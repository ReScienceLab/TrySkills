export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

async function proxyPost(path: string, webuiBaseUrl: string, body?: Record<string, unknown>) {
  const res = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: webuiBaseUrl, path, body }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    console.error(`[hermes-api] proxy ${path} failed:`, data);
    throw new Error(data.error || `Proxy request failed: ${res.status}`);
  }

  return res.json();
}

export async function createSession(
  webuiBaseUrl: string,
  model?: string,
): Promise<string> {
  console.log("[hermes-api] createSession via proxy, baseUrl:", webuiBaseUrl);
  const data = await proxyPost("/api/session/new", webuiBaseUrl, { model });
  return data.session.session_id;
}

export async function sendMessage(
  webuiBaseUrl: string,
  sessionId: string,
  message: string,
  model?: string,
): Promise<string> {
  const data = await proxyPost("/api/chat/start", webuiBaseUrl, {
    session_id: sessionId,
    message,
    model,
  });
  return data.stream_id;
}

export function streamResponse(
  webuiBaseUrl: string,
  streamId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
  onEnd: () => void,
): () => void {
  const streamUrl = new URL("/api/hermes/stream", window.location.origin);
  streamUrl.searchParams.set("baseUrl", webuiBaseUrl);
  streamUrl.searchParams.set("stream_id", streamId);
  const es = new EventSource(streamUrl.toString());

  const EVENTS = [
    "token", "reasoning", "tool", "tool_complete", "done",
    "error", "approval", "cancel", "apperror", "compressed", "title",
    "stream_end", "title_status",
  ];

  for (const eventType of EVENTS) {
    es.addEventListener(eventType, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent({ type: eventType, data });
        if (eventType === "done" || eventType === "stream_end" || eventType === "error" || eventType === "cancel") {
          es.close();
          onEnd();
        }
      } catch {
        // ignore parse errors
      }
    });
  }

  es.onerror = () => {
    es.close();
    onError(new Error("SSE connection lost"));
    onEnd();
  };

  return () => {
    es.close();
  };
}

export async function cancelStream(
  webuiBaseUrl: string,
  streamId: string,
): Promise<void> {
  const cancelUrl = new URL("/api/hermes", window.location.origin);
  cancelUrl.searchParams.set("baseUrl", webuiBaseUrl);
  cancelUrl.searchParams.set("path", "/api/chat/cancel");
  cancelUrl.searchParams.set("stream_id", streamId);
  await fetch(cancelUrl.toString()).catch(() => {});
}

export async function respondApproval(
  webuiBaseUrl: string,
  sessionId: string,
  choice: "once" | "session" | "always" | "deny",
): Promise<void> {
  await proxyPost("/api/approval/respond", webuiBaseUrl, {
    session_id: sessionId,
    choice,
  }).catch(() => {});
}
