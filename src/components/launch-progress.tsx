"use client"

import { Check, Loader2, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatusBadge, Surface } from "@/components/product-ui"
import type { SandboxState } from "@/lib/sandbox/types"

export type LaunchMode = "hotswap" | "snapshot" | "cold"

const STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "creating", label: "Creating sandbox", description: "Spinning up from snapshot (~5s)" },
  { key: "configuring", label: "Configuring environment", description: "Linking agent runtime and writing config" },
  { key: "uploading", label: "Installing skill", description: "Fetching skill from GitHub" },
  { key: "starting", label: "Starting agent", description: "Launching Hermes Gateway" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
]

const FALLBACK_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "creating", label: "Creating sandbox", description: "Provisioning a secure environment (~10s)" },
  { key: "installing", label: "Installing Hermes Agent", description: "Downloading and configuring agent runtime (~2 min)" },
  { key: "configuring", label: "Configuring environment", description: "Writing config files" },
  { key: "uploading", label: "Installing skill", description: "Fetching skill from GitHub" },
  { key: "starting", label: "Starting agent", description: "Launching Hermes Agent (~30s)" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
]

const HOTSWAP_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "uploading", label: "Installing skill", description: "Fetching skill from GitHub (~4s)" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
]

const HOTSWAP_WAKE_STEPS: { key: SandboxState; label: string; description: string }[] = [
  { key: "starting", label: "Waking sandbox", description: "Resuming stopped sandbox (~5-10s)" },
  { key: "uploading", label: "Installing skill", description: "Fetching skill from GitHub (~4s)" },
  { key: "running", label: "Ready", description: "Your agent session is live" },
]

function getSteps(mode: LaunchMode, needsWake: boolean) {
  if (mode === "hotswap") return needsWake ? HOTSWAP_WAKE_STEPS : HOTSWAP_STEPS
  if (mode === "cold") return FALLBACK_STEPS
  return STEPS
}

function getModeTone(mode: LaunchMode) {
  if (mode === "hotswap") return "preview"
  if (mode === "snapshot") return "develop"
  return "neutral"
}

export function LaunchProgress({
  state,
  error,
  onRetry,
  onCancel,
  mode = "snapshot",
  needsWake = false,
}: {
  state: SandboxState
  error?: string
  onRetry: () => void
  onCancel: () => void
  mode?: LaunchMode
  needsWake?: boolean
}) {
  const steps = getSteps(mode, needsWake)
  const currentIdx = steps.findIndex((s) => s.key === state)
  const modeLabel = mode === "hotswap" ? "hot-swap" : mode === "snapshot" ? "snapshot" : "cold"

  return (
    <div className="animate-fade-in">
      <Surface className="p-6" role="status" aria-live="polite" aria-label="Launch progress">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-[6px] bg-[rgba(10,114,239,0.12)] text-[#58a6ff] shadow-[var(--shadow-border)]">
            <Loader2 className="size-4 animate-spin" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Launching Agent Session
            </h2>
            <p className="text-xs text-muted-foreground">
              Preparing the sandbox, skill files, and Hermes Gateway.
            </p>
          </div>
          <StatusBadge tone={getModeTone(mode)} className="ml-auto">
            {modeLabel}
          </StatusBadge>
        </div>

        {mode !== "hotswap" && (
          <div className="mb-6 rounded-[8px] bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground shadow-[var(--shadow-border)]">
            First launch takes longer while the environment is set up. Subsequent launches reuse this sandbox and are near-instant.
          </div>
        )}

        <div className="relative mb-6">
          {steps.map((step, i) => {
            const isActive = step.key === state
            const isDone = currentIdx > i
            const isLast = i === steps.length - 1

            return (
              <div key={step.key} className="relative flex gap-4">
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-10px)] w-px bg-white/[0.08]">
                    <div className={`h-full w-full transition-colors duration-500 ${isDone ? "bg-[#58a6ff]" : ""}`} />
                  </div>
                )}

                <div className="relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background shadow-[var(--shadow-border)]">
                  {isDone ? (
                    <Check className="size-4 text-[#58a6ff]" />
                  ) : isActive ? (
                    <Loader2 className="size-4 animate-spin text-foreground" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-white/[0.18]" />
                  )}
                </div>

                <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                  <div className={`text-sm transition-colors ${
                    isDone
                      ? "text-muted-foreground"
                      : isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground/55"
                  }`}>
                    {step.label}
                  </div>
                  {isActive && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {state === "error" && (
          <div className="mb-6 rounded-[8px] bg-[rgba(255,91,79,0.1)] p-4 text-sm shadow-[var(--shadow-border)]">
            <div className="mb-1 font-medium text-[#ffb4ac]">Launch failed</div>
            <div className="text-muted-foreground">{error || "Unknown error"}</div>
          </div>
        )}

        <div className="flex gap-3">
          {state === "error" ? (
            <>
              <Button onClick={onRetry} className="flex-1">
                <RotateCcw className="size-4" />
                Retry
              </Button>
              <Button onClick={onCancel} variant="secondary">
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={onCancel} variant="secondary" className="w-full">
              <X className="size-4" />
              Cancel
            </Button>
          )}
        </div>
      </Surface>
    </div>
  )
}
