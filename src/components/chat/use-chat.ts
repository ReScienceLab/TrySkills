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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preflightDoneRef = useRef(false)
  const preflightFailedRef = useRef(false)
  const turnIdRef = useRef(0)
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null)
  const onToolCompleteRef = useRef(onToolComplete)
  onToolCompleteRef.current = onToolComplete

  const createSession = useMutation(api.chatSessions.create)
  const appendMessages = useMutation(api.chatSessions.appendMessages)

  const thinkingRef = useRef("")

  const handleError = useCallback(
    (err: Error) => {
      setIsStreaming(false)
      setIsThinking(false)
      setToolCalls((prev) => {
        for (const t of prev.filter((tc) => tc.status === "running")) {
          onToolCompleteRef.current?.(t.name)
        }
        return prev.map((t) => ({ ...t, status: "done" as const }))
      })
      setError(classifyError(err, providerId))
    },
    [providerId],
  )

  const handleDone = useCallback(
    async (meta: StreamDoneMeta) => {
      setIsStreaming(false)
      setToolCalls((prev) => prev.map((t) => ({ ...t, status: "done" as const })))
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

  const workspacePathRef = useRef<string | null>(initialWorkspacePath ?? null)

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

      const lastUserMsg = allMessages[allMessages.length - 1]

      // Prepend workspace system message on every request
      const wsDir = workspacePathRef.current
      const messagesWithSystem = wsDir
        ? [
            {
              role: "system" as const,
              content: `Use the directory ${wsDir} as your working directory for all file operations in this session. Create files, save outputs, and write results there. Create the directory first if it does not exist.`,
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
                onToolCompleteRef.current?.(t.name)
              }
              const existing = prev.find((t) => t.name === tool.tool && t.status === "running")
              if (existing) return prev
              return [
                ...prev.map((t) => t.status === "running" ? { ...t, status: "done" as const } : t),
                { name: tool.tool, emoji: tool.emoji, status: "running" },
              ]
            })
            setIsThinking(false)
          },
          onToolStart: (tool: ToolStartEvent) => {
            setToolCalls((prev) => {
              const running = prev.filter((t) => t.status === "running")
              for (const t of running) {
                onToolCompleteRef.current?.(t.name)
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
              onToolCompleteRef.current?.(updated[realIdx].name)
              return updated
            })
          },
          onDone: async (meta) => {
            setIsThinking(false)
            setToolCalls((prev) => {
              for (const t of prev.filter((tc) => tc.status === "running")) {
                onToolCompleteRef.current?.(t.name)
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
          },
          onError: handleError,
        },
        model,
      )
      cancelRef.current = cancel
    },
    [gatewayBaseUrl, model, handleDone, handleError, saveToSession],
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
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    setIsStreaming(false)
    setIsThinking(false)
    setToolCalls((prev) => {
      for (const t of prev.filter((tc) => tc.status === "running")) {
        onToolCompleteRef.current?.(t.name)
      }
      return prev.map((t) => ({ ...t, status: "done" as const }))
    })
    setMessages((prev) =>
      prev.length > 0 && prev[prev.length - 1]?.role === "assistant"
        ? prev.slice(0, -1)
        : prev,
    )
  }, [])

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

  return { messages, toolCalls, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, workspacePath, thinkingText, isThinking, send, cancel }
}
