import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/sandbox/hermes-api", () => ({
  createSession: vi.fn(),
  sendMessage: vi.fn(),
  streamResponse: vi.fn(),
  cancelStream: vi.fn(),
}));

import { useChat } from "@/components/chat/use-chat";
import { createSession, sendMessage, streamResponse } from "@/lib/sandbox/hermes-api";
import type { SSEEvent } from "@/lib/sandbox/hermes-api";

const mockCreateSession = vi.mocked(createSession);
const mockSendMessage = vi.mocked(sendMessage);
const mockStreamResponse = vi.mocked(streamResponse);

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue("session-123");
    mockSendMessage.mockResolvedValue("stream-abc");
    mockStreamResponse.mockReturnValue(() => {});
  });

  it("auto-initializes session and sends first message", async () => {
    const { result } = renderHook(() =>
      useChat("https://8787-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        "https://8787-abc.daytonaproxy01.net",
        "claude-3",
      );
    });

    await vi.waitFor(() => {
      expect(result.current.sessionId).toBe("session-123");
    });
  });

  it("does not init when webuiBaseUrl is null", () => {
    renderHook(() => useChat(null, "claude-3", "test-skill"));
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("handles SSE token events", async () => {
    let onEvent: ((event: SSEEvent) => void) | null = null;
    let onEnd: (() => void) | null = null;

    mockStreamResponse.mockImplementation((_url, _sid, _onEvent, _onError, _onEnd) => {
      onEvent = _onEvent;
      onEnd = _onEnd;
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8787-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => expect(onEvent).not.toBeNull());

    act(() => {
      onEvent!({ type: "token", data: { text: "Hello " } });
      onEvent!({ type: "token", data: { text: "world" } });
    });

    expect(result.current.messages.some((m) => m.content.includes("Hello world"))).toBe(true);

    act(() => {
      onEvent!({ type: "done", data: {} });
      onEnd!();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it("handles SSE approval events with correct sessionId via ref", async () => {
    let onEvent: ((event: SSEEvent) => void) | null = null;

    mockStreamResponse.mockImplementation((_url, _sid, _onEvent, _onError, _onEnd) => {
      onEvent = _onEvent;
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8787-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => expect(onEvent).not.toBeNull());

    act(() => {
      onEvent!({ type: "approval", data: { command: "rm -rf /", description: "dangerous" } });
    });

    expect(result.current.approval).not.toBeNull();
    expect(result.current.approval?.sessionId).toBe("session-123");
    expect(result.current.approval?.command).toBe("rm -rf /");
  });

  it("handles SSE error events", async () => {
    let onEvent: ((event: SSEEvent) => void) | null = null;

    mockStreamResponse.mockImplementation((_url, _sid, _onEvent, _onError, _onEnd) => {
      onEvent = _onEvent;
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat("https://8787-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => expect(onEvent).not.toBeNull());

    act(() => {
      onEvent!({ type: "error", data: { message: "Something went wrong" } });
    });

    expect(result.current.error).toBe("Something went wrong");
  });

  it("handles createSession failure", async () => {
    mockCreateSession.mockRejectedValue(new Error("Connection refused"));

    const { result } = renderHook(() =>
      useChat("https://8787-abc.daytonaproxy01.net", "claude-3", "test-skill"),
    );

    await vi.waitFor(() => {
      expect(result.current.error).toBe("Connection refused");
    });
  });
});
