import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const IMAGE = "nousresearch/hermes-agent:latest";
const AUTO_STOP_MINUTES = 60;
const HEALTH_TIMEOUT_MS = 300_000;
const HEALTH_POLL_INTERVAL_MS = 3_000;
const GATEWAY_PORT = 8642;
const DASHBOARD_PORT = 9119;

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
      image: IMAGE,
      ephemeral: true,
      autoStopInterval: AUTO_STOP_MINUTES,
      public: true,
      envVars: {
        [providerMapping.envVar]: config.llmApiKey,
        API_SERVER_ENABLED: "true",
        API_SERVER_CORS_ORIGINS: "*",
        GATEWAY_ALLOW_ALL_USERS: "true",
      },
      resources: { cpu: 2, memory: 4, disk: 8 },
    },
    { timeout: 300 },
  );
  activeSandbox = sandbox;

  onProgress("uploading");

  const configYaml = buildConfigYaml(config.llmModel, providerMapping.inferenceProvider);
  await sandbox.fs.uploadFile(
    Buffer.from(configYaml),
    "/opt/data/config.yaml",
  );

  const envContent = [
    `${providerMapping.envVar}=${config.llmApiKey}`,
    "API_SERVER_ENABLED=true",
    "API_SERVER_CORS_ORIGINS=*",
    "GATEWAY_ALLOW_ALL_USERS=true",
    "",
  ].join("\n");
  await sandbox.fs.uploadFile(
    Buffer.from(envContent),
    "/opt/data/.env",
  );

  for (const file of skillFiles) {
    const destPath = `/opt/data/skills/${skillName}/${file.path}`;
    await sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
  }

  await sandbox.process.executeCommand(
    "chown -R hermes:hermes /opt/data/skills /opt/data/config.yaml /opt/data/.env 2>/dev/null || true",
  ).catch(() => {});

  onProgress("starting");

  await sandbox.process.executeCommand(
    "cd /opt/hermes && nohup /opt/hermes/docker/entrypoint.sh gateway run > /tmp/hermes-gateway.log 2>&1 &",
  ).catch(() => {});

  await sandbox.process.executeCommand(
    "HERMES_HOME=/opt/data nohup /opt/hermes/.venv/bin/hermes dashboard --host 0.0.0.0 --no-open --insecure > /tmp/hermes-dashboard.log 2>&1 &",
  ).catch(() => {});

  await waitForHealth(sandbox);

  const preview = await sandbox.getPreviewLink(DASHBOARD_PORT);
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
