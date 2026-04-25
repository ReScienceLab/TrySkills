"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  chatStream,
  ProviderError,
  type ChatMessage,
  type ToolProgress,
  type ToolStartEvent,
  type ToolCompleteEvent,
  type StreamDoneMeta,
} from "@/lib/sandbox/hermes-api"
import { checkProviderCredit } from "@/lib/providers/check-credit"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

export type ErrorType =
  | "provider_error"
  | "auth_error"
  | "credit_error"
  | "rate_limit"
  | "empty_response"
  | "network"

export interface ChatError {
  type: ErrorType
  message: string
  action?: { label: string; url: string }
}

export interface ToolCall {
  name: string
  emoji?: string
  status: "running" | "done"
  preview?: string
  args?: Record<string, string>
  duration?: number
  isError?: boolean
}

export type Segment =
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }

const PROVIDER_BILLING_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/credits",
  anthropic: "https://console.anthropic.com/settings/billing",
  openai: "https://platform.openai.com/settings/organization/billing",
  google: "https://aistudio.google.com/apikey",
  nous: "https://portal.nousresearch.com",
  kimi: "https://platform.kimi.ai/console/top-up",
  minimax: "https://platform.minimax.io/user-center/basic-information",
}

const PROVIDER_KEY_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
  nous: "https://portal.nousresearch.com",
  kimi: "https://platform.kimi.ai/console/api-keys",
  minimax: "https://platform.minimax.io/user-center/basic-information/interface-key",
}

function classifyError(err: Error, providerId?: string): ChatError {
  const msg = err.message.toLowerCase()
  const code = err instanceof ProviderError ? err.code : undefined
  const codeStr = String(code ?? "").toLowerCase()
  const billingUrl = providerId ? PROVIDER_BILLING_URLS[providerId] : undefined
  const keyUrl = providerId ? PROVIDER_KEY_URLS[providerId] : undefined

  if (
    codeStr === "402" ||
    code === 402 ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("credit") ||
    msg.includes("quota") ||
    msg.includes("exceeded your current")
  ) {
    return {
      type: "credit_error",
      message: `Your ${providerId || "provider"} account has insufficient credits.`,
      action: billingUrl ? { label: "Add credits", url: billingUrl } : undefined,
    }
  }

  if (
    codeStr === "401" ||
    codeStr === "403" ||
    code === 401 ||
    code === 403 ||
    msg.includes("invalid api key") ||
    msg.includes("authentication") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid_api_key") ||
    codeStr === "authentication_error"
  ) {
    return {
      type: "auth_error",
      message: "Your API key is invalid or expired.",
      action: keyUrl ? { label: "Update API key", url: keyUrl } : undefined,
    }
  }

  if (
    codeStr === "429" ||
    code === 429 ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests")
  ) {
    return {
      type: "rate_limit",
      message: "Rate limit reached. Please wait a moment and try again.",
    }
  }

  if (
    msg.includes("model") ||
    msg.includes("provider") ||
    msg.includes("not found") ||
    msg.includes("not available")
  ) {
    return {
      type: "provider_error",
      message: err.message,
    }
  }

  if (msg.includes("connection") || msg.includes("network") || msg.includes("fetch")) {
    return {
      type: "network",
      message: err.message,
    }
  }

  return {
    type: "provider_error",
    message: err.message,
  }
}

async function diagnoseEmptyResponse(providerId?: string, apiKey?: string): Promise<ChatError> {
  if (!providerId || !apiKey) {
    return {
      type: "empty_response",
      message: "Agent returned no response. This may be a temporary issue -- try again.",
    }
  }

  try {
    const result = await checkProviderCredit(providerId, apiKey)
    if (!result.ok) {
      const errorType = (result.errorType as ErrorType) || "credit_error"
      return {
        type: errorType,
        message: result.error,
        action: result.action,
      }
    }
  } catch {
    // probe failed, fall through
  }

  return {
    type: "empty_response",
    message: "Agent returned an empty response. This may be a temporary issue -- try again.",
  }
}

