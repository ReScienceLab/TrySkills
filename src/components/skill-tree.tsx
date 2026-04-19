"use client";

import type { TreeNode } from "@/lib/skill/tree";

function TreeItem({
  node,
  isLast,
  prefix,
}: {
  node: TreeNode;
  isLast: boolean;
  prefix: string;
}) {
  const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
  const childPrefix = prefix + (isLast ? "    " : "\u2502   ");

  const icon = node.type === "dir" ? "\uD83D\uDCC1" : getFileIcon(node.name);

  return (
    <>
      <div className="flex items-center">
        <span className="text-white/30 select-none whitespace-pre">{prefix}{connector}</span>
        <span className="text-white/50 mr-1.5 text-xs">{icon}</span>
        <span className={node.type === "dir" ? "text-white/80 font-medium" : "text-white/60"}>
          {node.name}
        </span>
      </div>
      {node.children?.map((child, i) => (
        <TreeItem
          key={child.name}
          node={child}
          isLast={i === node.children!.length - 1}
          prefix={childPrefix}
        />
      ))}
    </>
  );
}

function getFileIcon(name: string): string {
  if (name === "SKILL.md" || name === "skill.md") return "\u2B50";
  if (name.endsWith(".md")) return "\uD83D\uDCC4";
  if (name.endsWith(".sh")) return "\u2699\uFE0F";
  if (name.endsWith(".py")) return "\uD83D\uDC0D";
  if (name.endsWith(".ts") || name.endsWith(".js")) return "\uD83D\uDFE8";
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml")) return "\u2699\uFE0F";
  return "\uD83D\uDCC4";
}

export function SkillTree({
  tree,
  skillName,
  resolvedPath,
}: {
  tree: TreeNode[];
  skillName: string;
  resolvedPath: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.02] backdrop-blur-sm">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="font-mono text-xs text-white/50">
          {resolvedPath}
        </span>
        <span className="text-xs text-white/30">
          {countFiles(tree)} files
        </span>
      </div>
      <div className="px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto">
        <div className="flex items-center mb-1">
          <span className="text-white/50 mr-1.5 text-xs">{"\uD83D\uDCC1"}</span>
          <span className="text-white/90 font-medium">{skillName}</span>
        </div>
        {tree.map((node, i) => (
          <TreeItem
            key={node.name}
            node={node}
            isLast={i === tree.length - 1}
            prefix=""
          />
        ))}
      </div>
    </div>
  );
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}
