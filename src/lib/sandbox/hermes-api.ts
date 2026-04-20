export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function buildUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  url.pathname = path;
  return url.toString();
}

const DAYTONA_HEADERS = {
  "X-Daytona-Skip-Preview-Warning": "true",
};

export async function createSession(
  webuiBaseUrl: string,
  model?: string,
): Promise<string> {
  const url = buildUrl(webuiBaseUrl, "/api/session/new");
  console.log("[hermes-api] createSession URL:", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...DAYTONA_HEADERS },
    body: JSON.stringify({ model }),
  });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.includes("json")) {
    const text = await res.text().catch(() => "");
    console.error(`[hermes-api] createSession failed: status=${res.status} ct=${ct} url=${url}`, text.slice(0, 300));
    throw new Error(`Failed to create session: ${res.status} (${ct.includes("html") ? "got HTML instead of JSON - CSRF or auth issue" : text.slice(0, 100)})`);
  }
  const data = await res.json();
  return data.session.session_id;
}

export async function sendMessage(
  webuiBaseUrl: string,
  sessionId: string,
  message: string,
  model?: string,
): Promise<string> {
  const url = buildUrl(webuiBaseUrl, "/api/chat/start");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...DAYTONA_HEADERS },
    body: JSON.stringify({ session_id: sessionId, message, model }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[hermes-api] sendMessage failed: ${res.status} ${url}`, text.slice(0, 200));
    throw new Error(text.includes('"error"') ? JSON.parse(text).error : `Failed to send: ${res.status}`);
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
  await fetch(cancelUrl.toString(), { headers: DAYTONA_HEADERS }).catch(() => {});
}

export async function respondApproval(
  webuiBaseUrl: string,
  sessionId: string,
  choice: "once" | "session" | "always" | "deny",
): Promise<void> {
  await fetch(buildUrl(webuiBaseUrl, "/api/approval/respond"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...DAYTONA_HEADERS },
    body: JSON.stringify({ session_id: sessionId, choice }),
  }).catch(() => {});
}
