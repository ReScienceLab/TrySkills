/**
 * Check if the hermes-ready snapshot exists and is active.
 * If inactive, reactivate it. If missing, exit with an error.
 *
 * Usage:
 *   DAYTONA_API_KEY=xxx npx tsx scripts/check-snapshot.ts
 *
 * Exit codes:
 *   0 — Snapshot is active and ready
 *   1 — Snapshot not found or unrecoverable error
 */

import { Daytona } from "@daytona/sdk";

const SNAPSHOT_NAME = process.env.SNAPSHOT_NAME || "hermes-ready";

async function main() {
  if (!process.env.DAYTONA_API_KEY) {
    console.error("Error: DAYTONA_API_KEY environment variable is required");
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
  });

  try {
    const snapshot = await daytona.snapshot.get(SNAPSHOT_NAME);
    console.log(`Snapshot: ${snapshot.name}`);
    console.log(`State:    ${snapshot.state}`);
    console.log(`Image:    ${snapshot.imageName}`);
    console.log(`Size:     ${snapshot.size ? `${(snapshot.size / 1024 / 1024).toFixed(1)}MB` : "unknown"}`);

    if (snapshot.state === "active") {
      console.log("\nSnapshot is active and ready.");
      return;
    }

    if (snapshot.state === "inactive") {
      console.log("\nSnapshot is inactive (auto-deactivated after 2 weeks of no use).");
      console.log("Reactivating...");
      await daytona.snapshot.activate(snapshot);
      console.log("Snapshot reactivated.");
      return;
    }

    if (snapshot.state === "error" || snapshot.state === "build_failed") {
      console.error(`\nSnapshot is in error state: ${snapshot.errorReason || "unknown"}`);
      console.error('Run "npx tsx scripts/build-snapshot.ts" to rebuild.');
      process.exit(1);
    }

    console.log(`\nSnapshot is in state "${snapshot.state}" — it may still be building.`);
  } catch {
    console.error(`Snapshot "${SNAPSHOT_NAME}" not found.`);
    console.error('Run "npx tsx scripts/build-snapshot.ts" to create it.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
