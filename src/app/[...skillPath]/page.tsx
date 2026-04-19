"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress } from "@/components/launch-progress";
import { SessionControl } from "@/components/session-control";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { resolveSkillPath, fetchSkillDirectory } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";
import { getProvider } from "@/lib/providers/registry";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "config" | "launching" | "running";

export default function SkillPage({
  params,
}: {
  params: Promise<{ skillPath: string[] }>;
}) {
  const resolvedParams = use(params);
  const { skillPath } = resolvedParams;
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { config: savedConfig, loading: keysLoading, save } = useKeyStore();

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);

  const [phase, setPhase] = useState<AppPhase>("config");
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const launchConfigRef = useRef<LaunchConfig | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);
  const autoLaunchFired = useRef(false);

  const handleLaunch = async (config: LaunchConfig) => {
    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxState("creating");
    setSandboxError(undefined);

    // Save config on launch
    await save({
      providerId: config.provider.id,
      model: config.model,
      llmKey: config.llmKey,
      sandboxKey: config.sandboxKey,
    });

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
      sessionRef.current = result;
      setSandboxState("running");
      setPhase("running");

      window.open(result.webuiUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setSandboxState("error");
      setSandboxError(err instanceof Error ? err.message : "Launch failed");
    }
  };

  // Auto-launch if keys are already saved
  useEffect(() => {
    if (autoLaunchFired.current || !isSignedIn || keysLoading || !savedConfig) return;
    if (!savedConfig.llmKey || !savedConfig.sandboxKey) return;
    const provider = getProvider(savedConfig.providerId);
    if (!provider) return;

    autoLaunchFired.current = true;
    void handleLaunch({
      provider,
      model: savedConfig.model,
      llmKey: savedConfig.llmKey,
      sandboxKey: savedConfig.sandboxKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, keysLoading, savedConfig]);

  useEffect(() => {
    const cleanup = () => {
      if (sessionRef.current && launchConfigRef.current) {
        destroySandbox(launchConfigRef.current.sandboxKey, sessionRef.current.sandboxId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
    };
  }, []);

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
    sessionRef.current = null;
    setSandboxState("idle");
    setPhase("config");
    autoLaunchFired.current = false;
  };

  const handleRetryLaunch = () => {
    if (launchConfigRef.current) {
      void handleLaunch(launchConfigRef.current);
    }
  };

  if (!isValidPath) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <SiteHeader />
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
      <SiteHeader breadcrumb={`${owner}/${repo}/${skillName}`} />

      <div className="flex-1 flex items-center justify-center relative z-10 px-6">
        <div className="w-full max-w-[640px]">
          {phase === "config" && !authLoaded && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          )}

          {phase === "config" && authLoaded && !isSignedIn && (
            <div className="animate-fade-in">
              <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <h2 className="text-lg font-semibold text-white/90 mb-2">Sign in to continue</h2>
                <p className="text-sm text-white/50 mb-6">
                  Sign in with GitHub to configure and launch your agent session.
                </p>
                <SignInButton mode="modal">
                  <button className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
                    Sign in with GitHub
                  </button>
                </SignInButton>
              </div>
            </div>
          )}

          {phase === "config" && isSignedIn && keysLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          )}

          {phase === "config" && isSignedIn && !keysLoading && !savedConfig?.llmKey && (
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
                void handleStop();
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
