import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const DAYTONA_SKIP_HEADER = "X-Daytona-Skip-Preview-Warning";

/**
 * GET /api/hermes?baseUrl=...&path=...&stream_id=...
 * Proxy GET requests (e.g. cancel stream) to Hermes WebUI API.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.searchParams.get("baseUrl");
  const path = request.nextUrl.searchParams.get("path");

  if (!baseUrl || !path) {
    return NextResponse.json({ error: "Missing baseUrl or path" }, { status: 400 });
  }

  try {
    const url = new URL(baseUrl);
    url.pathname = path;
    // Forward remaining query params (e.g. stream_id)
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== "baseUrl" && key !== "path") {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { [DAYTONA_SKIP_HEADER]: "true" },
    });

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy GET failed" },
      { status: 502 },
    );
  }
}

/**
 * POST /api/hermes — Proxy JSON requests to Hermes WebUI API.
 * Runs server-side to bypass Daytona's browser preview warning page.
 *
 * Body: { baseUrl: string, path: string, body?: object }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: { baseUrl?: string; path?: string; body?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { baseUrl, path, body } = payload;
  if (!baseUrl || !path) {
    return NextResponse.json({ error: "Missing baseUrl or path" }, { status: 400 });
  }

  try {
    const url = new URL(baseUrl);
    url.pathname = path;

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [DAYTONA_SKIP_HEADER]: "true",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream returned non-JSON", status: res.status, body: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy request failed" },
      { status: 502 },
    );
  }
}
