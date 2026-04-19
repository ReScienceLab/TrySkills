export class GitHubRateLimitError extends Error {
  public resetAt: number;

  constructor(resetAt: number) {
    const resetDate = new Date(resetAt * 1000);
    const minutes = Math.ceil((resetDate.getTime() - Date.now()) / 60_000);
    super(
      `GitHub API rate limit exceeded. Resets in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
    );
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

export async function githubFetch(url: string): Promise<Response> {
  const proxyUrl = `/api/github?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || res.status === 429) {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? parseInt(resetHeader, 10) : Math.floor(Date.now() / 1000) + 3600;
      throw new GitHubRateLimitError(resetAt);
    }
  }

  return res;
}
