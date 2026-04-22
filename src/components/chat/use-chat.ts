"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  chatStream,
  createGatewaySession,
  fetchSession,
  ProviderError,
  type ChatMessage,
  type ToolProgress,
  type StreamDoneMeta,
} from "@/lib/sandbox/hermes-api"
import { checkProviderCredit } from "@/lib/providers/check-credit"

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
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const [creditWarning, setCreditWarning] = useState<string | null>(null)
  const [sessionFailed, setSessionFailed] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)

  const cancelRef = useRef<(() => void) | null>(null)
  const initRef = useRef(false)
  const currentContentRef = useRef("")
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preflightDoneRef = useRef(false)
  const preflightFailedRef = useRef(false)
  const turnIdRef = useRef(0)
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null)

  const handleError = useCallback(
    (err: Error) => {
      setIsStreaming(false)
      setError(classifyError(err, providerId))
    },
    [providerId],
  )

  const handleDone = useCallback(
    async (meta: StreamDoneMeta) => {
      setIsStreaming(false)
      setToolCalls((prev) => prev.map((t) => ({ ...t, status: "done" as const })))
      if (meta.sessionId && meta.sessionId !== sessionIdRef.current) {
        sessionIdRef.current = meta.sessionId
        setSessionId(meta.sessionId)
      }
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

  const stream = useCallback(
    (allMessages: ChatMessage[], sid?: string) => {
      if (!gatewayBaseUrl) return

      currentContentRef.current = ""
      turnIdRef.current++
      setIsStreaming(true)
      setError(null)
      setToolCalls([])

      const cancel = chatStream(
        gatewayBaseUrl,
        allMessages,
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
          onToolProgress: (tool: ToolProgress) => {
            setToolCalls((prev) => {
              const existing = prev.find((t) => t.name === tool.tool && t.status === "running")
              if (existing) return prev
              return [...prev, { name: tool.tool, emoji: tool.emoji, status: "running" }]
            })
          },
          onDone: handleDone,
          onError: handleError,
        },
        model,
        sid ?? sessionIdRef.current ?? undefined,
      )
      cancelRef.current = cancel
    },
    [gatewayBaseUrl, model, handleDone, handleError],
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

  // Auto-init: create session + send first message (or resume existing session)
  useEffect(() => {
    if (!gatewayBaseUrl || initRef.current) return

    let pollTimer: ReturnType<typeof setInterval>

    function startInit() {
      if (initRef.current || !gatewayBaseUrl || preflightFailedRef.current) return
      initRef.current = true

      const MAX_RETRIES = 3
      const RETRY_DELAYS = [2000, 4000, 8000]
      let attempt = 0

      const tryInit = async () => {
        try {
          // If resuming a session, load existing messages
          if (initialSessionId) {
            try {
              const detail = await fetchSession(gatewayBaseUrl, initialSessionId)
              const chatMessages: ChatMessage[] = (detail.messages || [])
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({ role: m.role, content: m.content }))
              if (chatMessages.length > 0) {
                setMessages(chatMessages)
                sessionIdRef.current = initialSessionId
                setSessionId(initialSessionId)
                return
              }
            } catch {
              // Resume failed, fall through to create new session
            }
          }

          // Try to create a Gateway session; fall back to sessionless mode if unavailable
          let sid: string | undefined
          try {
            sid = await createGatewaySession(gatewayBaseUrl, model)
            sessionIdRef.current = sid
            setSessionId(sid)
          } catch {
            // Gateway session API unavailable, clear any stale session ref and continue without session
            sessionIdRef.current = null
            setSessionId(null)
          }

          const firstMsg: ChatMessage = { role: "user", content: `I want to try the ${skillName} skill` }
          setMessages([firstMsg])

          currentContentRef.current = ""
          setIsStreaming(true)

          const cancel = chatStream(
            gatewayBaseUrl,
            [firstMsg],
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
              onToolProgress: (tool: ToolProgress) => {
                setToolCalls((prev) => [...prev, { name: tool.tool, emoji: tool.emoji, status: "running" }])
              },
              onDone: handleDone,
              onError: (err) => {
                const classified = classifyError(err, providerId)
                if (classified.type === "credit_error" || classified.type === "auth_error") {
                  setIsStreaming(false)
                  setSessionFailed(true)
                  setError(classified)
                  return
                }
                attempt++
                if (attempt <= MAX_RETRIES) {
                  setError({ type: "network", message: `Retrying (${attempt}/${MAX_RETRIES})...` })
                  retryTimerRef.current = setTimeout(() => { void tryInit() }, RETRY_DELAYS[attempt - 1])
                } else {
                  setIsStreaming(false)
                  setSessionFailed(true)
                  setError(classified)
                  initRef.current = false
                }
              },
            },
            model,
            sid,
          )
          cancelRef.current = cancel
        } catch (err) {
          // Unexpected error, retry
          attempt++
          if (attempt <= MAX_RETRIES) {
            setError({ type: "network", message: `Retrying (${attempt}/${MAX_RETRIES})...` })
            retryTimerRef.current = setTimeout(() => { void tryInit() }, RETRY_DELAYS[attempt - 1])
          } else {
            setIsStreaming(false)
            setSessionFailed(true)
            setError(classifyError(err instanceof Error ? err : new Error(String(err)), providerId))
            initRef.current = false
          }
        }
      }

      void tryInit()
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
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      clearInterval(pollTimer)
    }
  }, [gatewayBaseUrl, model, skillName]) // eslint-disable-line react-hooks/exhaustive-deps

  const isProviderError = error?.type === "credit_error" || error?.type === "auth_error" || error?.type === "rate_limit"

  return { messages, toolCalls, isStreaming, error, creditWarning, sessionFailed, isProviderError, sessionId, send, cancel }
}
