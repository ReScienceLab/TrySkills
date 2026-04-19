import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const AUTO_STOP_MINUTES = 60;
const HEALTH_TIMEOUT_MS = 300_000;
const HEALTH_POLL_INTERVAL_MS = 5_000;
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

function buildWebuiEnv(): string {
  return [
    "HERMES_WEBUI_AGENT_DIR=$HOME/.hermes/hermes-agent",
    "HERMES_WEBUI_PYTHON=$HOME/.hermes/hermes-agent/venv/bin/python3",
    "HERMES_WEBUI_HOST=0.0.0.0",
    `HERMES_WEBUI_PORT=${WEBUI_PORT}`,
    "HERMES_HOME=$HOME/.hermes",
    "",
  ].join("\n");
}

export async function createHermesSandbox(
  config: SandboxConfig,
  skillName: string,
  skillFiles: SkillFile[],
  onProgress: (step: SandboxState) => void,
): Promise<SandboxSession> {
  const { Daytona } = await getDaytonaSDK();

  const daytona = new Daytona({
    apiKey: config.daytonaApiKey,
    apiUrl: "https://app.daytona.io/api",
  });
  activeDaytona = daytona;

  const providerMapping = PROVIDER_ENV_MAP[config.llmProvider] || PROVIDER_ENV_MAP.openrouter;

  onProgress("creating");
  const sandbox = await daytona.create(
    {
      ephemeral: true,
      autoStopInterval: AUTO_STOP_MINUTES,
      public: true,
      envVars: {
        [providerMapping.envVar]: config.llmApiKey,
        API_SERVER_ENABLED: "true",
        API_SERVER_CORS_ORIGINS: "*",
        GATEWAY_ALLOW_ALL_USERS: "true",
      },
    } as unknown as Parameters<typeof daytona.create>[0],
    { timeout: 300 },
  );
  activeSandbox = sandbox;

  onProgress("uploading");

  const installScript = [
    "set -e",
    // Install hermes-agent
    "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash 2>&1 || true",
    // Write config
    `cat > $HOME/.hermes/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey)}\nENVEOF`,
    `cat > $HOME/.hermes/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.inferenceProvider)}\nCFGEOF`,
    // Clone hermes-webui
    "git clone --depth 1 https://github.com/nesquena/hermes-webui.git $HOME/hermes-webui 2>&1",
    `cat > $HOME/hermes-webui/.env << 'WEOF'\n${buildWebuiEnv()}\nWEOF`,
  ].join("\n");

  await sandbox.process.executeCommand(installScript).catch(() => {});

  for (const file of skillFiles) {
    const destPath = `$HOME/.hermes/skills/${skillName}/${file.path}`;
    const dir = destPath.substring(0, destPath.lastIndexOf("/"));
    await sandbox.process.executeCommand(`mkdir -p "${dir}"`).catch(() => {});
    await sandbox.fs.uploadFile(Buffer.from(file.content), `/home/daytona/.hermes/skills/${skillName}/${file.path}`);
  }

  onProgress("starting");

  await sandbox.process.executeCommand(
    "export PATH=$HOME/.local/bin:$PATH && nohup hermes gateway run > /tmp/hermes-gateway.log 2>&1 &",
  ).catch(() => {});

  await sandbox.process.executeCommand(
    [
      "cd $HOME/hermes-webui",
      "export HERMES_WEBUI_AGENT_DIR=$HOME/.hermes/hermes-agent",
      "export HERMES_WEBUI_PYTHON=$HOME/.hermes/hermes-agent/venv/bin/python3",
      "export HERMES_WEBUI_HOST=0.0.0.0",
      `export HERMES_WEBUI_PORT=${WEBUI_PORT}`,
      "export HERMES_HOME=$HOME/.hermes",
      `nohup $HOME/.hermes/hermes-agent/venv/bin/python3 server.py > /tmp/hermes-webui.log 2>&1 &`,
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForHealth(sandbox: any): Promise<void> {
  const start = Date.now();
  const healthCmd = `python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:${GATEWAY_PORT}/health')"`;
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      const result = await sandbox.process.executeCommand(healthCmd);
      if (result.exitCode === 0) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  throw new Error("Sandbox health check timed out after 5 minutes");
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
