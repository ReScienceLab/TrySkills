import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sandboxId = request.nextUrl.searchParams.get("id");
  const daytonaKey = request.nextUrl.searchParams.get("key");

  if (!sandboxId || !daytonaKey) {
    return NextResponse.json({ error: "Missing id or key" }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await fetch(`https://app.daytona.io/api/sandbox/${sandboxId}`, {
      headers: { Authorization: `Bearer ${daytonaKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Sandbox not found", status: res.status }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      id: data.id,
      state: data.state,
      cpu: data.cpu,
      memory: data.memory,
      disk: data.disk,
      gpu: data.gpu,
      target: data.target,
      snapshot: data.snapshot,
      autoStopInterval: data.autoStopInterval,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sandbox info" }, { status: 500 });
  }
}

/**
 * POST /api/sandbox — Heartbeat/keepalive.
 * Calls Daytona's refreshActivity to reset the auto-stop idle timer.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { sandboxId?: string; daytonaKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sandboxId, daytonaKey } = body;
  if (!sandboxId || !daytonaKey) {
    return NextResponse.json({ error: "Missing sandboxId or daytonaKey" }, { status: 400 });
  }

  try {
    const { Daytona } = await import("@daytona/sdk");
    const daytona = new Daytona({
      apiKey: daytonaKey,
      apiUrl: "https://app.daytona.io/api",
    });
    const sandbox = await daytona.get(sandboxId);
    await sandbox.refreshActivity();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to refresh sandbox activity" }, { status: 500 });
  }
}
