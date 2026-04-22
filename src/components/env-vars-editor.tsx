"use client"

import { useState, useEffect, useRef } from "react"

const COMMON_PRESETS = [
  { key: "OPENAI_API_KEY", label: "OpenAI" },
  { key: "GOOGLE_API_KEY", label: "Google AI" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "DASHSCOPE_API_KEY", label: "DashScope" },
  { key: "REPLICATE_API_TOKEN", label: "Replicate" },
  { key: "AZURE_OPENAI_API_KEY", label: "Azure OpenAI" },
  { key: "MINIMAX_API_KEY", label: "MiniMax" },
  { key: "ZAI_API_KEY", label: "Z.AI" },
  { key: "GITHUB_TOKEN", label: "GitHub" },
  { key: "FIRECRAWL_API_KEY", label: "Firecrawl" },
]

interface EnvVarRow {
  id: string
  key: string
  value: string
}

export function EnvVarsEditor({
  value,
  onChange,
}: {
  value: Record<string, string>
  onChange: (envVars: Record<string, string>) => void
}) {
  const [rows, setRows] = useState<EnvVarRow[]>(() => {
    const entries = Object.entries(value)
    if (entries.length === 0) return []
    return entries.map(([k, v]) => ({ id: crypto.randomUUID(), key: k, value: v }))
  })
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [showPresets, setShowPresets] = useState(false)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const prev = prevValueRef.current
    const prevKeys = Object.keys(prev).sort().join(",")
    const nextKeys = Object.keys(value).sort().join(",")
    const prevVals = Object.keys(prev).sort().map(k => prev[k]).join(",")
    const nextVals = Object.keys(value).sort().map(k => value[k]).join(",")
    if (prevKeys !== nextKeys || prevVals !== nextVals) {
      prevValueRef.current = value
      const entries = Object.entries(value)
      setRows(entries.length === 0 ? [] : entries.map(([k, v]) => ({ id: crypto.randomUUID(), key: k, value: v })))
      setVisibleIds(new Set())
    }
  }, [value])

  const sync = (updated: EnvVarRow[]) => {
    setRows(updated)
    const result: Record<string, string> = {}
    for (const row of updated) {
      const k = row.key.trim()
      if (k && row.value) result[k] = row.value
    }
    onChange(result)
  }

  const addRow = (key = "", val = "") => {
    sync([...rows, { id: crypto.randomUUID(), key, value: val }])
  }

  const removeRow = (id: string) => {
    sync(rows.filter((r) => r.id !== id))
    setVisibleIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const updateRow = (id: string, field: "key" | "value", val: string) => {
    sync(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const toggleVisible = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const existingKeys = new Set(rows.map((r) => r.key.trim()))
  const availablePresets = COMMON_PRESETS.filter((p) => !existingKeys.has(p.key))

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="flex gap-2 items-start">
          <input
            type="text"
            value={row.key}
            onChange={(e) => updateRow(row.id, "key", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="ENV_VAR_NAME"
            aria-label="Environment variable name"
            className="w-[200px] shrink-0 px-3 py-2 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
          />
          <div className="relative flex-1">
            <input
              type={visibleIds.has(row.id) ? "text" : "password"}
              value={row.value}
              onChange={(e) => updateRow(row.id, "value", e.target.value)}
              placeholder="value"
              aria-label={`Value for ${row.key || "environment variable"}`}
              className="w-full px-3 py-2 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
            />
            <button
              onClick={() => toggleVisible(row.id)}
              aria-label={visibleIds.has(row.id) ? "Hide value" : "Show value"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
            >
              {visibleIds.has(row.id) ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={() => removeRow(row.id)}
            aria-label={`Remove ${row.key || "variable"}`}
            className="shrink-0 px-2 py-2 text-white/30 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => addRow()}
          className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
        >
          + Add Variable
        </button>
        {availablePresets.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              Quick Add &darr;
            </button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-[#111] border border-white/10 shadow-lg min-w-[200px] max-h-[240px] overflow-y-auto">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => {
                      addRow(preset.key)
                      setShowPresets(false)
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <span className="text-white/60 font-mono">{preset.key}</span>
                    <span className="text-white/30">{preset.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-white/30">
          Add environment variables that skills need (e.g., API keys for image generation, web scraping, etc.)
        </p>
      )}
    </div>
  )
}
