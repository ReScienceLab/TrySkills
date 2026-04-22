import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const HERMES_HOME = "/root/.hermes"
const MAX_DEPTH = 3
const MAX_ENTRIES = 500
const MAX_FILE_SIZE = 512 * 1024

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache",
  "__pycache__", ".venv", "venv", "dist", ".DS_Store", "logs",
])

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"])

interface FileEntry {
  name: string
  path: string
  type: "file" | "folder"
  size?: number
  modifiedAt?: string
  children?: FileEntry[]
}

async function getDaytonaSDK() {
  const { Daytona } = await import("@daytona/sdk")
  return { Daytona }
}

function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return IMAGE_EXTS.has(name.slice(dot).toLowerCase())
}

function getMimeType(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return "application/octet-stream"
  const ext = name.slice(dot).toLowerCase()
  const map: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  }
  return map[ext] || "application/octet-stream"
}

async function listFilesRecursive(
  sandbox: { fs: { listFiles: (path: string) => Promise<Array<{ name: string; isDir: boolean; size: number; modTime?: string }>> } },
  dirPath: string,
  depth: number,
  maxDepth: number,
  counter: { value: number },
  maxEntries: number,
): Promise<FileEntry[]> {
  if (depth > maxDepth || counter.value >= maxEntries) return []

  let items: Array<{ name: string; isDir: boolean; size: number; modTime?: string }>
  try {
    items = await sandbox.fs.listFiles(dirPath)
  } catch {
    return []
  }

  const entries: FileEntry[] = []
  for (const item of items) {
    if (counter.value >= maxEntries) break
    if (IGNORED_DIRS.has(item.name)) continue

    const itemPath = dirPath.endsWith("/") ? `${dirPath}${item.name}` : `${dirPath}/${item.name}`
    counter.value++

    if (item.isDir) {
      const children = await listFilesRecursive(sandbox, itemPath, depth + 1, maxDepth, counter, maxEntries)
      entries.push({
        name: item.name,
        path: itemPath,
        type: "folder",
        children,
      })
    } else {
      entries.push({
        name: item.name,
        path: itemPath,
        type: "file",
        size: item.size,
        modifiedAt: item.modTime,
      })
    }
  }

  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const action = request.nextUrl.searchParams.get("action") || "list"
  const sandboxId = request.nextUrl.searchParams.get("sandboxId")
  const daytonaKey = request.nextUrl.searchParams.get("key")
  const filePath = request.nextUrl.searchParams.get("path") || HERMES_HOME

  if (!sandboxId || !daytonaKey) {
    return NextResponse.json({ error: "Missing sandboxId or key" }, { status: 400 })
  }

  try {
    const { Daytona } = await getDaytonaSDK()
    const daytona = new Daytona({
      apiKey: daytonaKey,
      apiUrl: "https://app.daytona.io/api",
    })
    const sandbox = await daytona.get(sandboxId)

    if (action === "list") {
      const maxDepth = Math.min(
        Number(request.nextUrl.searchParams.get("maxDepth") || MAX_DEPTH),
        MAX_DEPTH,
      )
      const maxEntries = Math.min(
        Number(request.nextUrl.searchParams.get("maxEntries") || MAX_ENTRIES),
        MAX_ENTRIES,
      )
      const entries = await listFilesRecursive(
        sandbox, filePath, 0, maxDepth, { value: 0 }, maxEntries,
      )
      return NextResponse.json({ root: filePath, entries })
    }

    if (action === "read") {
      if (!filePath) {
        return NextResponse.json({ error: "Missing path" }, { status: 400 })
      }

      if (isImageFile(filePath)) {
        const buffer = await sandbox.fs.downloadFile(filePath)
        const mime = getMimeType(filePath)
        const base64 = buffer.toString("base64")
        return NextResponse.json({
          type: "image",
          path: filePath,
          content: `data:${mime};base64,${base64}`,
        })
      }

      const buffer = await sandbox.fs.downloadFile(filePath)
      const content = buffer.toString("utf8")
      if (content.length > MAX_FILE_SIZE) {
        return NextResponse.json({
          type: "text",
          path: filePath,
          content: content.slice(0, MAX_FILE_SIZE),
          truncated: true,
        })
      }
      return NextResponse.json({
        type: "text",
        path: filePath,
        content,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workspace request failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { action?: string; sandboxId?: string; key?: string; path?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { action, sandboxId, key: daytonaKey, path: dirPath } = body
  if (!sandboxId || !daytonaKey || !dirPath) {
    return NextResponse.json({ error: "Missing sandboxId, key, or path" }, { status: 400 })
  }

  if (!dirPath.startsWith("/root/.hermes/workspaces/")) {
    return NextResponse.json({ error: "Path must be under /root/.hermes/workspaces/" }, { status: 403 })
  }

  try {
    const { Daytona } = await getDaytonaSDK()
    const daytona = new Daytona({
      apiKey: daytonaKey,
      apiUrl: "https://app.daytona.io/api",
    })
    const sandbox = await daytona.get(sandboxId)

    if (action === "mkdir") {
      await sandbox.process.executeCommand(`mkdir -p "${dirPath}"`)
      return NextResponse.json({ ok: true, path: dirPath })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workspace request failed" },
      { status: 500 },
    )
  }
}
