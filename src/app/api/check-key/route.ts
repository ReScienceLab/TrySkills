import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers/registry";

export async function POST(req: NextRequest) {
  const { providerId, apiKey } = (await req.json()) as {
    providerId: string;
    apiKey: string;
  };

  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }
  if (!apiKey || apiKey.length < 5) {
    return NextResponse.json({ ok: false, error: "API key is too short" }, { status: 400 });
  }

  try {
    const method = provider.checkMethod ?? "GET";
    const fetchInit: RequestInit = {
      method,
      headers: provider.checkAuthHeader(apiKey),
      signal: AbortSignal.timeout(10_000),
    };
    if (method === "POST" && provider.checkBody) {
      fetchInit.body = provider.checkBody(apiKey);
    }

    const endpoint = provider.resolveCheckEndpoint
      ? provider.resolveCheckEndpoint(apiKey)
      : provider.checkEndpoint;

    const res = await fetch(endpoint, fetchInit);

    if (res.ok) {
      return NextResponse.json({ ok: true });
    }
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, error: "Invalid API key" });
    }
    return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ ok: false, error: "Request timed out" });
    }
    return NextResponse.json({ ok: false, error: "Network error" });
  }
}
