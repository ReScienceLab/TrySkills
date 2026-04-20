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
    const res = await fetch(provider.checkEndpoint, {
      method: "GET",
      headers: provider.checkAuthHeader(apiKey),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true };

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Invalid API key" };
    }

    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, error: "Request timed out" };
    }
    return { ok: false, error: "Network error" };
  }
}
