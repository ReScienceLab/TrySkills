import type { SandboxConfig, SandboxSession, SandboxState } from "./types";
import { getProviderData } from "@/lib/providers/provider-data";
import { fetchSkillDirectory, type ResolvedSkill } from "@/lib/skill/resolver";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function discoverSkillsOnDisk(sandbox: any): Promise<string[]> {
  try {
    const result = await sandbox.process.executeCommand(
      `for d in ${HERMES_HOME}/skills/*/; do [ -f "$d/SKILL.md" ] && basename "$d"; done 2>/dev/null || true`,
    )
    const output = (result.result?.output ?? result.output ?? "").trim()
    if (!output) return []
    return output
      .split("\n")
      .filter((s: string) => s.trim())
      .map((s: string) => {
        const name = s.trim()
        if (!name.includes("--")) return name
        // Reverse sanitizeSkillDir: owner--repo--skill -> owner/repo/skill
        // Only apply if result looks like a valid TrySkills path (3+ segments)
        const decoded = name.replace(/--/g, "/")
        const segments = decoded.split("/")
        return segments.length >= 3 ? decoded : name
      })
  } catch {
    return []
  }
}

export interface SkillSource {
  owner: string
  repo: string
  skillName: string
}

export interface SkillFile {
  path: string;
  content: string;
}

function resolveProviderMapping(llmProvider: string) {
  const provider = getProviderData(llmProvider);
  const envVar = provider?.hermesProvider === "custom"
    ? "OPENAI_API_KEY"
    : provider?.envVar ?? "OPENROUTER_API_KEY";
  const hermesProvider = provider?.hermesProvider ?? "openrouter";
  const baseUrl = provider?.baseUrl;
  return { envVar, hermesProvider, baseUrl };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDaytona: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeSandbox: any = null;

async function getDaytonaSDK() {
  const { Daytona } = await import("@daytona/sdk");
  return { Daytona };
}

function buildConfigYaml(model: string, provider: string, baseUrl?: string): string {
  const lines = [
    "model:",
    `  default: "${model}"`,
    `  provider: "${provider}"`,
  ];
  if (baseUrl) {
    lines.push(`  base_url: "${baseUrl}"`);
  }
  lines.push(
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
  );
  return lines.join("\n");
}

const RESERVED_ENV_KEYS = new Set([
  "API_SERVER_ENABLED",
  "API_SERVER_CORS_ORIGINS",
  "GATEWAY_ALLOW_ALL_USERS",
])

function sanitizeExtraEnvVars(
  extraEnvVars: Record<string, string> | undefined,
  providerEnvVar: string,
): Record<string, string> {
  if (!extraEnvVars) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(extraEnvVars)) {
    if (key !== providerEnvVar && !RESERVED_ENV_KEYS.has(key)) {
      result[key] = value
    }
  }
  return result
}

function buildEnvFile(providerEnvVar: string, apiKey: string, extraEnvVars?: Record<string, string>): string {
  const lines = [
    `${providerEnvVar}=${apiKey}`,
    "API_SERVER_ENABLED=true",
    "API_SERVER_CORS_ORIGINS=*",
    "GATEWAY_ALLOW_ALL_USERS=true",
  ]
  const safe = sanitizeExtraEnvVars(extraEnvVars, providerEnvVar)
  for (const [key, value] of Object.entries(safe)) {
    lines.push(`${key}=${value}`)
  }
  lines.push("")
  return lines.join("\n")
}

/**
 * Create a sandbox from the pre-baked "hermes-ready" snapshot.
 * This eliminates the ~2min install step — sandbox is ready in ~15s.
 *
 * Fallback: if snapshot is unavailable, falls back to cold-start install.
 */
