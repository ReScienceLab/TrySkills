"use client"

import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import type { FileContent } from "@/lib/workspace/types"
import { isMarkdownFile } from "@/lib/workspace/types"

export function FileViewer({
  filePath,
  content,
  loading,
  error,
  onClose,
}: {
  filePath: string | null
  content: FileContent | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-white/20">
        Select a file to preview
      </div>
    )
  }

  const fileName = filePath.split("/").pop() || filePath

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-xs text-white/60 truncate flex-1 font-mono">{fileName}</span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          {"\u2715"}
        </button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-xs text-red-400/80">{error}</div>
        )}

        {!loading && !error && content && content.type === "image" && (
          <div className="p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.content}
              alt={fileName}
              className="max-w-full rounded border border-white/10"
            />
          </div>
        )}

        {!loading && !error && content && content.type === "text" && isMarkdownFile(fileName) && (
          <div className="px-3 py-2 prose prose-invert prose-sm max-w-none text-white/80 [&_pre]:bg-white/5 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded [&_code]:text-emerald-400/80 text-xs">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {content.content}
            </ReactMarkdown>
          </div>
        )}

        {!loading && !error && content && content.type === "text" && !isMarkdownFile(fileName) && (
          <pre className="px-3 py-2 text-[11px] leading-relaxed text-white/70 font-mono whitespace-pre-wrap break-all">
            {content.content}
          </pre>
        )}
      </div>
    </div>
  )
}
