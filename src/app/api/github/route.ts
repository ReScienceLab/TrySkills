import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("https://api.github.com/")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  // Try to get GitHub OAuth token for authenticated users
  const { userId } = await auth();
  if (userId) {
    try {
      const client = await clerkClient();
      const response = await client.users.getUserOauthAccessToken(userId, "oauth_github");
      const token = response.data[0]?.token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // No GitHub token available, proceed without auth
    }
  }

  const res = await fetch(url, { headers });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "X-RateLimit-Remaining": res.headers.get("X-RateLimit-Remaining") || "",
      "X-RateLimit-Reset": res.headers.get("X-RateLimit-Reset") || "",
    },
  });
}