export function useChat(
  gatewayBaseUrl: string | null,
  model: string,
  skillName: string,
  providerId?: string,
  apiKey?: string,
  initialSessionId?: string,
  skillPath?: string,
  initialMessages?: ChatMessage[],
  onToolComplete?: (toolName: string) => void,
  sandboxId?: string | null,
  sandboxKey?: string | null,
  initialWorkspacePath?: string | null,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const [creditWarning, setCreditWarning] = useState<string | null>(null)
  const [sessionFailed, setSessionFailed] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [workspacePath, setWorkspacePath] = useState<string | null>(initialWorkspacePath ?? null)
  const [thinkingText, setThinkingText] = useState("")
  const [isThinking, setIsThinking] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const initRef = useRef(false)
  const currentContentRef = useRef("")
  const currentUserMessageRef = useRef<ChatMessage | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preflightDoneRef = useRef(false)
  const preflightFailedRef = useRef(false)
  const turnIdRef = useRef(0)
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null)
  const onToolCompleteRef = useRef(onToolComplete)
  const segmentsRef = useRef<Segment[]>([])
  const textOffsetRef = useRef(0)
  const pendingToolCompletionsRef = useRef<Set<string>>(new Set())
  const toolCompletionFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedMessagesRef = useRef<string | null>(
    initialMessages ? `${initialSessionId ?? "new"}:${initialMessages.length}` : null,
  )

  useEffect(() => {
    onToolCompleteRef.current = onToolComplete
  }, [onToolComplete])

  const createSession = useMutation(api.chatSessions.create)
  const appendMessages = useMutation(api.chatSessions.appendMessages)

  const thinkingRef = useRef("")
  const workspacePathRef = useRef<string | null>(initialWorkspacePath ?? null)

  const scheduleToolComplete = useCallback((toolName?: string) => {
    if (!toolName) return
    pendingToolCompletionsRef.current.add(toolName)
    if (toolCompletionFlushRef.current) return
    toolCompletionFlushRef.current = setTimeout(() => {
      toolCompletionFlushRef.current = null
      const names = Array.from(pendingToolCompletionsRef.current)
      pendingToolCompletionsRef.current.clear()
      for (const name of names) {
        onToolCompleteRef.current?.(name)
      }
    }, 0)
  }, [])

  useEffect(() => {
    const pendingToolCompletions = pendingToolCompletionsRef.current
    return () => {
      if (toolCompletionFlushRef.current) {
        clearTimeout(toolCompletionFlushRef.current)
        toolCompletionFlushRef.current = null
      }
      pendingToolCompletions.clear()
    }
  }, [])

  useEffect(() => {
    if (initialSessionId && sessionIdRef.current !== initialSessionId) {
      sessionIdRef.current = initialSessionId
      setSessionId(initialSessionId)
    }

    if (initialWorkspacePath && workspacePathRef.current !== initialWorkspacePath) {
      workspacePathRef.current = initialWorkspacePath
      setWorkspacePath(initialWorkspacePath)
    }

    const messagesKey = initialMessages ? `${initialSessionId ?? "new"}:${initialMessages.length}` : null
    if (initialMessages && hydratedMessagesRef.current !== messagesKey) {
      setMessages((prev) => {
        if (initialMessages.length === 0 && prev.length > 0) return prev
        return initialMessages
      })
      hydratedMessagesRef.current = messagesKey
    }
  }, [initialSessionId, initialMessages, initialWorkspacePath])

  const handleError = useCallback(
    (err: Error) => {
      setIsStreaming(false)
      setIsThinking(false)
      setToolCalls((prev) => {
        for (const t of prev.filter((tc) => tc.status === "running")) {
          scheduleToolComplete(t.name)
        }
        return prev.map((t) => ({ ...t, status: "done" as const }))
      })
      setSegments((prev) => prev.map((s) =>
        s.type === "tool" && s.tool.status === "running"
          ? { ...s, tool: { ...s.tool, status: "done" as const } }
          : s
      ))
      setError(classifyError(err, providerId))
    },
    [providerId, scheduleToolComplete],
  )

  const handleDone = useCallback(
    async (meta: StreamDoneMeta) => {
      setIsStreaming(false)
      setToolCalls((prev) => prev.map((t) => ({ ...t, status: "done" as const })))
      setSegments((prev) => prev.map((s) =>
        s.type === "tool" && s.tool.status === "running"
          ? { ...s, tool: { ...s.tool, status: "done" as const } }
          : s
      ))
      if (!meta.hadContent) {
        const currentTurn = turnIdRef.current
        setError({ type: "empty_response", message: "Diagnosing..." })
        const diagnosed = await diagnoseEmptyResponse(providerId, apiKey)
        if (turnIdRef.current === currentTurn) {
          setError(diagnosed)
        }
      }
    },
    [providerId, apiKey],
  )

  // Save messages to Convex session after streaming completes
  const saveToSession = useCallback(
    async (userMsg: ChatMessage, assistantMsg: ChatMessage) => {
      const sid = sessionIdRef.current
      if (!sid) return
      try {
        await appendMessages({
          sessionId: sid as Id<"chatSessions">,
          messages: [userMsg, assistantMsg],
        })
      } catch {
        // best effort
      }
    },
    [appendMessages],
  )

  const stream = useCallback(
    (allMessages: ChatMessage[]) => {
      if (!gatewayBaseUrl) return

      currentContentRef.current = ""
      thinkingRef.current = ""
      setThinkingText("")
      setIsThinking(false)
      turnIdRef.current++
      setIsStreaming(true)
      setError(null)
      setToolCalls([])
      setSegments([])
      segmentsRef.current = []
      textOffsetRef.current = 0

      const lastUserMsg = allMessages[allMessages.length - 1]
      currentUserMessageRef.current = lastUserMsg ?? null

      // Prepend workspace system message on every request
      const wsDir = workspacePathRef.current
      const messagesWithSystem = wsDir
        ? [
            {
              role: "system" as const,
              content: `Use the directory ${wsDir} as your working directory for all file operations in this session. Create files, save outputs, and write results there. Create the directory first if it does not exist.\nWhen you create media files (images, audio, video), display them inline using markdown syntax: ![description](filename) for images, [description](filename.mp3) for audio, [description](filename.mp4) for video. Use relative filenames, not absolute paths or MEDIA: prefixes.`,
            },
            ...allMessages,
          ]
        : allMessages

      const cancel = chatStream(
        gatewayBaseUrl,
        messagesWithSystem,
        {
          onDelta: (text) => {
            currentContentRef.current += text
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: currentContentRef.current }]
              }
              return [...prev, { role: "assistant", content: currentContentRef.current }]
            })
            const segs = segmentsRef.current
            const last = segs[segs.length - 1]
            const currentText = currentContentRef.current.slice(textOffsetRef.current)
            if (last?.type === "text") {
              last.content = currentText
            } else {
              segs.push({ type: "text", content: currentText })
            }
            setSegments([...segs])
          },
          onReasoning: (text) => {
            thinkingRef.current += text
            setThinkingText(thinkingRef.current)
            setIsThinking(true)
          },
          onToolProgress: (tool: ToolProgress) => {
            setToolCalls((prev) => {
              const running = prev.filter((t) => t.status === "running")
              for (const t of running) {
                scheduleToolComplete(t.name)
              }
              const existing = prev.find((t) => t.name === tool.tool && t.status === "running")
              if (existing) return prev
              return [
                ...prev.map((t) => t.status === "running" ? { ...t, status: "done" as const } : t),
                { name: tool.tool, emoji: tool.emoji, status: "running" },
              ]
            })
            setIsThinking(false)
            // Push tool segment for progress events; finalize prior running tools
            const segs = segmentsRef.current
            const alreadyTracked = segs.some((s) => s.type === "tool" && s.tool.name === tool.tool && s.tool.status === "running")
            if (!alreadyTracked) {
              for (const s of segs) {
                if (s.type === "tool" && s.tool.status === "running") s.tool = { ...s.tool, status: "done" }
              }
              textOffsetRef.current = currentContentRef.current.length
              segs.push({ type: "tool", tool: { name: tool.tool, emoji: tool.emoji, status: "running" } })
              setSegments([...segs])
            }
          },
          onToolStart: (tool: ToolStartEvent) => {
            setToolCalls((prev) => {
              const running = prev.filter((t) => t.status === "running")
              for (const t of running) {
                scheduleToolComplete(t.name)
              }
              return [
                ...prev.map((t) => t.status === "running" ? { ...t, status: "done" as const } : t),
                {
                  name: tool.name,
                  status: "running" as const,
                  preview: tool.preview,
                  args: tool.args,
                },
              ]
            })
            setIsThinking(false)
            // Finalize prior running tool segments, then push new one
            for (const s of segmentsRef.current) {
              if (s.type === "tool" && s.tool.status === "running") s.tool = { ...s.tool, status: "done" }
            }
            textOffsetRef.current = currentContentRef.current.length
            const tc: ToolCall = { name: tool.name, status: "running", preview: tool.preview, args: tool.args }
            segmentsRef.current.push({ type: "tool", tool: tc })
            setSegments([...segmentsRef.current])
          },
          onToolComplete: (tool: ToolCompleteEvent) => {
            setToolCalls((prev) => {
              const idx = [...prev].reverse().findIndex(
                (t) => t.status === "running" && (!tool.name || t.name === tool.name)
              )
              if (idx === -1) {
                return [
                  ...prev,
                  {
                    name: tool.name,
                    status: "done" as const,
                    preview: tool.preview,
                    args: tool.args,
                    duration: tool.duration,
                    isError: tool.is_error,
                  },
                ]
              }
              const realIdx = prev.length - 1 - idx
              const updated = [...prev]
              updated[realIdx] = {
                ...updated[realIdx],
                status: "done" as const,
                preview: tool.preview || updated[realIdx].preview,
                args: tool.args || updated[realIdx].args,
                duration: tool.duration,
                isError: tool.is_error,
              }
              scheduleToolComplete(updated[realIdx].name)
              return updated
            })
            // Update matching tool segment, or append done segment if no match
            const segs = segmentsRef.current
            let matched = false
            for (let i = segs.length - 1; i >= 0; i--) {
              const s = segs[i]
              if (s.type === "tool" && s.tool.status === "running" && (!tool.name || s.tool.name === tool.name)) {
                s.tool = {
                  ...s.tool,
                  status: "done",
                  preview: tool.preview || s.tool.preview,
                  args: tool.args || s.tool.args,
                  duration: tool.duration,
                  isError: tool.is_error,
                }
                matched = true
                break
              }
            }
            if (!matched) {
              textOffsetRef.current = currentContentRef.current.length
              segs.push({
                type: "tool",
                tool: { name: tool.name, status: "done", preview: tool.preview, args: tool.args, duration: tool.duration, isError: tool.is_error },
              })
            }
            setSegments([...segs])
          },
          onDone: async (meta) => {
            setIsThinking(false)
            cancelRef.current = null
            setToolCalls((prev) => {
              for (const t of prev.filter((tc) => tc.status === "running")) {
                scheduleToolComplete(t.name)
              }
              return prev.map((t) => ({ ...t, status: "done" as const }))
            })
            await handleDone(meta)
            if (meta.hadContent && lastUserMsg) {
              await saveToSession(
                lastUserMsg,
                { role: "assistant", content: currentContentRef.current },
              )
            }
            currentUserMessageRef.current = null
          },
          onError: handleError,
        },
        model,
      )
      cancelRef.current = cancel
    },
    [gatewayBaseUrl, model, handleDone, handleError, saveToSession, scheduleToolComplete],
  )

  const send = useCallback(
    (message: string) => {
      if (!message.trim() || isStreaming) return
      const userMsg: ChatMessage = { role: "user", content: message.trim() }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      stream(newMessages)
    },
    [messages, isStreaming, stream],
  )

  const cancel = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    const hasAssistantContent = currentContentRef.current.trim().length > 0
    const userMsg = currentUserMessageRef.current
    if (hasAssistantContent && userMsg) {
      void saveToSession(
        userMsg,
        { role: "assistant", content: currentContentRef.current },
      )
    }
    currentUserMessageRef.current = null
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    setIsStreaming(false)
    setIsThinking(false)
    setToolCalls((prev) => {
      for (const t of prev.filter((tc) => tc.status === "running")) {
        scheduleToolComplete(t.name)
      }
      return prev.map((t) => ({ ...t, status: "done" as const }))
    })
    setSegments([])
    segmentsRef.current = []
    textOffsetRef.current = 0
    setMessages((prev) =>
      !hasAssistantContent && prev.length > 0 && prev[prev.length - 1]?.role === "assistant"
        ? prev.slice(0, -1)
        : prev,
    )
  }, [saveToSession, scheduleToolComplete])

  // Pre-flight credit check (OpenRouter only, blocks auto-init until done)
  useEffect(() => {
    if (!gatewayBaseUrl || !providerId || !apiKey) {
      preflightDoneRef.current = true
      return
    }
    if (providerId !== "openrouter") {
      preflightDoneRef.current = true
      return
    }
    checkProviderCredit(providerId, apiKey)
      .then((result) => {
        if (!result.ok) {
          preflightFailedRef.current = true
          setError({
            type: (result.errorType as ErrorType) || "credit_error",
            message: result.error,
            action: result.action,
          })
          setSessionFailed(true)
        } else if (result.ok && result.warning) {
          setCreditWarning(result.warning)
        }
      })
      .catch(() => {})
      .finally(() => {
        preflightDoneRef.current = true
      })
  }, [gatewayBaseUrl, providerId, apiKey])

  // Auto-init: create Convex session + workspace directory (no auto-send)
  useEffect(() => {
    if (!gatewayBaseUrl || initRef.current) return

    let pollTimer: ReturnType<typeof setInterval>

    function startInit() {
      if (initRef.current || !gatewayBaseUrl || preflightFailedRef.current) return
      initRef.current = true

      const doInit = async () => {
        try {
          if (initialMessages && initialMessages.length > 0) {
            return
          }

          if (!sessionIdRef.current && skillPath) {
            // Generate workspace path before session creation so it can be persisted
            const wsId = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
            const wsPath = `/root/.hermes/workspaces/${wsId}`

            const sid = await createSession({
              skillPath,
              title: `${skillName} session`,
              model,
              workspacePath: wsPath,
            })
            const sidStr = sid as string
            sessionIdRef.current = sidStr
            setSessionId(sidStr)

            workspacePathRef.current = wsPath
            setWorkspacePath(wsPath)

            if (sandboxId && sandboxKey) {
              fetch("/api/workspace", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mkdir", sandboxId, key: sandboxKey, path: wsPath }),
              }).catch(() => {})
            }
          }
        } catch (err) {
          console.error("[useChat] session init failed:", err)
        }
      }

      void doInit()
    }

    if (!preflightDoneRef.current) {
      pollTimer = setInterval(() => {
        if (preflightDoneRef.current) {
          clearInterval(pollTimer)
          startInit()
        }
      }, 50)
    } else {
      startInit()
    }

    return () => {
      clearInterval(pollTimer)
    }
  }, [gatewayBaseUrl, model, skillName]) // eslint-disable-line react-hooks/exhaustive-deps

  const isProviderError = error?.type === "credit_error" || error?.type === "auth_error" || error?.type === "rate_limit"

  return { messages, toolCalls, segments, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, workspacePath, thinkingText, isThinking, send, cancel }
}
