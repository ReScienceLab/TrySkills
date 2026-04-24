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

  return (
    <div className={`my-1 border rounded-lg overflow-hidden transition-colors ${
      tool.status === "running"
        ? "border-blue-500/30 bg-blue-500/5"
        : tool.isError
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]"
    }`}>
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
      >
        {tool.status === "running" ? (
          <span className="w-[7px] h-[7px] rounded-full bg-blue-400 animate-pulse shrink-0" />
        ) : tool.isError ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500/60 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="text-white/60 font-mono font-semibold text-[11px] shrink-0">
          {tool.emoji ? `${tool.emoji} ` : ""}{tool.name}
        </span>
        {tool.preview && (
          <span className="text-white/30 truncate flex-1 text-left text-[11px]">{tool.preview}</span>
        )}
        {tool.duration != null && (
          <span className="text-white/20 text-[10px] shrink-0">{tool.duration.toFixed(1)}s</span>
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

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-white/10 rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4">
      {msg.content && (
        <div className="prose prose-invert prose-sm max-w-none text-white/85 [&_pre]:bg-white/5 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded [&_code]:text-emerald-400/80 [&_a]:text-blue-400 [&_a:hover]:underline">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {msg.content}
          </ReactMarkdown>
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
    const onVisibility = () => { document.hidden ? stop() : start() }
    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility) }
  }, [startedAt])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const addFiles = useCallback((files: FileList | File[]) => {
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
    if (!sandboxId || !sandboxKey || !workspacePath) {
      setUploadError("Workspace not ready yet -- please wait a moment")
      throw new Error("Workspace not ready")
    }
    setIsUploading(true)
    setUploadError(null)
    const uploaded: string[] = []
    try {
      for (const file of pendingFiles) {
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
    if ((!text && !pendingFiles.length) || isStreaming || isUploading) return

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
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
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
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
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
