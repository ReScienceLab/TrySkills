import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min without heartbeat = stale
const AGE_THRESHOLD_MS = 20 * 60 * 1000; // only consider sandboxes older than 20min

/**
 * Cleans up stale Convex sandbox records.
 * Daytona itself handles stopping/deleting the actual sandbox
 * (via ephemeral: true + autoStopInterval: 15).
 * This cron just removes orphan DB records so the dashboard stays clean.
 */
export const cleanupStaleSandboxes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleSandboxes = await ctx.runQuery(internal.sandboxes.listStale, {
      staleThresholdMs: STALE_THRESHOLD_MS,
      ageThresholdMs: AGE_THRESHOLD_MS,
    });

    if (staleSandboxes.length === 0) return;

    console.log(`[cleanup] Removing ${staleSandboxes.length} stale sandbox record(s)`);

    for (const sandbox of staleSandboxes) {
      await ctx.runMutation(internal.sandboxes.internalRemove, {
        sandboxId: sandbox.sandboxId,
      });
      console.log(`[cleanup] Removed record: ${sandbox.sandboxId}`);
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
