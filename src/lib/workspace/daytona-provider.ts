import type { WorkspaceProvider, FileEntry, FileContent } from "./types"
import { IGNORED_DIRS } from "./types"

const MAX_DEPTH = 3
const MAX_ENTRIES = 500

export const daytonaProvider: WorkspaceProvider = {
  async listFiles(sandboxId: string, sandboxKey: string, rootPath: string): Promise<FileEntry[]> {
    const res = await fetch("/api/workspace?" + new URLSearchParams({
      action: "list",
      sandboxId,
      key: sandboxKey,
      path: rootPath,
      maxDepth: String(MAX_DEPTH),
      maxEntries: String(MAX_ENTRIES),
    }))
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(text || `Workspace list failed: ${res.status}`)
    }
    const data = await res.json()
    return data.entries ?? []
  },

  async readFile(sandboxId: string, sandboxKey: string, filePath: string): Promise<FileContent> {
    const res = await fetch("/api/workspace?" + new URLSearchParams({
      action: "read",
      sandboxId,
      key: sandboxKey,
      path: filePath,
    }))
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(text || `Workspace read failed: ${res.status}`)
    }
    return await res.json()
  },
}

export function sortEntries(entries: FileEntry[]): FileEntry[] {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function shouldIgnore(name: string): boolean {
  return IGNORED_DIRS.has(name)
}
