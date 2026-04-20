"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress } from "@/components/launch-progress";
import { SessionControl } from "@/components/session-control";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { resolveSkillPath, fetchSkillDirectory } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { getProvider } from "@/lib/providers/registry";
import { OnboardingModal } from "@/components/onboarding-modal";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "config" | "launching" | "running";

// Per-skill-path lock to prevent double-launch from React Strict Mode
// Map<skillPath, boolean> -- scoped so different skills can each auto-launch
const autoLaunchLock = new Map<string, boolean>();

export default function SkillPage({
  params,
}: {
  params: Promise<{ skillPath: string[] }>;
}) {
  const resolvedParams = use(params);
  const { skillPath } = resolvedParams;
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config: savedConfig, loading: keysLoading } = useKeyStore();
  const createSandboxRecord = useMutation(api.sandboxes.create);
  const removeSandboxRecord = useMutation(api.sandboxes.remove);
  const updateSandboxState = useMutation(api.sandboxes.updateState);
  const existingSandboxes = useQuery(
    api.sandboxes.list,
    isAuthenticated ? {} : "skip",
  );

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);
  const skillKey = `${owner}/${repo}/${skillName}`;

  const [phase, setPhase] = useState<AppPhase>("config");
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [usedSnapshot, setUsedSnapshot] = useState(true);
  const launchConfigRef = useRef<LaunchConfig | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);
  const autoLaunchFired = useRef(false);
  const launchAbortRef = useRef<AbortController | null>(null);
  const placeholderIdRef = useRef<string | null>(null);
  const userCancelled = useRef(false);

  // Heartbeat: keeps sandbox alive while user is on page
  useHeartbeat(session?.sandboxId ?? null, savedConfig?.sandboxKey ?? null);

  const handleLaunch = async (config: LaunchConfig) => {
    launchAbortRef.current?.abort();
    const abort = new AbortController();
    launchAbortRef.current = abort;

    // Single-sandbox enforcement: note existing sandbox for deferred cleanup
    const previousSandbox = existingSandboxes?.find(
      (s) => s.state === "running",
    );

    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxState("creating");
    setSandboxError(undefined);

    const skillPathStr = `${owner}/${repo}/${skillName}`;
    const placeholderId = `pending-${Date.now()}`;
    placeholderIdRef.current = placeholderId;

    try {
      // Config is already saved by ConfigPanelForm.handleLaunch or auto-launch;
      // do not save again here to avoid overwriting providerKeys with stale data.

      await createSandboxRecord({
        sandboxId: placeholderId,
        skillPath: skillPathStr,
        webuiUrl: "",
        state: "creating",
      }).catch(() => {});

      if (abort.signal.aborted) return;

      const skillFiles = await fetchSkillDirectory(resolved);
      if (abort.signal.aborted) return;

      const result = await createHermesSandbox(
        {
          daytonaApiKey: config.sandboxKey,
          llmProvider: config.provider.id,
          llmApiKey: config.llmKey,
          llmModel: config.model,
        },
        skillName,
        skillFiles,
        (step, meta) => {
          if (abort.signal.aborted) return;
          setSandboxState(step as SandboxState);
          if (meta?.usedSnapshot !== undefined) setUsedSnapshot(meta.usedSnapshot);
          updateSandboxState({ sandboxId: placeholderId, state: step }).catch(() => {});
        },
      );

      if (abort.signal.aborted) {
        destroySandbox(config.sandboxKey, result.sandboxId).catch(() => {});
        removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
        return;
      }

      setSession(result);
      setUsedSnapshot(result.usedSnapshot);
      sessionRef.current = result;
      setSandboxState("running");
      setPhase("running");
      placeholderIdRef.current = null;

      await removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});

      // Deferred cleanup: destroy previous sandbox now that the new one is healthy.
      // destroySandbox is best-effort; if it fails, the cron will clean the record
      // after heartbeat timeout, and Daytona auto-stops the sandbox after 15min idle.
      if (previousSandbox) {
        try {
          await destroySandbox(config.sandboxKey, previousSandbox.sandboxId);
          await removeSandboxRecord({ sandboxId: previousSandbox.sandboxId }).catch(() => {});
        } catch {
          // Sandbox deletion failed — keep the Convex record so the
          // dashboard still shows the orphaned sandbox for manual cleanup.
        }
      }

      await createSandboxRecord({
        sandboxId: result.sandboxId,
        skillPath: skillPathStr,
        webuiUrl: result.webuiUrl,
        state: "running",
        cpu: result.cpu,
        memory: result.memory,
        disk: result.disk,
        region: result.region,
      }).catch(() => {});

      window.open(result.webuiUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (abort.signal.aborted) return;
      setSandboxState("error");
      setSandboxError(err instanceof Error ? err.message : "Launch failed");
      await removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
      placeholderIdRef.current = null;
    }
  };

  const handleCancel = () => {
    launchAbortRef.current?.abort();
    launchAbortRef.current = null;

    // Clean up placeholder dashboard record
    if (placeholderIdRef.current) {
      removeSandboxRecord({ sandboxId: placeholderIdRef.current }).catch(() => {});
      placeholderIdRef.current = null;
    }

    setSession(null);
    sessionRef.current = null;
    setSandboxState("idle");
    setSandboxError(undefined);
    setPhase("config");
    userCancelled.current = true;
  };

  const hasCompleteConfig = !!(savedConfig?.llmKey && savedConfig?.sandboxKey);

  useEffect(() => {
    if (autoLaunchLock.get(skillKey) || autoLaunchFired.current || userCancelled.current) return;
    if (phase !== "config") return;
    if (!isSignedIn || keysLoading || !savedConfig) return;
    if (!savedConfig.llmKey || !savedConfig.sandboxKey) return;
    const provider = getProvider(savedConfig.providerId);
    if (!provider) return;

    autoLaunchFired.current = true;
    autoLaunchLock.set(skillKey, true);
    void handleLaunch({
      provider,
      model: savedConfig.model,
      llmKey: savedConfig.llmKey,
      sandboxKey: savedConfig.sandboxKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, keysLoading, savedConfig, phase]);

  useEffect(() => {
    const cleanup = () => {
      launchAbortRef.current?.abort();
      autoLaunchLock.delete(skillKey);
      if (sessionRef.current && launchConfigRef.current) {
        destroySandbox(launchConfigRef.current.sandboxKey, sessionRef.current.sandboxId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      launchAbortRef.current?.abort();
      // Clear the lock for this skill so a fresh visit can auto-launch
      autoLaunchLock.delete(skillKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillKey]);

  const handleStop = async () => {
    if (session && launchConfigRef.current) {
      setSandboxState("cleaning");
      try {
        await destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId);
      } catch {
        // best effort
      }
      await removeSandboxRecord({ sandboxId: session.sandboxId }).catch(() => {});
    }
    setSession(null);
    sessionRef.current = null;
    setSandboxState("idle");
    setPhase("config");
    userCancelled.current = true;
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
            <div className="text-white/50 text-sm mb-6">Expected format: /owner/repo/skill-name</div>
            <Link href="/" className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">Go home</Link>
          </div>
        </div>
      </main>
    );
  }

  const needsOnboarding = isSignedIn && !keysLoading && !hasCompleteConfig && !userCancelled.current;
  const readyToAutoLaunch = isSignedIn && !keysLoading && hasCompleteConfig && !userCancelled.current && !autoLaunchLock.get(skillKey);

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
                <p className="text-sm text-white/50 mb-6">Sign in with GitHub to configure and launch your agent session.</p>
                <SignInButton mode="modal" forceRedirectUrl={`/${skillPath.join("/")}`}>
                  <button className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">Sign in with GitHub</button>
                </SignInButton>
              </div>
            </div>
          )}

          {phase === "config" && isSignedIn && keysLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          )}

          {phase === "config" && needsOnboarding && (
            <OnboardingModal onComplete={() => {
              window.location.reload();
            }} />
          )}

          {/* Show config after user cancels */}
          {phase === "config" && isSignedIn && !keysLoading && userCancelled.current && (
            <ConfigPanel
              onLaunch={handleLaunch}
              onBack={() => { window.location.href = "/"; }}
            />
          )}

          {phase === "config" && readyToAutoLaunch && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          )}

          {phase === "launching" && (
            <div className="space-y-6">
              <LaunchProgress
                state={sandboxState}
                error={sandboxError}
                onRetry={handleRetryLaunch}
                onCancel={handleCancel}
                usedSnapshot={usedSnapshot}
              />
            </div>
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
