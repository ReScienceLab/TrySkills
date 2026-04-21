"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  createSession,
  sendMessage,
  streamResponse,
  cancelStream,
  type SSEEvent,
} from "@/lib/sandbox/hermes-api";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args?: Record<string, string>;
  status: "running" | "done" | "error";
  duration?: number;
}

export interface ApprovalRequest {
  command: string;
  description?: string;
  sessionId: string;
}

export function useChat(
  webuiBaseUrl: string | null,
  model: string,
  skillName: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const initRef = useRef(false);
  const currentAssistantRef = useRef("");
  const currentReasoningRef = useRef("");
  const currentToolsRef = useRef<ToolCall[]>([]);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case "token": {
        const text = event.data.text as string;
        currentAssistantRef.current += text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: currentAssistantRef.current }];
          }
          return [...prev, { role: "assistant", content: currentAssistantRef.current }];
        });
        break;
      }
      case "reasoning": {
        currentReasoningRef.current += event.data.text as string;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, reasoning: currentReasoningRef.current }];
          }
          return prev;
        });
        break;
      }
      case "tool": {
        const tc: ToolCall = {
          name: event.data.name as string,
          args: event.data.args as Record<string, string> | undefined,
          status: "running",
        };
        currentToolsRef.current = [...currentToolsRef.current, tc];
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, toolCalls: [...currentToolsRef.current] }];
          }
          return [...prev, { role: "assistant", content: "", toolCalls: [tc] }];
        });
        break;
      }
      case "tool_complete": {
        const name = event.data.name as string;
        const duration = event.data.duration as number | undefined;
        const isError = event.data.is_error as boolean;
        currentToolsRef.current = currentToolsRef.current.map((tc) =>
          tc.name === name && tc.status === "running"
            ? { ...tc, status: isError ? "error" : "done", duration }
            : tc,
        );
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, toolCalls: [...currentToolsRef.current] }];
          }
          return prev;
        });
        break;
      }
      case "approval": {
        setApproval({
          command: event.data.command as string,
          description: event.data.description as string | undefined,
          sessionId: sessionIdRef.current ?? "",
        });
        break;
      }
      case "apperror": {
        setError(event.data.message as string);
        break;
      }
      case "error": {
        setError(event.data.message as string);
        break;
      }
      case "done":
      case "stream_end":
      case "cancel":
        break;
    }
  }, []); // sessionId accessed via ref

  const startStream = useCallback(
    async (sid: string, message: string) => {
      if (!webuiBaseUrl) return;

      currentAssistantRef.current = "";
      currentReasoningRef.current = "";
      currentToolsRef.current = [];
      setIsStreaming(true);
      setError(null);

      setMessages((prev) => [...prev, { role: "user", content: message }]);

      try {
        const streamId = await sendMessage(webuiBaseUrl, sid, message, model);
        streamIdRef.current = streamId;

        const unsub = streamResponse(
          webuiBaseUrl,
          streamId,
          handleSSEEvent,
          (err) => setError(err.message),
          () => setIsStreaming(false),
        );
        cancelRef.current = unsub;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send");
        setIsStreaming(false);
      }
    },
    [webuiBaseUrl, model, handleSSEEvent],
  );

  const send = useCallback(
    async (message: string) => {
      if (!sessionId || !message.trim()) return;
      await startStream(sessionId, message.trim());
    },
    [sessionId, startStream],
  );

  const cancel = useCallback(async () => {
    cancelRef.current?.();
    cancelRef.current = null;
    if (webuiBaseUrl && streamIdRef.current) {
      await cancelStream(webuiBaseUrl, streamIdRef.current);
    }
    setIsStreaming(false);
  }, [webuiBaseUrl]);

  // Auto-init: create session and send first message (with retry)
  useEffect(() => {
    if (!webuiBaseUrl || initRef.current) return;
    initRef.current = true;

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 4000, 8000];

    (async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            setError(`Retrying connection (${attempt}/${MAX_RETRIES})...`);
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          }
          const sid = await createSession(webuiBaseUrl, model);
          sessionIdRef.current = sid;
          setSessionId(sid);
          setError(null);
          // Send first message directly (not via startStream which swallows errors)
          const firstMessage = `I want to try the ${skillName} skill`;
          const streamId = await sendMessage(webuiBaseUrl, sid, firstMessage, model);
          // Message sent successfully -- now stream the response
          setMessages([{ role: "user", content: firstMessage }]);
          setIsStreaming(true);
          streamIdRef.current = streamId;
          const unsub = streamResponse(
            webuiBaseUrl,
            streamId,
            handleSSEEvent,
            (err) => setError(err.message),
            () => setIsStreaming(false),
          );
          cancelRef.current = unsub;
          return;
        } catch (err) {
          if (attempt === MAX_RETRIES) {
            initRef.current = false;
            setError(err instanceof Error ? err.message : "Failed to connect");
          }
        }
      }
    })();
  }, [webuiBaseUrl, model, skillName, startStream]);

  return { messages, isStreaming, error, sessionId, approval, send, cancel, setApproval };
}
