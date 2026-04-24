"use client"

import { FileTree } from "./file-tree"
import { FileViewer } from "./file-viewer"
import type { FileEntry, FileContent } from "@/lib/workspace/types"
import { formatBytes, isImageFile } from "@/lib/workspace/types"
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
}) {
  const files = flattenFiles(entries)
  const imageCount = files.filter((file) => isImageFile(file.name)).length
  const latestFile = [...files].sort((a, b) => getModifiedTime(b) - getModifiedTime(a))[0]

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c] border-l border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <Folder className="w-4 h-4 text-white/25" />
        <span className="text-[13px] text-white/50 font-medium flex-1 tracking-tight">Workspace</span>
        {loadingTree && entries.length > 0 && (
          <div className="w-3 h-3 rounded-full border border-white/10 border-t-white/30 animate-spin" />
        )}
        <button
          onClick={onRefresh}
          className="text-white/20 hover:text-white/50 transition-colors p-1 rounded hover:bg-white/[0.04]"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="text-white/20 hover:text-white/50 transition-colors p-1 rounded hover:bg-white/[0.04]"
          title="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {files.length > 0 && !selectedFile && (
        <div className="border-b border-white/[0.05] bg-white/[0.018] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/25">Generated outputs</div>
              <div className="mt-1 text-[12px] text-white/[0.48]">
                {files.length} file{files.length === 1 ? "" : "s"}
                {imageCount > 0 ? ` · ${imageCount} image${imageCount === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            {latestFile && (
              <button
                onClick={() => onSelectFile(latestFile)}
                className="min-w-0 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                <span className="block text-[10px] uppercase tracking-[0.14em] text-white/[0.22]">Latest</span>
                <span className="block max-w-[150px] truncate text-[12px] text-white/[0.64]">{latestFile.name}</span>
                {latestFile.size != null && (
                  <span className="block text-[10px] text-white/25">{formatBytes(latestFile.size)}</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator for initial load */}
      {loadingTree && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
          <span className="text-[11px] text-white/20">Loading workspace...</span>
        </div>
      )}

      {/* Tree error */}
      {treeError && entries.length === 0 && (
        <div className="px-4 py-6 text-[12px] text-red-400/50">{treeError}</div>
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
            className="flex items-center gap-2 px-4 py-2 text-[12px] text-white/30 hover:text-white/50 border-b border-white/[0.04] transition-colors shrink-0 hover:bg-white/[0.02]"
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
          />
        </div>
      )}
    </div>
  )
}
