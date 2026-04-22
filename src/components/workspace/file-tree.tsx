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
  const paddingLeft = 12 + depth * 16

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
        className={`flex w-full items-center gap-1.5 py-1 pr-2 text-left text-xs transition-colors ${
          isSelected
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white/80"
        }`}
        style={{ paddingLeft }}
      >
        {entry.type === "folder" ? (
          <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-90" : ""}`}>
            {"\u25B6"}
          </span>
        ) : (
          <span className="w-[10px]" />
        )}
        <span className="text-xs">{icon}</span>
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
      <div className="px-3 py-6 text-center text-xs text-white/30">
        No files yet
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
