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
import { NousResearch } from "@lobehub/icons";

interface SandboxLiveInfo {
  id?: string;
  state?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  gpu?: number;
  target?: string;
  snapshot?: string;
  autoStopInterval?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config } = useKeyStore();

  const sandboxes = useQuery(api.sandboxes.list, isAuthenticated ? {} : "skip");
  const trials = useQuery(api.skillTrials.list, isAuthenticated ? {} : "skip");
  const removeSandbox = useMutation(api.sandboxes.remove);

  const STALE_PENDING_MS = 5 * 60 * 1000;
  const sandboxList = sandboxes ?? [];
  const sandbox = sandboxList.find((s) => !s.sandboxId.startsWith("pending-"))
    ?? sandboxList.find((s) =>
      s.sandboxId.startsWith("pending-") && Date.now() - s.createdAt <= STALE_PENDING_MS
    );
  const trialList = trials ?? [];

  const [liveInfo, setLiveInfo] = useState<SandboxLiveInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const isRealSandbox = sandbox && !sandbox.sandboxId.startsWith("pending-");

  const fetchLiveInfo = useCallback(async (sandboxId: string) => {
    if (!config?.sandboxKey || sandboxId.startsWith("pending-")) return;
    try {
      const res = await fetch(`/api/sandbox?id=${sandboxId}&key=${encodeURIComponent(config.sandboxKey)}`);
      if (res.ok) setLiveInfo(await res.json());
    } catch {}
  }, [config?.sandboxKey]);

  useEffect(() => {
    if (isRealSandbox && config?.sandboxKey && !liveInfo) {
      fetchLiveInfo(sandbox.sandboxId);
    }
  }, [isRealSandbox, sandbox?.sandboxId, config?.sandboxKey, fetchLiveInfo, liveInfo]);

  const handleDestroy = async () => {
    if (!isRealSandbox || !config?.sandboxKey) return;
    try { await destroySandbox(config.sandboxKey, sandbox.sandboxId); } catch {}
    await removeSandbox({ sandboxId: sandbox.sandboxId });
    setLiveInfo(null);
  };

  const handleWakeUp = () => {
    if (!sandbox?.currentSkillPath) return;
    window.location.href = `/${sandbox.currentSkillPath}`;
  };

  const handleCopyId = () => {
    if (!isRealSandbox) return;
    navigator.clipboard.writeText(sandbox.sandboxId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  const isCreating = poolState === "creating";
  const isActive = poolState === "active" || displayState === "running" || displayState === "started";
  const isStopped = poolState === "stopped" || displayState === "stopped";

  const statusLabel = isCreating ? "creating" : isActive ? "active" : isStopped ? "stopped" : displayState;
  const statusColor = isCreating
    ? "text-blue-400/70 bg-blue-500/10"
    : isActive
      ? "text-green-400/70 bg-green-500/10"
      : isStopped
        ? "text-orange-400/70 bg-orange-500/10"
        : "text-white/30 bg-white/5";
  const dotColor = isCreating
    ? "bg-blue-400 animate-pulse"
    : isActive
      ? "bg-green-500 animate-pulse"
      : isStopped
        ? "bg-white/20"
        : "bg-white/10";

  const formatTime = (ts: number | string) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const cpu = liveInfo?.cpu ?? sandbox?.cpu;
  const memory = liveInfo?.memory ?? sandbox?.memory;
  const disk = sandbox?.disk;

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
                <div className="relative">
                  <NousResearch size={24} className="text-white/80" />
                  <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
                </div>
                <h2 className="text-lg font-medium text-white/90">Hermes Agent</h2>
              </div>
              <span className={`text-xs font-mono px-2 py-1 rounded-full ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {isCreating && !isRealSandbox ? (
              <div className="text-sm text-blue-400/60 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-blue-400/30 border-t-blue-400/70 animate-spin" />
                Creating sandbox...
              </div>
            ) : isRealSandbox ? (
              <>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30">ID</span>
                    <span className="font-mono text-white/50 truncate">{sandbox.sandboxId}</span>
                    <button
                      onClick={handleCopyId}
                      className="text-white/20 hover:text-white/50 transition-colors shrink-0"
                      title="Copy sandbox ID"
                    >
                      {copied ? "✓" : "⎘"}
                    </button>
                  </div>
                  {sandbox.region && (
                    <div>
                      <span className="text-white/30">Region </span>
                      <span className="text-white/50">{sandbox.region.toUpperCase()}</span>
                    </div>
                  )}
                  {cpu && (
                    <div>
                      <span className="text-white/30">CPU </span>
                      <span className="text-white/50">{cpu} vCPU</span>
                    </div>
                  )}
                  {memory && (
                    <div>
                      <span className="text-white/30">Memory </span>
                      <span className="text-white/50">{memory} GB</span>
                    </div>
                  )}
                  {disk && (
                    <div>
                      <span className="text-white/30">Disk </span>
                      <span className="text-white/50">{disk} GB</span>
                    </div>
                  )}
                  {sandbox.currentSkillPath && (
                    <div>
                      <span className="text-white/30">Current Skill </span>
                      <span className="font-mono text-white/50">{sandbox.currentSkillPath}</span>
                    </div>
                  )}
                  {(liveInfo?.createdAt || sandbox.createdAt) && (
                    <div>
                      <span className="text-white/30">Created </span>
                      <span className="text-white/50">{formatTime(liveInfo?.createdAt ?? sandbox.createdAt)}</span>
                    </div>
                  )}
                  {sandbox.lastHeartbeat && (
                    <div>
                      <span className="text-white/30">Last Heartbeat </span>
                      <span className="text-white/50">{formatTime(sandbox.lastHeartbeat)}</span>
                    </div>
                  )}
                </div>

                {sandbox.installedSkills && sandbox.installedSkills.length > 0 && (
                  <div className="mb-4">
                    <span className="text-xs text-white/30 block mb-1.5">Installed Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sandbox.installedSkills.map((s) => (
                        <span key={s} className="text-[10px] font-mono px-2 py-0.5 bg-white/5 border border-white/10 text-white/40 rounded-full">
                          {s.split("/").pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {isStopped && sandbox?.currentSkillPath && (
                    <button onClick={handleWakeUp} className="px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all">
                      Resume Last Skill
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
