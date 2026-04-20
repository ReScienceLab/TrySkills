export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function buildUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  url.pathname = path;
  return url.toString();
}

export async function createSession(
  webuiBaseUrl: string,
  model?: string,
): Promise<string> {
  const res = await fetch(buildUrl(webuiBaseUrl, "/api/session/new"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  const data = await res.json();
  return data.session.session_id;
}

export async function sendMessage(
  webuiBaseUrl: string,
  sessionId: string,
  message: string,
  model?: string,
): Promise<string> {
  const res = await fetch(buildUrl(webuiBaseUrl, "/api/chat/start"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to send message: ${res.status}`);
  }
  const data = await res.json();
  return data.stream_id;
}

export function streamResponse(
  webuiBaseUrl: string,
  streamId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
  onEnd: () => void,
): () => void {
  const streamUrl = new URL(webuiBaseUrl);
  streamUrl.pathname = "/api/chat/stream";
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
  const cancelUrl = new URL(webuiBaseUrl);
  cancelUrl.pathname = "/api/chat/cancel";
  cancelUrl.searchParams.set("stream_id", streamId);
  await fetch(cancelUrl.toString()).catch(() => {});
}

export async function respondApproval(
  webuiBaseUrl: string,
  sessionId: string,
  choice: "once" | "session" | "always" | "deny",
): Promise<void> {
  await fetch(buildUrl(webuiBaseUrl, "/api/approval/respond"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, choice }),
  }).catch(() => {});
}
