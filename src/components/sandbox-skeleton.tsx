"use client";

import { ArrowRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

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
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>

          {/* Thinking indicator */}
          <div className="flex gap-3 mt-6">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
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
            <Skeleton className="h-10 flex-1 rounded-[6px]" />
            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.04] text-muted-foreground shadow-[var(--shadow-border)]">
              <ArrowRight className="size-4" />
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
