"use client";

import type { SandboxState } from "@/lib/sandbox/types";

export type LaunchMode = "hotswap" | "snapshot" | "cold";

const STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "creating", label: "Creating sandbox", description: "Spinning up from snapshot (~5s)" },
  { key: "configuring", label: "Configuring environment", description: "Linking agent runtime and writing config" },
  { key: "uploading", label: "Uploading skill", description: "Uploading skill files to sandbox" },
  { key: "starting", label: "Starting agent", description: "Launching Hermes Gateway + WebUI" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
];

const FALLBACK_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "creating", label: "Creating sandbox", description: "Provisioning a secure environment (~10s)" },
  { key: "installing", label: "Installing Hermes Agent", description: "Downloading and configuring agent runtime (~2 min)" },
  { key: "configuring", label: "Configuring environment", description: "Writing config files" },
  { key: "uploading", label: "Uploading skill", description: "Uploading skill files to sandbox" },
  { key: "starting", label: "Starting agent", description: "Launching Hermes Agent + WebUI (~30s)" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
];

const HOTSWAP_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "swapping", label: "Swapping skill", description: "Cleaning old skill and uploading new one (~1s)" },
  { key: "restarting", label: "Restarting gateway", description: "Restarting Hermes Gateway" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
];

const HOTSWAP_WAKE_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "starting", label: "Waking sandbox", description: "Resuming stopped sandbox (~5-10s)" },
  { key: "swapping", label: "Swapping skill", description: "Cleaning old skill and uploading new one (~1s)" },
  { key: "restarting", label: "Restarting gateway", description: "Restarting Hermes Gateway" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
];

function getSteps(mode: LaunchMode, needsWake: boolean) {
  if (mode === "hotswap") return needsWake ? HOTSWAP_WAKE_STEPS : HOTSWAP_STEPS;
  if (mode === "cold") return FALLBACK_STEPS;
  return STEPS;
}

export function LaunchProgress({
  state,
  error,
  onRetry,
  onCancel,
  mode = "snapshot",
  needsWake = false,
}: {
  state: SandboxState;
  error?: string;
  onRetry: () => void;
  onCancel: () => void;
  mode?: LaunchMode;
  needsWake?: boolean;
}) {
  const steps = getSteps(mode, needsWake);
  const currentIdx = steps.findIndex((s) => s.key === state);

  const modeLabel = mode === "hotswap" ? "hot-swap" : mode === "snapshot" ? "snapshot" : "cold";
  const modeColor = mode === "hotswap"
    ? "text-amber-400/60 bg-amber-500/10"
    : mode === "snapshot"
      ? "text-emerald-400/60 bg-emerald-500/10"
      : "text-white/40 bg-white/5";

  return (
    <div className="animate-fade-in">
      <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <h2 className="text-base font-semibold text-white/90">
            Launching Agent Session
          </h2>
          <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full ${modeColor}`}>
            {modeLabel}
          </span>
        </div>

        <div className="relative ml-1 mb-8">
          {steps.map((step, i) => {
            const isActive = step.key === state;
            const isDone = currentIdx > i;
            const isLast = i === steps.length - 1;

            return (
              <div key={step.key} className="relative flex gap-4">
                {!isLast && (
                  <div className="absolute left-[5px] top-[18px] w-px h-[calc(100%-2px)]">
                    <div className={`w-full h-full transition-colors duration-500 ${
                      isDone ? "bg-white/30" : "bg-white/8"
                    }`} />
                  </div>
                )}

                <div className="relative shrink-0 mt-[6px]">
                  {isDone ? (
                    <div className="w-[11px] h-[11px] rounded-full bg-white/70" />
                  ) : isActive ? (
                    <div className="w-[11px] h-[11px] rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-[11px] h-[11px] rounded-full bg-white/10" />
                  )}
                </div>

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
