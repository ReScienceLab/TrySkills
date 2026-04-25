import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useChat: vi.fn(),
}))

vi.mock("@/components/chat/use-chat", () => ({
  useChat: mocks.useChat,
}))

import { ChatPanel } from "@/components/chat/chat-panel"

const defaultChatState = {
  messages: [],
  toolCalls: [],
  segments: [],
  isStreaming: false,
  error: null,
  creditWarning: null,
  sessionFailed: false,
  isProviderError: false,
  sessionId: null,
  workspacePath: null,
  thinkingText: "",
  isThinking: false,
  send: vi.fn(),
  cancel: vi.fn(),
}

const defaultProps = {
  gatewayBaseUrl: "https://8642-abc.daytonaproxy01.net",
  model: "kimi-k2.6",
  skillName: "brainstorming",
  skillPath: "obra/superpowers/brainstorming",
  startedAt: Date.now(),
  onStop: vi.fn(),
}

describe("ChatPanel", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mocks.useChat.mockReturnValue({ ...defaultChatState })
  })

  it("shows the automatic intro prompt before the Convex session is ready", () => {
    const { container } = render(<ChatPanel {...defaultProps} />)

    expect(container.textContent).toContain(
      "Use skill_view to look up the /obra/superpowers/brainstorming skill",
    )
    expect(defaultChatState.send).not.toHaveBeenCalled()
  })

  it("sends the automatic intro once the Convex session is ready", async () => {
    const send = vi.fn()
    mocks.useChat.mockReturnValue({
      ...defaultChatState,
      sessionId: "session-123",
      send,
    })

    render(<ChatPanel {...defaultProps} />)

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "Use skill_view to look up the /obra/superpowers/brainstorming skill, then briefly introduce it - what it does, when to use it, and a quick example.",
      )
    })
  })

  it("focuses the message input when chat is ready", async () => {
    const { container } = render(<ChatPanel {...defaultProps} />)

    await waitFor(() => {
      const input = container.querySelector<HTMLTextAreaElement>("#chat-message-input")
      expect(input).not.toBeNull()
      expect(document.activeElement).toBe(input)
    })
  })
})
