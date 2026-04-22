"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import { useChat, type ToolCall, type ChatError } from "./use-chat"
import type { ChatMessage } from "@/lib/sandbox/hermes-api"

function ToolCard({ tool }: { tool: ToolCall }) {
  return (
    <div className="my-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        {tool.status === "running" ? (
          <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        )}
        <span className="text-white/60 font-mono">{tool.emoji || "\u{1F527}"} {tool.name}</span>
        {tool.status === "running" && (
          <span className="text-blue-400/60 ml-auto">running...</span>
        )}
      </div>
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
    <div className="flex gap-1 py-2 px-1">
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
  onStop,
  onTryAnother,
  onSessionError,
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
  onStop: () => void
  onTryAnother?: () => void
  onSessionError?: () => void
}) {
  const { messages, toolCalls, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, send, cancel } = useChat(
    gatewayBaseUrl,
    model,
    skillName,
    providerId,
    apiKey,
    initialSessionId,
    skillPath,
    initialMessages,
  )

  const [input, setInput] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keep browser URL in sync when session id changes (e.g. resume fallback creates new session)
  useEffect(() => {
    if (!sessionId || sessionId === initialSessionId) return
    const url = new URL(window.location.href)
    url.searchParams.set("session", sessionId)
    window.history.replaceState({}, "", url.toString())
  }, [sessionId, initialSessionId])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    send(input)
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto w-full">
      {/* TopBar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
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
        {toolCalls.length > 0 && (
          <div className="mb-2">
            {toolCalls.map((tc, i) => (
              <ToolCard key={`${tc.name}-${i}`} tool={tc} />
            ))}
          </div>
        )}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
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
        <div className="flex items-end gap-2">
          <textarea
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
            disabled={isStreaming}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/90 placeholder:text-white/25 outline-none focus:border-white/25 resize-none disabled:opacity-50 transition-colors"
          />
          {isStreaming ? (
            <button
              onClick={cancel}
              className="px-4 py-2.5 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-all shrink-0"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
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
