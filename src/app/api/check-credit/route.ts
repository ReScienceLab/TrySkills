import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const PROVIDER_BILLING_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/credits",
  anthropic: "https://console.anthropic.com/settings/billing",
  openai: "https://platform.openai.com/settings/organization/billing",
  google: "https://aistudio.google.com/apikey",
}

const PROVIDER_KEY_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { providerId, apiKey } = (await req.json()) as {
    providerId: string
    apiKey: string
  }

  if (!providerId || !apiKey) {
    return NextResponse.json({ ok: false, error: "Missing providerId or apiKey" }, { status: 400 })
  }

  const billingUrl = PROVIDER_BILLING_URLS[providerId]
  const keyUrl = PROVIDER_KEY_URLS[providerId]

  if (providerId === "openrouter") {
    return checkOpenRouter(apiKey, billingUrl, keyUrl)
  }

  return checkGenericProvider(providerId, apiKey, billingUrl, keyUrl)
}

async function checkOpenRouter(
  apiKey: string,
  billingUrl: string,
  keyUrl: string,
): Promise<NextResponse> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 401) {
      return NextResponse.json({
        ok: false,
        errorType: "auth_error",
        error: "Your OpenRouter API key is invalid or expired.",
        action: { label: "Get a new key", url: keyUrl },
      })
    }

    if (!res.ok) {
      return NextResponse.json({ ok: true })
    }

    const data = await res.json()
    const info = data?.data
    if (!info) return NextResponse.json({ ok: true })

    if (info.limit_remaining !== null && info.limit_remaining !== undefined && info.limit_remaining <= 0) {
      return NextResponse.json({
        ok: false,
        errorType: "credit_error",
        error: "Your OpenRouter credits are exhausted.",
        action: { label: "Add credits", url: billingUrl },
      })
    }

    if (info.is_free_tier && info.usage_daily >= 50) {
      return NextResponse.json({
        ok: false,
        errorType: "credit_error",
        error: "You have reached the free-tier daily limit (50 requests). Purchase credits to continue.",
        action: { label: "Add credits", url: billingUrl },
      })
    }

    if (info.limit_remaining !== null && info.limit_remaining < 0.5) {
      return NextResponse.json({
        ok: true,
        warning: `Low OpenRouter credits remaining ($${info.limit_remaining.toFixed(2)}).`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

async function checkGenericProvider(
  providerId: string,
  apiKey: string,
  billingUrl: string | undefined,
  keyUrl: string | undefined,
): Promise<NextResponse> {
  const endpoints: Record<string, { url: string; headers: Record<string, string> }> = {
    anthropic: {
      url: "https://api.anthropic.com/v1/models?limit=1",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    },
    openai: {
      url: "https://api.openai.com/v1/models?limit=1",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    google: {
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      headers: { "x-goog-api-key": apiKey },
    },
  }

  const config = endpoints[providerId]
  if (!config) return NextResponse.json({ ok: true })

  try {
    const res = await fetch(config.url, {
      headers: config.headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        errorType: "auth_error",
        error: `Your ${providerId} API key is invalid or expired.`,
        action: keyUrl ? { label: "Update key", url: keyUrl } : undefined,
      })
    }

    if (res.status === 402) {
      return NextResponse.json({
        ok: false,
        errorType: "credit_error",
        error: `Your ${providerId} account has insufficient credits.`,
        action: billingUrl ? { label: "Add credits", url: billingUrl } : undefined,
      })
    }

    if (res.status === 429) {
      const body = await res.text().catch(() => "")
      const isQuotaExhausted = /quota|billing|exceeded.*current|insufficient.*fund/i.test(body)
      if (isQuotaExhausted) {
        return NextResponse.json({
          ok: false,
          errorType: "credit_error",
          error: `Your ${providerId} account has exceeded its quota or billing limit.`,
          action: billingUrl ? { label: "Check billing", url: billingUrl } : undefined,
        })
      }
      return NextResponse.json({
        ok: false,
        errorType: "rate_limit",
        error: "Rate limit reached. Please wait a moment and try again.",
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
