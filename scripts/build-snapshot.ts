/**
 * Build or rebuild the "hermes-ready" Daytona snapshot.
 *
 * This snapshot pre-installs hermes-agent, hermes-webui, and all dependencies
 * so that sandbox creation from this snapshot takes ~10-15s instead of ~3min.
 *
 * Usage:
 *   DAYTONA_API_KEY=xxx npx tsx scripts/build-snapshot.ts
 *
 * Environment:
 *   DAYTONA_API_KEY     — Required. Admin Daytona API key.
 *   DAYTONA_API_URL     — Optional. Defaults to https://app.daytona.io/api
 *   SNAPSHOT_NAME       — Optional. Defaults to "hermes-ready"
 *   SNAPSHOT_REGION     — Optional. Region for the snapshot (e.g. "us", "eu")
 */

import { Daytona, Image } from "@daytona/sdk";

const SNAPSHOT_NAME = process.env.SNAPSHOT_NAME || "hermes-ready";
const SNAPSHOT_REGION = process.env.SNAPSHOT_REGION || undefined;

const SNAPSHOT_RESOURCES = {
  cpu: 2,
  memory: 4,
  disk: 10,
};

const image = Image.base("ubuntu:22.04").runCommands(
  // System packages
  "apt-get update && apt-get install -y --no-install-recommends curl git ripgrep ca-certificates && rm -rf /var/lib/apt/lists/*",

  // Install uv (fast Python package manager)
  "curl -LsSf https://astral.sh/uv/install.sh | sh",

  // Install Python 3.11 via uv
  "export PATH=/root/.local/bin:$PATH && uv python install 3.11",

  // Install Node.js 22 LTS
  'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*',

  // Clone and install hermes-agent
  "git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent",
  'export PATH=/root/.local/bin:$PATH && cd /opt/hermes-agent && uv venv venv --python 3.11 && VIRTUAL_ENV=/opt/hermes-agent/venv uv pip install -e ".[all]" || VIRTUAL_ENV=/opt/hermes-agent/venv uv pip install -e "."',

  // Symlink hermes binary to PATH
  "ln -sf /opt/hermes-agent/venv/bin/hermes /usr/local/bin/hermes",

  // Clone and install hermes-webui
  "git clone --depth 1 https://github.com/nesquena/hermes-webui.git /opt/hermes-webui",
  "cd /opt/hermes-webui && npm install --silent",

  // Pre-create hermes home directory structure
  "mkdir -p /home/daytona/.hermes/skills /home/daytona/.hermes/logs",

  // Install Playwright chromium for browser tools
  "cd /opt/hermes-agent && npx playwright install chromium --with-deps 2>/dev/null || true",
);

async function main() {
  if (!process.env.DAYTONA_API_KEY) {
    console.error("Error: DAYTONA_API_KEY environment variable is required");
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
  });

  console.log(`Building snapshot "${SNAPSHOT_NAME}"...`);
  console.log(`Resources: ${SNAPSHOT_RESOURCES.cpu} vCPU, ${SNAPSHOT_RESOURCES.memory}GiB RAM, ${SNAPSHOT_RESOURCES.disk}GiB disk`);
  if (SNAPSHOT_REGION) console.log(`Region: ${SNAPSHOT_REGION}`);

  // Check if snapshot already exists and delete it
  try {
    const existing = await daytona.snapshot.get(SNAPSHOT_NAME);
    if (existing) {
      console.log(`Existing snapshot "${SNAPSHOT_NAME}" found (state: ${existing.state}). Deleting...`);
      await daytona.snapshot.delete(existing);
      console.log("Deleted.");
    }
  } catch {
    // Snapshot doesn't exist — that's fine
  }

  console.log("\nBuilding new snapshot (this may take 5-10 minutes)...\n");

  const snapshot = await daytona.snapshot.create(
    {
      name: SNAPSHOT_NAME,
      image,
      resources: SNAPSHOT_RESOURCES,
      ...(SNAPSHOT_REGION ? { regionId: SNAPSHOT_REGION } : {}),
    },
    {
      onLogs: (chunk) => process.stdout.write(chunk),
      timeout: 0, // no timeout
    },
  );

  console.log(`\nSnapshot "${snapshot.name}" created successfully!`);
  console.log(`State: ${snapshot.state}`);
  console.log(`Image: ${snapshot.imageName}`);
  console.log(`\nUsers can now create sandboxes with: snapshot: "${SNAPSHOT_NAME}"`);
}

main().catch((err) => {
  console.error("Failed to build snapshot:", err);
  process.exit(1);
});
