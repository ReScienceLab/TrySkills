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
      <div className="flex-1 flex items-center justify-center text-[11px] text-white/15">
        Select a file to preview
      </div>
    )
  }

  const fileName = filePath.split("/").pop() || filePath

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
        <span className="text-[12px] text-white/50 truncate flex-1 font-mono">{fileName}</span>
        <button
          onClick={onClose}
          className="text-white/20 hover:text-white/50 text-xs transition-colors p-0.5"
        >
          {"\u2715"}
        </button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-[12px] text-red-400/60">{error}</div>
        )}

        {!loading && !error && content && content.type === "image" && (
          <div className="p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.content}
              alt={fileName}
              className="max-w-full rounded border border-white/10"
            />
          </div>
        )}

        {!loading && !error && content && content.type === "audio" && (
          <div className="p-4">
            <audio controls src={content.content} className="w-full" />
          </div>
        )}

        {!loading && !error && content && content.type === "video" && (
          <div className="p-4">
            <video controls src={content.content} className="max-w-full rounded border border-white/10" />
          </div>
        )}

        {!loading && !error && content && content.type === "text" && isMarkdownFile(fileName) && (
          <div className="px-4 py-3 prose prose-invert prose-sm max-w-none text-white/70 [&_pre]:bg-white/[0.03] [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:rounded [&_code]:text-emerald-400/70 text-[12px] leading-relaxed">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {content.content}
            </ReactMarkdown>
          </div>
        )}

        {!loading && !error && content && content.type === "text" && !isMarkdownFile(fileName) && (
          <pre className="px-4 py-3 text-[11px] leading-[1.7] text-white/50 font-mono whitespace-pre-wrap break-all selection:bg-white/10">
            {content.content}
          </pre>
        )}
      </div>
    </div>
  )
}
