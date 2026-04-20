import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const SNAPSHOT_NAME = process.env.NEXT_PUBLIC_HERMES_SNAPSHOT || "hermes-ready";
const AUTO_STOP_MINUTES = 15;
const HEALTH_TIMEOUT_MS = 120_000; // 2 min (snapshot-based is much faster)
const HEALTH_POLL_INTERVAL_MS = 2_000;
const GATEWAY_PORT = 8642;
const WEBUI_PORT = 8787;

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

/**
 * Create a sandbox from the pre-baked "hermes-ready" snapshot.
 * This eliminates the ~2min install step — sandbox is ready in ~15s.
 *
 * Fallback: if snapshot is unavailable, falls back to cold-start install.
 */
export async function createHermesSandbox(
  config: SandboxConfig,
  skillName: string,
  skillFiles: SkillFile[],
  onProgress: (step: SandboxState, meta?: { usedSnapshot?: boolean }) => void,
): Promise<SandboxSession & { usedSnapshot: boolean }> {
  const { Daytona } = await getDaytonaSDK();

  const daytona = new Daytona({
    apiKey: config.daytonaApiKey,
    apiUrl: "https://app.daytona.io/api",
  });
  activeDaytona = daytona;

  const providerMapping = PROVIDER_ENV_MAP[config.llmProvider] || PROVIDER_ENV_MAP.openrouter;

  onProgress("creating");

  // Try snapshot-based fast path first
  let sandbox;
  let usedSnapshot = false;
  try {
    sandbox = await daytona.create(
      {
        snapshot: SNAPSHOT_NAME,
        ephemeral: true,
        autoStopInterval: AUTO_STOP_MINUTES,
        public: true,
        labels: { tryskills: "true" },
        envVars: {
          [providerMapping.envVar]: config.llmApiKey,
          API_SERVER_ENABLED: "true",
          API_SERVER_CORS_ORIGINS: "*",
          GATEWAY_ALLOW_ALL_USERS: "true",
        },
      },
      { timeout: 120 },
    );
    usedSnapshot = true;
  } catch {
    // Snapshot not available — fall back to default sandbox + cold install
    sandbox = await daytona.create(
      {
        ephemeral: true,
        autoStopInterval: AUTO_STOP_MINUTES,
        public: true,
        labels: { tryskills: "true" },
        envVars: {
          [providerMapping.envVar]: config.llmApiKey,
          API_SERVER_ENABLED: "true",
          API_SERVER_CORS_ORIGINS: "*",
          GATEWAY_ALLOW_ALL_USERS: "true",
        },
      } as unknown as Parameters<typeof daytona.create>[0],
      { timeout: 300 },
    );
  }
  activeSandbox = sandbox;

  if (usedSnapshot) {
    // Fast path: hermes-agent and webui are pre-installed at /opt/
    onProgress("configuring", { usedSnapshot: true });
    await sandbox.process.executeCommand([
      "mkdir -p /home/daytona/.hermes/skills /home/daytona/.hermes/logs",
      "ln -sfn /opt/hermes-agent /home/daytona/.hermes/hermes-agent",
      "mkdir -p /home/daytona/.local/bin",
      "ln -sf /opt/hermes-agent/venv/bin/hermes /home/daytona/.local/bin/hermes",
    ].join(" && ")).catch(() => {});
  } else {
    // Cold path: install from scratch (fallback)
    onProgress("installing", { usedSnapshot: false });
    await sandbox.process.executeCommand(
      "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup 2>&1 || true",
    ).catch(() => {});
    onProgress("configuring", { usedSnapshot: false });
  }

  // Write config files
  await sandbox.process.executeCommand(
    `mkdir -p /home/daytona/.hermes && cat > /home/daytona/.hermes/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
  ).catch(() => {});
  await sandbox.process.executeCommand(
    `cat > /home/daytona/.hermes/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
  ).catch(() => {});

  // Write webui .env
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

  // Upload skill files
  onProgress("uploading");
  for (const file of skillFiles) {
    const destPath = `/home/daytona/.hermes/skills/${skillName}/${file.path}`;
    const dir = destPath.substring(0, destPath.lastIndexOf("/"));
    await sandbox.process.executeCommand(`mkdir -p "${dir}"`).catch(() => {});
    await sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
  }

  // Start services
  onProgress("starting");

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

  const preview = await sandbox.getPreviewLink(WEBUI_PORT);
  const webuiUrl = preview.url + (preview.token ? `?token=${preview.token}` : "");

  return {
    sandboxId: sandbox.id,
    webuiUrl,
    state: "running",
    startedAt: Date.now(),
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    region: sandbox.target,
    usedSnapshot,
  };
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
  } catch {
    // best-effort cleanup
  }
}
