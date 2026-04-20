"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

export type SnapshotState = "unknown" | "building" | "active" | "error" | "none";

export interface UseSnapshotResult {
  state: SnapshotState;
  snapshotName: string | null;
  errorReason: string | null;
  markBuilding: () => Promise<void>;
  markActive: () => Promise<void>;
  markError: (reason: string) => Promise<void>;
}

const DEFAULT_SNAPSHOT_NAME = process.env.NEXT_PUBLIC_HERMES_SNAPSHOT || "hermes-ready";

export function useSnapshot(): UseSnapshotResult {
  const { isAuthenticated } = useConvexAuth();
  const record = useQuery(
    api.userSnapshots.get,
    isAuthenticated ? {} : "skip",
  );
  const upsert = useMutation(api.userSnapshots.upsert);

  const state: SnapshotState = !isAuthenticated
    ? "unknown"
    : record === undefined
      ? "unknown"
      : record === null
        ? "none"
        : record.state;

  const markBuilding = async () => {
    await upsert({ snapshotName: DEFAULT_SNAPSHOT_NAME, state: "building" });
  };

  const markActive = async () => {
    await upsert({ snapshotName: DEFAULT_SNAPSHOT_NAME, state: "active" });
  };

  const markError = async (reason: string) => {
    await upsert({ snapshotName: DEFAULT_SNAPSHOT_NAME, state: "error", errorReason: reason });
  };

  return {
    state,
    snapshotName: record?.snapshotName ?? null,
    errorReason: record?.errorReason ?? null,
    markBuilding,
    markActive,
    markError,
  };
}
