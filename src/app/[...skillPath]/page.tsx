"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress } from "@/components/launch-progress";
import { SessionControl } from "@/components/session-control";
import { resolveSkillPath, fetchSkillDirectory } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox } from "@/lib/sandbox/daytona";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "config" | "launching" | "running";

function Header({ owner, repo, skillName }: { owner: string; repo: string; skillName: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="TrySkills.sh" width={28} height={28} />
          <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
            tryskills<span className="text-[var(--accent)]">.sh</span>
          </span>
        </Link>
        <div className="font-mono text-xs text-[var(--text-muted)]">
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

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);

  const [phase, setPhase] = useState<AppPhase>("config");
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const launchConfigRef = useRef<LaunchConfig | null>(null);

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
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <Header owner="" repo="" skillName="" />
        <div className="relative z-10 pt-24 pb-12 max-w-3xl mx-auto px-6">
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="text-[var(--text-primary)] font-semibold mb-2">Invalid skill path</div>
            <div className="text-[var(--text-secondary)] text-sm mb-6">
              Expected format: /owner/repo/skill-name
            </div>
            <Link href="/" className="px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-all">
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <Header owner={owner} repo={repo} skillName={skillName} />

      <div className="relative z-10 pt-24 pb-12 max-w-3xl mx-auto px-6">
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
    </main>
  );
}
