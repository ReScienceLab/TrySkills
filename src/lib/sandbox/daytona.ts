import type { SandboxConfig, SandboxSession, SandboxState } from "./types";

const IMAGE = "ghcr.io/resciencelab/tryskills-hermes:0.1.0";
const AUTO_STOP_MINUTES = 60;
const HEALTH_TIMEOUT_MS = 300_000;
const HEALTH_POLL_INTERVAL_MS = 3_000;

export interface SkillFile {
  path: string;
  content: string;
}

const PROVIDER_ENV_MAP: Record<string, string> = {
  openrouter: "OPENROUTER",
  anthropic: "ANTHROPIC",
  openai: "OPENAI",
  google: "GOOGLE",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDaytona: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeSandbox: any = null;

async function getDaytonaSDK() {
  const { Daytona } = await import("@daytona/sdk");
  return { Daytona };
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

  const providerEnv = PROVIDER_ENV_MAP[config.llmProvider] || "OPENROUTER";

  onProgress("creating");
  const sandbox = await daytona.create(
    {
      image: IMAGE,
      ephemeral: true,
      autoStopInterval: AUTO_STOP_MINUTES,
      public: true,
      envVars: {
        LLM_PROVIDER: providerEnv,
        LLM_API_KEY: config.llmApiKey,
        LLM_MODEL: config.llmModel,
      },
      resources: { cpu: 2, memory: 4, disk: 8 },
    },
    { timeout: 300 },
  );
  activeSandbox = sandbox;

  onProgress("uploading");
  for (const file of skillFiles) {
    const destPath = `/root/.hermes/skills/${skillName}/${file.path}`;
    await sandbox.fs.uploadFile(Buffer.from(file.content), destPath);
  }

  onProgress("starting");
  await waitForHealth(sandbox);

  const preview = await sandbox.getPreviewLink(8787);
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
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      const result = await sandbox.process.executeCommand(
        "curl -sf http://localhost:8642/health",
      );
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
