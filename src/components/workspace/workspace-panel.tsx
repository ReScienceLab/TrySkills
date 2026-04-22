"use client"

import { FileTree } from "./file-tree"
import { FileViewer } from "./file-viewer"
import type { FileEntry, FileContent } from "@/lib/workspace/types"

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
  return (
    <div className="flex flex-col h-full bg-black/40 border-l border-white/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
        <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="text-xs text-white/60 font-medium flex-1">Workspace</span>
        <button
          onClick={onRefresh}
          className="text-white/30 hover:text-white/60 transition-colors p-0.5"
          title="Refresh"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 transition-colors p-0.5"
          title="Close panel"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading indicator */}
      {loadingTree && entries.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
        </div>
      )}

      {/* Tree error */}
      {treeError && entries.length === 0 && (
        <div className="px-3 py-4 text-xs text-red-400/60">{treeError}</div>
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
          {/* Collapsed tree: show breadcrumb to go back */}
          <button
            onClick={onCloseFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 border-b border-white/5 transition-colors shrink-0"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
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
