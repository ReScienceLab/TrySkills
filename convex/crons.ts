import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const STALE_THRESHOLD_MS = 45 * 60 * 1000; // 45 min without heartbeat = stale (matches autoStop + buffer)
const AGE_THRESHOLD_MS = 45 * 60 * 1000; // only consider sandboxes older than 45min
const STOPPED_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days for stopped sandboxes

/**
 * Cleans up stale Convex sandbox records.
 * Daytona itself handles stopping/deleting the actual sandbox
 * (via autoStopInterval: 30 + autoDeleteInterval: 7d).
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

    const now = Date.now();
    for (const sandbox of staleSandboxes) {
      // Stale active sandboxes: mark as stopped (Daytona likely auto-stopped them)
      if (sandbox.poolState === "active" || sandbox.poolState === "installing") {
        await ctx.runMutation(internal.sandboxes.internalMarkStopped, {
          sandboxId: sandbox.sandboxId,
        });
        console.log(`[cleanup] Marked stopped: ${sandbox.sandboxId}`);
        continue;
      }
      // Remove stopped sandboxes older than 2 days
      if (sandbox.poolState === "stopped" && now - sandbox.createdAt < STOPPED_THRESHOLD_MS) {
        continue;
      }

      await ctx.runMutation(internal.sandboxes.internalRemove, {
        sandboxId: sandbox.sandboxId,
      });
      console.log(`[cleanup] Removed record: ${sandbox.sandboxId} (poolState: ${sandbox.poolState ?? "none"})`);
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
