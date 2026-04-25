"use client";

import { useState, useEffect, useMemo, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { Folder, Loader2, LockKeyhole } from "lucide-react";

async function computeConfigHash(provider: string, model: string, key: string, envVars?: Record<string, string>): Promise<string> {
  const envPart = envVars && Object.keys(envVars).length > 0
    ? JSON.stringify(envVars, Object.keys(envVars).sort())
    : ""
  const data = new TextEncoder().encode(`${provider}:${model}:${key}:${envPart}`);
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
import { SiteHeader } from "@/components/site-header";
import { resolveSkillPath, fetchSkillContent } from "@/lib/skill/resolver";
import { createHermesSandbox, destroySandbox, installSkill, type SkillSource } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { getProvider } from "@/lib/providers/registry";
import { OnboardingModal } from "@/components/onboarding-modal";
import { EnvVarsPrompt } from "@/components/env-vars-prompt";
import { extractSkillEnvVars, type SkillEnvVar } from "@/lib/skill/env-vars";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { useWorkspace } from "@/hooks/use-workspace";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/product-ui";

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
  const { config: savedConfig, loading: keysLoading, save: saveConfig } = useKeyStore();
  const createSandboxRecord = useMutation(api.sandboxes.create);
  const removeSandboxRecord = useMutation(api.sandboxes.remove);
  const updateSandboxState = useMutation(api.sandboxes.updateState);
  const acquireCreateLock = useMutation(api.sandboxes.acquireCreateLock);
  const updatePoolState = useMutation(api.sandboxes.updatePoolState);
  const addInstalledSkillMut = useMutation(api.sandboxes.addInstalledSkill);
  const syncInstalledSkills = useMutation(api.sandboxes.syncInstalledSkills);
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
  const [userCancelled, setUserCancelled] = useState(false);

  const [detectedEnvVars, setDetectedEnvVars] = useState<SkillEnvVar[]>([]);
  const [showEnvPrompt, setShowEnvPrompt] = useState(false);
  const [pendingEnvVars, setPendingEnvVars] = useState<Record<string, string>>({});
  const pendingLaunchRef = useRef<LaunchConfig | null>(null);

  useHeartbeat(session?.sandboxId ?? null, savedConfig?.sandboxKey ?? null);

  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [chatIsStreaming, setChatIsStreaming] = useState(false);
  const effectiveWorkspacePath = workspacePath ?? resumeSession?.workspacePath ?? null;
  const workspace = useWorkspace(
    session?.sandboxId ?? null,
    savedConfig?.sandboxKey ?? null,
    effectiveWorkspacePath,
    chatIsStreaming,
  );

  // Early fetch: detect env vars from SKILL.md on page load
  useEffect(() => {
    if (!isValidPath) return
    let cancelled = false
    fetchSkillContent(resolved).then((content) => {
      if (cancelled || !content) return
      const vars = extractSkillEnvVars(content)
      setDetectedEnvVars(vars)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isValidPath, resolved]);

  const handleLaunch = async (config: LaunchConfig) => {
    // Check for missing skill-specific env vars before launching
    if (detectedEnvVars.length > 0 && !pendingLaunchRef.current) {
      const configured = config.envVars ?? {}
      const missing = detectedEnvVars.filter((v) => !configured[v.name])
      if (missing.length > 0) {
        pendingLaunchRef.current = config
        setPendingEnvVars(config.envVars ?? {})
        setShowEnvPrompt(true)
        return
      }
    }
    pendingLaunchRef.current = null
    setPendingEnvVars({})

    launchAbortRef.current?.abort();
    const abort = new AbortController();
    launchAbortRef.current = abort;

    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxError(undefined);

    const skillPathStr = `${owner}/${repo}/${skillName}`;
    const configHash = await computeConfigHash(config.provider.id, config.model, config.llmKey, config.envVars);

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
        const skillSource: SkillSource = { owner, repo, skillName }
        if (abort.signal.aborted) return;

        const result = await installSkill(
          {
            daytonaApiKey: config.sandboxKey,
            llmProvider: config.provider.id,
            llmApiKey: config.llmKey,
            llmModel: config.model,
            envVars: config.envVars,
          },
          sandbox.sandboxId,
          skillPathStr,
          skillSource,
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
        if (result.discoveredSkills?.length) {
          syncInstalledSkills({ sandboxId: sandbox.sandboxId, discoveredSkills: result.discoveredSkills }).catch(() => {});
        }
        recordTrial({ sandboxId: sandbox.sandboxId, skillPath: skillPathStr, skillName }).catch(() => {});
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("not found")) {
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
      const skillSource: SkillSource = { owner, repo, skillName }
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
          envVars: config.envVars,
        },
        skillPathStr,
        skillSource,
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
      if (result.discoveredSkills?.length) {
        syncInstalledSkills({ sandboxId: result.sandboxId, discoveredSkills: result.discoveredSkills }).catch(() => {});
      }
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
    queueMicrotask(() => {
      if (launchConfigRef.current) void handleLaunch(launchConfigRef.current);
    });
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
    setUserCancelled(true);
  };

  const hasCompleteConfig = !!(savedConfig?.llmKey && savedConfig?.sandboxKey);
  const sandboxQueryReady = userSandbox !== undefined;

  useEffect(() => {
    if (autoLaunchLock.get(skillKey) || autoLaunchFired.current || userCancelled) return;
    if (phase !== "config") return;
    if (!isSignedIn || !isAuthenticated || keysLoading || !savedConfig) return;
    if (!sandboxQueryReady) return;
    if (!savedConfig.llmKey || !savedConfig.sandboxKey) return;
    const provider = getProvider(savedConfig.providerId);
    if (!provider) return;

    autoLaunchFired.current = true;
    autoLaunchLock.set(skillKey, true);
    queueMicrotask(() => void handleLaunch({
      provider,
      model: savedConfig.model,
      llmKey: savedConfig.llmKey,
      sandboxKey: savedConfig.sandboxKey,
      envVars: savedConfig.envVars,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isAuthenticated, keysLoading, savedConfig, phase, sandboxQueryReady, userCancelled]);

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
    setUserCancelled(true);
  };

  const handleTryAnother = () => {
    // Sandbox stays active for reuse on next skill page
    setSession(null);
    sessionRef.current = null;
    setSandboxState("idle");
    setPhase("config");
    window.location.assign("/");
  };

  const handleRetryLaunch = () => {
    if (launchConfigRef.current) {
      void handleLaunch(launchConfigRef.current);
    }
  };

  const handleEnvVarsConfigure = async (newEnvVars: Record<string, string>) => {
    setShowEnvPrompt(false)
    const config = pendingLaunchRef.current
    if (!config) return
    const merged = { ...config.envVars, ...newEnvVars }
    const updatedConfig = { ...config, envVars: merged }
    // Save the env vars to the user's settings
    if (savedConfig) {
      await saveConfig({ ...savedConfig, envVars: merged }).catch(() => {})
    }
    pendingLaunchRef.current = updatedConfig
    setPendingEnvVars(updatedConfig.envVars ?? {})
    void handleLaunch(updatedConfig)
  }

  const handleEnvVarsSkip = () => {
    setShowEnvPrompt(false)
    const config = pendingLaunchRef.current
    if (!config) return
    pendingLaunchRef.current = config
    setPendingEnvVars(config.envVars ?? {})
    void handleLaunch(config)
  }

  const handleWorkspacePathChange = useCallback((path: string) => {
    setWorkspacePath(path);
  }, []);

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setChatIsStreaming(streaming);
  }, []);

  if (!isValidPath) {
    return (
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <div className="flex animate-fade-in flex-col items-center">
            <div className="mb-2 font-semibold text-foreground">Invalid skill path</div>
            <div className="mb-6 text-sm text-muted-foreground">Expected format: /owner/repo/skill-name</div>
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const needsOnboarding = isSignedIn && !keysLoading && !hasCompleteConfig && !userCancelled;
  const readyToAutoLaunch = isSignedIn && !keysLoading && hasCompleteConfig && !userCancelled;
  const isResumeSessionLoading = !!resumeSessionId && (!isAuthenticated || resumeSession === undefined);
  const verifiedResumeSessionId = resumeSession ? resumeSessionId : undefined;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <SiteHeader breadcrumb={`${owner}/${repo}/${skillName}`} />

      {showEnvPrompt && detectedEnvVars.length > 0 && (
        <EnvVarsPrompt
          skillName={skillName}
          missingVars={detectedEnvVars.filter(
            (v) => !pendingEnvVars[v.name],
          )}
          onConfigure={handleEnvVarsConfigure}
          onSkip={handleEnvVarsSkip}
        />
      )}

      {phase === "running" && session ? (
        <div className={`relative z-10 flex-1 overflow-hidden bg-background pt-14 ${workspace.panelOpen ? "lg:pr-[360px]" : ""}`}>
          {/* Chat column */}
          <div className="mx-auto min-w-0 max-w-4xl flex-1">
            {isResumeSessionLoading ? (
              <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading chat session...</div>
              </div>
            ) : (
              <ChatPanel
                gatewayBaseUrl={session.gatewayBaseUrl || session.gatewayUrl}
                model={savedConfig?.model || "anthropic/claude-sonnet-4"}
                skillName={skillName}
                skillPath={skillKey}
                startedAt={session.startedAt}
                providerId={savedConfig?.providerId}
                apiKey={savedConfig?.llmKey}
                initialSessionId={verifiedResumeSessionId}
                initialMessages={resumeSession?.messages}
                sandboxId={session.sandboxId}
                sandboxKey={savedConfig?.sandboxKey}
                initialWorkspacePath={resumeSession?.workspacePath}
                onStop={handleStop}
                onTryAnother={handleTryAnother}
                onToolComplete={workspace.onToolComplete}
                onWorkspacePathChange={handleWorkspacePathChange}
                onStreamingChange={handleStreamingChange}
                onSessionError={async () => {
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

          {/* Workspace panel */}
          {workspace.panelOpen && (
            <div className="fixed right-0 top-14 bottom-0 z-30 hidden w-[360px] lg:block">
              <WorkspacePanel
                entries={workspace.entries}
                selectedFile={workspace.selectedFile}
                fileContent={workspace.fileContent}
                loadingTree={workspace.loadingTree}
                loadingFile={workspace.loadingFile}
                treeError={workspace.treeError}
                fileError={workspace.fileError}
                onSelectFile={workspace.selectFile}
                onCloseFile={workspace.closeFile}
                onRefresh={workspace.refreshTree}
                onClose={() => workspace.setPanelOpen(false)}
                sandboxId={session?.sandboxId}
                sandboxKey={savedConfig?.sandboxKey}
              />
            </div>
          )}

          {/* Workspace toggle button (when panel is closed) */}
          {!workspace.panelOpen && workspace.entries.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => workspace.setPanelOpen(true)}
              className="fixed right-4 bottom-6 z-20 hidden items-center gap-2 text-[13px] lg:flex"
              title="Open workspace files"
            >
              <Folder className="h-4 w-4" />
              Files
              <span className="rounded-full bg-[rgba(0,112,243,0.16)] px-1.5 py-0.5 text-[11px] text-[#58a6ff]">{workspace.entries.length}</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-[640px]">
          {phase === "config" && !authLoaded && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase === "config" && authLoaded && !isSignedIn && (
            <div className="animate-fade-in">
              <Surface className="p-8 text-center">
                <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-[8px] bg-white/[0.04] text-muted-foreground shadow-[var(--shadow-border)]">
                  <LockKeyhole className="size-5" />
                </span>
                <h2 className="mb-2 text-lg font-semibold text-foreground">Sign in to continue</h2>
                <p className="mb-6 text-sm text-muted-foreground">Sign in with GitHub to configure and launch your agent session.</p>
                <SignInButton mode="modal" forceRedirectUrl={`/${skillPath.join("/")}`}>
                  <Button>Sign in with GitHub</Button>
                </SignInButton>
              </Surface>
            </div>
          )}

          {phase === "config" && isSignedIn && keysLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase === "config" && needsOnboarding && (
            <OnboardingModal
              onComplete={() => { window.location.reload(); }}
              skillEnvVars={detectedEnvVars.length > 0 ? detectedEnvVars : undefined}
            />
          )}

          {/* Show config after user cancels */}
          {phase === "config" && isSignedIn && !keysLoading && userCancelled && (
            <ConfigPanel
              onLaunch={handleLaunch}
              onBack={() => { window.location.assign("/"); }}
            />
          )}

          {phase === "config" && readyToAutoLaunch && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
        </div>
      </div>
      )}
    </main>
  );
}
