"use client"

import { useState } from "react"
import type { FileEntry } from "@/lib/workspace/types"
import { getFileIcon, IGNORED_DIRS } from "@/lib/workspace/types"

function TreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
}: {
  entry: FileEntry
  depth: number
  expanded: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (entry: FileEntry) => void
}) {
  const isExpanded = expanded.has(entry.path)
  const isSelected = selectedPath === entry.path
  const icon = getFileIcon(entry)
  const paddingLeft = 16 + depth * 16

  return (
    <>
      <button
        onClick={() => {
          if (entry.type === "folder") {
            onToggle(entry.path)
          } else {
            onSelect(entry)
          }
        }}
        className={`flex w-full items-center gap-2 py-1.5 pr-3 text-left text-[13px] leading-tight transition-colors ${
          isSelected
            ? "bg-white/10 text-white/90"
            : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
        }`}
        style={{ paddingLeft }}
      >
        {entry.type === "folder" ? (
          <span className={`text-[9px] text-white/30 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}>
            {"\u25B6"}
          </span>
        ) : (
          <span className="w-[9px]" />
        )}
        <span className="text-[13px] shrink-0">{icon}</span>
        <span className="truncate">{entry.name}</span>
      </button>
      {entry.type === "folder" && isExpanded && entry.children && (
        <div>
          {entry.children
            .filter((c) => !IGNORED_DIRS.has(c.name))
            .map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          {entry.children.filter((c) => !IGNORED_DIRS.has(c.name)).length === 0 && (
            <div className="text-[11px] text-white/20 italic py-1" style={{ paddingLeft: paddingLeft + 16 }}>
              empty
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function FileTree({
  entries,
  selectedPath,
  onSelect,
}: {
  entries: FileEntry[]
  selectedPath: string | null
  onSelect: (entry: FileEntry) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="text-[11px] text-white/20">No files yet</span>
        <span className="text-[10px] text-white/10">Files will appear as the agent works</span>
      </div>
    )
  }

  return (
    <div className="py-1">
      {entries
        .filter((e) => !IGNORED_DIRS.has(e.name))
        .map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={handleToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}
