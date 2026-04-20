import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min without heartbeat = stale
const AGE_THRESHOLD_MS = 20 * 60 * 1000; // only consider sandboxes older than 20min

export const cleanupStaleSandboxes = internalAction({
  args: {},
  handler: async (ctx) => {
    const adminKey = process.env.DAYTONA_ADMIN_KEY;
    if (!adminKey) {
      console.log("[cleanup] DAYTONA_ADMIN_KEY not set, skipping cleanup");
      return;
    }

    const staleSandboxes = await ctx.runQuery(internal.sandboxes.listStale, {
      staleThresholdMs: STALE_THRESHOLD_MS,
      ageThresholdMs: AGE_THRESHOLD_MS,
    });

    if (staleSandboxes.length === 0) return;

    console.log(`[cleanup] Found ${staleSandboxes.length} stale sandbox(es)`);

    for (const sandbox of staleSandboxes) {
      try {
        // Try to delete via Daytona API
        const res = await fetch(
          `https://app.daytona.io/api/sandbox/${sandbox.sandboxId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminKey}` },
          },
        );

        if (res.ok || res.status === 404) {
          // Successfully deleted or already gone
          await ctx.runMutation(internal.sandboxes.internalRemove, {
            sandboxId: sandbox.sandboxId,
          });
          console.log(`[cleanup] Deleted sandbox ${sandbox.sandboxId}`);
        } else {
          console.log(`[cleanup] Failed to delete ${sandbox.sandboxId}: ${res.status}`);
        }
      } catch (err) {
        console.log(`[cleanup] Error cleaning ${sandbox.sandboxId}: ${err}`);
      }
    }
  },
});

const crons = cronJobs();
crons.interval(
  "cleanup stale sandboxes",
  { minutes: 10 },
  internal.crons.cleanupStaleSandboxes,
  {},
);

export default crons;
