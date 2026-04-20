"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { destroySandbox } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";

interface SandboxLiveInfo {
  cpu?: number;
  memory?: number;
  disk?: number;
  gpu?: number;
  target?: string;
  snapshot?: string;
  state?: string;
  autoStopInterval?: number;
  createdAt?: string;
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config } = useKeyStore();

  const sandboxes = useQuery(
    api.sandboxes.list,
    isAuthenticated ? {} : "skip",
  );
  const removeSandbox = useMutation(api.sandboxes.remove);
  const updateState = useMutation(api.sandboxes.updateState);
  const updatePoolState = useMutation(api.sandboxes.updatePoolState);

  const sandboxList = sandboxes ?? (isSignedIn && !isAuthenticated ? [] : undefined);

  const [liveInfo, setLiveInfo] = useState<Record<string, SandboxLiveInfo>>({});

  const fetchLiveInfo = useCallback(async (sandboxId: string) => {
    if (!config?.sandboxKey || sandboxId.startsWith("pending-")) return;
    try {
      const res = await fetch(`/api/sandbox?id=${sandboxId}&key=${encodeURIComponent(config.sandboxKey)}`);
      if (res.ok) {
        const data = await res.json();
        setLiveInfo((prev) => ({ ...prev, [sandboxId]: data }));
      }
    } catch {}
  }, [config?.sandboxKey]);

  useEffect(() => {
    if (!sandboxList || !config?.sandboxKey) return;
    for (const sb of sandboxList) {
      if (!sb.sandboxId.startsWith("pending-") && !liveInfo[sb.sandboxId]) {
        fetchLiveInfo(sb.sandboxId);
      }
    }
  }, [sandboxList, config?.sandboxKey, fetchLiveInfo, liveInfo]);

  const handleStop = async (sandboxId: string) => {
    if (!config?.sandboxKey) return;
    await updateState({ sandboxId, state: "stopping" });
    try {
      await destroySandbox(config.sandboxKey, sandboxId);
    } catch {}
    await removeSandbox({ sandboxId });
  };

  const handleWakeUp = async (sandboxId: string) => {
    if (!config?.sandboxKey) return;
    await updatePoolState({ sandboxId, poolState: "warm" });
    // The actual Daytona start happens when user launches a skill
  };

  const handleRemove = async (sandboxId: string) => {
    await removeSandbox({ sandboxId });
  };

  if (!isLoaded) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center relative z-10 px-6">
          <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-white/90 mb-2">Sign in to view dashboard</h2>
            <p className="text-sm text-white/50 mb-6">Manage your active sandbox sessions.</p>
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
                Sign in with GitHub
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  const formatElapsed = (startedAt: number) => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const stateColor = (state: string, poolState?: string) => {
    if (poolState === "warm") return "bg-amber-500 animate-pulse";
    if (poolState === "stopped") return "bg-white/20";
    if (state === "running" || state === "started") return "bg-green-500 animate-pulse";
    if (state === "stopping") return "bg-yellow-500";
    if (state === "creating" || state === "installing" || state === "uploading" || state === "starting") return "bg-blue-400 animate-pulse";
    if (state === "stopped" || state === "archived") return "bg-white/20";
    return "bg-white/20";
  };

  const stateLabel = (state: string, poolState?: string) => {
    if (poolState === "warm") return "warm (reusable)";
    if (poolState === "swapping") return "swapping skill...";
    if (poolState === "stopped") return "stopped (restartable)";
    const labels: Record<string, string> = {
      creating: "Creating sandbox...",
      installing: "Installing agent...",
      uploading: "Uploading skill...",
      starting: "Starting agent...",
      running: "running",
      started: "running",
      stopping: "stopping...",
      stopped: "stopped",
      archived: "archived",
    };
    return labels[state] ?? state;
  };

  const stateTextColor = (state: string, poolState?: string) => {
    if (poolState === "warm") return "text-amber-400/70";
    if (poolState === "stopped") return "text-white/30";
    if (state === "running" || state === "started") return "text-green-400/70";
    if (state === "creating" || state === "installing" || state === "uploading" || state === "starting") return "text-blue-400/70";
    if (state === "stopped" || state === "archived") return "text-white/30";
    return "text-yellow-400/70";
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />
      <SiteHeader />

      <div className="flex-1 relative z-10 px-6 pt-20 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-semibold text-white/90">Dashboard</h1>
            <span className="text-sm text-white/40">
              {sandboxList?.length ?? 0} sandbox{(sandboxList?.length ?? 0) !== 1 ? "es" : ""}
            </span>
          </div>

          {sandboxList === undefined ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          ) : sandboxList.length === 0 ? (
            <div className="border border-white/10 bg-black/40 backdrop-blur-sm p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
              <h2 className="text-lg font-semibold text-white/60 mb-2">No active sandboxes</h2>
              <p className="text-sm text-white/40 mb-6">Launch a skill from the homepage to create a sandbox.</p>
              <a href="/" className="inline-block px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
                Try a Skill
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {sandboxList.map((sb) => {
                const live = liveInfo[sb.sandboxId];
                const displayState = live?.state ?? sb.state;
                const poolState = sb.poolState;
                const cpu = sb.cpu ?? live?.cpu;
                const memory = sb.memory ?? live?.memory;
                const disk = sb.disk ?? live?.disk;
                const gpu = live?.gpu;
                const region = sb.region ?? live?.target;

                return (
                  <div
                    key={sb._id}
                    className="border border-white/10 bg-black/40 backdrop-blur-sm px-6 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${stateColor(displayState, poolState ?? undefined)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm text-white/80 truncate">
                            {sb.currentSkillPath ?? sb.skillPath}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs font-medium ${stateTextColor(displayState, poolState ?? undefined)}`}>
                              {stateLabel(displayState, poolState ?? undefined)}
                            </span>
                            {poolState && (
                              <>
                                <span className="text-[10px] text-white/20">&middot;</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                                  poolState === "warm" ? "text-amber-400/60 bg-amber-500/10"
                                    : poolState === "active" ? "text-blue-400/60 bg-blue-500/10"
                                    : "text-white/30 bg-white/5"
                                }`}>
                                  {poolState}
                                </span>
                              </>
                            )}
                            <span className="text-[10px] text-white/20">&middot;</span>
                            <span className="text-xs text-white/30">
                              {formatElapsed(sb.createdAt)}
                            </span>
                            {!sb.sandboxId.startsWith("pending-") && (
                              <>
                                <span className="text-[10px] text-white/20">&middot;</span>
                                <span className="text-xs text-white/25 font-mono">
                                  {sb.sandboxId.slice(0, 8)}
                                </span>
                              </>
                            )}
                          </div>

                          {(cpu || memory || disk || region) && (
                            <div className="flex items-center gap-3 mt-2">
                              {cpu ? (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                                  </svg>
                                  <span className="text-xs text-white/30">{cpu} vCPU</span>
                                </div>
                              ) : null}
                              {memory ? (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                                  </svg>
                                  <span className="text-xs text-white/30">{memory} GB</span>
                                </div>
                              ) : null}
                              {disk ? (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                                  </svg>
                                  <span className="text-xs text-white/30">{disk} GB</span>
                                </div>
                              ) : null}
                              {gpu ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-white/30">{gpu} GPU</span>
                                </div>
                              ) : null}
                              {region ? (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                  </svg>
                                  <span className="text-xs text-white/30">{region}</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(displayState === "running" || displayState === "started") && (
                          <button
                            onClick={() => window.open(sb.webuiUrl, "_blank", "noopener,noreferrer")}
                            className="px-4 py-2 bg-white text-black text-xs font-medium hover:bg-white/90 transition-all"
                          >
                            Open WebUI
                          </button>
                        )}
                        {poolState === "stopped" && (
                          <button
                            onClick={() => handleWakeUp(sb.sandboxId)}
                            className="px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all"
                          >
                            Wake Up
                          </button>
                        )}
                        {(displayState === "running" || displayState === "started" || poolState === "warm") && (
                          <button
                            onClick={() => handleStop(sb.sandboxId)}
                            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
                          >
                            Stop
                          </button>
                        )}
                        {displayState !== "running" && displayState !== "started" && displayState !== "stopping" &&
                         displayState !== "creating" && displayState !== "installing" && displayState !== "uploading" && displayState !== "starting" &&
                         poolState !== "warm" && (
                          <button
                            onClick={() => handleRemove(sb.sandboxId)}
                            className="px-4 py-2 bg-white/5 text-white/40 hover:bg-white/10 text-xs font-medium transition-all"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
