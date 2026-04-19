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
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: { Accept: "application/vnd.github.v3+json" } },
    ).catch(() => null);

    if (!treeRes || !treeRes.ok) continue;

    const data = await treeRes.json();
    const items = (data.tree || []) as { path: string; type: string }[];

    // Find the skill directory: try exact match first, then common prefixes
    const candidatePrefixes = [
      `${skillName}/`,
      `skills/${skillName}/`,
      `${repo}/${skillName}/`,
      `.agents/skills/${skillName}/`,
      `.claude/skills/${skillName}/`,
      `plugin/skills/${skillName}/`,
    ];

    // Also try stripped name variants
    const strippedNames: string[] = [];
    for (const prefix of [owner, repo]) {
      if (skillName.startsWith(`${prefix}-`) && skillName.length > prefix.length + 1) {
        strippedNames.push(skillName.slice(prefix.length + 1));
      }
    }
    for (const stripped of strippedNames) {
      candidatePrefixes.push(`skills/${stripped}/`);
      candidatePrefixes.push(`${stripped}/`);
    }

    for (const prefix of candidatePrefixes) {
      const matching = items.filter(
        (item) => item.path.startsWith(prefix) && item.path !== prefix.slice(0, -1),
      );

      if (matching.length > 0) {
        const tree = buildTree(matching, prefix);
        return { tree, resolvedPath: `${owner}/${repo}/${branch}/${prefix.slice(0, -1)}` };
      }
    }
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
