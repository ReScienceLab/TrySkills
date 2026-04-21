import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const SNAPSHOT_NAME = process.env.NEXT_PUBLIC_HERMES_SNAPSHOT || "hermes-ready";
const AUTO_STOP_MINUTES = 30;
const AUTO_ARCHIVE_MINUTES = 60 * 24 * 2; // 2 days
const AUTO_DELETE_MINUTES = 60 * 24 * 7; // 7 days
const HEALTH_TIMEOUT_MS = 120_000;
const HEALTH_POLL_INTERVAL_MS = 500;
const GATEWAY_PORT = 8642;
const WEBUI_PORT = 8787;
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_FRESH_MS = 50 * 60 * 1000;
const COLD_RESOURCES = { cpu: 2, memory: 4, disk: 10 };

export interface SkillFile {
  path: string;
  content: string;
}

const PROVIDER_ENV_MAP: Record<string, { envVar: string; inferenceProvider: string }> = {
  openrouter: { envVar: "OPENROUTER_API_KEY", inferenceProvider: "openrouter" },
  anthropic: { envVar: "ANTHROPIC_API_KEY", inferenceProvider: "anthropic" },
  openai: { envVar: "OPENAI_API_KEY", inferenceProvider: "openrouter" },
  google: { envVar: "GOOGLE_API_KEY", inferenceProvider: "gemini" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDaytona: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeSandbox: any = null;

async function getDaytonaSDK() {
  const { Daytona } = await import("@daytona/sdk");
  return { Daytona };
}

function buildConfigYaml(model: string, inferenceProvider: string): string {
  return [
    "model:",
    `  default: "${model}"`,
    `  inference_provider: "${inferenceProvider}"`,
    "",
    "terminal:",
    "  backend: local",
    "",
    "compression:",
    "  enabled: true",
    "  threshold: 0.50",
  ].join("\n");
}

function buildEnvFile(providerEnvVar: string, apiKey: string): string {
  return [
    `${providerEnvVar}=${apiKey}`,
    "API_SERVER_ENABLED=true",
    "API_SERVER_CORS_ORIGINS=*",
    "GATEWAY_ALLOW_ALL_USERS=true",
    "",
  ].join("\n");
}

function buildWebuiEnv(agentDir: string): string {
  return [
    `HERMES_WEBUI_AGENT_DIR=${agentDir}`,
    `HERMES_WEBUI_PYTHON=${agentDir}/venv/bin/python3`,
    "HERMES_WEBUI_HOST=0.0.0.0",
    `HERMES_WEBUI_PORT=${WEBUI_PORT}`,
    "HERMES_HOME=/home/daytona/.hermes",
    "",
  ].join("\n");
}

const BASE_ALLOWED_ORIGINS = "https://tryskills.sh,https://www.tryskills.sh";

/**
 * Create a sandbox from the pre-baked "hermes-ready" snapshot.
 * This eliminates the ~2min install step — sandbox is ready in ~15s.
 *
 * Fallback: if snapshot is unavailable, falls back to cold-start install.
 */
function sanitizeSkillDir(skillName: string): string {
  return skillName.replace(/\//g, "--");
}

export async function createHermesSandbox(
  config: SandboxConfig,
  skillName: string,
  skillFiles: SkillFile[],
  onProgress: (step: SandboxState, meta?: { usedSnapshot?: boolean }) => void,
  userId?: string,
  callerOrigin?: string,
): Promise<SandboxSession & { usedSnapshot: boolean }> {
  const t0 = Date.now();
  const log = (label: string) => console.log(`[daytona] createHermesSandbox ${label}: ${Date.now() - t0}ms`);

  const { Daytona } = await getDaytonaSDK();
  log("SDK loaded");

  const daytona = new Daytona({
    apiKey: config.daytonaApiKey,
    apiUrl: "https://app.daytona.io/api",
  });
  activeDaytona = daytona;

  const providerMapping = PROVIDER_ENV_MAP[config.llmProvider] || PROVIDER_ENV_MAP.openrouter;

  onProgress("creating");

  const labels: Record<string, string> = { tryskills: "true" };
  if (userId) labels.userId = userId;

  let sandbox;
  let usedSnapshot = false;
  try {
    sandbox = await daytona.create(
      {
        snapshot: SNAPSHOT_NAME,
        autoStopInterval: AUTO_STOP_MINUTES,
        autoArchiveInterval: AUTO_ARCHIVE_MINUTES,
        autoDeleteInterval: AUTO_DELETE_MINUTES,
        public: true,
        labels,
        envVars: {
          [providerMapping.envVar]: config.llmApiKey,
          API_SERVER_ENABLED: "true",
          API_SERVER_CORS_ORIGINS: "*",
          GATEWAY_ALLOW_ALL_USERS: "true",
          HERMES_WEBUI_ALLOWED_ORIGINS: callerOrigin
            ? `${BASE_ALLOWED_ORIGINS},${callerOrigin}`
            : BASE_ALLOWED_ORIGINS,
        },
      },
      { timeout: 120 },
    );
    usedSnapshot = true;
  } catch (err) {
    log("snapshot create failed, trying fallback");
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const isSnapshotMissing = msg.includes("not found") || msg.includes("404") || msg.includes("unprocessable") || msg.includes("does not exist");
    if (!isSnapshotMissing) throw err;

    sandbox = await daytona.create(
      {
        autoStopInterval: AUTO_STOP_MINUTES,
        autoArchiveInterval: AUTO_ARCHIVE_MINUTES,
        autoDeleteInterval: AUTO_DELETE_MINUTES,
        public: true,
        labels,
        resources: COLD_RESOURCES,
        envVars: {
          [providerMapping.envVar]: config.llmApiKey,
          API_SERVER_ENABLED: "true",
          API_SERVER_CORS_ORIGINS: "*",
          GATEWAY_ALLOW_ALL_USERS: "true",
          HERMES_WEBUI_ALLOWED_ORIGINS: callerOrigin
            ? `${BASE_ALLOWED_ORIGINS},${callerOrigin}`
            : BASE_ALLOWED_ORIGINS,
        },
      } as unknown as Parameters<typeof daytona.create>[0],
      { timeout: 300 },
    );
  }
  activeSandbox = sandbox;
  log(`sandbox created (snapshot=${usedSnapshot})`);

  if (usedSnapshot) {
    onProgress("configuring", { usedSnapshot: true });
    await sandbox.process.executeCommand([
      "mkdir -p /home/daytona/.hermes/skills /home/daytona/.hermes/logs",
      "ln -sfn /opt/hermes-agent /home/daytona/.hermes/hermes-agent",
      "mkdir -p /home/daytona/.local/bin",
      "ln -sf /opt/hermes-agent/venv/bin/hermes /home/daytona/.local/bin/hermes",
    ].join(" && ")).catch(() => {});
  } else {
    onProgress("installing", { usedSnapshot: false });
    log("starting cold install");
    await sandbox.process.executeCommand(
      "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup 2>&1 || true",
    ).catch(() => {});
    onProgress("configuring", { usedSnapshot: false });
  }

  await sandbox.process.executeCommand(
    `mkdir -p /home/daytona/.hermes && cat > /home/daytona/.hermes/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
  ).catch(() => {});
  await sandbox.process.executeCommand(
    `cat > /home/daytona/.hermes/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
  ).catch(() => {});

  const agentDir = usedSnapshot ? "/opt/hermes-agent" : "/home/daytona/.hermes/hermes-agent";
  const webuiDir = usedSnapshot ? "/opt/hermes-webui" : "/home/daytona/hermes-webui";
  if (!usedSnapshot) {
    await sandbox.process.executeCommand(
      "git clone --depth 1 https://github.com/nesquena/hermes-webui.git /home/daytona/hermes-webui 2>&1",
    ).catch(() => {});
  }
  await sandbox.process.executeCommand(
    `cat > ${webuiDir}/.env << 'WEOF'\n${buildWebuiEnv(agentDir)}\nWEOF`,
  ).catch(() => {});
  log("config written");

  // Clean up disk space after cold install (venv cache, tmp downloads)
  if (!usedSnapshot) {
    await sandbox.process.executeCommand(
      "rm -rf /tmp/camoufox* /tmp/pip-* /root/.cache /home/daytona/.cache && pip cache purge 2>/dev/null || true",
    ).catch(() => {});
    log("disk cleanup done");
  }

  onProgress("uploading");
  log("uploading skill files");
  for (const file of skillFiles) {
    const destPath = `/home/daytona/.hermes/skills/${sanitizeSkillDir(skillName)}/${file.path}`;
    const dir = destPath.substring(0, destPath.lastIndexOf("/"));
    await sandbox.process.executeCommand(`mkdir -p "${dir}"`).catch(() => {});
    await sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
  }

  onProgress("starting");
  log("skill files uploaded, starting gateway + webui");

  const hermesCmd = `${agentDir}/venv/bin/hermes`;
  const pythonCmd = `${agentDir}/venv/bin/python3`;

  await sandbox.process.executeCommand(
    `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
  ).catch(() => {});

  await sandbox.process.executeCommand(
    [
      `cd ${webuiDir}`,
      `export HERMES_WEBUI_AGENT_DIR=${agentDir}`,
      `export HERMES_WEBUI_PYTHON=${pythonCmd}`,
      "export HERMES_WEBUI_HOST=0.0.0.0",
      `export HERMES_WEBUI_PORT=${WEBUI_PORT}`,
      "export HERMES_HOME=/home/daytona/.hermes",
      `nohup ${pythonCmd} server.py > /tmp/hermes-webui.log 2>&1 &`,
    ].join(" && "),
  ).catch(() => {});

  await waitForHealth(sandbox);
  log("health check passed");

  const signedPreview = await sandbox.getSignedPreviewUrl(WEBUI_PORT, SIGNED_URL_TTL_SECONDS);
  log("signed URL obtained");
  console.log("[daytona] createHermesSandbox signedPreview URL:", signedPreview.url);
  const webuiUrl = signedPreview.url;

  return {
    sandboxId: sandbox.id,
    webuiUrl,
    webuiBaseUrl: webuiUrl,
    state: "running",
    startedAt: Date.now(),
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    region: sandbox.target,
    usedSnapshot,
  };
}

/**
 * Install a skill into an existing sandbox.
 * Starts the sandbox if stopped, uploads skill files (additive, no cleanup),
 * and returns a fresh signed preview URL.
 * Skills accumulate on disk -- Hermes loads the requested skill per-session.
 */
export async function installSkill(
  config: SandboxConfig,
  sandboxId: string,
  skillName: string,
  skillFiles: SkillFile[],
  onProgress: (step: SandboxState) => void,
  options?: {
    skipConfigWrite?: boolean;
    skipHealthCheck?: boolean;
    existingWebuiUrl?: string;
    webuiUrlCreatedAt?: number;
  },
): Promise<SandboxSession> {
  const t0 = Date.now();
  const log = (label: string) => console.log(`[daytona] installSkill ${label}: ${Date.now() - t0}ms`);

  const { Daytona } = await getDaytonaSDK();
  log("SDK loaded");
  const daytona = new Daytona({
    apiKey: config.daytonaApiKey,
    apiUrl: "https://app.daytona.io/api",
  });

  const sandbox = await daytona.get(sandboxId);
  log("sandbox fetched");
  activeDaytona = daytona;
  activeSandbox = sandbox;

  let wasStopped = false;
  if (sandbox.state !== "started") {
    if (sandbox.state === "stopped") {
      onProgress("starting");
      wasStopped = true;
      await daytona.start(sandbox, 60);
      log("sandbox started from stopped");

      const agentDir = "/opt/hermes-agent";
      const webuiDir = "/opt/hermes-webui";
      const hermesCmd = `${agentDir}/venv/bin/hermes`;
      const pythonCmd = `${agentDir}/venv/bin/python3`;

      await Promise.all([
        sandbox.process.executeCommand(
          `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
        ).catch(() => {}),
        sandbox.process.executeCommand(
          [
            `cd ${webuiDir}`,
            `export HERMES_WEBUI_AGENT_DIR=${agentDir}`,
            `export HERMES_WEBUI_PYTHON=${pythonCmd}`,
            "export HERMES_WEBUI_HOST=0.0.0.0",
            `export HERMES_WEBUI_PORT=${WEBUI_PORT}`,
            "export HERMES_HOME=/home/daytona/.hermes",
            `nohup ${pythonCmd} server.py > /tmp/hermes-webui.log 2>&1 &`,
          ].join(" && "),
        ).catch(() => {}),
      ]);
      log("gateway + webui restarted");
    } else {
      throw new Error(`Sandbox in unexpected state: ${sandbox.state}`);
    }
  }
  log(`sandbox ready (state=${sandbox.state})`);

  const providerMapping = PROVIDER_ENV_MAP[config.llmProvider] || PROVIDER_ENV_MAP.openrouter;

  onProgress("uploading");
  log(`uploading (skipConfig=${!!options?.skipConfigWrite}, files=${skillFiles.length})`);

  // Batch ALL mkdir into one command, then parallel uploads
  const allDirs = [...new Set(skillFiles.map((f) => {
    const destPath = `/home/daytona/.hermes/skills/${sanitizeSkillDir(skillName)}/${f.path}`;
    return destPath.substring(0, destPath.lastIndexOf("/"));
  }))];

  const setupTasks: Promise<unknown>[] = [];
  if (!options?.skipConfigWrite) {
    setupTasks.push(
      sandbox.process.executeCommand(
        `mkdir -p /home/daytona/.hermes && cat > /home/daytona/.hermes/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
      ).catch(() => {}),
      sandbox.process.executeCommand(
        `cat > /home/daytona/.hermes/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
      ).catch(() => {}),
    );
  }
  // One mkdir for ALL directories (batched)
  if (allDirs.length > 0) {
    setupTasks.push(
      sandbox.process.executeCommand(`mkdir -p ${allDirs.map((d) => `"${d}"`).join(" ")}`).catch(() => {}),
    );
  }
  await Promise.all(setupTasks);
  log("setup done (mkdir + config)");

  // Pure parallel file uploads (no per-file mkdir)
  await Promise.all(
    skillFiles.map((file) => {
      const destPath = `/home/daytona/.hermes/skills/${sanitizeSkillDir(skillName)}/${file.path}`;
      return sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
    }),
  );
  log("files uploaded");

  // Health check: only when waking from stopped
  if (wasStopped || !options?.skipHealthCheck) {
    await waitForHealth(sandbox);
    log("health check passed");
  } else {
    log("health check skipped");
  }

  // Reuse existing signed URL if still fresh
  const urlAge = options?.webuiUrlCreatedAt ? Date.now() - options.webuiUrlCreatedAt : Infinity;
  let webuiUrl: string;
  let urlRefreshed = false;
  if (options?.existingWebuiUrl && urlAge < SIGNED_URL_FRESH_MS) {
    webuiUrl = options.existingWebuiUrl;
    log("reused existing signed URL");
  } else {
    const signedPreview = await sandbox.getSignedPreviewUrl(WEBUI_PORT, SIGNED_URL_TTL_SECONDS);
    webuiUrl = signedPreview.url;
    urlRefreshed = true;
    log("new signed URL obtained");
  }

  return {
    sandboxId: sandbox.id,
    webuiUrl,
    webuiBaseUrl: webuiUrl,
    urlRefreshed,
    state: "running",
    startedAt: Date.now(),
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    region: sandbox.target,
  };
}

