export type CreditCheckResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; errorType?: string; action?: { label: string; url: string } }

export async function checkProviderCredit(
  providerId: string,
  apiKey: string,
): Promise<CreditCheckResult> {
  try {
    const res = await fetch("/api/check-credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, apiKey }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: true }
    return (await res.json()) as CreditCheckResult
  } catch {
    return { ok: true }
  }
}
