import { githubFetch } from "@/lib/github-fetch";

export interface SkillMeta {
  name: string;
  description: string;
  author?: string;
  icon?: string;
  version?: string;
  installs?: string;
}

export interface ResolvedSkill {
  owner: string;
  repo: string;
  skillName: string;
  rawBaseUrl: string;
}

export interface SkillFile {
  path: string;
  content: string;
}

export function resolveSkillPath(pathSegments: string[]): ResolvedSkill {
  const owner = pathSegments[0] || "";
  const repo = pathSegments[1] || "";
  const skillName = pathSegments.slice(2).join("/") || "";
  const rawBaseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${skillName}`;
  return { owner, repo, skillName, rawBaseUrl };
}

function buildCandidatePaths(owner: string, repo: string, skillName: string, branch: string): string[] {
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;

  const candidates = [
    `${base}/${skillName}/SKILL.md`,
    `${base}/skills/${skillName}/SKILL.md`,
    `${base}/${repo}/${skillName}/SKILL.md`,
    `${base}/.agents/skills/${skillName}/SKILL.md`,
    `${base}/.claude/skills/${skillName}/SKILL.md`,
    `${base}/plugin/skills/${skillName}/SKILL.md`,
    `${base}/plugins/${owner}/skills/${skillName}/SKILL.md`,
  ];

  // Handle name normalization: "vercel-react-best-practices" -> "react-best-practices"
  // Try stripping common prefixes that match the owner or repo name
  const prefixes = [owner, repo, `${owner}-`, `${repo}-`];
  for (const prefix of prefixes) {
    if (skillName.startsWith(prefix) && skillName.length > prefix.length) {
      const stripped = skillName.startsWith(`${prefix}-`)
        ? skillName.slice(prefix.length + 1)
        : skillName.slice(prefix.length);
      if (stripped) {
        candidates.push(`${base}/skills/${stripped}/SKILL.md`);
        candidates.push(`${base}/${stripped}/SKILL.md`);
        candidates.push(`${base}/.agents/skills/${stripped}/SKILL.md`);
        candidates.push(`${base}/.claude/skills/${stripped}/SKILL.md`);
        candidates.push(`${base}/plugin/skills/${stripped}/SKILL.md`);
      }
    }
  }

  // Handle repo-name-as-directory pattern: "better-auth/skills" + "better-auth-best-practices"
  // -> "better-auth/best-practices/SKILL.md"
  const repoPrefix = `${repo}-`;
  if (skillName.startsWith(repoPrefix)) {
    const afterRepo = skillName.slice(repoPrefix.length);
    candidates.push(`${base}/${repo}/${afterRepo}/SKILL.md`);
  }

  // Handle "sleek-design-mobile-apps" -> "design-mobile-apps" (strip first word)
  const dashIdx = skillName.indexOf("-");
  if (dashIdx > 0) {
    const withoutFirst = skillName.slice(dashIdx + 1);
    candidates.push(`${base}/skills/${withoutFirst}/SKILL.md`);
  }

  return candidates;
}

const contentCache = new Map<string, string | null>();

export async function fetchSkillContent(resolved: ResolvedSkill): Promise<string | null> {
  const cacheKey = `${resolved.owner}/${resolved.repo}/${resolved.skillName}`;
  if (contentCache.has(cacheKey)) return contentCache.get(cacheKey)!;

  const { owner, repo, skillName } = resolved;

  // Try main branch first, then master
  for (const branch of ["main", "master"]) {
    const candidates = buildCandidatePaths(owner, repo, skillName, branch);
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          contentCache.set(cacheKey, text);
          return text;
        }
      } catch {
        continue;
      }
    }
  }

  // Last resort: use GitHub tree API to search for SKILL.md matching the skill name
  const found = await searchSkillInRepo(owner, repo, skillName);
  contentCache.set(cacheKey, found);
  return found;
}

async function searchSkillInRepo(
  owner: string,
  repo: string,
  skillName: string,
): Promise<string | null> {
  for (const branch of ["main", "master"]) {
    try {
      const treeRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      );
      if (!treeRes.ok) continue;

      const tree = await treeRes.json();
      const items = tree.tree || [];

      // Exact match: path ends with {skillName}/SKILL.md
      let match = items.find(
        (item: { path: string }) =>
          item.path.endsWith(`${skillName}/SKILL.md`) ||
          item.path.endsWith(`${skillName}/skill.md`),
      );

      // Partial match: try last segment of skill name (e.g. "remotion-best-practices" -> "remotion")
      if (!match) {
        const segments = skillName.split("-");
        // Try progressively shorter prefixes
        for (let len = segments.length - 1; len >= 1 && !match; len--) {
          const partial = segments.slice(0, len).join("-");
          match = items.find(
            (item: { path: string }) =>
              item.path.endsWith(`/${partial}/SKILL.md`),
          );
        }
      }

      if (match) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${match.path}`;
        const res = await fetch(rawUrl);
        if (res.ok) return res.text();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "GitHubRateLimitError") throw err;
      continue;
    }
  }
  return null;
}

