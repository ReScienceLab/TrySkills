"use client"

import { useState, useRef, useEffect, useCallback, useMemo, isValidElement, type ReactNode } from "react"
import { useChat, type ToolCall, type ChatError } from "./use-chat"
import { formatUploadedFilesMessage, isPreviewableImageName, type UploadedFile } from "./upload-message"
import type { ChatMessage } from "@/lib/sandbox/hermes-api"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageResponseProps,
} from "@/components/ai-elements/message"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  type ToolPart,
} from "@/components/ai-elements/tool"
import { Terminal } from "@/components/ai-elements/terminal"
import { Button } from "@/components/ui/button"
import {
  CreditCard, KeyRound, Clock, MailX, AlertTriangle, Globe,
  X, ImageIcon, Paperclip, Upload,
  Music, Video, Copy, Check,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024
const CHAT_STREAMDOWN_CONTROLS: MessageResponseProps["controls"] = {
  code: false,
  table: { copy: true, download: true, fullscreen: true },
  mermaid: { copy: true, download: true, fullscreen: true, panZoom: true },
}

const ERROR_ICONS: Record<string, LucideIcon> = {
  credit_error: CreditCard,
  auth_error: KeyRound,
  rate_limit: Clock,
  empty_response: MailX,
  provider_error: AlertTriangle,
  network: Globe,
}

const ERROR_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  credit_error: { bg: "bg-[rgba(245,165,36,0.10)]", ring: "shadow-[0_0_0_1px_rgba(245,165,36,0.24)]", text: "text-[#f5a524]" },
  auth_error: { bg: "bg-[rgba(255,91,79,0.10)]", ring: "shadow-[0_0_0_1px_rgba(255,91,79,0.24)]", text: "text-[#ff5b4f]" },
  rate_limit: { bg: "bg-[rgba(10,114,239,0.10)]", ring: "shadow-[0_0_0_1px_rgba(10,114,239,0.24)]", text: "text-[#58a6ff]" },
  empty_response: { bg: "bg-white/[0.04]", ring: "shadow-[var(--shadow-border)]", text: "text-muted-foreground" },
  provider_error: { bg: "bg-[rgba(255,91,79,0.10)]", ring: "shadow-[0_0_0_1px_rgba(255,91,79,0.24)]", text: "text-[#ff5b4f]" },
  network: { bg: "bg-[rgba(255,91,79,0.10)]", ring: "shadow-[0_0_0_1px_rgba(255,91,79,0.24)]", text: "text-[#ff5b4f]" },
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
  const Icon = ERROR_ICONS[error.type] || AlertTriangle

  return (
    <div className={`mb-4 rounded-lg p-3 ${colors.bg} ${colors.ring}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${colors.text}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${colors.text}`}>{error.message}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {error.action && (
              <a
                href={error.action.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block rounded-[6px] px-3 py-1.5 text-xs ${colors.bg} ${colors.text} shadow-[var(--shadow-border)] transition-all hover:opacity-80`}
              >
                {error.action.label} &rarr;
              </a>
            )}
            {sessionFailed && !isProviderError && onSessionError && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onSessionError}
              >
                Reconnect (create new sandbox)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreditWarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-[rgba(245,165,36,0.10)] px-4 py-2 text-xs text-[#f5a524] shadow-[inset_0_-1px_0_0_rgba(245,165,36,0.22)]">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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

function WorkspaceImage({ src, alt, sandboxId, sandboxKey, workspacePath, variant = "artifact", allowExternal = true }: {
  src?: string
  alt?: string
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
  variant?: "artifact" | "attachment"
  allowExternal?: boolean
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isAttachment = variant === "attachment"

  const isExternalUrl = src?.startsWith("http://") || src?.startsWith("https://")
  const resolvedSrc = (() => {
    if (!src || isExternalUrl) return null
    if (src.startsWith("/") && workspacePath && !src.startsWith(workspacePath)) {
      return normalizeImagePath(`${workspacePath}${src}`)
    }
    if (src.startsWith("/")) return normalizeImagePath(src)
    if (workspacePath) return normalizeImagePath(`${workspacePath}/${src}`)
    return null
  })()
  const isWorkspacePath = !!(resolvedSrc && workspacePath && resolvedSrc.startsWith(workspacePath + "/") && !resolvedSrc.includes(".."))
  const fileName = (resolvedSrc || src || alt || "image").split("/").pop() || "image"

  useEffect(() => {
    if (!isWorkspacePath || !sandboxId || !sandboxKey || !resolvedSrc) return
    let cancelled = false
    const params = new URLSearchParams({
      action: "read", sandboxId, key: sandboxKey, path: resolvedSrc, maxSize: String(MAX_INLINE_IMAGE_SIZE),
    })
    fetch(`/api/workspace?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        if (data.type !== "image") { setError("Not an image"); return }
        setDataUrl(data.content)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load")
      })
    return () => { cancelled = true }
  }, [resolvedSrc, sandboxId, sandboxKey, isWorkspacePath])

  if (isExternalUrl && allowExternal) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || ""} loading="lazy" className="max-w-full rounded-[6px] shadow-[var(--shadow-border)]" />
  }
  if (isExternalUrl) {
    return <span className="text-xs text-muted-foreground">[external image: {alt || src}]</span>
  }
  if (!isWorkspacePath) {
    if (src) return <span className="text-xs text-muted-foreground">[image: {alt || src}]</span>
    return null
  }

  const copyMarkdown = async () => {
    await navigator.clipboard?.writeText(`![${alt || fileName}](${src || resolvedSrc || fileName})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  if (isAttachment) {
    return (
      <span className="not-prose my-2 block overflow-hidden rounded-lg bg-[#0a0a0a] shadow-[var(--shadow-border)]">
        {error ? (
          <span className="block px-3 py-4 text-center text-[12px] text-red-200/75">
            {error}
          </span>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={alt || ""} className="max-h-[360px] max-w-full object-contain" />
        ) : (
          <span className="flex h-28 animate-pulse items-center justify-center text-[12px] text-muted-foreground">
            Loading image...
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="not-prose my-3 block overflow-hidden rounded-lg bg-[#0a0a0a] shadow-[var(--shadow-card)]">
      <span className="flex items-center gap-3 px-3.5 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.06]"><ImageIcon className="w-4 h-4 text-muted-foreground" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{alt || fileName}</span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">{resolvedSrc}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
          error ? "bg-[rgba(255,91,79,0.10)] text-[#ff8f86]"
            : dataUrl ? "bg-[rgba(0,112,243,0.16)] text-[#58a6ff]"
            : "bg-[rgba(10,114,239,0.12)] text-[#58a6ff]"
        }`}>
          {error ? "Failed" : dataUrl ? "Ready" : "Loading"}
        </span>
      </span>
      <span className="block bg-white/[0.025] p-3">
        {error ? (
          <span className="block rounded-lg bg-[rgba(255,91,79,0.06)] px-3 py-6 text-center text-[12px] text-[#ff8f86] shadow-[0_0_0_1px_rgba(255,91,79,0.18)]">
            {error}
          </span>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={alt || ""} className="mx-auto max-h-[520px] max-w-full rounded-[6px] bg-white shadow-[var(--shadow-border)]" />
        ) : (
          <span className="flex h-36 animate-pulse items-center justify-center rounded-lg bg-white/[0.025] text-[12px] text-muted-foreground shadow-[var(--shadow-border)]">
            Loading image...
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="rounded-[6px] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          {copied ? "Copied" : "Copy markdown"}
        </button>
        {dataUrl && (
          <a
            href={dataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[6px] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground no-underline shadow-[var(--shadow-border)] transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            Open preview
          </a>
        )}
      </span>
    </span>
  )
}

const AUDIO_EXTS_SET = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"])
const VIDEO_EXTS_SET = new Set(["mp4", "webm", "mov", "avi", "mkv"])

function getMediaType(filename: string): "audio" | "video" | null {
  const dot = filename.lastIndexOf(".")
  if (dot < 0) return null
  const ext = filename.slice(dot + 1).toLowerCase()
  if (AUDIO_EXTS_SET.has(ext)) return "audio"
  if (VIDEO_EXTS_SET.has(ext)) return "video"
  return null
}

function WorkspaceMedia({ src, alt, sandboxId, sandboxKey, workspacePath }: {
  src?: string
  alt?: string
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isExternalUrl = src?.startsWith("http://") || src?.startsWith("https://")
  const resolvedSrc = (() => {
    if (!src || isExternalUrl) return null
    if (src.startsWith("/") && workspacePath && !src.startsWith(workspacePath)) {
      return normalizeImagePath(`${workspacePath}${src}`)
    }
    if (src.startsWith("/")) return normalizeImagePath(src)
    if (workspacePath) return normalizeImagePath(`${workspacePath}/${src}`)
    return null
  })()
  const isWorkspacePath = !!(resolvedSrc && workspacePath && resolvedSrc.startsWith(workspacePath + "/") && !resolvedSrc.includes(".."))
  const fileName = (resolvedSrc || src || alt || "media").split("/").pop() || "media"
  const mediaType = getMediaType(fileName)
  const MediaTypeIcon = mediaType === "audio" ? Music : Video

  useEffect(() => {
    if (!isWorkspacePath || !sandboxId || !sandboxKey || !resolvedSrc) return
    let cancelled = false
    const params = new URLSearchParams({
      action: "media-url", sandboxId, key: sandboxKey, path: resolvedSrc,
    })
    fetch(`/api/workspace?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setMediaUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to get media URL")
      })
    return () => { cancelled = true }
  }, [resolvedSrc, sandboxId, sandboxKey, isWorkspacePath])

  if (isExternalUrl) {
    if (mediaType === "audio") return <audio controls src={src} className="max-w-full my-2" />
    if (mediaType === "video") return <video controls src={src} className="my-2 max-w-full rounded-[6px] shadow-[var(--shadow-border)]" />
    return null
  }
  if (!isWorkspacePath) {
    if (src) return <span className="text-xs text-muted-foreground">[media: {alt || src}]</span>
    return null
  }

  return (
    <span className="not-prose my-3 block overflow-hidden rounded-lg bg-[#0a0a0a] shadow-[var(--shadow-card)]">
      <span className="flex items-center gap-3 px-3.5 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.06]">
          <MediaTypeIcon className="w-4 h-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{alt || fileName}</span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">{resolvedSrc}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
          error ? "bg-[rgba(255,91,79,0.10)] text-[#ff8f86]"
            : mediaUrl ? "bg-[rgba(0,112,243,0.16)] text-[#58a6ff]"
            : "bg-[rgba(10,114,239,0.12)] text-[#58a6ff]"
        }`}>
          {error ? "Failed" : mediaUrl ? "Ready" : "Loading"}
        </span>
      </span>
      <span className="block bg-white/[0.025] p-3">
        {error ? (
          <span className="block rounded-lg bg-[rgba(255,91,79,0.06)] px-3 py-6 text-center text-[12px] text-[#ff8f86] shadow-[0_0_0_1px_rgba(255,91,79,0.18)]">
            {error}
          </span>
        ) : mediaUrl ? (
          mediaType === "audio" ? (
            <audio controls src={mediaUrl} className="w-full" />
          ) : (
            <video controls src={mediaUrl} className="mx-auto max-h-[520px] max-w-full rounded-[6px] shadow-[var(--shadow-border)]" />
          )
        ) : (
          <span className="flex h-20 animate-pulse items-center justify-center rounded-lg bg-white/[0.025] text-[12px] text-muted-foreground shadow-[var(--shadow-border)]">
            Loading {mediaType || "media"}...
          </span>
        )}
      </span>
      {mediaUrl && (
        <span className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[6px] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground no-underline shadow-[var(--shadow-border)] transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            Open in new tab
          </a>
        </span>
      )}
    </span>
  )
}

type StreamdownComponents = NonNullable<MessageResponseProps["components"]>

function textFromReactNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textFromReactNode).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromReactNode(node.props.children)
  return ""
}

function ChatCodeBlock({ className, children }: { className?: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const language = className?.match(/language-([^\s]+)/)?.[1]
  const code = textFromReactNode(children).replace(/\n$/, "")

  const copyCode = async () => {
    await navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className="not-prose group/code relative my-3 block overflow-hidden rounded-lg bg-[#050505] shadow-[var(--shadow-card)]"
      data-language={language || undefined}
    >
      <button
        type="button"
        aria-label="Copy code"
        onClick={() => void copyCode()}
        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-muted-foreground opacity-70 transition-colors hover:bg-white/[0.06] hover:text-foreground group-hover/code:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="m-0 overflow-x-auto p-3 pr-12 font-mono text-[13px] leading-relaxed text-[#58a6ff]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function createStreamdownComponents({
  sandboxId,
  sandboxKey,
  workspacePath,
  isUser,
}: {
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
  isUser: boolean
}): StreamdownComponents {
  return {
    code: ({ className, children, ...props }) => {
      const { node, ...codeProps } = props
      void node
      if (!("data-block" in codeProps)) {
        return <code className={className} {...codeProps}>{children}</code>
      }
      return <ChatCodeBlock className={className}>{children}</ChatCodeBlock>
    },
    img: (props) => {
      const imgSrc = typeof props.src === "string" ? props.src : undefined
      const imgAlt = typeof props.alt === "string" ? props.alt : undefined
      if (imgSrc && getMediaType(imgSrc)) {
        return (
          <WorkspaceMedia
            src={imgSrc}
            alt={imgAlt}
            sandboxId={sandboxId}
            sandboxKey={sandboxKey}
            workspacePath={workspacePath}
          />
        )
      }
      return (
        <WorkspaceImage
          src={imgSrc}
          alt={imgAlt}
          sandboxId={sandboxId}
          sandboxKey={sandboxKey}
          workspacePath={workspacePath}
          variant={isUser ? "attachment" : "artifact"}
          allowExternal={!isUser}
        />
      )
    },
    a: (props) => {
      const href = typeof props.href === "string" ? props.href : undefined
      if (href && getMediaType(href)) {
        return (
          <WorkspaceMedia
            src={href}
            alt={typeof props.children === "string" ? props.children : undefined}
            sandboxId={sandboxId}
            sandboxKey={sandboxKey}
            workspacePath={workspacePath}
          />
        )
      }
      return <a {...props} />
    },
  }
}

const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|svg|ico|mp3|wav|ogg|flac|aac|m4a|mp4|webm|mov|avi|mkv)$/i

function prefixBareMediaPaths(md: string): string {
  return md.replace(
    /(!?\[([^\]]*)\])\(([^)]+)\)/g,
    (_match, prefix, _alt, url) => {
      if (/^(https?:|\/|\.\/|\.\.\/)/.test(url)) return _match
      if (MEDIA_EXT_RE.test(url)) return `${prefix}(./${url})`
      return _match
    },
  )
}

