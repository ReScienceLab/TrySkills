"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress } from "@/components/launch-progress";
import { SessionControl } from "@/components/session-control";
import { GlowMesh } from "@/components/glow-mesh";
import { resolveSkillPath, fetchSkillDirectory } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox } from "@/lib/sandbox/daytona";
import { loadConfig } from "@/lib/key-store";
import { getProvider } from "@/lib/providers/registry";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "config" | "launching" | "running";

function Header({ owner, repo, skillName }: { owner: string; repo: string; skillName: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="TrySkills.sh" width={28} height={28} />
          <span className="text-white/90 text-sm font-semibold tracking-tight">
            tryskills<span className="text-blue-400">.sh</span>
          </span>
        </Link>
        <div className="font-mono text-xs text-white/40">
          {owner}/{repo}/{skillName}
        </div>
      </div>
    </header>
  );
}

export default function SkillPage({
  params,
}: {
  params: Promise<{ skillPath: string[] }>;
}) {
  const resolvedParams = use(params);
  const { skillPath } = resolvedParams;
  const searchParams = useSearchParams();
  const autoLaunch = searchParams.get("launch") === "1";

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);

  const canAutoLaunch = useMemo(() => {
    if (!autoLaunch || !isValidPath) return false;
    if (typeof window === "undefined") return false;
    const saved = loadConfig();
    if (!saved || !saved.llmKey || !saved.sandboxKey) return false;
    return !!getProvider(saved.providerId);
  }, [autoLaunch, isValidPath]);

  const [phase, setPhase] = useState<AppPhase>(canAutoLaunch ? "launching" : "config");
  const [sandboxState, setSandboxState] = useState<SandboxState>(canAutoLaunch ? "creating" : "idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const launchConfigRef = useRef<LaunchConfig | null>(null);
  const autoLaunchFired = useRef(false);

  const handleLaunch = async (config: LaunchConfig) => {
    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxState("creating");
    setSandboxError(undefined);

    try {
      const skillFiles = await fetchSkillDirectory(resolved);

      const result = await createHermesSandbox(
        {
          daytonaApiKey: config.sandboxKey,
          llmProvider: config.provider.id,
          llmApiKey: config.llmKey,
          llmModel: config.model,
        },
        skillName,
        skillFiles,
        (step) => setSandboxState(step as SandboxState),
      );

      setSession(result);
      setSandboxState("running");
      setPhase("running");

      window.open(result.webuiUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setSandboxState("error");
      setSandboxError(err instanceof Error ? err.message : "Launch failed");
    }
  };

  useEffect(() => {
    if (!canAutoLaunch || autoLaunchFired.current) return;
    autoLaunchFired.current = true;

    const saved = loadConfig()!;
    const provider = getProvider(saved.providerId)!;

    handleLaunch({
      provider,
      model: saved.model,
      llmKey: saved.llmKey,
      sandboxKey: saved.sandboxKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoLaunch]);

  useEffect(() => {
    const cleanup = () => {
      if (session && launchConfigRef.current) {
        destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [session]);

  const handleStop = async () => {
    if (session && launchConfigRef.current) {
      setSandboxState("cleaning");
      try {
        await destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId);
      } catch {
        // best effort cleanup
      }
    }
    setSession(null);
    setSandboxState("idle");
    setPhase("config");
  };

  const handleRetryLaunch = () => {
    if (launchConfigRef.current) {
      handleLaunch(launchConfigRef.current);
    }
  };

  if (!isValidPath) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <Header owner="" repo="" skillName="" />
        <div className="flex-1 flex items-center justify-center relative z-10 px-6">
          <div className="flex flex-col items-center animate-fade-in">
            <div className="text-white font-semibold mb-2">Invalid skill path</div>
            <div className="text-white/50 text-sm mb-6">
              Expected format: /owner/repo/skill-name
            </div>
            <Link href="/" className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />
      <Header owner={owner} repo={repo} skillName={skillName} />

      <div className="flex-1 flex items-center justify-center relative z-10 px-6">
        <div className="w-full max-w-[640px]">
          {phase === "config" && (
            <ConfigPanel
              onLaunch={handleLaunch}
              onBack={() => { window.location.href = "/"; }}
            />
          )}

          {phase === "launching" && (
            <LaunchProgress
              state={sandboxState}
              error={sandboxError}
              onRetry={handleRetryLaunch}
              onCancel={() => {
                handleStop();
                setPhase("config");
              }}
            />
          )}

          {phase === "running" && session && (
            <SessionControl
              webuiUrl={session.webuiUrl}
              startedAt={session.startedAt}
              onStop={handleStop}
            />
          )}
        </div>
      </div>
    </main>
  );
}
