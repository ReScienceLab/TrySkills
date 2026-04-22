export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolProgress {
  tool: string;
  emoji: string;
  label: string;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onToolProgress: (tool: ToolProgress) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export function chatStream(
  gatewayBaseUrl: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  model?: string,
): () => void {
  let aborted = false;
  const controller = new AbortController();

  (async () => {
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
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Gateway error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            callbacks.onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (currentEventType === "hermes.tool.progress") {
              callbacks.onToolProgress(parsed as ToolProgress);
              currentEventType = "";
              continue;
            }
            currentEventType = "";

            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              callbacks.onDelta(delta.content);
            }

            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason === "stop") {
              callbacks.onDone();
              return;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (!aborted) callbacks.onDone();
    } catch (err) {
      if (!aborted) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
  };
}
