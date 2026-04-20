import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

const DAYTONA_SKIP_HEADER = "X-Daytona-Skip-Preview-Warning";
const ALLOWED_HOST_PATTERN = /^\d+-[a-z0-9]+\.daytonaproxy\d*\.net$/;

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOST_PATTERN.test(hostname);
  } catch {
    return false;
  }
}

/**
 * GET /api/hermes/stream?baseUrl=...&stream_id=...
 * Server-side SSE proxy to bypass Daytona's browser preview warning page.
 * Forwards the EventSource connection through our server.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Not authenticated", { status: 401 });
  }

  const baseUrl = request.nextUrl.searchParams.get("baseUrl");
  const streamId = request.nextUrl.searchParams.get("stream_id");

  if (!baseUrl || !streamId) {
    return new Response("Missing baseUrl or stream_id", { status: 400 });
  }

  if (!isAllowedHost(baseUrl)) {
    return new Response("Forbidden: invalid proxy target", { status: 403 });
  }

  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.pathname = "/api/chat/stream";
  upstreamUrl.searchParams.set("stream_id", streamId);

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: { [DAYTONA_SKIP_HEADER]: "true" },
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const text = await upstreamRes.text().catch(() => "");
      return new Response(`Upstream error: ${upstreamRes.status} ${text.slice(0, 200)}`, {
        status: 502,
      });
    }

    return new Response(upstreamRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      `Proxy stream failed: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 502 },
    );
  }
}
