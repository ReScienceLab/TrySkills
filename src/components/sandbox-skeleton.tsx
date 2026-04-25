"use client";

export function SandboxSkeleton({ skillName }: { skillName: string }) {
  return (
    <div className="animate-fade-in w-full">
      <div className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)]">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-white/[0.02] px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#0a72ef]" />
            <span className="font-mono text-xs text-muted-foreground">
              {skillName}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            preparing...
          </span>
        </div>

        {/* Chat area skeleton */}
        <div className="min-h-[320px] space-y-4 p-6">
          {/* System message */}
          <div className="flex gap-3">
            <div className="h-6 w-6 shrink-0 rounded-full bg-white/[0.04]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" style={{ animationDelay: "100ms" }} />
            </div>
          </div>

          {/* Thinking indicator */}
          <div className="flex gap-3 mt-6">
            <div className="h-6 w-6 shrink-0 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-1 py-2">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>

        {/* Input area (disabled) */}
        <div className="px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 flex-1 items-center rounded-[6px] bg-white/[0.03] px-3 shadow-[var(--shadow-border)]">
              <span className="text-xs text-muted-foreground">
                Agent is starting up...
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.04] shadow-[var(--shadow-border)]">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar below */}
      <div className="mt-3 flex items-center px-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a72ef]" />
          <span className="text-[11px] text-muted-foreground">Setting up environment...</span>
        </div>
      </div>
    </div>
  );
}
