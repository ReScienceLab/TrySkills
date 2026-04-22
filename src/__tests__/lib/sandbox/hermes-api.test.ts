import { describe, it, expect, vi, beforeEach } from "vitest"
import { chatStream, ProviderError } from "@/lib/sandbox/hermes-api"

function mockFetch(body: string, status = 200) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    text: () => Promise.resolve(body),
  })
}

describe("hermes-api chatStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses normal streaming delta and calls onDone with hadContent=true", async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      "",
    ].join("\n")

    global.fetch = mockFetch(sseBody)

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())

    expect(onDelta).toHaveBeenCalledWith("Hello")
    expect(onDelta).toHaveBeenCalledWith(" world")
    expect(onDone).toHaveBeenCalledWith({ hadContent: true })
    expect(onError).not.toHaveBeenCalled()
  })

  it("detects error payload in SSE stream and calls onError with ProviderError", async () => {
    const sseBody = [
      'data: {"error":{"code":402,"message":"Insufficient credits"}}',
      "",
    ].join("\n")

    global.fetch = mockFetch(sseBody)

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())

    const err = onError.mock.calls[0][0]
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.message).toBe("Insufficient credits")
    expect(err.code).toBe(402)
    expect(onDone).not.toHaveBeenCalled()
  })

  it("detects finish_reason=error (OpenRouter mid-stream format)", async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
      'data: {"error":{"code":"server_error","message":"Provider disconnected"},"choices":[{"delta":{"content":""},"finish_reason":"error"}]}',
      "",
    ].join("\n")

    global.fetch = mockFetch(sseBody)

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())

    const err = onError.mock.calls[0][0]
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.message).toBe("Provider disconnected")
  })

  it("calls onDone with hadContent=false when no content received", async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      "",
    ].join("\n")

    global.fetch = mockFetch(sseBody)

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())

    expect(onDelta).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledWith({ hadContent: false })
  })

  it("handles HTTP error with JSON error body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      body: null,
      text: () => Promise.resolve('{"error":{"message":"Billing error","type":"billing_error"}}'),
    })

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())

    const err = onError.mock.calls[0][0]
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.message).toBe("Billing error")
    expect(err.code).toBe("billing_error")
  })

  it("handles tool progress SSE events", async () => {
    const sseBody = [
      'event: hermes.tool.progress',
      'data: {"tool":"web_search","emoji":"🔍","label":"web_search"}',
      '',
      'data: {"choices":[{"delta":{"content":"Result"},"finish_reason":null}]}',
      'data: [DONE]',
      "",
    ].join("\n")

    global.fetch = mockFetch(sseBody)

    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onToolProgress = vi.fn()

    chatStream("https://example.com", [{ role: "user", content: "hi" }], {
      onDelta,
      onDone,
      onError,
      onToolProgress,
    })

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())

    expect(onToolProgress).toHaveBeenCalledWith({
      tool: "web_search",
      emoji: "\u{1F50D}",
      label: "web_search",
    })
    expect(onDelta).toHaveBeenCalledWith("Result")
  })
})
