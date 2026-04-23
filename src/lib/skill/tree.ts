import { githubFetch } from "@/lib/github-fetch";

export interface TreeNode {
  name: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

export async function fetchSkillTree(
  owner: string,
  repo: string,
  skillName: string,
): Promise<{ tree: TreeNode[]; resolvedPath: string } | null> {
  for (const branch of ["main", "master"]) {
    const treeRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    ).catch((err) => {
      if (err.name === "GitHubRateLimitError") throw err;
      return null;
    });

    if (!treeRes || !treeRes.ok) continue;

    const data = await treeRes.json();
    const items = (data.tree || []) as { path: string; type: string }[];

    const dir = findSkillDir(items, owner, repo, skillName);
    if (dir) {
      const prefix = dir + "/";
      const matching = items.filter(
        (item) => item.path.startsWith(prefix) && item.path !== dir,
      );
      if (matching.length > 0) {
        const tree = buildTree(matching, prefix);
        return { tree, resolvedPath: `${owner}/${repo}/${branch}/${dir}` };
      }
    }
  }

  return null;
}

function findSkillDir(
  items: { path: string; type: string }[],
  owner: string,
  repo: string,
  skillName: string,
): string | null {
  // Collect all SKILL.md paths and their parent directories
  const skillDirs = items
    .filter((i) => i.path.endsWith("/SKILL.md") || i.path === "SKILL.md")
    .map((i) => {
      const dir = i.path.replace(/\/SKILL\.md$/, "");
      const dirName = dir.split("/").pop() || dir;
      return { dir, dirName };
    });

  // 0. Full path match: skillName contains slashes (e.g. "category/sub-skill")
  if (skillName.includes("/")) {
    const fullPathMatch = skillDirs.find(
      (d) => d.dir === skillName || d.dir.endsWith(`/${skillName}`),
    );
    if (fullPathMatch) return fullPathMatch.dir;
  }

  // 1. Exact match: directory name equals skillName
  const exact = skillDirs.find((d) => d.dirName === skillName);
  if (exact) return exact.dir;

  // 2. Stripped prefix match: remove owner- or repo- prefix from skillName
  for (const prefix of [owner, repo]) {
    if (skillName.startsWith(`${prefix}-`) && skillName.length > prefix.length + 1) {
      const stripped = skillName.slice(prefix.length + 1);
      const match = skillDirs.find((d) => d.dirName === stripped);
      if (match) return match.dir;
    }
  }

  // 3. Progressive dash-trim: "remotion-best-practices" -> "remotion-best" -> "remotion"
  const segments = skillName.split("-");
  for (let len = segments.length - 1; len >= 1; len--) {
    const partial = segments.slice(0, len).join("-");
    const match = skillDirs.find((d) => d.dirName === partial);
    if (match) return match.dir;
  }

  // 4. Repo-name as parent directory: "better-auth-best-practices" -> "better-auth/best-practices"
  const repoPrefix = `${repo}-`;
  if (skillName.startsWith(repoPrefix)) {
    const afterRepo = skillName.slice(repoPrefix.length);
    const match = skillDirs.find(
      (d) => d.dir === `${repo}/${afterRepo}` || d.dir.endsWith(`/${repo}/${afterRepo}`),
    );
    if (match) return match.dir;
  }

  return null;
}

function buildTree(
  items: { path: string; type: string }[],
  prefix: string,
): TreeNode[] {
  const root: TreeNode[] = [];

  for (const item of items) {
    const relativePath = item.path.slice(prefix.length);
    if (!relativePath) continue;

    const parts = relativePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);

      if (existing) {
        if (existing.children) {
          current = existing.children;
        }
      } else {
        const node: TreeNode = {
          name,
          type: isLast && item.type === "blob" ? "file" : "dir",
        };
        if (node.type === "dir") {
          node.children = [];
        }
        current.push(node);
        if (node.children) {
          current = node.children;
        }
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) sortTree(node.children);
  }
}
