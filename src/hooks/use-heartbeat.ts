"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Sends a heartbeat every 60s while a sandbox is running AND the page is visible.
 * When the user switches tabs or minimizes the browser, heartbeats pause and
 * Daytona's 15-minute idle timer counts down naturally.
 */
export function useHeartbeat(sandboxId: string | null, daytonaKey: string | null) {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.sandboxes.heartbeat);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(() => {
    if (!sandboxId || !daytonaKey) return;
    // Only send if page is visible
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
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

    // Pause/resume on visibility change
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat(); // send immediately on tab re-focus
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sandboxId, daytonaKey, isAuthenticated, sendHeartbeat]);
}
