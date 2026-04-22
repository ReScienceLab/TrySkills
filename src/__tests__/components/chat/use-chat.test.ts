import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/sandbox/hermes-api", () => ({
  chatStream: vi.fn(),
}));

import { useChat } from "@/components/chat/use-chat";
import { chatStream } from "@/lib/sandbox/hermes-api";

const mockChatStream = vi.mocked(chatStream);

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStream.mockReturnValue(() => {});
  });

  it("auto-initializes with first message", async () => {
    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => {
      expect(mockChatStream).toHaveBeenCalledWith(
        "https://8642-abc.daytonaproxy01.net",
        [{ role: "user", content: "I want to try the test-skill skill" }],
        expect.any(Object),
        "claude-3",
      );
    });

    expect(result.current.isStreaming).toBe(true);
  });

  it("does not init when gatewayBaseUrl is null", () => {
    renderHook(() => useChat(null, "claude-3", "test-skill"));
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it("handles streaming delta", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onDelta("Hello ");
        callbacks.onDelta("world");
        callbacks.onDone();
      }, 10);
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages.some((m) => m.content.includes("Hello world"))).toBe(true);
  });

  it("handles error with retry and sessionFailed", async () => {
    vi.useFakeTimers();
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => callbacks.onError(new Error("Connection refused")), 5);
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(10000);
    }

    expect(result.current.error).toBe("Connection refused");
    expect(result.current.sessionFailed).toBe(true);
    vi.useRealTimers();
  });

  it("handles tool progress events", async () => {
    mockChatStream.mockImplementation((_url, _msgs, callbacks) => {
      setTimeout(() => {
        callbacks.onToolProgress({ tool: "skill_view", emoji: "📋", label: "skill_view" });
        callbacks.onDone();
      }, 10);
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8642-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => {
      expect(result.current.toolCalls.length).toBeGreaterThan(0);
    });

    expect(result.current.toolCalls[0].name).toBe("skill_view");
  });
});