function sanitizeSkillDir(skillName: string): string {
  return skillName.replace(/\//g, "--");
}

const SAFE_SHELL_SEGMENT = /^[a-zA-Z0-9_.\-\/]+$/

function shellSafe(value: string): string | null {
  if (!value || !SAFE_SHELL_SEGMENT.test(value)) return null
  return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cloneSkillOnSandbox(
  sandbox: any,
  source: SkillSource,
  destDir: string,
  log: (label: string) => void,
): Promise<boolean> {
  const owner = shellSafe(source.owner)
  const repo = shellSafe(source.repo)
  const skill = shellSafe(source.skillName)
  const safeDest = shellSafe(destDir)
  if (!owner || !repo || !skill || !safeDest) {
    log("cloneSkill skipped: unsafe characters in source")
    return false
  }

  const candidates = [
    skill,
    `skills/${skill}`,
    `${repo}/${skill}`,
    `.agents/skills/${skill}`,
    `.claude/skills/${skill}`,
    `plugin/skills/${skill}`,
    `plugins/${owner}/skills/${skill}`,
  ]
  const candidateChecks = candidates.map((c) => `[ -f "$TMP/${c}/SKILL.md" -o -f "$TMP/${c}/skill.md" ] && echo "${c}"`).join("\n")

  const script = `set -e
DEST="${HERMES_HOME}/skills/${safeDest}"
REPO="https://github.com/${owner}/${repo}.git"
TMP=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse "$REPO" "$TMP" 2>/dev/null
cd "$TMP"
git sparse-checkout set ${candidates.map((c) => `"${c}"`).join(" ")} 2>/dev/null || true
FOUND=$(
${candidateChecks}
)
FOUND=$(echo "$FOUND" | head -1)
if [ -z "$FOUND" ]; then
  rm -rf "$TMP"
  exit 1
fi
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$TMP/$FOUND"/. "$DEST/"
rm -rf "$TMP"
exit 0`

  try {
    const result = await sandbox.process.executeCommand(script)
    const ok = result.exitCode === 0
    log(`cloneSkill ${ok ? "succeeded" : "failed"} (dest=${destDir})`)
    return ok
  } catch {
    log("cloneSkill threw exception")
    return false
  }
}

export async function createHermesSandbox(
  config: SandboxConfig,
  skillName: string,
  skillSource: SkillSource,
  resolved: ResolvedSkill,
  onProgress: (step: SandboxState, meta?: { usedSnapshot?: boolean }) => void,
  userId?: string,
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

  const providerMapping = resolveProviderMapping(config.llmProvider);
  const safeExtra = sanitizeExtraEnvVars(config.envVars, providerMapping.envVar);

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
          ...safeExtra,
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
            ...safeExtra,
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
            ...safeExtra,
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
    `mkdir -p ${HERMES_HOME} && cat > ${HERMES_HOME}/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey, config.envVars)}\nENVEOF`,
  ).catch(() => {});
  await sandbox.process.executeCommand(
    `cat > ${HERMES_HOME}/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.hermesProvider, providerMapping.baseUrl)}\nCFGEOF`,
  ).catch(() => {});

  const agentDir = usedSnapshot ? "/opt/hermes-agent" : `${HERMES_HOME}/hermes-agent`;

  if (!usedSnapshot) {
    await sandbox.process.executeCommand(
      "rm -rf /tmp/camoufox* /tmp/pip-* /root/.cache /home/daytona/.cache && pip cache purge 2>/dev/null || true",
    ).catch(() => {});
    log("disk cleanup done");
  }

  onProgress("uploading");
  const destDir = sanitizeSkillDir(skillName)
  const cloned = await cloneSkillOnSandbox(sandbox, skillSource, destDir, log)
  if (!cloned) {
    log("clone failed, falling back to browser fetch + upload")
    const skillFiles = await fetchSkillDirectory(resolved)
    for (const file of skillFiles) {
      const destPath = `${HERMES_HOME}/skills/${destDir}/${file.path}`
      const dir = destPath.substring(0, destPath.lastIndexOf("/"))
      await sandbox.process.executeCommand(`mkdir -p "${dir}"`).catch(() => {})
      await sandbox.fs.uploadFile(Buffer.from(file.content), destPath)
    }
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
  const gatewayUrl = signedPreview.url;

  const discoveredSkills = await discoverSkillsOnDisk(sandbox);
  log(`discovered ${discoveredSkills.length} skills on disk`);

  return {
    sandboxId: sandbox.id,
    gatewayUrl,
    gatewayBaseUrl: gatewayUrl,
    state: "running",
    startedAt: Date.now(),
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    region: sandbox.target,
    usedSnapshot,
    discoveredSkills,
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
  skillSource: SkillSource,
  resolved: ResolvedSkill,
  onProgress: (step: SandboxState) => void,
  options?: {
    skipConfigWrite?: boolean;
    existingGatewayUrl?: string;
    gatewayUrlCreatedAt?: number;
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
      // Config files are written below before starting the gateway
    } else {
      throw new Error(`Sandbox in unexpected state: ${sandbox.state}`);
    }
  }
  log(`sandbox ready (state=${sandbox.state})`);

  const providerMapping = resolveProviderMapping(config.llmProvider);

  onProgress("uploading");
  log(`installing (skipConfig=${!!options?.skipConfigWrite})`)

  const setupTasks: Promise<unknown>[] = [];
  if (!options?.skipConfigWrite) {
    setupTasks.push(
      sandbox.process.executeCommand(
        `mkdir -p ${HERMES_HOME} && cat > ${HERMES_HOME}/.env << 'ENVEOF'\n${buildEnvFile(providerMapping.envVar, config.llmApiKey, config.envVars)}\nENVEOF`,
      ).catch(() => {}),
      sandbox.process.executeCommand(
        `cat > ${HERMES_HOME}/config.yaml << 'CFGEOF'\n${buildConfigYaml(config.llmModel, providerMapping.hermesProvider, providerMapping.baseUrl)}\nCFGEOF`,
      ).catch(() => {}),
    );
  }
  await Promise.all(setupTasks);
  log("config done");

  const destDir = sanitizeSkillDir(skillName)
  const cloned = await cloneSkillOnSandbox(sandbox, skillSource, destDir, log)
  if (!cloned) {
    log("clone failed, falling back to browser fetch + upload")
    const skillFiles = await fetchSkillDirectory(resolved)
    const allDirs = [...new Set(skillFiles.map((f) => {
      const destPath = `${HERMES_HOME}/skills/${destDir}/${f.path}`
      return destPath.substring(0, destPath.lastIndexOf("/"))
    }))]
    if (allDirs.length > 0) {
      await sandbox.process.executeCommand(`mkdir -p ${allDirs.map((d) => `"${d}"`).join(" ")}`).catch(() => {})
    }
    await Promise.all(
      skillFiles.map((file) => {
        const destPath = `${HERMES_HOME}/skills/${destDir}/${file.path}`
        return sandbox.fs.uploadFile(Buffer.from(file.content), destPath)
      }),
    )
  }
  log("skill installed");

  const hermesCmd = `$(test -f /opt/hermes-agent/venv/bin/hermes && echo /opt/hermes-agent/venv/bin/hermes || echo ${HERMES_HOME}/hermes-agent/venv/bin/hermes)`;

  // Start or restart the gateway so it picks up current config
  if (wasStopped) {
    // Stopped sandbox: gateway not running, just start it
    await sandbox.process.executeCommand(
      `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
    ).catch(() => {});
    log("gateway started after wake");
  } else if (!options?.skipConfigWrite) {
    // Running sandbox with config changes: gracefully restart gateway
    await sandbox.process.executeCommand(
      `pkill -f "hermes.*gateway" 2>/dev/null || true`,
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
    await sandbox.process.executeCommand(
      `nohup ${hermesCmd} gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown`,
    ).catch(() => {});
    log("gateway restarted after config write");
  }

  // Always verify gateway is alive before returning
  await waitForHealth(sandbox);
  log("health check passed");

  // Reuse existing signed URL if still fresh
  const urlAge = options?.gatewayUrlCreatedAt ? Date.now() - options.gatewayUrlCreatedAt : Infinity;
  let gatewayUrl: string;
  let urlRefreshed = false;
  if (options?.existingGatewayUrl && urlAge < SIGNED_URL_FRESH_MS) {
    gatewayUrl = options.existingGatewayUrl;
    log("reused existing signed URL");
  } else {
    const signedPreview = await sandbox.getSignedPreviewUrl(GATEWAY_PORT, SIGNED_URL_TTL_SECONDS);
    gatewayUrl = signedPreview.url;
    urlRefreshed = true;
    log("new signed URL obtained");
  }

  const discoveredSkills = await discoverSkillsOnDisk(sandbox);
  log(`discovered ${discoveredSkills.length} skills on disk`);

  return {
    sandboxId: sandbox.id,
    gatewayUrl,
    gatewayBaseUrl: gatewayUrl,
    urlRefreshed,
    state: "running",
    startedAt: Date.now(),
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    region: sandbox.target,
    discoveredSkills,
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
