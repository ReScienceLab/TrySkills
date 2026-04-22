import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

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
const mockAppendMessages = vi.fn().mockResolvedValue(null)

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
})