/**
 * Find an existing reusable sandbox for the given user via Daytona labels.
 */
export async function findReusableSandbox(
  daytonaApiKey: string,
  userId: string,
): Promise<{ sandboxId: string; state: string } | null> {
  const { Daytona } = await getDaytonaSDK();
  const daytona = new Daytona({
    apiKey: daytonaApiKey,
    apiUrl: "https://app.daytona.io/api",
  });

  try {
    const result = await daytona.list({ tryskills: "true", userId });
    const reusable = result.items.find(
      (s) => s.state === "started" || s.state === "stopped",
    );
    if (!reusable) return null;
    return { sandboxId: reusable.id, state: reusable.state ?? "unknown" };
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForHealth(sandbox: any): Promise<void> {
  const start = Date.now();
  const gatewayCmd = `curl -sf http://localhost:${GATEWAY_PORT}/health 2>/dev/null`;
  let gatewayReady = false;
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      if (!gatewayReady) {
        const r = await sandbox.process.executeCommand(gatewayCmd);
        if (r.exitCode === 0) gatewayReady = true;
      }
      if (gatewayReady) {
        const r2 = await sandbox.process.executeCommand(
          `curl -sf -o /dev/null http://localhost:${WEBUI_PORT}/ 2>/dev/null`,
        );
        if (r2.exitCode === 0) return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  throw new Error("Sandbox health check timed out");
}

export async function destroySandbox(
  daytonaApiKey: string,
  sandboxId: string,
): Promise<void> {
  try {
    if (activeDaytona && activeSandbox && activeSandbox.id === sandboxId) {
      await activeDaytona.delete(activeSandbox);
      activeDaytona = null;
      activeSandbox = null;
      return;
    }
    const { Daytona } = await getDaytonaSDK();
    const daytona = new Daytona({
      apiKey: daytonaApiKey,
      apiUrl: "https://app.daytona.io/api",
    });
    const sandbox = await daytona.get(sandboxId);
    await daytona.delete(sandbox);
  } catch (err) {
    // Re-throw so callers can decide whether to keep the dashboard record
    throw err;
  }
}
