/**
 * Benchmark: Measure sandbox launch speed (snapshot vs cold start).
 *
 * Usage:
 *   DAYTONA_API_KEY=xxx LLM_API_KEY=xxx npx tsx scripts/bench-launch.ts
 *
 * Optional:
 *   SNAPSHOT_NAME=hermes-ready    (default)
 *   LLM_PROVIDER=openrouter       (default)
 *   LLM_MODEL=anthropic/claude-sonnet-4 (default)
 *   SKIP_COLD=1                   skip cold-start benchmark
 *   SKIP_SNAPSHOT=1               skip snapshot benchmark
 *   SKIP_CLEANUP=1                keep sandboxes alive after test
 */

import { Daytona } from "@daytona/sdk";
import { getProviderData } from "../src/lib/providers/provider-data";

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
const LLM_API_KEY = process.env.LLM_API_KEY || "sk-placeholder-for-bench";
const LLM_PROVIDER = process.env.LLM_PROVIDER || "openrouter";
const LLM_MODEL = process.env.LLM_MODEL || "anthropic/claude-sonnet-4";
const SNAPSHOT_NAME = process.env.SNAPSHOT_NAME || "hermes-ready";
const SKIP_COLD = process.env.SKIP_COLD === "1";
const SKIP_SNAPSHOT = process.env.SKIP_SNAPSHOT === "1";
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "1";

const GATEWAY_PORT = 8642;
const WEBUI_PORT = 8787;

function resolveProvider(providerId: string) {
  const provider = getProviderData(providerId);
  const envVar = provider?.inferenceProvider === "custom"
    ? "OPENAI_API_KEY"
    : provider?.envVar ?? "OPENROUTER_API_KEY";
  const inferenceProvider = provider?.inferenceProvider ?? "openrouter";
  const baseUrl = provider?.baseUrl;
  return { envVar, inferenceProvider, baseUrl };
}

