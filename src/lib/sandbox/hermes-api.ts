export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ToolProgress {
  tool: string
  emoji: string
  label: string
}

export interface ToolStartEvent {
  name: string
  preview?: string
  args?: Record<string, string>
}

export interface ToolCompleteEvent {
  name: string
  preview?: string
  args?: Record<string, string>
  duration?: number
  is_error?: boolean
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
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
  onReasoning?: (text: string) => void
  onToolProgress: (tool: ToolProgress) => void
  onToolStart?: (tool: ToolStartEvent) => void
  onToolComplete?: (tool: ToolCompleteEvent) => void
  onDone: (meta: StreamDoneMeta) => void
  onError: (err: Error) => void
}

export const STREAM_IDLE_DONE_TIMEOUT_MS = 12_000

export interface ChatStreamOptions {
  idleDoneTimeoutMs?: number
}

export function chatStream(
  gatewayBaseUrl: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  model?: string,
  options?: ChatStreamOptions,
): () => void {
  let aborted = false
  const controller = new AbortController()
  const idleDoneTimeoutMs = options?.idleDoneTimeoutMs ?? STREAM_IDLE_DONE_TIMEOUT_MS
  let idleDoneTimer: ReturnType<typeof setTimeout> | null = null
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  const clearIdleDoneTimer = () => {
    if (idleDoneTimer) {
      clearTimeout(idleDoneTimer)
      idleDoneTimer = null
    }
  }

  const abortRead = () => {
    aborted = true
    controller.abort()
    void reader?.cancel().catch(() => {})
  }

  void (async () => {
    let hadContent = false
    let settled = false
    let rawContent = ""
    let inThinkBlock = false
    let thinkBuffer = ""
    let thinkDecided = false

    const finalize = (meta: StreamDoneMeta, shouldAbortRead = false) => {
      if (settled) return
      settled = true
      clearIdleDoneTimer()
      if (shouldAbortRead) abortRead()
      callbacks.onDone(meta)
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      clearIdleDoneTimer()
      callbacks.onError(err)
    }

    try {
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

      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let currentEventType = ""

      while (!aborted) {
        let readResult: ReadableStreamReadResult<Uint8Array>
        if (hadContent) {
          const timeout = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined as unknown as Uint8Array }), idleDoneTimeoutMs),
          )
          readResult = await Promise.race([reader.read(), timeout])
        } else {
          readResult = await reader.read()
        }
        const { done, value } = readResult
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
            finalize({ hadContent })
            return
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.error) {
              const errMsg = parsed.error.message || parsed.error.type || "Unknown provider error"
              const errCode = parsed.error.code || parsed.error.type
              fail(new ProviderError(errMsg, errCode))
              return
            }

            if (currentEventType === "done" || currentEventType === "stream_end" || currentEventType === "cancel") {
              currentEventType = ""
              finalize({ hadContent })
              return
            }

            if (currentEventType === "apperror") {
              const errMsg = parsed.message || parsed.error || "Provider error during streaming"
              const errCode = parsed.code || parsed.type
              fail(new ProviderError(errMsg, errCode))
              return
            }

            if (currentEventType === "hermes.tool.progress") {
              callbacks.onToolProgress(parsed as ToolProgress)
              currentEventType = ""

              continue
            }

            if (currentEventType === "reasoning") {
              callbacks.onReasoning?.(parsed.text ?? "")
              currentEventType = ""

              continue
            }

            if (currentEventType === "tool") {
              callbacks.onToolStart?.({
                name: parsed.name,
                preview: parsed.preview,
                args: parsed.args,
              })
              currentEventType = ""

              continue
            }

            if (currentEventType === "tool_complete") {
              callbacks.onToolComplete?.({
                name: parsed.name,
                preview: parsed.preview,
                args: parsed.args,
                duration: parsed.duration,
                is_error: parsed.is_error,
              })
              currentEventType = ""

              continue
            }

            currentEventType = ""

            const finishReason = parsed.choices?.[0]?.finish_reason
            if (finishReason === "error") {
              const errMsg = parsed.error?.message || "Provider error during streaming"
              fail(new ProviderError(errMsg, parsed.error?.code))
              return
            }

            const delta = parsed.choices?.[0]?.delta
            if (delta?.content) {
              rawContent += delta.content

              // <think> tag fallback: only attempt detection once at stream start
              if (!thinkDecided && !inThinkBlock) {
                const trimmed = rawContent.trimStart()
                const TAG = "<think>"
                if (trimmed.length < TAG.length && TAG.startsWith(trimmed)) {
                  // Still ambiguous -- could become <think>, keep buffering
                  continue
                }
                if (trimmed.startsWith(TAG)) {
                  thinkDecided = true
                  inThinkBlock = true
                  thinkBuffer = trimmed.slice(TAG.length)
                  const closeIdx = thinkBuffer.indexOf("</think>")
                  if (closeIdx !== -1) {
                    callbacks.onReasoning?.(thinkBuffer.slice(0, closeIdx))
                    inThinkBlock = false
                    const remaining = thinkBuffer.slice(closeIdx + 8).replace(/^\s+/, "")
                    thinkBuffer = ""
                    if (remaining) {
                      hadContent = true
                      callbacks.onDelta(remaining)
        
                    }
                  } else {
                    callbacks.onReasoning?.(thinkBuffer)
                  }
                  continue
                }
                // Not a think tag -- flush all buffered rawContent as visible
                thinkDecided = true
                hadContent = true
                callbacks.onDelta(rawContent)
  
                continue
              }

              if (inThinkBlock) {
                const prevLen = thinkBuffer.length
                thinkBuffer += delta.content
                const closeIdx = thinkBuffer.indexOf("</think>")
                if (closeIdx !== -1) {
                  // Only emit the new reasoning text from this delta (before </think>)
                  const newReasoningEnd = Math.max(prevLen, closeIdx)
                  const unsent = thinkBuffer.slice(prevLen, newReasoningEnd)
                  if (unsent) callbacks.onReasoning?.(unsent)
                  inThinkBlock = false
                  const remaining = thinkBuffer.slice(closeIdx + 8).replace(/^\s+/, "")
                  thinkBuffer = ""
                  if (remaining) {
                    hadContent = true
                    callbacks.onDelta(remaining)
      
                  }
                } else {
                  callbacks.onReasoning?.(delta.content)
                }
                continue
              }

              hadContent = true
              callbacks.onDelta(delta.content)

            }

            if (finishReason === "stop") {
              finalize({ hadContent })
              return
            }
          } catch {
            // ignore parse errors for non-JSON lines
          }
        }
      }

      if (!aborted) finalize({ hadContent })
    } catch (err) {
      if (!aborted && !settled) {
        fail(err instanceof Error ? err : new Error(String(err)))
      }
    }
  })()

  return () => {
    clearIdleDoneTimer()
    abortRead()
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
