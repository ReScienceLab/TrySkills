"use client"

import { FileTree } from "./file-tree"
import { FileViewer } from "./file-viewer"
import type { FileEntry, FileContent } from "@/lib/workspace/types"
import { formatBytes, isImageFile } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Folder, RefreshCw, X, ChevronLeft } from "lucide-react"

function flattenFiles(entries: FileEntry[]): FileEntry[] {
  return entries.flatMap((entry) => {
    if (entry.type === "folder") return flattenFiles(entry.children ?? [])
    return [entry]
  })
}

function getModifiedTime(entry: FileEntry): number {
  if (!entry.modifiedAt) return 0
  const time = Date.parse(entry.modifiedAt)
  return Number.isNaN(time) ? 0 : time
}

export function WorkspacePanel({
  entries,
  selectedFile,
  fileContent,
  loadingTree,
  loadingFile,
  treeError,
  fileError,
  onSelectFile,
  onCloseFile,
  onRefresh,
  onClose,
  sandboxId,
  sandboxKey,
}: {
  entries: FileEntry[]
  selectedFile: FileEntry | null
  fileContent: FileContent | null
  loadingTree: boolean
  loadingFile: boolean
  treeError: string | null
  fileError: string | null
  onSelectFile: (entry: FileEntry) => void
  onCloseFile: () => void
  onRefresh: () => void
  onClose: () => void
  sandboxId?: string | null
  sandboxKey?: string | null
}) {
  const files = flattenFiles(entries)
  const imageCount = files.filter((file) => isImageFile(file.name)).length
  const latestFile = [...files].sort((a, b) => getModifiedTime(b) - getModifiedTime(a))[0]

  return (
    <div className="flex h-full flex-col bg-card shadow-[inset_1px_0_0_0_rgba(255,255,255,0.08)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-[13px] font-medium text-foreground">Workspace</span>
        {loadingTree && entries.length > 0 && (
          <Skeleton className="h-3 w-10 rounded-full" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRefresh}
          className="text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          title="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {files.length > 0 && !selectedFile && (
        <div className="bg-white/[0.018] px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-medium uppercase text-muted-foreground">Generated outputs</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"}
                {imageCount > 0 ? ` · ${imageCount} image${imageCount === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            {latestFile && (
              <button
                onClick={() => onSelectFile(latestFile)}
                className="min-w-0 rounded-lg bg-white/[0.03] px-3 py-2 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-white/[0.06] hover:shadow-[var(--shadow-border-strong)]"
              >
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Latest</span>
                <span className="block max-w-[150px] truncate text-[12px] text-foreground">{latestFile.name}</span>
                {latestFile.size != null && (
                  <span className="block text-[10px] text-muted-foreground">{formatBytes(latestFile.size)}</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator for initial load */}
      {loadingTree && entries.length === 0 && (
        <div className="space-y-2 px-4 py-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-3.5 shrink-0 rounded-[4px]" />
              <Skeleton
                className={
                  index % 3 === 0
                    ? "h-3 w-28"
                    : index % 3 === 1
                      ? "h-3 w-40"
                      : "h-3 w-24"
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Tree error */}
      {treeError && entries.length === 0 && (
        <div className="px-4 py-6 text-[12px] text-[#ff8f86]">{treeError}</div>
      )}

      {/* Content area: tree + optional file viewer */}
      {!selectedFile ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <FileTree
            entries={entries}
            selectedPath={null}
            onSelect={onSelectFile}
          />
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <button
            onClick={onCloseFile}
            className="flex shrink-0 items-center gap-2 px-4 py-2 text-[12px] text-muted-foreground shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.02] hover:text-foreground"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to files
          </button>
          <FileViewer
            filePath={selectedFile.path}
            content={fileContent}
            loading={loadingFile}
            error={fileError}
            onClose={onCloseFile}
            sandboxId={sandboxId}
            sandboxKey={sandboxKey}
          />
        </div>
      )}
    </div>
  )
}
