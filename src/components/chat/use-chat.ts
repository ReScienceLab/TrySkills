"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { chatStream, type ChatMessage, type ToolProgress } from "@/lib/sandbox/hermes-api";

export interface ToolCall {
  name: string;
  emoji?: string;
  status: "running" | "done";
}

export function useChat(
  gatewayBaseUrl: string | null,
  model: string,
  skillName: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionFailed, setSessionFailed] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const initRef = useRef(false);
  const currentContentRef = useRef("");

  const stream = useCallback(
    (allMessages: ChatMessage[]) => {
      if (!gatewayBaseUrl) return;

      currentContentRef.current = "";
      setIsStreaming(true);
      setError(null);
      setToolCalls([]);

      const cancel = chatStream(
        gatewayBaseUrl,
        allMessages,
        {
          onDelta: (text) => {
            currentContentRef.current += text;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: currentContentRef.current }];
              }
              return [...prev, { role: "assistant", content: currentContentRef.current }];
            });
          },
          onToolProgress: (tool: ToolProgress) => {
            setToolCalls((prev) => {
              const existing = prev.find((t) => t.name === tool.tool && t.status === "running");
              if (existing) return prev;
              return [...prev, { name: tool.tool, emoji: tool.emoji, status: "running" }];
            });
          },
          onDone: () => {
            setIsStreaming(false);
            setToolCalls((prev) => prev.map((t) => ({ ...t, status: "done" as const })));
          },
          onError: (err) => {
            setIsStreaming(false);
            setError(err.message);
          },
        },
        model,
      );
      cancelRef.current = cancel;
    },
    [gatewayBaseUrl, model],
  );

  const send = useCallback(
    (message: string) => {
      if (!message.trim() || isStreaming) return;
      const userMsg: ChatMessage = { role: "user", content: message.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      stream(newMessages);
    },
    [messages, isStreaming, stream],
  );

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setIsStreaming(false);
    // Remove partial assistant message to avoid replaying truncated content
    setMessages((prev) =>
      prev.length > 0 && prev[prev.length - 1]?.role === "assistant"
        ? prev.slice(0, -1)
        : prev,
    );
  }, []);

  // Auto-init: send first message with retry
  useEffect(() => {
    if (!gatewayBaseUrl || initRef.current) return;
    initRef.current = true;

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 4000, 8000];

    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tryInit = () => {
      const firstMsg: ChatMessage = { role: "user", content: `I want to try the ${skillName} skill` };
      setMessages([firstMsg]);

      const cancel = chatStream(
        gatewayBaseUrl,
        [firstMsg],
        {
          onDelta: (text) => {
            currentContentRef.current += text;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: currentContentRef.current }];
              }
              return [...prev, { role: "assistant", content: currentContentRef.current }];
            });
          },
          onToolProgress: (tool: ToolProgress) => {
            setToolCalls((prev) => [...prev, { name: tool.tool, emoji: tool.emoji, status: "running" }]);
          },
          onDone: () => {
            setIsStreaming(false);
            setToolCalls((prev) => prev.map((t) => ({ ...t, status: "done" as const })));
          },
          onError: (err) => {
            attempt++;
            if (attempt <= MAX_RETRIES) {
              setError(`Retrying (${attempt}/${MAX_RETRIES})...`);
              timer = setTimeout(tryInit, RETRY_DELAYS[attempt - 1]);
            } else {
              setIsStreaming(false);
              setSessionFailed(true);
              setError(err.message);
              initRef.current = false;
            }
          },
        },
        model,
      );
      cancelRef.current = cancel;
      setIsStreaming(true);
      currentContentRef.current = "";
    };

    tryInit();

    return () => {
      clearTimeout(timer);
    };
  }, [gatewayBaseUrl, model, skillName]); // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, toolCalls, isStreaming, error, sessionFailed, send, cancel };
}
