"use client";

import type { SandboxState } from "@/lib/sandbox/types";

const STEPS: { key: SandboxState; label: string }[] = [
  { key: "creating", label: "Creating sandbox..." },
  { key: "uploading", label: "Uploading skill files..." },
  { key: "starting", label: "Starting Hermes Agent..." },
  { key: "running", label: "Ready!" },
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
        <h2 className="text-lg font-semibold text-white/90 mb-8">
          Launching Agent Session
        </h2>

        <div className="space-y-4 mb-8">
          {STEPS.map((step, i) => {
            const isActive = step.key === state;
            const isDone = currentIdx > i;
            const isPending = currentIdx < i;

            return (
              <div key={step.key} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-blue-500 text-white"
                      : "bg-white/10 text-white/30"
                }`}>
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </div>
                <span className={`text-sm transition-colors ${
                  isDone
                    ? "text-white/40"
                    : isActive
                      ? "text-white font-medium"
                      : isPending
                        ? "text-white/30"
                        : ""
                }`}>
                  {step.label}
                </span>
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
              className="w-full py-3 bg-white/10 text-white/60 hover:bg-white/15 text-sm font-medium transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
