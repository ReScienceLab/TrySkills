"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import { useChat, type ToolCall, type ChatError } from "./use-chat"
import type { ChatMessage } from "@/lib/sandbox/hermes-api"

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024

const ChevronIcon = ({ open, className }: { open: boolean; className?: string }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-150 ${open ? "rotate-90" : ""} ${className ?? ""}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

function ThinkingCard({ text, isLive }: { text: string; isLive: boolean }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && isLive && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [text, open, isLive])

  if (!text && !isLive) return null

  return (
    <div className="my-1.5 border border-amber-500/20 bg-amber-500/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
      >
        {isLive && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="font-semibold tracking-wide">Thinking</span>
        <ChevronIcon open={open} className="ml-auto text-amber-500/50" />
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="px-3 pb-2 max-h-[200px] overflow-y-auto border-t border-amber-500/10"
        >
          <pre className="text-[11px] leading-relaxed text-white/50 font-mono whitespace-pre-wrap break-words m-0">
            {text || "Thinking\u2026"}
          </pre>
        </div>
      )}
    </div>
  )
}

function ToolCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false)
  const hasDetail = tool.args && Object.keys(tool.args).length > 0
  const subject = tool.args?.path || tool.args?.file_path || tool.args?.filename || tool.preview
  const toolLabel = tool.name.replace(/_/g, " ")
  const statusLabel = tool.status === "running"
    ? "Working"
    : tool.isError
      ? "Needs attention"
      : tool.name === "write_file"
        ? "File written"
        : "Completed"

  return (
    <div className={`my-1 border rounded-lg overflow-hidden transition-colors ${
      tool.status === "running"
        ? "border-blue-400/30 bg-blue-400/[0.06] shadow-[0_0_24px_rgba(96,165,250,0.08)]"
        : tool.isError
          ? "border-red-400/25 bg-red-500/[0.06]"
          : "border-emerald-400/15 bg-emerald-400/[0.04] hover:border-emerald-400/25"
    }`}>
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className={`flex items-center gap-3 w-full px-3 py-2 text-xs ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
      >
        {tool.status === "running" ? (
          <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse shrink-0 shadow-[0_0_10px_rgba(147,197,253,0.7)]" />
        ) : tool.isError ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/75 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-white/75 font-medium text-[12px] shrink-0">{statusLabel}</span>
            <span className="text-white/30 font-mono text-[10px] uppercase tracking-[0.14em] truncate">
              {tool.emoji ? `${tool.emoji} ` : ""}{toolLabel}
            </span>
          </span>
          {subject && (
            <span className="block mt-0.5 text-white/[0.38] truncate text-[11px]">{subject}</span>
          )}
        </span>
        {tool.duration != null && (
          <span className="text-white/25 text-[10px] shrink-0 tabular-nums">{tool.duration.toFixed(1)}s</span>
        )}
        {hasDetail && <ChevronIcon open={open} className="text-white/30 shrink-0" />}
      </button>
      {open && hasDetail && (
        <div className="px-3 pb-2 border-t border-white/[0.06]">
          <div className="mt-1.5">
            {Object.entries(tool.args!).map(([k, v]) => (
              <div key={k} className="text-[11px] leading-relaxed font-mono">
                <span className="text-blue-400">{k}</span>{" "}
                <span className="text-white/40 break-all">{typeof v === "string" ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ERROR_ICONS: Record<string, string> = {
  credit_error: "\u{1F4B3}",
  auth_error: "\u{1F511}",
  rate_limit: "\u{23F3}",
  empty_response: "\u{1F4ED}",
  provider_error: "\u{26A0}\u{FE0F}",
  network: "\u{1F310}",
}

const ERROR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  credit_error: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
  auth_error: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
  rate_limit: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  empty_response: { bg: "bg-white/5", border: "border-white/10", text: "text-white/60" },
  provider_error: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
  network: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
}

function ErrorCard({
  error,
  sessionFailed,
  isProviderError,
  onSessionError,
}: {
  error: ChatError
  sessionFailed: boolean
  isProviderError?: boolean
  onSessionError?: () => void
}) {
  const colors = ERROR_COLORS[error.type] || ERROR_COLORS.provider_error
  const icon = ERROR_ICONS[error.type] || "\u{26A0}\u{FE0F}"

  return (
    <div className={`p-3 ${colors.bg} border ${colors.border} rounded mb-4`}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${colors.text}`}>{error.message}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {error.action && (
              <a
                href={error.action.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block px-3 py-1.5 ${colors.bg} hover:opacity-80 ${colors.text} text-xs rounded border ${colors.border} transition-all`}
              >
                {error.action.label} &rarr;
              </a>
            )}
            {sessionFailed && !isProviderError && onSessionError && (
              <button
                onClick={onSessionError}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-all"
              >
                Reconnect (create new sandbox)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreditWarningBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
      <span>{"\u{26A0}\u{FE0F}"}</span>
      <span>{message}</span>
    </div>
  )
}

const MAX_INLINE_IMAGE_SIZE = 2 * 1024 * 1024

function normalizeImagePath(p: string): string {
  const parts = p.split("/")
  const resolved: string[] = []
  for (const part of parts) {
    if (part === "..") resolved.pop()
    else if (part && part !== ".") resolved.push(part)
  }
  return "/" + resolved.join("/")
}

function WorkspaceImage({ src, alt, sandboxId, sandboxKey, workspacePath }: {
  src?: string
  alt?: string
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
}) {
  const [preview, setPreview] = useState<{ path: string; dataUrl: string | null; error: string | null } | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const isExternalUrl = /^(https?:|data:|blob:)/i.test(src ?? "")
  const resolvedPath = (() => {
    if (!src || isExternalUrl) return null
    if (src.startsWith("/")) return normalizeImagePath(src)
    if (workspacePath) return normalizeImagePath(`${workspacePath}/${src}`)
    return null
  })()
  const isWorkspacePath = !!(resolvedPath && workspacePath && resolvedPath.startsWith(`${workspacePath}/`) && !resolvedPath.includes(".."))
  const fileName = (resolvedPath || src || alt || "image").split("/").pop() || "image"
  const markdown = `![${alt || fileName}](${src || resolvedPath || fileName})`
  const dataUrl = preview?.path === resolvedPath ? preview.dataUrl : null
  const error = preview?.path === resolvedPath ? preview.error : null
  const copied = copiedPath === resolvedPath

  useEffect(() => {
    if (!isWorkspacePath || !sandboxId || !sandboxKey || !resolvedPath) return
    let cancelled = false
    const params = new URLSearchParams({
      action: "read",
      sandboxId,
      key: sandboxKey,
      path: resolvedPath,
      maxSize: String(MAX_INLINE_IMAGE_SIZE),
    })
    fetch(`/api/workspace?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setPreview({ path: resolvedPath, dataUrl: null, error: data.error })
          return
        }
        if (data.type !== "image") {
          setPreview({ path: resolvedPath, dataUrl: null, error: "Not an image" })
          return
        }
        setPreview({ path: resolvedPath, dataUrl: data.content, error: null })
      })
      .catch(() => {
        if (!cancelled) setPreview({ path: resolvedPath, dataUrl: null, error: "Failed to load" })
      })
    return () => { cancelled = true }
  }, [resolvedPath, sandboxId, sandboxKey, isWorkspacePath])

  const copyMarkdown = async () => {
    if (!navigator.clipboard) return
    await navigator.clipboard.writeText(markdown)
    setCopiedPath(resolvedPath)
    window.setTimeout(() => {
      setCopiedPath((current) => current === resolvedPath ? null : current)
    }, 1400)
  }

  if (!resolvedPath) {
    if (!src) return null
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || ""} loading="lazy" className="max-w-full rounded" />
  }

  if (!isWorkspacePath) {
    return <span className="text-white/30 text-xs">[image blocked outside workspace: {alt || src}]</span>
  }

  return (
    <span className="not-prose my-3 block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070b0d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <span className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[15px]">{"\u{1F5BC}\u{FE0F}"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white/[0.82]">{alt || fileName}</span>
          <span className="block truncate font-mono text-[10px] text-white/[0.28]">{resolvedPath}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
          error
            ? "bg-red-500/10 text-red-300/80"
            : dataUrl
              ? "bg-emerald-400/10 text-emerald-300/80"
              : "bg-blue-400/10 text-blue-300/80"
        }`}>
          {error ? "Preview failed" : dataUrl ? "Preview ready" : "Loading"}
        </span>
      </span>
      <span className="block bg-white/[0.025] p-3">
        {error ? (
          <span className="block rounded-xl border border-red-400/15 bg-red-500/[0.04] px-3 py-6 text-center text-[12px] text-red-300/70">
            {error}. Open the workspace file panel to inspect `{fileName}`.
          </span>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={alt || ""} className="mx-auto max-h-[520px] max-w-full rounded-xl border border-white/10 bg-white shadow-sm" />
        ) : (
          <span className="flex h-36 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-[12px] text-white/[0.35]">
            Loading image preview...
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/55 transition-colors hover:border-white/[0.16] hover:text-white/80"
        >
          {copied ? "Copied" : "Copy markdown"}
        </button>
        {dataUrl && (
          <a
            href={dataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/55 no-underline transition-colors hover:border-white/[0.16] hover:text-white/80"
          >
            Open preview
          </a>
        )}
      </span>
    </span>
  )
}

function MessageBubble({ msg, sandboxId, sandboxKey, workspacePath }: {
  msg: ChatMessage
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[min(82%,42rem)] rounded-2xl rounded-br-sm border border-white/[0.08] bg-white/[0.1] px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
          <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5">
      {msg.content && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#080c0f]/90 px-4 py-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
          <div className="prose prose-invert prose-sm max-w-none text-white/85 prose-p:leading-7 prose-li:leading-7 [&_pre]:overflow-x-auto [&_pre]:bg-[#030608]/90 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded-xl [&_pre]:p-3 [&_code]:text-emerald-300/85 [&_a]:text-blue-300 [&_a:hover]:underline">
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              img: (props) => (
                <WorkspaceImage
                  src={typeof props.src === "string" ? props.src : undefined}
                  alt={typeof props.alt === "string" ? props.alt : undefined}
                  sandboxId={sandboxId}
                  sandboxKey={sandboxKey}
                  workspacePath={workspacePath}
                />
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 py-2 px-1" role="status" aria-label="Agent is thinking">
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

export function ChatPanel({
  gatewayBaseUrl,
  model,
  skillName,
  skillPath,
  startedAt,
  providerId,
  apiKey,
  initialSessionId,
  initialMessages,
  sandboxId,
  sandboxKey,
  initialWorkspacePath,
  onStop,
  onTryAnother,
  onSessionError,
  onToolComplete,
  onWorkspacePathChange,
  onStreamingChange,
}: {
  gatewayBaseUrl: string
  model: string
  skillName: string
  skillPath: string
  startedAt: number
  providerId?: string
  apiKey?: string
  initialSessionId?: string
  initialMessages?: { role: "user" | "assistant" | "system"; content: string }[]
  sandboxId?: string | null
  sandboxKey?: string | null
  initialWorkspacePath?: string | null
  onStop: () => void
  onTryAnother?: () => void
  onSessionError?: () => void
  onToolComplete?: (toolName: string) => void
  onWorkspacePathChange?: (path: string) => void
  onStreamingChange?: (streaming: boolean) => void
}) {
  const { messages, toolCalls, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, workspacePath, thinkingText, isThinking, send, cancel } = useChat(
    gatewayBaseUrl,
    model,
    skillName,
    providerId,
    apiKey,
    initialSessionId,
    skillPath,
    initialMessages,
    onToolComplete,
    sandboxId,
    sandboxKey,
    initialWorkspacePath,
  )

  const [input, setInput] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoIntroSent = useRef(false)

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const uploadingRef = useRef(false)

  useEffect(() => {
    if (autoIntroSent.current || initialMessages?.length || !sessionId) return
    autoIntroSent.current = true
    send(`Use skill_view to look up the /${skillPath} skill, then briefly introduce it - what it does, when to use it, and a quick example.`)
  }, [sessionId, initialMessages, skillPath, send])

  // Propagate workspace path to parent for workspace panel
  useEffect(() => {
    if (workspacePath) onWorkspacePathChange?.(workspacePath)
  }, [workspacePath, onWorkspacePathChange])

  // Propagate streaming state to parent for workspace polling
  useEffect(() => {
    onStreamingChange?.(isStreaming)
  }, [isStreaming, onStreamingChange])

  // Keep browser URL in sync when session id changes (e.g. resume fallback creates new session)
  useEffect(() => {
    if (!sessionId || sessionId === initialSessionId) return
    const url = new URL(window.location.href)
    url.searchParams.set("session", sessionId)
    window.history.replaceState({}, "", url.toString())
  }, [sessionId, initialSessionId])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (!timer) timer = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000))
      }, 1000)
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }
    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility) }
  }, [startedAt])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const addFiles = useCallback((files: FileList | File[]) => {
    if (uploadingRef.current) return
    const arr = Array.from(files)
    const sanitize = (n: string) => (n.split("/").pop() || n).replace(/[^\w.\-]/g, "_").slice(0, 200)
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((f) => sanitize(f.name)))
      const accepted: File[] = []
      for (const f of arr) {
        const sName = sanitize(f.name)
        if (!seen.has(sName) && f.size <= MAX_UPLOAD_SIZE) {
          seen.add(sName)
          accepted.push(f)
        }
      }
      return [...prev, ...accepted]
    })
    const oversized = arr.filter((f) => f.size > MAX_UPLOAD_SIZE)
    if (oversized.length) {
      setUploadError(`${oversized.map((f) => f.name).join(", ")} exceeds 4MB limit`)
      setTimeout(() => setUploadError(null), 4000)
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    if (uploadingRef.current) return
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const uploadFiles = useCallback(async (): Promise<string[]> => {
    if (!pendingFiles.length) return []
    if (uploadingRef.current) return []
    if (!sandboxId || !sandboxKey || !workspacePath) {
      setUploadError("Workspace not ready yet -- please wait a moment")
      throw new Error("Workspace not ready")
    }
    uploadingRef.current = true
    setIsUploading(true)
    setUploadError(null)
    const snapshot = [...pendingFiles]
    const uploaded: string[] = []
    try {
      for (const file of snapshot) {
        const fd = new FormData()
        fd.append("action", "upload")
        fd.append("sandboxId", sandboxId)
        fd.append("key", sandboxKey)
        fd.append("path", workspacePath)
        fd.append("file", file, file.name)
        const res = await fetch("/api/workspace", { method: "POST", body: fd })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Upload failed" }))
          throw new Error(data.error || `Upload failed: ${res.status}`)
        }
        const data = await res.json()
        uploaded.push(data.filename)
      }
      setPendingFiles([])
      return uploaded
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
      throw err
    } finally {
      uploadingRef.current = false
      setIsUploading(false)
    }
  }, [pendingFiles, sandboxId, sandboxKey, workspacePath])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !pendingFiles.length) || isStreaming || isUploading || uploadingRef.current) return

    let msgText = text
    if (pendingFiles.length) {
      try {
        const uploaded = await uploadFiles()
        if (uploaded.length) {
          if (!msgText) {
            msgText = `I've uploaded ${uploaded.length} file(s): ${uploaded.join(", ")}`
          } else {
            msgText = `${msgText}\n\n[Attached files: ${uploaded.join(", ")}]`
          }
        }
      } catch {
        return
      }
    }

    if (!msgText) return
    send(msgText)
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const uploadReady = !!(sandboxId && sandboxKey && workspacePath)
  const canSend = ((input.trim() && true) || (pendingFiles.length > 0 && uploadReady)) && !isStreaming && !isUploading

  return (
    <div
      className="flex flex-col h-[calc(100vh-56px)] w-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-500/40 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-blue-400 text-sm font-medium flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Drop files here
          </div>
        </div>
      )}

      {/* TopBar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0" aria-label={`Skill ${skillName} active for ${formatTime(elapsed)}`}>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
        <span className="text-sm text-white/70 font-mono">{skillName}</span>
        <span className="text-xs text-white/30 font-mono">{formatTime(elapsed)}</span>
        <div className="ml-auto flex items-center gap-2">
          {onTryAnother && (
            <button
              onClick={onTryAnother}
              className="px-3 py-1.5 text-xs text-amber-400/60 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded transition-all"
            >
              Try Another
            </button>
          )}
          <button
            onClick={onStop}
            className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded transition-all"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Credit warning banner */}
      {creditWarning && <CreditWarningBanner message={creditWarning} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-32 [scrollbar-gutter:stable]">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} sandboxId={sandboxId} sandboxKey={sandboxKey} workspacePath={workspacePath} />
        ))}
        {(thinkingText || isThinking) && (
          <ThinkingCard text={thinkingText} isLive={isThinking} />
        )}
        {toolCalls.length > 0 && (
          <div className="mb-2">
            {toolCalls.map((tc, i) => (
              <ToolCard key={`${tc.name}-${i}`} tool={tc} />
            ))}
          </div>
        )}
        {isStreaming && !thinkingText && !isThinking && toolCalls.length === 0 && messages[messages.length - 1]?.role !== "assistant" && (
          <ThinkingDots />
        )}
        {error && (
          <ErrorCard
            error={error}
            sessionFailed={sessionFailed}
            isProviderError={isProviderError}
            onSessionError={onSessionError}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative shrink-0 border-t border-white/10 bg-[#080a0c]/95 px-4 py-3 shadow-[0_-24px_60px_rgba(0,0,0,0.42)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-gradient-to-t before:from-[#080a0c]/95 before:to-transparent">
        {/* Attachment tray */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] border border-white/[0.08] rounded-md text-[11px] text-white/50 max-w-[200px]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/30">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload status */}
        {isUploading && (
          <div className="flex items-center gap-2 mb-2 text-[11px] text-blue-400/70">
            <div className="w-3 h-3 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
            Uploading...
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mb-2 text-[11px] text-red-400/70">{uploadError}</div>
        )}

        <div className="flex items-end gap-2">
          {/* Clip button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isUploading}
            aria-label="Attach files"
            className="px-2 py-2.5 text-white/25 hover:text-white/50 disabled:opacity-30 transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <label htmlFor="chat-message-input" className="sr-only">Message</label>
          <textarea
            id="chat-message-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = "auto"
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Hermes..."
            rows={1}
            disabled={isStreaming || isUploading}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/90 placeholder:text-white/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/25 resize-none disabled:opacity-50 transition-colors"
          />
          {isStreaming ? (
            <button
              onClick={cancel}
              aria-label="Cancel streaming response"
              className="px-4 py-2.5 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-all shrink-0"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send message"
              className="px-4 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 transition-all shrink-0"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
