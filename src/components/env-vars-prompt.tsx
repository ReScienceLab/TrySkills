"use client"

import { useState } from "react"
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configure environment variables for skill"
    >
      <div className="w-full max-w-lg border border-white/20 bg-[#0a0a0a] shadow-2xl">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-white/90">Environment Variables Needed</h2>
              <p className="text-xs text-white/40 mt-0.5">
                <span className="font-mono">{skillName}</span> uses additional API keys
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[400px] overflow-y-auto">
          {missingVars.map((v) => (
            <div key={v.name} className="space-y-1">
              <div className="flex items-center gap-2">
                <label htmlFor={`env-${v.name}`} className="text-xs font-mono text-white/70">{v.name}</label>
                {v.required && (
                  <span className="text-[10px] text-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5">required</span>
                )}
              </div>
              {v.description && (
                <p className="text-[11px] text-white/30">{v.description}</p>
              )}
              {v.help && (
                <a href={v.help} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">
                  Get a key &rarr;
                </a>
              )}
              <div className="relative">
                <input
                  id={`env-${v.name}`}
                  type={visibleKeys.has(v.name) ? "text" : "password"}
                  value={values[v.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                  placeholder={`Enter ${v.name}`}
                  className="w-full px-3 py-2 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
                />
                <button
                  onClick={() => toggleVisible(v.name)}
                  aria-label={visibleKeys.has(v.name) ? `Hide ${v.name}` : `Show ${v.name}`}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
                >
                  {visibleKeys.has(v.name) ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02]">
          <p className="text-[11px] text-white/30">
            You can configure these later in Settings. The skill may not work fully without them.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-between">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Launch Anyway
          </button>
          <button
            onClick={() => {
              const filled: Record<string, string> = {}
              for (const [k, v] of Object.entries(values)) {
                if (v.trim()) filled[k] = v.trim()
              }
              onConfigure(filled)
            }}
            disabled={!hasAnyValue}
            className={`px-6 py-2 text-sm font-medium transition-all ${
              hasAnyValue
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            Save & Launch
          </button>
        </div>
      </div>
    </div>
  )
}