function buildDirectoryCandidateUrls(owner: string, repo: string, skillName: string, branch: string): string[] {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const candidates = [
    `${apiBase}/${skillName}?ref=${branch}`,
    `${apiBase}/skills/${skillName}?ref=${branch}`,
    `${apiBase}/${repo}/${skillName}?ref=${branch}`,
    `${apiBase}/.agents/skills/${skillName}?ref=${branch}`,
    `${apiBase}/.claude/skills/${skillName}?ref=${branch}`,
    `${apiBase}/plugin/skills/${skillName}?ref=${branch}`,
    `${apiBase}/plugins/${owner}/skills/${skillName}?ref=${branch}`,
  ];
  return candidates;
}

export async function fetchSkillDirectory(
  resolved: ResolvedSkill,
): Promise<SkillFile[]> {
  const { owner, repo, skillName } = resolved;

  for (const branch of ["main", "master"]) {
    for (const apiUrl of buildDirectoryCandidateUrls(owner, repo, skillName, branch)) {
      try {
        const files: SkillFile[] = [];
        const res = await githubFetch(apiUrl);
        if (!res.ok) continue;

        const data = await res.json();

        if (!Array.isArray(data)) {
          const content = data.encoding === "base64"
            ? atob(data.content)
            : data.content;
          files.push({ path: data.name, content });
          return files;
        }

        // Parallel: fetch all files and recurse into all dirs concurrently
        const tasks: Promise<void>[] = [];
        for (const item of data) {
          if (item.type === "file") {
            tasks.push(
              fetch(item.download_url).then(async (fileRes) => {
                if (fileRes.ok) {
                  files.push({ path: item.name, content: await fileRes.text() });
                }
              }).catch(() => {}),
            );
          } else if (item.type === "dir") {
            tasks.push(fetchDirectoryRecursive(item.url, item.name, files));
          }
        }
        await Promise.all(tasks);

        if (files.length > 0) return files;
      } catch (err) {
        if (err instanceof Error && err.name === "GitHubRateLimitError") throw err;
        continue;
      }
    }
  }

  // Fallback: search via tree API and fetch the directory
  for (const branch of ["main", "master"]) {
    try {
      const treeRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      );
      if (!treeRes.ok) continue;

      const tree = await treeRes.json();
      const items = (tree.tree || []) as { path: string; type: string }[];

      const skillDir = items.find(
        (item) =>
          item.type === "tree" && item.path.endsWith(`/${skillName}`),
      );

      if (skillDir) {
        const dirFiles = items.filter(
          (item) => item.type === "blob" && item.path.startsWith(`${skillDir.path}/`),
        );
        const files: SkillFile[] = [];
        // Parallel: fetch all file contents concurrently
        await Promise.all(
          dirFiles.map(async (f) => {
            const relativePath = f.path.slice(skillDir.path.length + 1);
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`;
            try {
              const res = await fetch(rawUrl);
              if (res.ok) {
                files.push({ path: relativePath, content: await res.text() });
              }
            } catch {
              // skip
            }
          }),
        );
        if (files.length > 0) return files;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "GitHubRateLimitError") throw err;
      continue;
    }
  }

  // Last resort: just get SKILL.md content
  const content = await fetchSkillContent(resolved);
  if (content) return [{ path: "SKILL.md", content }];

  return [];
}

async function fetchDirectoryRecursive(
  apiUrl: string,
  relativePath: string,
  files: SkillFile[],
): Promise<void> {
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) return;

  const data = await res.json();
  if (!Array.isArray(data)) return;

  // Parallel: fetch all files and recurse into all dirs concurrently
  const tasks: Promise<void>[] = [];
  for (const item of data) {
    const itemPath = `${relativePath}/${item.name}`;
    if (item.type === "file") {
      tasks.push(
        fetch(item.download_url).then(async (fileRes) => {
          if (fileRes.ok) {
            files.push({ path: itemPath, content: await fileRes.text() });
          }
        }).catch(() => {}),
      );
    } else if (item.type === "dir") {
      tasks.push(fetchDirectoryRecursive(item.url, itemPath, files));
    }
  }
  await Promise.all(tasks);
}
