"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Eye, EyeOff, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  const localEditRef = useRef(false)
  const prevValueRef = useRef(value)

  useEffect(() => {
    if (localEditRef.current) {
      localEditRef.current = false
      prevValueRef.current = value
      return
    }
    const prev = prevValueRef.current
    const prevJson = JSON.stringify(prev, Object.keys(prev).sort())
    const nextJson = JSON.stringify(value, Object.keys(value).sort())
    if (prevJson !== nextJson) {
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
    localEditRef.current = true
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
          <Input
            type="text"
            value={row.key}
            onChange={(e) => updateRow(row.id, "key", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="ENV_VAR_NAME"
            aria-label="Environment variable name"
            className="h-10 w-[200px] shrink-0 border-0 bg-white/[0.03] font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
          />
          <div className="relative flex-1">
            <Input
              type={visibleIds.has(row.id) ? "text" : "password"}
              value={row.value}
              onChange={(e) => updateRow(row.id, "value", e.target.value)}
              placeholder="value"
              aria-label={`Value for ${row.key || "environment variable"}`}
              className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="button"
              onClick={() => toggleVisible(row.id)}
              aria-label={visibleIds.has(row.id) ? "Hide value" : "Show value"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {visibleIds.has(row.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(row.id)}
            aria-label={`Remove ${row.key || "variable"}`}
            className="shrink-0 text-muted-foreground hover:text-[#ff5b4f]"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addRow()}
        >
          <Plus className="size-3.5" />
          Add Variable
        </Button>
        {availablePresets.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
            >
              Quick Add
              <ChevronDown className="size-3.5" />
            </Button>
            {showPresets && (
              <div className="absolute left-0 top-full z-10 mt-1 max-h-[240px] min-w-[240px] overflow-y-auto rounded-lg bg-popover p-1 shadow-[var(--shadow-card)]">
                {availablePresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.key}
                    onClick={() => {
                      addRow(preset.key)
                      setShowPresets(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="font-mono text-foreground">{preset.key}</span>
                    <span className="text-muted-foreground">{preset.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add environment variables that skills need (e.g., API keys for image generation, web scraping, etc.)
        </p>
      )}
    </div>
  )
}
