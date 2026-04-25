"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SiteHeader } from "@/components/site-header";
import { destroySandbox } from "@/lib/sandbox/daytona";
import { useKeyStore } from "@/hooks/use-key-store";
import { NousResearch } from "@lobehub/icons";
import { Check, Copy, ExternalLink, Loader2, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface, StatusBadge } from "@/components/product-ui";

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

const PAGE_SIZE = 20;

function SandboxDetailsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full max-w-[320px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.03] px-4 py-3 shadow-[var(--shadow-border)]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-[280px]" />
              <Skeleton className="h-3 w-full max-w-[220px]" />
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Skeleton className="h-8 w-24 rounded-[6px]" />
            <Skeleton className="h-8 w-20 rounded-[6px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardPageSkeleton() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />
      <div className="relative z-10 flex-1 px-6 pb-10 pt-20">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="mb-8 h-8 w-40" />
          <Surface className="mb-8 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-6 w-36" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <SandboxDetailsSkeleton />
          </Surface>
          <Surface className="p-6">
            <Skeleton className="mb-4 h-6 w-36" />
            <DashboardRowsSkeleton rows={3} />
          </Surface>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { config } = useKeyStore();

  const sandboxes = useQuery(api.sandboxes.list, isAuthenticated ? {} : "skip");
  const trials = useQuery(api.skillTrials.list, isAuthenticated ? {} : "skip");
  const chatSessionsList = useQuery(api.chatSessions.list, isAuthenticated ? {} : "skip");
  const removeSandbox = useMutation(api.sandboxes.remove);
  const removeChatSession = useMutation(api.chatSessions.remove);
  const dataLoading = isAuthenticated && (
    sandboxes === undefined ||
    trials === undefined ||
    chatSessionsList === undefined
  );

  const STALE_PENDING_MS = 5 * 60 * 1000;
  const [now] = useState(() => Date.now());
  const sandboxList = sandboxes ?? [];
  const sandbox = sandboxList.find((s) => !s.sandboxId.startsWith("pending-"))
    ?? sandboxList.find((s) =>
      s.sandboxId.startsWith("pending-") && now - s.createdAt <= STALE_PENDING_MS
    );
  const trialList = trials ?? [];

  const [liveInfo, setLiveInfo] = useState<SandboxLiveInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sessions = (chatSessionsList ?? []).filter((s) => s.messageCount > 0);

  const isRealSandbox = sandbox && !sandbox.sandboxId.startsWith("pending-");

  useEffect(() => {
    if (!isRealSandbox || !sandbox?.sandboxId || !config?.sandboxKey || liveInfo) return;
    let cancelled = false;
    void fetch(`/api/sandbox?id=${sandbox.sandboxId}&key=${encodeURIComponent(config.sandboxKey)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data) setLiveInfo(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isRealSandbox, sandbox?.sandboxId, config?.sandboxKey, liveInfo]);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await removeChatSession({ sessionId: sessionId as Parameters<typeof removeChatSession>[0]["sessionId"] });
    } catch {
      // best effort
    }
  };

  const handleResumeSession = (session: typeof sessions[0]) => {
    window.location.assign(`/${session.skillPath}?session=${session._id}`);
  };

  const handleDestroy = async () => {
    if (!isRealSandbox || !config?.sandboxKey || destroying) return;
    setDestroying(true);
    try {
      try { await destroySandbox(config.sandboxKey, sandbox.sandboxId); } catch {}
      await removeSandbox({ sandboxId: sandbox.sandboxId });
      setLiveInfo(null);
    } finally {
      setDestroying(false);
    }
  };

  const handleWakeUp = () => {
    if (!sandbox?.currentSkillPath) return;
    window.location.href = `/${sandbox.currentSkillPath}`;
  };

  const handleCopyId = () => {
    if (!isRealSandbox) return;
    void navigator.clipboard.writeText(sandbox.sandboxId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isLoaded) {
    return <DashboardPageSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <Surface className="max-w-md p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold text-foreground">Sign in to view dashboard</h2>
            <p className="mb-6 text-sm text-muted-foreground">Manage your Hermes agent sandbox.</p>
            <SignInButton mode="modal">
              <Button>
                Sign in with GitHub
              </Button>
            </SignInButton>
          </Surface>
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
  const dotColor = isCreating
    ? "bg-[#0a72ef] animate-pulse"
    : isActive
      ? "bg-[#0a72ef] animate-pulse"
      : isStopped
        ? "bg-white/30"
        : "bg-white/20";

  const formatTime = (ts: number | string) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const cpu = liveInfo?.cpu ?? sandbox?.cpu;
  const memory = liveInfo?.memory ?? sandbox?.memory;
  const disk = sandbox?.disk;
  const statusTone = isCreating || isActive ? "develop" : isStopped ? "ship" : "neutral";

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />

      <div className="relative z-10 flex-1 px-6 pb-10 pt-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-2xl font-semibold text-foreground">Dashboard</h1>

          {/* Sandbox Card */}
          <Surface className="mb-8 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <NousResearch size={24} className="text-foreground" />
                  <div className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${dotColor}`} />
                </div>
                <h2 className="text-lg font-medium text-foreground">Hermes Agent</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {dataLoading ? (
                  <Skeleton className="h-6 w-16 rounded-full" />
                ) : (
                  <StatusBadge tone={statusTone}>
                    {statusLabel}
                  </StatusBadge>
                )}
                {!dataLoading && isRealSandbox && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={handleWakeUp}
                      disabled={!sandbox.currentSkillPath}
                      aria-label="Open current skill"
                    >
                      <Play className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Sandbox actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Sandbox Controls</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={handleWakeUp}
                          disabled={!sandbox.currentSkillPath}
                        >
                          <Play className="size-4" />
                          Open Current Skill
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`https://app.daytona.io/dashboard/sandboxes/${sandbox.sandboxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Open in Daytona
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopyId}>
                          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copied ? "Copied ID" : "Copy Sandbox ID"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={handleDestroy}
                          disabled={!config?.sandboxKey || destroying}
                        >
                          {destroying ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>

            {dataLoading ? (
              <SandboxDetailsSkeleton />
            ) : isCreating && !isRealSandbox ? (
              <div className="flex items-center gap-2 text-sm text-[#58a6ff]">
                <Loader2 className="size-3.5 animate-spin" />
                Creating sandbox...
              </div>
            ) : isRealSandbox ? (
              <>
                <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">ID</span>
                    <span className="truncate font-mono text-muted-foreground">{sandbox.sandboxId}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleCopyId}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={copied ? "Copied sandbox ID" : "Copy sandbox ID"}
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </Button>
                  </div>
                  {sandbox.region && (
                    <div>
                      <span className="text-muted-foreground">Region </span>
                      <span className="text-foreground">{sandbox.region.toUpperCase()}</span>
                    </div>
                  )}
                  {cpu && (
                    <div>
                      <span className="text-muted-foreground">CPU </span>
                      <span className="text-foreground">{cpu} vCPU</span>
                    </div>
                  )}
                  {memory && (
                    <div>
                      <span className="text-muted-foreground">Memory </span>
                      <span className="text-foreground">{memory} GB</span>
                    </div>
                  )}
                  {disk && (
                    <div>
                      <span className="text-muted-foreground">Disk </span>
                      <span className="text-foreground">{disk} GB</span>
                    </div>
                  )}
                  {sandbox.currentSkillPath && (
                    <div>
                      <span className="text-muted-foreground">Current Skill </span>
                      <span className="font-mono text-foreground">{sandbox.currentSkillPath}</span>
                    </div>
                  )}
                  {(liveInfo?.createdAt || sandbox.createdAt) && (
                    <div>
                      <span className="text-muted-foreground">Created </span>
                      <span className="text-foreground">{formatTime(liveInfo?.createdAt ?? sandbox.createdAt)}</span>
                    </div>
                  )}
                  {sandbox.lastHeartbeat && (
                    <div>
                      <span className="text-muted-foreground">Last Heartbeat </span>
                      <span className="text-foreground">{formatTime(sandbox.lastHeartbeat)}</span>
                    </div>
                  )}
                </div>

                {sandbox.installedSkills && sandbox.installedSkills.length > 0 && (
                  <div className="mb-4">
                    <span className="mb-1.5 block text-xs text-muted-foreground">Installed Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sandbox.installedSkills.map((s) => (
                        <StatusBadge key={s} tone="neutral" className="font-mono text-[10px]">
                          {s.includes("/") ? s.split("/").pop() : s}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                )}

              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No sandbox yet. Try a skill to create one automatically.
              </div>
            )}
          </Surface>

          {/* Chat Sessions */}
          {(dataLoading || sessions.length > 0) && (
            <Surface className="mb-8 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-foreground">Chat Sessions</h2>
              </div>

              {dataLoading ? (
                <DashboardRowsSkeleton rows={3} />
              ) : sessions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No chat sessions yet. Start chatting with a skill to create one.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {sessions.slice(0, visibleCount).map((session) => (
                      <div
                        key={session._id}
                        className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3 shadow-[var(--shadow-border)] transition-all hover:bg-white/[0.05] hover:shadow-[var(--shadow-border-strong)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a72ef]" />
                          <div className="min-w-0">
                            <div className="truncate text-sm text-foreground">
                              {session.title || "Untitled"}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{session.model}</span>
                              <span>&middot;</span>
                              <span>{session.messageCount} messages</span>
                              <span>&middot;</span>
                              <span>{formatTime(session.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleResumeSession(session)}
                          >
                            <Play className="size-3.5" />
                            Resume
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteSession(session._id)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {sessions.length > visibleCount && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="mt-3 w-full"
                    >
                      Show more ({sessions.length - visibleCount} remaining)
                    </Button>
                  )}
                </>
              )}
            </Surface>
          )}

          {/* Skill Trial History */}
          <Surface className="p-6">
            <h2 className="mb-4 text-lg font-medium text-foreground">Skill Trials</h2>

            {dataLoading ? (
              <DashboardRowsSkeleton rows={4} />
            ) : trialList.length === 0 ? (
              <div className="text-center py-8">
                <p className="mb-4 text-sm text-muted-foreground">No skills tried yet.</p>
                <Button asChild>
                  <Link href="/">
                  Try a Skill
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {trialList.map((trial) => (
                  <div key={trial._id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3 shadow-[var(--shadow-border)] transition-all hover:bg-white/[0.05] hover:shadow-[var(--shadow-border-strong)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm text-foreground">{trial.skillName}</div>
                        <div className="text-xs text-muted-foreground">{trial.skillPath}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatTime(trial.startedAt)}</span>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <a
                        href={`/${trial.skillPath}`}
                        >
                        Try again
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </div>
    </main>
  );
}
