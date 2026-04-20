"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Sends a heartbeat every 60s while a sandbox is running.
 * - Updates Convex `lastHeartbeat` (for cron cleanup tracking)
 * - Calls Daytona `refreshActivity()` (to reset the 15min auto-stop timer)
 *
 * Heartbeats fire unconditionally while sandbox is active, even when the tab
 * is hidden — because the user typically interacts with Hermes in a separate tab.
 */
export function useHeartbeat(sandboxId: string | null, daytonaKey: string | null) {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.sandboxes.heartbeat);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(() => {
    if (!sandboxId || !daytonaKey) return;
    heartbeat({ sandboxId }).catch(() => {});
    fetch("/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId, daytonaKey }),
    }).catch(() => {});
  }, [sandboxId, daytonaKey, heartbeat]);

  useEffect(() => {
    if (!sandboxId || !daytonaKey || !isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sandboxId, daytonaKey, isAuthenticated, sendHeartbeat]);
}
