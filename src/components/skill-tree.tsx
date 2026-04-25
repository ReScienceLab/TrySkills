"use client"

import {
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Settings,
  Star,
  Terminal,
} from "lucide-react"
import type { ComponentProps } from "react"

import { StatusBadge, Surface } from "@/components/product-ui"
import type { TreeNode } from "@/lib/skill/tree"

function TreeItem({
  node,
  isLast,
  prefix,
}: {
  node: TreeNode
  isLast: boolean
  prefix: string
}) {
  const connector = isLast ? "└── " : "├── "
  const childPrefix = prefix + (isLast ? "    " : "│   ")

  return (
    <>
      <div className="flex items-center whitespace-nowrap">
        <span className="select-none whitespace-pre text-muted-foreground/60">{prefix}{connector}</span>
        <TreeIcon type={node.type} name={node.name} className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" />
        <span className={node.type === "dir" ? "font-medium text-foreground" : "text-muted-foreground"}>
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
  )
}

function TreeIcon({
  type,
  name,
  ...props
}: ComponentProps<typeof File> & {
  type: TreeNode["type"]
  name: string
}) {
  if (type === "dir") return <Folder {...props} />
  if (name === "SKILL.md" || name === "skill.md") return <Star {...props} />
  if (name.endsWith(".md")) return <FileText {...props} />
  if (name.endsWith(".sh")) return <Terminal {...props} />
  if (name.endsWith(".py") || name.endsWith(".ts") || name.endsWith(".js")) return <FileCode2 {...props} />
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml")) return <FileJson {...props} />
  if (name.startsWith(".")) return <Settings {...props} />
  return <File {...props} />
}

export function SkillTree({
  tree,
  skillName,
  resolvedPath,
}: {
  tree: TreeNode[]
  skillName: string
  resolvedPath: string
}) {
  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {resolvedPath}
        </span>
        <StatusBadge tone="neutral">
          {countFiles(tree)} files
        </StatusBadge>
      </div>
      <div className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed">
        <div className="mb-1 flex items-center">
          <Folder className="mr-1.5 size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{skillName}</span>
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
    </Surface>
  )
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === "file") count++
    if (node.children) count += countFiles(node.children)
  }
  return count
}