function MessageBubble({ msg, sandboxId, sandboxKey, workspacePath, isStreamingContent = false }: {
  msg: ChatMessage
  sandboxId?: string | null
  sandboxKey?: string | null
  workspacePath?: string | null
  isStreamingContent?: boolean
}) {
  const isUser = msg.role === "user"
  const streamComponents = useMemo(
    () => createStreamdownComponents({ sandboxId, sandboxKey, workspacePath, isUser }),
    [sandboxId, sandboxKey, workspacePath, isUser],
  )

  const content = useMemo(() => prefixBareMediaPaths(msg.content), [msg.content])

  if (isUser) {
    return (
      <Message from="user" className="mb-4">
        <MessageContent className="max-w-[85%] rounded-lg rounded-br-[3px] bg-[#111111] px-4 py-2.5 shadow-[var(--shadow-border)]">
          <MessageResponse
            className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground [&_code]:text-[#58a6ff] [&_li]:my-0 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-2"
            components={streamComponents}
            controls={CHAT_STREAMDOWN_CONTROLS}
            lineNumbers={false}
            mode="static"
          >
            {content}
          </MessageResponse>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message from="assistant" className="mb-4 max-w-full">
      {msg.content && (
        <MessageContent className="w-full max-w-full">
          <MessageResponse
            className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_a]:text-[#58a6ff] [&_a:hover]:underline [&_code]:text-[#58a6ff]"
            components={streamComponents}
            controls={CHAT_STREAMDOWN_CONTROLS}
            lineNumbers={false}
            mode={isStreamingContent ? "streaming" : "static"}
            parseIncompleteMarkdown={isStreamingContent}
          >
            {content}
          </MessageResponse>
        </MessageContent>
      )}
    </Message>
  )
}

function AgentReasoning({ text, isLive }: { text: string; isLive: boolean }) {
  if (!text && !isLive) return null

  return (
    <Reasoning
      className="my-1.5 rounded-lg bg-[#0a0a0a] px-3 py-2 shadow-[var(--shadow-border)]"
      defaultOpen={isLive}
      isStreaming={isLive}
    >
      <ReasoningTrigger
        className="font-mono text-[11px] font-medium uppercase"
        getThinkingMessage={(streaming, duration) => {
          if (streaming) return "Thinking"
          if (duration === undefined) return "Thought"
          return `Thought for ${duration}s`
        }}
      />
      <ReasoningContent className="max-h-[220px] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {text || "Thinking..."}
      </ReasoningContent>
    </Reasoning>
  )
}

function getToolState(tool: ToolCall): ToolPart["state"] {
  if (tool.isError) return "output-error"
  if (tool.status === "running") return "input-available"
  return "output-available"
}

function AgentToolCard({ tool }: { tool: ToolCall }) {
  const hasArgs = !!(tool.args && Object.keys(tool.args).length > 0)
  const hasPreview = !!tool.preview
  const state = getToolState(tool)

  return (
    <Tool
      className={`my-1 overflow-hidden border-0 transition-shadow ${
        tool.status === "running"
          ? "bg-[rgba(10,114,239,0.08)] shadow-[0_0_0_1px_rgba(10,114,239,0.28)]"
          : tool.isError
            ? "bg-[rgba(255,91,79,0.08)] shadow-[0_0_0_1px_rgba(255,91,79,0.24)]"
            : "bg-[#0a0a0a] shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-strong)]"
      }`}
      defaultOpen={tool.status === "running" || tool.isError}
    >
      <ToolHeader
        className="px-3 py-1.5"
        state={state}
        title={tool.name}
        type={`tool-${tool.name}`}
      />
      {(hasArgs || hasPreview) && (
        <ToolContent className="space-y-2 px-3 pb-3 pt-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          {hasArgs && (
            <ToolInput
              input={tool.args}
              className="[&_h4]:text-[10px] [&_h4]:tracking-normal"
            />
          )}
          {hasPreview && (
            <Terminal
              autoScroll
              className="border-0 bg-[#050505] text-xs shadow-[var(--shadow-border)]"
              isStreaming={tool.status === "running"}
              output={tool.preview ?? ""}
            />
          )}
          {tool.duration != null && (
            <div className="font-mono text-[10px] text-muted-foreground">
              Completed in {tool.duration.toFixed(1)}s
            </div>
          )}
        </ToolContent>
      )}
    </Tool>
  )
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 py-2 px-1" role="status" aria-label="Agent is thinking">
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
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
  const { messages, toolCalls, segments, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, workspacePath, thinkingText, isThinking, send, cancel } = useChat(
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoIntroSent = useRef(false)
  const autoIntroPrompt = useMemo(
    () => `Use skill_view to look up the /${skillPath} skill, then briefly introduce it - what it does, when to use it, and a quick example.`,
    [skillPath],
  )

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const uploadingRef = useRef(false)

  const hasInitialMessages = (initialMessages?.length ?? 0) > 0

  // Auto-intro guard: keyed by sessionId in sessionStorage so it survives
  // any mid-stream remount (e.g. Next's useSearchParams re-running after the
  // URL ?session= is synced) and prevents the prompt from being sent twice.
  useEffect(() => {
    if (autoIntroSent.current || hasInitialMessages || messages.length > 0 || !sessionId) return
    const storageKey = `tryskills:auto-intro-sent:${sessionId}`
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
        autoIntroSent.current = true
        return
      }
    } catch {}
    autoIntroSent.current = true
    try {
      if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, "1")
    } catch {}
    send(autoIntroPrompt)
  }, [sessionId, hasInitialMessages, messages.length, autoIntroPrompt, send])

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
      if (document.hidden) stop()
      else start()
    }
    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility) }
  }, [startedAt])

  useEffect(() => {
    if (isStreaming || isUploading) return
    const textarea = textareaRef.current
    if (!textarea) return

    const activeElement = document.activeElement as HTMLElement | null
    const composerHasFocus = activeElement?.closest("[data-chat-composer='true']")
    if (activeElement && activeElement !== document.body && activeElement !== textarea && !composerHasFocus) return

    const frame = window.requestAnimationFrame(() => {
      if (!textarea.disabled) {
        textarea.focus({ preventScroll: true })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isStreaming, isUploading])

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

  const uploadFiles = useCallback(async (): Promise<UploadedFile[]> => {
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
    const uploaded: UploadedFile[] = []
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
        const filename = typeof data.filename === "string" ? data.filename : file.name
        uploaded.push({
          filename,
          path: typeof data.path === "string" ? data.path : filename,
          size: typeof data.size === "number" ? data.size : file.size,
          isImage: isPreviewableImageName(filename),
        })
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

  const handleTopStop = useCallback(() => {
    if (isStreaming) {
      cancel()
      return
    }
    onStop()
  }, [isStreaming, cancel, onStop])

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !pendingFiles.length) || isStreaming || isUploading || uploadingRef.current) return

    let msgText = text
    if (pendingFiles.length) {
      try {
        const uploaded = await uploadFiles()
        if (uploaded.length) {
          msgText = formatUploadedFilesMessage(msgText, uploaded)
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
  const shouldShowOptimisticAutoIntro = !hasInitialMessages && messages.length === 0

  return (
    <div
      className="relative flex h-[calc(100vh-56px)] w-full flex-col bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-[rgba(10,114,239,0.10)] shadow-[inset_0_0_0_1px_rgba(10,114,239,0.45)]">
          <div className="flex items-center gap-2 text-sm font-medium text-[#58a6ff]">
            <Upload className="h-5 w-5" />
            Drop files here
          </div>
        </div>
      )}

      {/* TopBar */}
      <div className="flex shrink-0 items-center gap-3 bg-background px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]" aria-label={`Skill ${skillName} active for ${formatTime(elapsed)}`}>
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#0a72ef]" aria-hidden="true" />
        <span className="font-mono text-sm text-foreground">{skillName}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatTime(elapsed)}</span>
        <div className="ml-auto flex items-center gap-2">
          {onTryAnother && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTryAnother}
            >
              Try Another
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleTopStop}
            title={isStreaming ? "Cancel streaming response" : "Stop session"}
          >
            Stop
          </Button>
        </div>
      </div>

      {/* Credit warning banner */}
      {creditWarning && <CreditWarningBanner message={creditWarning} />}

      {/* Messages */}
      <Conversation className="bg-background">
        <ConversationContent className="gap-0 px-4 py-4">
          {segments.length > 0 ? (
            <>
              {/* Previous messages; skip last if it's the assistant message mirrored by segments */}
              {(messages[messages.length - 1]?.role === "assistant" ? messages.slice(0, -1) : messages).map((msg, i) => (
                <MessageBubble key={i} msg={msg} sandboxId={sandboxId} sandboxKey={sandboxKey} workspacePath={workspacePath} />
              ))}
              {/* Interleaved segments for current assistant turn */}
              {segments.map((seg, i) =>
                seg.type === "text" ? (
                  seg.content.trim() ? (
                    <MessageBubble
                      key={`seg-text-${i}`}
                      msg={{ role: "assistant", content: seg.content }}
                      sandboxId={sandboxId}
                      sandboxKey={sandboxKey}
                      workspacePath={workspacePath}
                      isStreamingContent
                    />
                  ) : null
                ) : (
                  <AgentToolCard key={`seg-tool-${i}`} tool={seg.tool} />
                )
              )}
            </>
          ) : (
            <>
              {shouldShowOptimisticAutoIntro && (
                <MessageBubble
                  msg={{ role: "user", content: autoIntroPrompt }}
                  sandboxId={sandboxId}
                  sandboxKey={sandboxKey}
                  workspacePath={workspacePath}
                />
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} sandboxId={sandboxId} sandboxKey={sandboxKey} workspacePath={workspacePath} />
              ))}
            </>
          )}
          {(thinkingText || isThinking) && (
            <AgentReasoning text={thinkingText} isLive={isThinking} />
          )}
          {isStreaming && !thinkingText && !isThinking && segments.length === 0 && toolCalls.length === 0 && messages[messages.length - 1]?.role !== "assistant" && (
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
        </ConversationContent>
        <ConversationScrollButton className="bottom-4 shadow-[var(--shadow-card)]" />
      </Conversation>

      {/* Input */}
      <div className="shrink-0 bg-background px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        {/* Attachment tray */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex max-w-[200px] items-center gap-1.5 rounded-[6px] bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground shadow-[var(--shadow-border)]"
              >
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-2.5 w-2.5" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload status */}
        {isUploading && (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#58a6ff]">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#0a72ef]/30 border-t-[#0a72ef]" />
            Uploading...
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mb-2 text-[11px] text-[#ff8f86]">{uploadError}</div>
        )}

        <div className="flex items-end gap-2" data-chat-composer="true">
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isUploading}
            aria-label="Attach files"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-[18px] h-[18px]" />
          </Button>

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
            className="flex-1 resize-none rounded-lg bg-white/[0.04] px-4 py-2.5 text-sm text-foreground shadow-[var(--shadow-border)] outline-none transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              onClick={cancel}
              aria-label="Cancel streaming response"
              className="shrink-0"
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send message"
              className="shrink-0"
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
