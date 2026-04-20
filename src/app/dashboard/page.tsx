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
  state?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  gpu?: number;
  target?: string;
  autoStopInterval?: number;
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config } = useKeyStore();

  const sandboxes = useQuery(api.sandboxes.list, isAuthenticated ? {} : "skip");
  const trials = useQuery(api.skillTrials.list, isAuthenticated ? {} : "skip");
  const removeSandbox = useMutation(api.sandboxes.remove);
  const updatePoolState = useMutation(api.sandboxes.updatePoolState);

  const sandboxList = sandboxes ?? [];
  const sandbox = sandboxList.find((s) => !s.sandboxId.startsWith("pending-"));
  const trialList = trials ?? [];

  const [liveInfo, setLiveInfo] = useState<SandboxLiveInfo | null>(null);

  const fetchLiveInfo = useCallback(async (sandboxId: string) => {
    if (!config?.sandboxKey || sandboxId.startsWith("pending-")) return;
    try {
      const res = await fetch(`/api/sandbox?id=${sandboxId}&key=${encodeURIComponent(config.sandboxKey)}`);
      if (res.ok) setLiveInfo(await res.json());
    } catch {}
  }, [config?.sandboxKey]);

  useEffect(() => {
    if (sandbox && config?.sandboxKey && !liveInfo) {
      fetchLiveInfo(sandbox.sandboxId);
    }
  }, [sandbox, config?.sandboxKey, fetchLiveInfo, liveInfo]);

  const handleDestroy = async () => {
    if (!sandbox || !config?.sandboxKey) return;
    try { await destroySandbox(config.sandboxKey, sandbox.sandboxId); } catch {}
    await removeSandbox({ sandboxId: sandbox.sandboxId });
    setLiveInfo(null);
  };

  const handleWakeUp = async () => {
    if (!sandbox) return;
    await updatePoolState({ sandboxId: sandbox.sandboxId, poolState: "active" });
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
            <p className="text-sm text-white/50 mb-6">Manage your Hermes agent sandbox.</p>
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

  const displayState = liveInfo?.state ?? sandbox?.state ?? "unknown";
  const poolState = sandbox?.poolState;
  const isActive = poolState === "active" || displayState === "running" || displayState === "started";
  const isStopped = poolState === "stopped" || displayState === "stopped";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />
      <SiteHeader />

      <div className="flex-1 relative z-10 px-6 pt-20 pb-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-white/90 mb-8">Dashboard</h1>

          {/* Sandbox Card */}
          <div className="border border-white/10 bg-black/40 backdrop-blur-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-green-500 animate-pulse" : isStopped ? "bg-white/20" : "bg-blue-400 animate-pulse"}`} />
                <h2 className="text-lg font-medium text-white/90">Hermes Agent</h2>
              </div>
              <span className={`text-xs font-mono px-2 py-1 rounded-full ${isActive ? "text-green-400/70 bg-green-500/10" : isStopped ? "text-orange-400/70 bg-orange-500/10" : "text-white/30 bg-white/5"}`}>
                {isActive ? "active" : isStopped ? "stopped" : displayState}
              </span>
            </div>

            {sandbox ? (
              <>
                <div className="flex items-center gap-4 text-xs text-white/30 mb-4">
                  {sandbox.sandboxId && (
                    <span className="font-mono">{sandbox.sandboxId.slice(0, 12)}...</span>
                  )}
                  {(liveInfo?.cpu || sandbox.cpu) && (
                    <span>{liveInfo?.cpu ?? sandbox.cpu} vCPU</span>
                  )}
                  {(liveInfo?.memory || sandbox.memory) && (
                    <span>{liveInfo?.memory ?? sandbox.memory} GB RAM</span>
                  )}
                  {sandbox.currentSkillPath && (
                    <span>Last: {sandbox.currentSkillPath.split("/").pop()}</span>
                  )}
                </div>

                {sandbox.installedSkills && sandbox.installedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {sandbox.installedSkills.map((s) => (
                      <span key={s} className="text-[10px] font-mono px-2 py-0.5 bg-white/5 border border-white/10 text-white/40 rounded-full">
                        {s.split("/").pop()}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {isStopped && (
                    <button onClick={handleWakeUp} className="px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all">
                      Wake Up
                    </button>
                  )}
                  <button onClick={handleDestroy} className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all">
                    Destroy
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-white/40">
                No sandbox yet. Try a skill to create one automatically.
              </div>
            )}
          </div>

          {/* Skill Trial History */}
          <div className="border border-white/10 bg-black/40 backdrop-blur-sm p-6">
            <h2 className="text-lg font-medium text-white/90 mb-4">Skill Trials</h2>

            {trialList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/40 mb-4">No skills tried yet.</p>
                <a href="/" className="inline-block px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
                  Try a Skill
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {trialList.map((trial) => (
                  <div key={trial._id} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-sm text-white/70 truncate">{trial.skillName}</div>
                        <div className="text-xs text-white/30">{trial.skillPath}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-white/25">{formatTime(trial.startedAt)}</span>
                      <a
                        href={`/${trial.skillPath}`}
                        className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 rounded transition-all"
                      >
                        Try again
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
