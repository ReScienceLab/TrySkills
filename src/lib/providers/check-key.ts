import type { Provider } from "./registry";

export type CheckResult = { ok: true } | { ok: false; error: string };

export async function checkProviderKey(
  provider: Provider,
  apiKey: string,
): Promise<CheckResult> {
  if (!apiKey || apiKey.length < 5) {
    return { ok: false, error: "API key is too short" };
  }

  try {
    const res = await fetch("/api/check-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: provider.id, apiKey }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await res.json()) as CheckResult;
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, error: "Request timed out" };
    }
    return { ok: false, error: "Network error" };
  }
}
