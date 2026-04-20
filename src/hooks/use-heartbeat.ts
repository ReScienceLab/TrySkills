"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

export function useHeartbeat(sandboxId: string | null) {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.sandboxes.heartbeat);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sandboxId || !isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediately on mount
    heartbeat({ sandboxId }).catch(() => {});

    intervalRef.current = setInterval(() => {
      heartbeat({ sandboxId }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sandboxId, isAuthenticated, heartbeat]);
}
