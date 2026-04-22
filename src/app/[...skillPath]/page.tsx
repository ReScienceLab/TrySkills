"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";

async function computeConfigHash(provider: string, model: string, key: string): Promise<string> {
  const data = new TextEncoder().encode(`${provider}:${model}:${key}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress, type LaunchMode } from "@/components/launch-progress";
import { ChatPanel } from "@/components/chat/chat-panel";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { resolveSkillPath, fetchSkillDirectory } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox, installSkill } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { getProvider } from "@/lib/providers/registry";
import { OnboardingModal } from "@/components/onboarding-modal";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "config" | "launching" | "running";

const autoLaunchLock = new Map<string, boolean>();

export default function SkillPage({
  params,
}: {
  params: Promise<{ skillPath: string[] }>;
}) {
  const resolvedParams = use(params);
  const { skillPath } = resolvedParams;
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("session") ?? undefined;
  const { isSignedIn, isLoaded: authLoaded, userId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config: savedConfig, loading: keysLoading } = useKeyStore();
  const createSandboxRecord = useMutation(api.sandboxes.create);
  const removeSandboxRecord = useMutation(api.sandboxes.remove);
  const updateSandboxState = useMutation(api.sandboxes.updateState);
  const acquireCreateLock = useMutation(api.sandboxes.acquireCreateLock);
  const updatePoolState = useMutation(api.sandboxes.updatePoolState);
  const addInstalledSkillMut = useMutation(api.sandboxes.addInstalledSkill);
  const recordTrial = useMutation(api.skillTrials.record);
  const userSandbox = useQuery(
    api.sandboxes.getSandbox,
    isAuthenticated ? {} : "skip",
  );
  const resumeSession = useQuery(
    api.chatSessions.get,
    resumeSessionId && isAuthenticated
      ? { sessionId: resumeSessionId as Id<"chatSessions"> }
      : "skip",
  );

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);
  const skillKey = `${owner}/${repo}/${skillName}`;

  const [phase, setPhase] = useState<AppPhase>("config");
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [launchMode, setLaunchMode] = useState<LaunchMode>("snapshot");
  const [needsWake, setNeedsWake] = useState(false);
  const launchConfigRef = useRef<LaunchConfig | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);
  const autoLaunchFired = useRef(false);
  const launchAbortRef = useRef<AbortController | null>(null);
  const placeholderIdRef = useRef<string | null>(null);
  const userCancelled = useRef(false);

  useHeartbeat(session?.sandboxId ?? null, savedConfig?.sandboxKey ?? null);

  const handleLaunch = async (config: LaunchConfig) => {
    launchAbortRef.current?.abort();
    const abort = new AbortController();
    launchAbortRef.current = abort;

    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxError(undefined);

    const skillPathStr = `${owner}/${repo}/${skillName}`;
    const configHash = await computeConfigHash(config.provider.id, config.model, config.llmKey);

    // Check for existing sandbox (read-only query, no lock)
    const sandbox = userSandbox;

    if (sandbox && sandbox.status === "found" && !abort.signal.aborted) {
      const isStopped = sandbox.poolState === "stopped";
      const skillInstalled = sandbox.installedSkills?.includes(skillPathStr) ?? false;
      const sameConfig = sandbox.configHash === configHash;
      const urlFresh = sandbox.gatewayUrlCreatedAt
        ? Date.now() - sandbox.gatewayUrlCreatedAt < 50 * 60 * 1000
        : false;
      const heartbeatRecent = sandbox.lastHeartbeat
        ? Date.now() - sandbox.lastHeartbeat < 30 * 60 * 1000
        : false;

      // INSTANT PATH: skill installed + same config + active + URL fresh + heartbeat recent
      if (skillInstalled && sameConfig && !isStopped && urlFresh && heartbeatRecent) {
        const sess = {
          sandboxId: sandbox.sandboxId,
          gatewayUrl: sandbox.gatewayUrl,
          gatewayBaseUrl: sandbox.gatewayUrl,
          state: "running" as const,
          startedAt: Date.now(),
        };
        setSession(sess);
        sessionRef.current = sess;
        setSandboxState("running");
        setPhase("running");
        await updatePoolState({
          sandboxId: sandbox.sandboxId,
          poolState: "active",
          currentSkillPath: skillPathStr,
          configHash,
        }).catch(() => {});
        recordTrial({ sandboxId: sandbox.sandboxId, skillPath: skillPathStr, skillName }).catch(() => {});
        return;
      }

      // INSTALL PATH: upload skill files (no sandbox-level lock needed)
      setLaunchMode("hotswap");
      setNeedsWake(isStopped);
      setSandboxState(isStopped ? "starting" : "uploading");

      try {
        const skillFiles = await fetchSkillDirectory(resolved);
        if (abort.signal.aborted) return;

        const result = await installSkill(
          {
            daytonaApiKey: config.sandboxKey,
            llmProvider: config.provider.id,
            llmApiKey: config.llmKey,
            llmModel: config.model,
          },
          sandbox.sandboxId,
          skillPathStr,
          skillFiles,
          (step) => {
            if (abort.signal.aborted) return;
            setSandboxState(step as SandboxState);
          },
          {
            skipConfigWrite: sameConfig,
            existingGatewayUrl: sandbox.gatewayUrl,
            gatewayUrlCreatedAt: sandbox.gatewayUrlCreatedAt ?? undefined,
          },
        );

        if (abort.signal.aborted) return;

        setSession(result);
        sessionRef.current = result;
        setSandboxState("running");
        setPhase("running");

        await updatePoolState({
          sandboxId: sandbox.sandboxId,
          poolState: "active",
          currentSkillPath: skillPathStr,
          gatewayUrl: result.gatewayUrl,
          configHash: sameConfig ? undefined : configHash,
          gatewayUrlCreatedAt: result.urlRefreshed ? Date.now() : undefined,
        }).catch(() => {});
        addInstalledSkillMut({ sandboxId: sandbox.sandboxId, skillPath: skillPathStr }).catch(() => {});
        recordTrial({ sandboxId: sandbox.sandboxId, skillPath: skillPathStr, skillName }).catch(() => {});
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("not found")) {
          console.error("[install] Sandbox not found in Daytona, removing stale record");
          await removeSandboxRecord({ sandboxId: sandbox.sandboxId }).catch(() => {});
          // Fall through to cold create path below
        } else {
          console.error("[install] installSkill failed:", err);
          setSandboxState("error");
          setSandboxError(err instanceof Error ? err.message : "Install failed");
          return;
        }
      }
    }

    // Sandbox is being created by another tab -- wait for it
    if (sandbox && sandbox.status === "creating") {
      setSandboxState("creating");
      setPhase("launching");
      // Don't return -- the useEffect below will re-trigger handleLaunch
      // when userSandbox changes from "creating" to "found"
      return;
    }

    if (abort.signal.aborted) return;

    // COLD CREATE PATH: no sandbox exists, acquire create lock
    const lock = await acquireCreateLock({}).catch(() => null);

    if (!lock) {
      setSandboxState("error");
      setSandboxError("Failed to acquire sandbox. Please try again.");
      return;
    }

    if (lock.status === "exists" || lock.status === "creating") {
      // Another tab created/is creating -- wait for userSandbox query to update
      setSandboxState("creating");
      setPhase("launching");
      return;
    }

    // lock.status === "acquired"
    const placeholderId = lock.placeholderId;
    placeholderIdRef.current = placeholderId;
    setLaunchMode("snapshot");
    setNeedsWake(false);
    setSandboxState("creating");

    try {
      const skillFiles = await fetchSkillDirectory(resolved);
      if (abort.signal.aborted) {
        removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
        return;
      }

      const result = await createHermesSandbox(
        {
          daytonaApiKey: config.sandboxKey,
          llmProvider: config.provider.id,
          llmApiKey: config.llmKey,
          llmModel: config.model,
        },
        skillPathStr,
        skillFiles,
        (step, meta) => {
          if (abort.signal.aborted) return;
          setSandboxState(step as SandboxState);
          if (meta?.usedSnapshot === false) setLaunchMode("cold");
          updateSandboxState({ sandboxId: placeholderId, state: step }).catch(() => {});
        },
        userId ?? undefined,
      );

      if (abort.signal.aborted) {
        destroySandbox(config.sandboxKey, result.sandboxId).catch(() => {});
        removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
        return;
      }

      setSession(result);
      sessionRef.current = result;
      setSandboxState("running");
      setPhase("running");
      placeholderIdRef.current = null;

      // Insert real record BEFORE deleting placeholder to avoid null window.
      // If insert fails, destroy sandbox to prevent orphan.
      try {
        await createSandboxRecord({
          sandboxId: result.sandboxId,
          skillPath: skillPathStr,
          gatewayUrl: result.gatewayUrl,
          state: "running",
          poolState: "active",
          currentSkillPath: skillPathStr,
          configHash,
          installedSkills: [skillPathStr],
          gatewayUrlCreatedAt: Date.now(),
          cpu: result.cpu,
          memory: result.memory,
          disk: result.disk,
          region: result.region,
        });
        await removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
      } catch {
        // Real record insert failed -- destroy sandbox to prevent orphan
        destroySandbox(config.sandboxKey, result.sandboxId).catch(() => {});
        await removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
        setSession(null);
        sessionRef.current = null;
        setPhase("launching");
        setSandboxState("error");
        setSandboxError("Failed to save sandbox record. Please try again.");
        return;
      }
      recordTrial({ sandboxId: result.sandboxId, skillPath: skillPathStr, skillName }).catch(() => {});
    } catch (err) {
      if (abort.signal.aborted) return;
      setSandboxState("error");
      setSandboxError(err instanceof Error ? err.message : "Launch failed");
      await removeSandboxRecord({ sandboxId: placeholderId }).catch(() => {});
      placeholderIdRef.current = null;
    }
  };

  // Re-trigger launch when sandbox becomes available or stale lock expires
  useEffect(() => {
    if (phase !== "launching" || sandboxState !== "creating") return;
    if (!launchConfigRef.current) return;
    // Retry when: sandbox found (another tab finished) OR null (stale lock expired)
    if (userSandbox === undefined) return; // query still loading
    if (userSandbox && userSandbox.status === "creating") return; // still creating, keep waiting
    void handleLaunch(launchConfigRef.current);
  }, [userSandbox, phase, sandboxState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    launchAbortRef.current?.abort();
    launchAbortRef.current = null;

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
      // Sandbox stays active for instant reuse
      if (sessionRef.current) {
        // no-op: sandbox remains active
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      launchAbortRef.current?.abort();
      autoLaunchLock.delete(skillKey);
      // Also cleanup on SPA navigation (React cleanup)
      if (sessionRef.current) {
        // no-op: sandbox remains active
      }
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

  const handleTryAnother = () => {
    // Sandbox stays active for reuse on next skill page
    setSession(null);
    sessionRef.current = null;
    setSandboxState("idle");
    setPhase("config");
    window.location.href = "/";
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
                mode={launchMode}
                needsWake={needsWake}
              />
            </div>
          )}

          {phase === "running" && session && (
            <ChatPanel
              gatewayBaseUrl={session.gatewayBaseUrl || session.gatewayUrl}
              model={savedConfig?.model || "anthropic/claude-sonnet-4"}
              skillName={skillName}
              skillPath={skillKey}
              startedAt={session.startedAt}
              providerId={savedConfig?.providerId}
              apiKey={savedConfig?.llmKey}
              initialSessionId={resumeSessionId}
              initialMessages={resumeSession?.messages}
              onStop={handleStop}
              onTryAnother={handleTryAnother}
              onSessionError={async () => {
                // Sandbox may be dead -- destroy Daytona sandbox + clear record
                if (session?.sandboxId && launchConfigRef.current) {
                  destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId).catch(() => {});
                  await removeSandboxRecord({ sandboxId: session.sandboxId }).catch(() => {});
                }
                setSession(null);
                sessionRef.current = null;
                autoLaunchFired.current = false;
                autoLaunchLock.delete(skillKey);
                setPhase("config");
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
