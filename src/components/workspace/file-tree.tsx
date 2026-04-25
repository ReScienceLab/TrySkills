"use client"

import { createElement, useState } from "react"
import type { FileEntry } from "@/lib/workspace/types"
import { getFileIcon, IGNORED_DIRS } from "@/lib/workspace/types"
import { ChevronRight, Folder as FolderIcon } from "lucide-react"

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
            ? "bg-white/[0.06] text-foreground shadow-[inset_2px_0_0_0_#0072f5]"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        }`}
        style={{ paddingLeft }}
      >
        {entry.type === "folder" ? (
          <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
        ) : (
          <span className="w-[9px]" />
        )}
        {createElement(getFileIcon(entry), {
          className: "h-3.5 w-3.5 shrink-0 text-muted-foreground",
          "aria-hidden": true,
        })}
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
            <div className="py-1 text-[11px] italic text-muted-foreground" style={{ paddingLeft: paddingLeft + 16 }}>
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
        <FolderIcon className="h-8 w-8 text-muted-foreground/35" />
        <span className="text-[11px] text-muted-foreground">No files yet</span>
        <span className="text-[10px] text-muted-foreground/60">Files will appear as the agent works</span>
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
