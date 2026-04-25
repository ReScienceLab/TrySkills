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
    if (typeof window !== "undefined") window.sessionStorage.clear()
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

  it("shows and sends the automatic intro for an empty resumed session", async () => {
    const send = vi.fn()
    mocks.useChat.mockReturnValue({
      ...defaultChatState,
      sessionId: "session-123",
      send,
    })

    const { container } = render(
      <ChatPanel
        {...defaultProps}
        initialSessionId="session-123"
        initialMessages={[]}
      />,
    )

    expect(container.textContent).toContain(
      "Use skill_view to look up the /obra/superpowers/brainstorming skill",
    )
    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "Use skill_view to look up the /obra/superpowers/brainstorming skill, then briefly introduce it - what it does, when to use it, and a quick example.",
      )
    })
  })

  it("does not send the automatic intro for a resumed session with messages", async () => {
    const send = vi.fn()
    const initialMessages = [
      { role: "user" as const, content: "Existing user message" },
    ]
    mocks.useChat.mockReturnValue({
      ...defaultChatState,
      messages: initialMessages,
      sessionId: "session-123",
      send,
    })

    const { container } = render(
      <ChatPanel
        {...defaultProps}
        initialSessionId="session-123"
        initialMessages={initialMessages}
      />,
    )

    expect(container.textContent).toContain("Existing user message")
    expect(container.textContent).not.toContain(
      "Use skill_view to look up the /obra/superpowers/brainstorming skill",
    )
    await waitFor(() => {
      expect(send).not.toHaveBeenCalled()
    })
  })

  it("does not resend the automatic intro if ChatPanel remounts for the same session id", async () => {
    const send = vi.fn()
    mocks.useChat.mockReturnValue({
      ...defaultChatState,
      sessionId: "session-abc",
      send,
    })

    const first = render(<ChatPanel {...defaultProps} />)

    await waitFor(() => {
      expect(send).toHaveBeenCalledTimes(1)
    })

    first.unmount()

    mocks.useChat.mockReturnValue({
      ...defaultChatState,
      sessionId: "session-abc",
      send,
    })
    render(<ChatPanel {...defaultProps} />)

    // Give any pending effects a tick.
    await new Promise((r) => setTimeout(r, 20))
    expect(send).toHaveBeenCalledTimes(1)
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
