"use client";

import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { destroySandbox } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";

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

  // Treat as loaded with empty list if Clerk says signed in but Convex hasn't synced yet
  const sandboxList = sandboxes ?? (isSignedIn && !isAuthenticated ? [] : undefined);

  const handleStop = async (sandboxId: string) => {
    if (!config?.sandboxKey) return;
    await updateState({ sandboxId, state: "stopping" });
    try {
      await destroySandbox(config.sandboxKey, sandboxId);
    } catch {
      // best effort
    }
    await removeSandbox({ sandboxId });
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
            <p className="text-sm text-white/50 mb-6">
              Manage your active sandbox sessions.
            </p>
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
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
              <p className="text-sm text-white/40 mb-6">
                Launch a skill from the homepage to create a sandbox.
              </p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all"
              >
                Try a Skill
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {sandboxList.map((sb) => (
                <div
                  key={sb._id}
                  className="border border-white/10 bg-black/40 backdrop-blur-sm px-6 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        sb.state === "running"
                          ? "bg-green-500 animate-pulse"
                          : sb.state === "stopping"
                            ? "bg-yellow-500"
                            : "bg-white/20"
                      }`} />
                      <div className="min-w-0">
                        <div className="font-mono text-sm text-white/80 truncate">
                          {sb.skillPath}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-white/30">
                            {sb.sandboxId.slice(0, 8)}...
                          </span>
                          <span className="text-xs text-white/30">
                            {formatElapsed(sb.createdAt)}
                          </span>
                          <span className={`text-xs ${
                            sb.state === "running" ? "text-green-400/60" : "text-yellow-400/60"
                          }`}>
                            {sb.state}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {sb.state === "running" && (
                        <button
                          onClick={() => window.open(sb.webuiUrl, "_blank", "noopener,noreferrer")}
                          className="px-4 py-2 bg-white text-black text-xs font-medium hover:bg-white/90 transition-all"
                        >
                          Open WebUI
                        </button>
                      )}
                      {sb.state === "running" && (
                        <button
                          onClick={() => handleStop(sb.sandboxId)}
                          className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
                        >
                          Stop
                        </button>
                      )}
                      {sb.state !== "running" && (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
