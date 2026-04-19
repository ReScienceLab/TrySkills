import { auth, clerkClient } from "@clerk/nextjs/server";
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
