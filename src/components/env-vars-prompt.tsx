"use client"

import { useState } from "react"
import { AlertTriangle, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/product-ui"
import type { SkillEnvVar } from "@/lib/skill/env-vars"

export function EnvVarsPrompt({
  skillName,
  missingVars,
  onConfigure,
  onSkip,
}: {
  skillName: string
  missingVars: SkillEnvVar[]
  onConfigure: (envVars: Record<string, string>) => void
  onSkip: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  const toggleVisible = (name: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const hasAnyValue = Object.values(values).some((v) => v.length > 0)

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden border-0 bg-[#0a0a0a] p-0 shadow-[var(--shadow-card)]">
        <DialogHeader className="gap-0 px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(255,91,79,0.12)] text-[#ffb4ac] shadow-[var(--shadow-border)]">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Environment variables needed
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                <span className="font-mono text-foreground">{skillName}</span> uses additional API keys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[400px] space-y-4 overflow-y-auto px-6 py-5">
          {missingVars.map((v) => (
            <div key={v.name} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`env-${v.name}`} className="font-mono text-xs font-medium text-foreground">
                  {v.name}
                </label>
                {v.required && (
                  <StatusBadge tone="ship">required</StatusBadge>
                )}
                {v.help && (
                  <a href={v.help} target="_blank" rel="noopener noreferrer" className="text-xs text-[#58a6ff] hover:underline">
                    Get a key
                  </a>
                )}
              </div>
              {v.description && (
                <p className="text-xs text-muted-foreground">{v.description}</p>
              )}
              <div className="relative">
                <Input
                  id={`env-${v.name}`}
                  type={visibleKeys.has(v.name) ? "text" : "password"}
                  value={values[v.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                  placeholder={`Enter ${v.name}`}
                  className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
                />
                <button
                  onClick={() => toggleVisible(v.name)}
                  aria-label={visibleKeys.has(v.name) ? `Hide ${v.name}` : `Show ${v.name}`}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {visibleKeys.has(v.name) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 text-xs text-muted-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          You can configure these later in Settings. The skill may not work fully without them.
        </div>

        <DialogFooter className="m-0 rounded-none border-0 bg-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <Button onClick={onSkip} variant="ghost">
            Launch Anyway
          </Button>
          <Button
            onClick={() => {
              const filled: Record<string, string> = {}
              for (const [k, v] of Object.entries(values)) {
                if (v.trim()) filled[k] = v.trim()
              }
              onConfigure(filled)
            }}
            disabled={!hasAnyValue}
          >
            Save & Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
