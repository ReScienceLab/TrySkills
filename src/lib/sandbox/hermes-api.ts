export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ToolProgress {
  tool: string
  emoji: string
  label: string
}

export class ProviderError extends Error {
  code: string | number | undefined
  constructor(message: string, code?: string | number) {
    super(message)
    this.name = "ProviderError"
    this.code = code
  }
}

export interface StreamDoneMeta {
  hadContent: boolean
  sessionId?: string
  title?: string
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
  onToolProgress: (tool: ToolProgress) => void
  onDone: (meta: StreamDoneMeta) => void
  onError: (err: Error) => void
}

// --- Session types ---

export interface SessionCompact {
  session_id: string
  title: string
  model: string
  message_count: number
  created_at: number
  updated_at: number
  workspace?: string
  pinned?: boolean
  archived?: boolean
}

export interface SessionDetail extends SessionCompact {
  messages: ChatMessage[]
  tool_calls: Array<{ name: string; args?: Record<string, unknown> }>
}

// --- Session API functions ---

export async function createGatewaySession(
  gatewayBaseUrl: string,
  model?: string,
): Promise<string> {
  const res = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: gatewayBaseUrl,
      path: "/api/session/new",
      body: { model },
    }),
  })
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
  const data = await res.json()
  return data.session?.session_id ?? data.session_id
}

export async function fetchSessions(
  gatewayBaseUrl: string,
): Promise<SessionCompact[]> {
  const params = new URLSearchParams({ baseUrl: gatewayBaseUrl, path: "/api/sessions" })
  const res = await fetch(`/api/hermes?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
  const data = await res.json()
  return data.sessions ?? []
}

export async function fetchSession(
  gatewayBaseUrl: string,
  sessionId: string,
): Promise<SessionDetail> {
  const params = new URLSearchParams({
    baseUrl: gatewayBaseUrl,
    path: "/api/session",
    session_id: sessionId,
  })
  const res = await fetch(`/api/hermes?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
  const data = await res.json()
  return data.session
}

export async function deleteGatewaySession(
  gatewayBaseUrl: string,
  sessionId: string,
): Promise<void> {
  const res = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: gatewayBaseUrl,
      path: "/api/session/delete",
      body: { session_id: sessionId },
    }),
  })
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`)
}

// --- Chat streaming ---

interface ChatStartResponse {
  stream_id: string
  session_id: string
}

async function chatStart(
  gatewayBaseUrl: string,
  sessionId: string,
  message: string,
  model: string,
): Promise<ChatStartResponse> {
  const res = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: gatewayBaseUrl,
      path: "/api/chat/start",
      body: {
        session_id: sessionId,
        message,
        model,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const parsed = tryParseErrorJson(text)
    if (parsed) throw new ProviderError(parsed.message, parsed.code)
    throw new Error(text || `Chat start failed: ${res.status}`)
  }
  return res.json()
}

export function chatStream(
  gatewayBaseUrl: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  model?: string,
  sessionId?: string,
): () => void {
  let aborted = false
  const controller = new AbortController()

  void (async () => {
    let hadContent = false

    try {
      // If we have a sessionId, use the Gateway native session API
      if (sessionId) {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
        if (!lastUserMsg) {
          callbacks.onError(new Error("No user message to send"))
          return
        }

        const { stream_id } = await chatStart(
          gatewayBaseUrl,
          sessionId,
          lastUserMsg.content,
          model || "hermes",
        )

        // Connect to SSE stream
        const streamParams = new URLSearchParams({
          baseUrl: gatewayBaseUrl,
          path: "/api/stream",
          stream_id,
        })
        const sseRes = await fetch(`/api/hermes?${streamParams}`, {
          signal: controller.signal,
        })

        if (!sseRes.ok || !sseRes.body) {
          throw new Error(`Stream connect failed: ${sseRes.status}`)
        }

        const reader = sseRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let currentEventType = ""

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim()
              continue
            }
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6)

            try {
              const parsed = JSON.parse(data)

              if (currentEventType === "error" || parsed.error) {
                const errMsg = parsed.error?.message || parsed.message || "Stream error"
                callbacks.onError(new ProviderError(errMsg, parsed.error?.code))
                return
              }

              if (currentEventType === "token") {
                if (parsed.text) {
                  hadContent = true
                  callbacks.onDelta(parsed.text)
                }
                currentEventType = ""
                continue
              }

              if (currentEventType === "tool" || currentEventType === "tool_complete") {
                if (parsed.name) {
                  callbacks.onToolProgress({
                    tool: parsed.name,
                    emoji: parsed.preview || "",
                    label: parsed.name,
                  })
                }
                currentEventType = ""
                continue
              }

              if (currentEventType === "apperror") {
                const errMsg = parsed.message || "Provider error"
                callbacks.onError(new ProviderError(errMsg, parsed.type))
                return
              }

              if (currentEventType === "done") {
                const sess = parsed.session
                callbacks.onDone({
                  hadContent,
                  sessionId: sess?.session_id,
                  title: sess?.title,
                })
                return
              }

              if (currentEventType === "stream_end") {
                callbacks.onDone({ hadContent, sessionId: parsed.session_id })
                return
              }

              if (currentEventType === "cancel") {
                callbacks.onDone({ hadContent })
                return
              }

              currentEventType = ""
            } catch {
              // ignore parse errors
            }
          }
        }

        if (!aborted) callbacks.onDone({ hadContent })
        return
      }

      // Fallback: OpenAI-compatible /v1/chat/completions (no session)
      const res = await fetch("/api/hermes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: gatewayBaseUrl,
          path: "/v1/chat/completions",
          stream: true,
          body: {
            model: model || "hermes",
            messages,
            stream: true,
          },
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "")
        const parsed = tryParseErrorJson(text)
        if (parsed) {
          throw new ProviderError(parsed.message, parsed.code)
        }
        throw new Error(text || `Gateway error: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let currentEventType = ""

      while (!aborted) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim()
            continue
          }
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)

          if (data === "[DONE]") {
            callbacks.onDone({ hadContent })
            return
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.error) {
              const errMsg = parsed.error.message || parsed.error.type || "Unknown provider error"
              const errCode = parsed.error.code || parsed.error.type
              callbacks.onError(new ProviderError(errMsg, errCode))
              return
            }

            if (currentEventType === "hermes.tool.progress") {
              callbacks.onToolProgress(parsed as ToolProgress)
              currentEventType = ""
              continue
            }
            currentEventType = ""

            const finishReason = parsed.choices?.[0]?.finish_reason
            if (finishReason === "error") {
              const errMsg = parsed.error?.message || "Provider error during streaming"
              callbacks.onError(new ProviderError(errMsg, parsed.error?.code))
              return
            }

            const delta = parsed.choices?.[0]?.delta
            if (delta?.content) {
              hadContent = true
              callbacks.onDelta(delta.content)
            }

            if (finishReason === "stop") {
              callbacks.onDone({ hadContent })
              return
            }
          } catch {
            // ignore parse errors for non-JSON lines
          }
        }
      }

      if (!aborted) callbacks.onDone({ hadContent })
    } catch (err) {
      if (!aborted) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)))
      }
    }
  })()

  return () => {
    aborted = true
    controller.abort()
  }
}

function tryParseErrorJson(text: string): { message: string; code?: string | number } | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed.error?.message) {
      return { message: parsed.error.message, code: parsed.error.code || parsed.error.type }
    }
    if (parsed.error && typeof parsed.error === "string") {
      return { message: parsed.error }
    }
  } catch {
    // not JSON
  }
  return null
}
