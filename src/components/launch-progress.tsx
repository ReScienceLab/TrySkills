"use client";

import type { SandboxState } from "@/lib/sandbox/types";

const STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "creating", label: "Creating sandbox", description: "Provisioning a secure environment" },
  { key: "uploading", label: "Installing skill", description: "Uploading skill files and dependencies" },
  { key: "starting", label: "Starting agent", description: "Launching Hermes Agent + WebUI" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
];

export function LaunchProgress({
  state,
  error,
  onRetry,
  onCancel,
}: {
  state: SandboxState;
  error?: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === state);

  return (
    <div className="animate-fade-in">
      <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <h2 className="text-base font-semibold text-white/90">
            Launching Agent Session
          </h2>
        </div>

        <div className="relative ml-1 mb-8">
          {STEPS.map((step, i) => {
            const isActive = step.key === state;
            const isDone = currentIdx > i;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.key} className="relative flex gap-4">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[5px] top-[18px] w-px h-[calc(100%-2px)]">
                    <div className={`w-full h-full transition-colors duration-500 ${
                      isDone ? "bg-white/30" : "bg-white/8"
                    }`} />
                  </div>
                )}

                {/* Dot */}
                <div className="relative shrink-0 mt-[6px]">
                  {isDone ? (
                    <div className="w-[11px] h-[11px] rounded-full bg-white/70" />
                  ) : isActive ? (
                    <div className="w-[11px] h-[11px] rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-[11px] h-[11px] rounded-full bg-white/10" />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                  <div className={`text-sm transition-colors ${
                    isDone
                      ? "text-white/40"
                      : isActive
                        ? "text-white font-medium"
                        : "text-white/20"
                  }`}>
                    {step.label}
                  </div>
                  {isActive && (
                    <div className="text-xs text-white/30 mt-0.5">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {state === "error" && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20">
            <div className="text-sm text-red-400 font-medium mb-1">Launch failed</div>
            <div className="text-sm text-white/60">{error || "Unknown error"}</div>
          </div>
        )}

        <div className="flex gap-3">
          {state === "error" ? (
            <>
              <button
                onClick={onRetry}
                className="flex-1 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all"
              >
                Retry
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-white/10 text-white/60 hover:bg-white/15 text-sm font-medium transition-all"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              className="w-full py-3 bg-white/5 text-white/40 hover:bg-white/10 text-sm transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
