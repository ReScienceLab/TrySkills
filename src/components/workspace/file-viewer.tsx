"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import type { FileContent } from "@/lib/workspace/types"
import { isMarkdownFile } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export function FileViewer({
  filePath,
  content,
  loading,
  error,
  onClose,
  sandboxId,
  sandboxKey,
}: {
  filePath: string | null
  content: FileContent | null
  loading: boolean
  error: string | null
  onClose: () => void
  sandboxId?: string | null
  sandboxKey?: string | null
}) {
  const [mediaResult, setMediaResult] = useState<{ path: string; url: string | null } | null>(null)
  const mediaUrl = mediaResult?.path === filePath ? mediaResult.url : null

  useEffect(() => {
    if (!content || (content.type !== "audio" && content.type !== "video")) return
    if (!filePath || !sandboxId || !sandboxKey) return
    let cancelled = false
    const params = new URLSearchParams({ action: "media-url", sandboxId, key: sandboxKey, path: filePath })
    fetch(`/api/workspace?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMediaResult({ path: filePath, url: data.url ?? null })
      })
      .catch(() => {
        if (!cancelled) setMediaResult({ path: filePath, url: null })
      })
    return () => { cancelled = true }
  }, [content, filePath, sandboxId, sandboxKey])
  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
        Select a file to preview
      </div>
    )
  }

  const fileName = filePath.split("/").pop() || filePath

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 bg-white/[0.02] px-4 py-2.5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <span className="flex-1 truncate font-mono text-[12px] text-muted-foreground">{fileName}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close file preview"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-[12px] text-[#ff8f86]">{error}</div>
        )}

        {!loading && !error && content && content.type === "image" && (
          <div className="p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.content}
              alt={fileName}
              className="max-w-full rounded-[6px] shadow-[var(--shadow-border)]"
            />
          </div>
        )}

        {!loading && !error && content && content.type === "audio" && (
          <div className="p-4">
            {mediaUrl ? (
              <audio controls src={mediaUrl} className="w-full" />
            ) : (
              <div className="animate-pulse text-[12px] text-muted-foreground">Loading audio...</div>
            )}
          </div>
        )}

        {!loading && !error && content && content.type === "video" && (
          <div className="p-4">
            {mediaUrl ? (
              <video controls src={mediaUrl} className="max-w-full rounded-[6px] shadow-[var(--shadow-border)]" />
            ) : (
              <div className="animate-pulse text-[12px] text-muted-foreground">Loading video...</div>
            )}
          </div>
        )}

        {!loading && !error && content && content.type === "text" && isMarkdownFile(fileName) && (
          <div className="prose prose-invert prose-sm max-w-none px-4 py-3 text-[12px] leading-relaxed text-foreground/80 [&_a]:text-[#58a6ff] [&_code]:text-[#58a6ff] [&_pre]:rounded-[6px] [&_pre]:bg-white/[0.03] [&_pre]:shadow-[var(--shadow-border)]">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {content.content}
            </ReactMarkdown>
          </div>
        )}

        {!loading && !error && content && content.type === "text" && !isMarkdownFile(fileName) && (
          <pre className="whitespace-pre-wrap break-all px-4 py-3 font-mono text-[11px] leading-[1.7] text-muted-foreground selection:bg-white/10">
            {content.content}
          </pre>
        )}
      </div>
    </div>
  )
}
