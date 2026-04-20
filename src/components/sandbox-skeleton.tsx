"use client";

export function SandboxSkeleton({ skillName }: { skillName: string }) {
  return (
    <div className="animate-fade-in w-full">
      <div className="border border-white/10 bg-black/60 backdrop-blur-sm rounded-lg overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-white/50">
              {skillName}
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-mono">
            preparing...
          </span>
        </div>

        {/* Chat area skeleton */}
        <div className="p-6 space-y-4 min-h-[320px]">
          {/* System message */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-white/5 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" style={{ animationDelay: "100ms" }} />
            </div>
          </div>

          {/* Thinking indicator */}
          <div className="flex gap-3 mt-6">
            <div className="w-6 h-6 rounded-full bg-white/5 shrink-0" />
            <div className="flex items-center gap-1 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>

        {/* Input area (disabled) */}
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-10 rounded bg-white/[0.03] border border-white/10 flex items-center px-3">
              <span className="text-xs text-white/20">
                Agent is starting up...
              </span>
            </div>
            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
              <svg className="w-4 h-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar below */}
      <div className="mt-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[11px] text-white/30">Setting up environment...</span>
        </div>
        <button className="text-[11px] text-white/20 hover:text-white/40 transition-colors">
          cancel
        </button>
      </div>
    </div>
  );
}