interface TimingResult {
  phase: string;
  durationMs: number;
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildConfigYaml(): string {
  const { inferenceProvider, baseUrl } = resolveProvider(LLM_PROVIDER);
  const lines = [
    "model:",
    `  default: "${LLM_MODEL}"`,
    `  inference_provider: "${inferenceProvider}"`,
  ];
  if (baseUrl) {
    lines.push(`  base_url: "${baseUrl}"`);
  }
  lines.push(
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

function buildEnvFile(): string {
  const { envVar } = resolveProvider(LLM_PROVIDER);
  return [
    `${envVar}=${LLM_API_KEY}`,
    "API_SERVER_ENABLED=true",
    "API_SERVER_CORS_ORIGINS=*",
    "GATEWAY_ALLOW_ALL_USERS=true",
    "",
  ].join("\n");
}

function buildWebuiEnv(): string {
  return [
    "HERMES_WEBUI_AGENT_DIR=/opt/hermes-agent",
    "HERMES_WEBUI_PYTHON=/opt/hermes-agent/venv/bin/python3",
    "HERMES_WEBUI_HOST=0.0.0.0",
    `HERMES_WEBUI_PORT=${WEBUI_PORT}`,
    "HERMES_HOME=/home/daytona/.hermes",
    "",
  ].join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForHealth(sandbox: any, timeoutMs = 120_000): Promise<number> {
  const start = Date.now();
  const cmd = `curl -sf http://localhost:${GATEWAY_PORT}/health 2>/dev/null`;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await sandbox.process.executeCommand(cmd);
      if (result.exitCode === 0) return Date.now() - start;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Health check timed out after ${timeoutMs / 1000}s`);
}

async function benchmarkSnapshot(daytona: Daytona): Promise<{ timings: TimingResult[]; sandboxId: string }> {
  const timings: TimingResult[] = [];
  let t: number;

  console.log("\n=== SNAPSHOT BENCHMARK ===\n");

  // Phase 1: Create from snapshot
  t = Date.now();
  console.log(`[1/5] Creating sandbox from snapshot "${SNAPSHOT_NAME}"...`);
  const { envVar } = resolveProvider(LLM_PROVIDER);
  const sandbox = await daytona.create(
    {
      snapshot: SNAPSHOT_NAME,
      ephemeral: true,
      autoStopInterval: 30,
      public: true,
      envVars: {
        [envVar]: LLM_API_KEY,
        API_SERVER_ENABLED: "true",
        API_SERVER_CORS_ORIGINS: "*",
        GATEWAY_ALLOW_ALL_USERS: "true",
      },
    },
    { timeout: 120 },
  );
  timings.push({ phase: "create (snapshot)", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)} — sandbox: ${sandbox.id}`);

  // Phase 2: Link + configure
  t = Date.now();
  console.log("[2/5] Linking agent + writing config...");
  await sandbox.process.executeCommand([
    "mkdir -p /home/daytona/.hermes/skills /home/daytona/.hermes/logs",
    "ln -sfn /opt/hermes-agent /home/daytona/.hermes/hermes-agent",
    "mkdir -p /home/daytona/.local/bin",
    "ln -sf /opt/hermes-agent/venv/bin/hermes /home/daytona/.local/bin/hermes",
  ].join(" && "));
  await sandbox.process.executeCommand(
    `mkdir -p /home/daytona/.hermes && cat > /home/daytona/.hermes/.env << 'EOF'\n${buildEnvFile()}\nEOF`,
  );
  await sandbox.process.executeCommand(
    `cat > /home/daytona/.hermes/config.yaml << 'EOF'\n${buildConfigYaml()}\nEOF`,
  );
  await sandbox.process.executeCommand(
    `cat > /opt/hermes-webui/.env << 'EOF'\n${buildWebuiEnv()}\nEOF`,
  );
  timings.push({ phase: "configure", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 3: Upload a test skill
  t = Date.now();
  console.log("[3/5] Uploading test skill...");
  const testSkill = "---\nname: bench-test\ndescription: Benchmark test skill\n---\n# Bench Test\nA minimal skill for benchmarking.\n";
  await sandbox.process.executeCommand("mkdir -p /home/daytona/.hermes/skills/bench-test");
  await sandbox.fs.uploadFile(Buffer.from(testSkill), "/home/daytona/.hermes/skills/bench-test/SKILL.md");
  timings.push({ phase: "upload skill", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 4: Start gateway + webui
  t = Date.now();
  console.log("[4/5] Starting gateway + webui...");
  await sandbox.process.executeCommand(
    "nohup /opt/hermes-agent/venv/bin/hermes gateway run > /tmp/hermes-gateway.log 2>&1 &\ndisown",
  );
  await sandbox.process.executeCommand(
    [
      "cd /opt/hermes-webui",
      "export HERMES_WEBUI_AGENT_DIR=/opt/hermes-agent",
      "export HERMES_WEBUI_PYTHON=/opt/hermes-agent/venv/bin/python3",
      "export HERMES_WEBUI_HOST=0.0.0.0",
      `export HERMES_WEBUI_PORT=${WEBUI_PORT}`,
      "export HERMES_HOME=/home/daytona/.hermes",
      `nohup /opt/hermes-agent/venv/bin/python3 server.py > /tmp/hermes-webui.log 2>&1 &`,
      "disown",
    ].join(" && "),
  );
  timings.push({ phase: "start services", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 5: Wait for health
  t = Date.now();
  console.log("[5/5] Waiting for health check...");
  const healthMs = await waitForHealth(sandbox);
  timings.push({ phase: "health check", durationMs: healthMs });
  console.log(`      Healthy in ${fmt(healthMs)}`);

  // Get preview URL
  const preview = await sandbox.getPreviewLink(WEBUI_PORT);
  const webuiUrl = preview.url + (preview.token ? `?token=${preview.token}` : "");
  console.log(`\n  WebUI: ${webuiUrl}`);

  return { timings, sandboxId: sandbox.id };
}

async function benchmarkCold(daytona: Daytona): Promise<{ timings: TimingResult[]; sandboxId: string }> {
  const timings: TimingResult[] = [];
  let t: number;

  console.log("\n=== COLD START BENCHMARK ===\n");

  // Phase 1: Create default sandbox
  t = Date.now();
  console.log("[1/6] Creating default sandbox (no snapshot)...");
  const { envVar } = resolveProvider(LLM_PROVIDER);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sandbox = await (daytona as any).create(
    {
      ephemeral: true,
      autoStopInterval: 30,
      public: true,
      envVars: {
        [envVar]: LLM_API_KEY,
        API_SERVER_ENABLED: "true",
        API_SERVER_CORS_ORIGINS: "*",
        GATEWAY_ALLOW_ALL_USERS: "true",
      },
    },
    { timeout: 300 },
  );
  timings.push({ phase: "create (cold)", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)} — sandbox: ${sandbox.id}`);

  // Phase 2: Install hermes-agent
  t = Date.now();
  console.log("[2/6] Installing hermes-agent (curl | bash)...");
  await sandbox.process.executeCommand(
    "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup 2>&1 || true",
  );
  timings.push({ phase: "install hermes", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 3: Write config
  t = Date.now();
  console.log("[3/6] Writing config...");
  await sandbox.process.executeCommand(
    `mkdir -p $HOME/.hermes && cat > $HOME/.hermes/.env << 'EOF'\n${buildEnvFile()}\nEOF`,
  );
  await sandbox.process.executeCommand(
    `cat > $HOME/.hermes/config.yaml << 'EOF'\n${buildConfigYaml()}\nEOF`,
  );
  // Clone webui
  await sandbox.process.executeCommand(
    "git clone --depth 1 https://github.com/nesquena/hermes-webui.git $HOME/hermes-webui 2>&1",
  );
  const webuiEnvCold = [
    "HERMES_WEBUI_AGENT_DIR=$HOME/.hermes/hermes-agent",
    "HERMES_WEBUI_PYTHON=$HOME/.hermes/hermes-agent/venv/bin/python3",
    "HERMES_WEBUI_HOST=0.0.0.0",
    `HERMES_WEBUI_PORT=${WEBUI_PORT}`,
    "HERMES_HOME=$HOME/.hermes",
    "",
  ].join("\n");
  await sandbox.process.executeCommand(
    `cat > $HOME/hermes-webui/.env << 'EOF'\n${webuiEnvCold}\nEOF`,
  );
  timings.push({ phase: "configure + clone webui", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 4: Upload test skill
  t = Date.now();
  console.log("[4/6] Uploading test skill...");
  const testSkill = "---\nname: bench-test\n---\n# Bench Test\n";
  await sandbox.process.executeCommand("mkdir -p $HOME/.hermes/skills/bench-test");
  await sandbox.fs.uploadFile(Buffer.from(testSkill), "/home/daytona/.hermes/skills/bench-test/SKILL.md");
  timings.push({ phase: "upload skill", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 5: Start services
  t = Date.now();
  console.log("[5/6] Starting gateway + webui...");
  await sandbox.process.executeCommand(
    "export PATH=$HOME/.local/bin:$PATH && nohup hermes gateway run > /tmp/hermes-gateway.log 2>&1 &",
  );
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
  );
  timings.push({ phase: "start services", durationMs: Date.now() - t });
  console.log(`      Done in ${fmt(Date.now() - t)}`);

  // Phase 6: Health check
  t = Date.now();
  console.log("[6/6] Waiting for health check...");
  const healthMs = await waitForHealth(sandbox, 300_000);
  timings.push({ phase: "health check", durationMs: healthMs });
  console.log(`      Healthy in ${fmt(healthMs)}`);

  const preview = await sandbox.getPreviewLink(WEBUI_PORT);
  const webuiUrl = preview.url + (preview.token ? `?token=${preview.token}` : "");
  console.log(`\n  WebUI: ${webuiUrl}`);

  return { timings, sandboxId: sandbox.id };
}

function printSummary(label: string, timings: TimingResult[]) {
  const total = timings.reduce((sum, t) => sum + t.durationMs, 0);
  console.log(`\n┌─ ${label} ─${"─".repeat(Math.max(0, 45 - label.length))}┐`);
  for (const t of timings) {
    const bar = "█".repeat(Math.min(30, Math.round((t.durationMs / total) * 30)));
    console.log(`│ ${t.phase.padEnd(22)} ${fmt(t.durationMs).padStart(8)}  ${bar}`);
  }
  console.log(`├${"─".repeat(49)}┤`);
  console.log(`│ ${"TOTAL".padEnd(22)} ${fmt(total).padStart(8)}  ${"█".repeat(30)}`);
  console.log(`└${"─".repeat(49)}┘`);
  return total;
}

async function main() {
  if (!DAYTONA_API_KEY) {
    console.error("Error: DAYTONA_API_KEY environment variable is required");
    console.error("Usage: DAYTONA_API_KEY=xxx npx tsx scripts/bench-launch.ts");
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: DAYTONA_API_KEY,
    apiUrl: "https://app.daytona.io/api",
  });

  const sandboxIds: string[] = [];
  let snapshotTotal = 0;
  let coldTotal = 0;

  // Benchmark snapshot path
  if (!SKIP_SNAPSHOT) {
    try {
      const result = await benchmarkSnapshot(daytona);
      snapshotTotal = printSummary("SNAPSHOT PATH", result.timings);
      sandboxIds.push(result.sandboxId);
    } catch (err) {
      console.error("\nSnapshot benchmark FAILED:", err instanceof Error ? err.message : err);
      console.error('Make sure snapshot exists: DAYTONA_API_KEY=xxx npx tsx scripts/build-snapshot.ts');
    }
  }

  // Benchmark cold path
  if (!SKIP_COLD) {
    try {
      const result = await benchmarkCold(daytona);
      coldTotal = printSummary("COLD START PATH", result.timings);
      sandboxIds.push(result.sandboxId);
    } catch (err) {
      console.error("\nCold start benchmark FAILED:", err instanceof Error ? err.message : err);
    }
  }

  // Comparison
  if (snapshotTotal > 0 && coldTotal > 0) {
    const speedup = (coldTotal / snapshotTotal).toFixed(1);
    const saved = coldTotal - snapshotTotal;
    console.log("\n╔═══════════════════════════════════════════════╗");
    console.log(`║  Snapshot: ${fmt(snapshotTotal).padStart(8)}                          ║`);
    console.log(`║  Cold:     ${fmt(coldTotal).padStart(8)}                          ║`);
    console.log(`║  Speedup:  ${speedup}x  (saved ${fmt(saved)})            ║`);
    console.log("╚═══════════════════════════════════════════════╝");
  }

  // Cleanup
  if (!SKIP_CLEANUP && sandboxIds.length > 0) {
    console.log("\nCleaning up sandboxes...");
    for (const id of sandboxIds) {
      try {
        const sb = await daytona.get(id);
        await daytona.delete(sb);
        console.log(`  Deleted: ${id}`);
      } catch {
        console.log(`  Skip: ${id} (already gone)`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
