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

export async function fetchSkillDirectory(
  resolved: ResolvedSkill,
): Promise<SkillFile[]> {
  const files: SkillFile[] = [];
  await fetchDirectoryRecursive(resolved.rawBaseUrl, "", files);
  return files;
}

async function fetchDirectoryRecursive(
  apiUrl: string,
  relativePath: string,
  files: SkillFile[],
): Promise<void> {
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!res.ok) {
    if (res.status === 404) {
      const rawUrl = apiUrl
        .replace("https://api.github.com/repos/", "https://raw.githubusercontent.com/")
        .replace("/contents/", "/main/");
      const fallback = await fetch(rawUrl);
      if (fallback.ok) {
        const content = await fallback.text();
        const fileName = relativePath || "SKILL.md";
        files.push({ path: fileName, content });
      }
      return;
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    const content = data.encoding === "base64"
      ? atob(data.content)
      : data.content;
    files.push({ path: relativePath || data.name, content });
    return;
  }

  for (const item of data) {
    const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;
    if (item.type === "file") {
      const fileRes = await fetch(item.download_url);
      if (fileRes.ok) {
        const content = await fileRes.text();
        files.push({ path: itemPath, content });
      }
    } else if (item.type === "dir") {
      await fetchDirectoryRecursive(item.url, itemPath, files);
    }
  }
}

export async function fetchSkillContent(resolved: ResolvedSkill): Promise<string | null> {
  const rawUrl = `https://raw.githubusercontent.com/${resolved.owner}/${resolved.repo}/main/${resolved.skillName}/SKILL.md`;
  const res = await fetch(rawUrl);
  if (!res.ok) return null;
  return res.text();
}
