import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

vi.mock("@/lib/sandbox/hermes-api", () => ({
  chatStream: vi.fn(),
  ProviderError: class ProviderError extends Error {
    code: string | number | undefined
    constructor(message: string, code?: string | number) {
      super(message)
      this.name = "ProviderError"
      this.code = code
    }
  },
}))

vi.mock("@/lib/providers/check-credit", () => ({
  checkProviderCredit: vi.fn().mockResolvedValue({ ok: true }),
}))

const mockCreateSession = vi.fn().mockResolvedValue("test-session-id")

vi.mock("convex/react", () => ({
  useMutation: () => mockCreateSession,
}))

import { useChat } from "@/components/chat/use-chat"
import { chatStream, ProviderError } from "@/lib/sandbox/hermes-api"

const mockChatStream = vi.mocked(chatStream)

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChatStream.mockReturnValue(() => {})
  })

  it("creates session on init but does not auto-send", async () => {
    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    expect(mockChatStream).not.toHaveBeenCalled()
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.messages).toHaveLength(0)
  })

  it("does not clear local messages when a new session hydrates with empty messages", async () => {
    type Props = {
      initialSessionId?: string
      initialMessages?: { role: "user" | "assistant" | "system"; content: string }[]
    }

    const { result, rerender } = renderHook(
      (props: Props) =>
        useChat(
          "https://8642-abc.daytonaproxy01.net",
          "claude-3",
          "test-skill",
          undefined,
          undefined,
          props.initialSessionId,
          "org/repo/test-skill",
          props.initialMessages,
        ),
      { initialProps: {} },
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    act(() => {
      result.current.send("Use skill_view to introduce this skill.")
    })

    expect(result.current.messages).toEqual([
      { role: "user", content: "Use skill_view to introduce this skill." },
    ])

    rerender({ initialSessionId: "test-session-id", initialMessages: [] })

    await vi.waitFor(() => {
      expect(result.current.sessionId).toBe("test-session-id")
    })

    expect(result.current.messages).toEqual([
      { role: "user", content: "Use skill_view to introduce this skill." },
    ])
  })

  it("does not init when gatewayBaseUrl is null", () => {
    renderHook(() => useChat(null, "claude-3", "test-skill"))
    expect(mockChatStream).not.toHaveBeenCalled()
  })

  it("handles streaming delta with hadContent=true", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onDelta("Hello ")
        callbacks.onDelta("world")
      }, 10)
      setTimeout(() => {
        callbacks.onDone({ hadContent: true })
      }, 50)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("I want to try the /test-skill skill")

    await vi.waitFor(() => {
      expect(mockChatStream).toHaveBeenCalled()
    })

    await vi.waitFor(() => {
      expect(result.current.messages.some((m) => m.content.includes("Hello world"))).toBe(true)
    })

    expect(result.current.error).toBeNull()
  })

  it("detects empty response (hadContent=false) and diagnoses", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onDone({ hadContent: false })
      }, 10)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test message")

    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.type).toBe("empty_response")
  })

  it("classifies credit errors", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onError(new ProviderError("Your account has insufficient credits.", 402))
      }, 5)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", "openrouter", undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.type).toBe("credit_error")
  })

  it("classifies auth errors", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onError(new ProviderError("Invalid API key", 401))
      }, 5)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", "anthropic", undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.type).toBe("auth_error")
    expect(result.current.error?.action?.url).toContain("anthropic.com")
  })

  it("handles network errors", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => callbacks.onError(new Error("Connection refused")), 5)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.type).toBe("network")
    expect(result.current.error?.message).toBe("Connection refused")
  })

  it("handles tool progress events", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onToolProgress({ tool: "skill_view", emoji: "\u{1F4CB}", label: "skill_view" })
        callbacks.onDelta("result")
        callbacks.onDone({ hadContent: true })
      }, 10)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.toolCalls.length).toBeGreaterThan(0)
    })

    expect(result.current.toolCalls[0].name).toBe("skill_view")
  })

  it("handles reasoning events and exposes thinkingText", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onReasoning?.("Let me think...")
        callbacks.onReasoning?.(" about this.")
        callbacks.onDelta("The answer is 42.")
        callbacks.onDone({ hadContent: true })
      }, 10)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.thinkingText).toBe("Let me think... about this.")
    })

    await vi.waitFor(() => {
      expect(result.current.isThinking).toBe(false)
    })
  })

  it("handles tool start and tool complete events with args/duration", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onToolStart?.({
          name: "web_search",
          preview: "Searching...",
          args: { query: "test" },
        })
      }, 5)
      setTimeout(() => {
        callbacks.onToolComplete?.({
          name: "web_search",
          preview: "Found results",
          duration: 1.5,
          is_error: false,
        })
        callbacks.onDelta("Here are the results.")
        callbacks.onDone({ hadContent: true })
      }, 20)
      return () => {}
    })

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill", undefined, undefined, undefined, "org/repo/test-skill"),
    )

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })

    result.current.send("test")

    await vi.waitFor(() => {
      expect(result.current.toolCalls.length).toBe(1)
      expect(result.current.toolCalls[0].status).toBe("done")
    })

    expect(result.current.toolCalls[0].name).toBe("web_search")
    expect(result.current.toolCalls[0].duration).toBe(1.5)
    expect(result.current.toolCalls[0].isError).toBe(false)
    expect(result.current.toolCalls[0].args).toEqual({ query: "test" })
  })
})
