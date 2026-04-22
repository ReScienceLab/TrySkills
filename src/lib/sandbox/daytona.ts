import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const SNAPSHOT_NAME = process.env.NEXT_PUBLIC_HERMES_SNAPSHOT || "hermes-ready";
const HERMES_IMAGE = process.env.NEXT_PUBLIC_HERMES_IMAGE || "ghcr.io/resciencelab/hermes-ready:latest";
const AUTO_STOP_MINUTES = 30;
const AUTO_ARCHIVE_MINUTES = 60 * 24 * 2;
const AUTO_DELETE_MINUTES = 60 * 24 * 7;
const HEALTH_TIMEOUT_MS = 120_000;
const HEALTH_POLL_INTERVAL_MS = 500;
const GATEWAY_PORT = 8642;
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_FRESH_MS = 50 * 60 * 1000;
const COLD_RESOURCES = { cpu: 2, memory: 4, disk: 10 };
const HERMES_HOME = "/root/.hermes";

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
    "approvals:",
    "  mode: off",
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
    log("snapshot create failed, trying image fallback");
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const isSnapshotMissing = msg.includes("not found") || msg.includes("404") || msg.includes("unprocessable") || msg.includes("does not exist") || msg.includes("cannot specify");
    if (!isSnapshotMissing) throw err;

    try {
      sandbox = await daytona.create(
        {
          image: HERMES_IMAGE,
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
        },
        {
          timeout: 90,
          onSnapshotCreateLogs: (chunk) => console.log("[daytona] image build:", chunk),
        },
      );
      usedSnapshot = true;
    } catch (imageErr) {
      log("image fallback failed, trying bare create + curl install");
      // Final fallback: bare sandbox + curl install (works even if GHCR image not published yet)
      sandbox = await daytona.create(
        {
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
        } as unknown as Parameters<typeof daytona.create>[0],
        { timeout: 300 },
      );
      // usedSnapshot stays false -- needs curl install
    }
  }
  activeSandbox = sandbox;
  log(`sandbox created (snapshot=${usedSnapshot})`);

  if (usedSnapshot) {
    onProgress("configuring", { usedSnapshot: true });
    await sandbox.process.executeCommand([
      `mkdir -p ${HERMES_HOME}/skills ${HERMES_HOME}/logs`,
      `ln -sfn /opt/hermes-agent ${HERMES_HOME}/hermes-agent`,
      "mkdir -p /home/daytona/.local/bin",
      "ln -sf /opt/hermes-agent/venv/bin/hermes /home/daytona/.local/bin/hermes",
    ].join(" && ")).catch(() => {});
  } else {
    onProgress("installing", { usedSnapshot: false });
    log("starting curl install (final fallback)");
    await sandbox.process.executeCommand(
      "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup 2>&1 || true",
    ).catch(() => {});
    onProgress("configuring", { usedSnapshot: false });
  }

  await sandbox.process.executeCommand(
    `mkdir -p ${HERMES_HOME} && cat > ${HERMES_HOME}/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
  ).catch(() => {});
  await sandbox.process.executeCommand(
    `cat > ${HERMES_HOME}/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
  ).catch(() => {});

  const agentDir = usedSnapshot ? "/opt/hermes-agent" : `${HERMES_HOME}/hermes-agent`;

  if (!usedSnapshot) {
    await sandbox.process.executeCommand(
      "rm -rf /tmp/camoufox* /tmp/pip-* /root/.cache /home/daytona/.cache && pip cache purge 2>/dev/null || true",
    ).catch(() => {});
    log("disk cleanup done");
  }

  onProgress("uploading");
  log("uploading skill files");
  for (const file of skillFiles) {
    const destPath = `${HERMES_HOME}/skills/${sanitizeSkillDir(skillName)}/${file.path}`;
    const dir = destPath.substring(0, destPath.lastIndexOf("/"));
    await sandbox.process.executeCommand(`mkdir -p "${dir}"`).catch(() => {});
    await sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
  }

  onProgress("starting");
  log("skill files uploaded, starting gateway");

  const hermesCmd = `${agentDir}/venv/bin/hermes`;

  await sandbox.process.executeCommand(
    `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
  ).catch(() => {});

  await waitForHealth(sandbox);
  log("health check passed");

  const signedPreview = await sandbox.getSignedPreviewUrl(GATEWAY_PORT, SIGNED_URL_TTL_SECONDS);
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

      const hermesCmd = `$(test -f /opt/hermes-agent/venv/bin/hermes && echo /opt/hermes-agent/venv/bin/hermes || echo ${HERMES_HOME}/hermes-agent/venv/bin/hermes)`;

      await sandbox.process.executeCommand(
        `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
      ).catch(() => {});
      log("gateway restarted");
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
    const destPath = `${HERMES_HOME}/skills/${sanitizeSkillDir(skillName)}/${f.path}`;
    return destPath.substring(0, destPath.lastIndexOf("/"));
  }))];

  const setupTasks: Promise<unknown>[] = [];
  if (!options?.skipConfigWrite) {
    setupTasks.push(
      sandbox.process.executeCommand(
        `mkdir -p ${HERMES_HOME} && cat > ${HERMES_HOME}/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
      ).catch(() => {}),
      sandbox.process.executeCommand(
        `cat > ${HERMES_HOME}/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
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
      const destPath = `${HERMES_HOME}/skills/${sanitizeSkillDir(skillName)}/${file.path}`;
      return sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
    }),
  );
  log("files uploaded");

  // Always verify gateway is alive before returning
  await waitForHealth(sandbox);
  log("health check passed");

  // Reuse existing signed URL if still fresh
  const urlAge = options?.webuiUrlCreatedAt ? Date.now() - options.webuiUrlCreatedAt : Infinity;
  let webuiUrl: string;
  let urlRefreshed = false;
  if (options?.existingWebuiUrl && urlAge < SIGNED_URL_FRESH_MS) {
    webuiUrl = options.existingWebuiUrl;
    log("reused existing signed URL");
  } else {
    const signedPreview = await sandbox.getSignedPreviewUrl(GATEWAY_PORT, SIGNED_URL_TTL_SECONDS);
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
  const healthCmd = `curl -sf http://localhost:${GATEWAY_PORT}/health 2>/dev/null`;
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      const result = await sandbox.process.executeCommand(healthCmd);
      if (result.exitCode === 0) return;
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
