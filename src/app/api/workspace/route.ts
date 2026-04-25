import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const HERMES_HOME = "/root/.hermes"
const MAX_DEPTH = 3
const MAX_ENTRIES = 500
const MAX_FILE_SIZE = 512 * 1024
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024 // 4MB (Vercel Functions body limit is 4.5MB)
const MAX_IMAGE_READ_SIZE = 2 * 1024 * 1024 // 2MB max for image reads
const FILE_SERVER_PORT = 9090
const FILE_SERVER_URL_TTL = 3600

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache",
  "__pycache__", ".venv", "venv", "dist", ".DS_Store", "logs",
])

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"])
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".webm"])
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"])

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

function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return AUDIO_EXTS.has(name.slice(dot).toLowerCase())
}

function isVideoFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return VIDEO_EXTS.has(name.slice(dot).toLowerCase())
}

function getMimeType(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return "application/octet-stream"
  const ext = name.slice(dot).toLowerCase()
  const map: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".flac": "audio/flac", ".aac": "audio/aac", ".m4a": "audio/mp4",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
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

function sanitizeFilename(raw: string): string {
  const name = raw.split("/").pop() || raw
  const safe = name.replace(/[^\w.\-]/g, "_").slice(0, 200)
  if (!safe || safe.replace(/\./g, "") === "") throw new Error("Invalid filename")
  return safe
}

const SAFE_PATH_RE = /^[a-zA-Z0-9/_.\-]+$/
const WORKSPACE_PREFIX = "/root/.hermes/workspaces/"

function normalizePosixPath(p: string): string {
  const parts = p.split("/")
  const resolved: string[] = []
  for (const part of parts) {
    if (part === "..") resolved.pop()
    else if (part && part !== ".") resolved.push(part)
  }
  return "/" + resolved.join("/")
}

function validateWorkspacePath(dirPath: string): boolean {
  if (!dirPath.startsWith(WORKSPACE_PREFIX) || !SAFE_PATH_RE.test(dirPath)) return false
  const normalized = normalizePosixPath(dirPath)
  return normalized.startsWith(WORKSPACE_PREFIX) && !normalized.includes("..")
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
        const clientMaxSize = Number(request.nextUrl.searchParams.get("maxSize") || 0)
        const effectiveMax = clientMaxSize > 0 ? Math.min(clientMaxSize, MAX_IMAGE_READ_SIZE) : MAX_IMAGE_READ_SIZE
        try {
          const info = await sandbox.fs.getFileDetails(filePath)
          if (info.size && info.size > effectiveMax) {
            return NextResponse.json({ error: "Image too large for inline display", size: info.size, limit: effectiveMax }, { status: 413 })
          }
        } catch {
          // getFileDetails not available or failed -- fall through to download
        }
        const buffer = await sandbox.fs.downloadFile(filePath)
        if (buffer.length > effectiveMax) {
          return NextResponse.json({ error: "Image too large for inline display", size: buffer.length, limit: effectiveMax }, { status: 413 })
        }
        const mime = getMimeType(filePath)
        const base64 = buffer.toString("base64")
        return NextResponse.json({
          type: "image",
          path: filePath,
          content: `data:${mime};base64,${base64}`,
        })
      }

      if (isAudioFile(filePath) || isVideoFile(filePath)) {
        const mediaType = isAudioFile(filePath) ? "audio" : "video"
        return NextResponse.json({
          type: mediaType,
          path: filePath,
          content: "",
          needsDirectUrl: true,
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

    if (action === "media-url") {
      if (!filePath) {
        return NextResponse.json({ error: "Missing path" }, { status: 400 })
      }
      const workspaceDir = filePath.substring(0, filePath.lastIndexOf("/")) || "/root"
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const checkResult: any = await sandbox.process.executeCommand(
          `curl -sf http://localhost:${FILE_SERVER_PORT}/ >/dev/null 2>&1 && echo "running" || echo "stopped"`,
        )
        const checkOutput = (checkResult.result?.output ?? checkResult.output ?? checkResult.result ?? "").toString().trim()
        if (checkOutput !== "running") {
          await sandbox.process.executeCommand(
            `cd "${workspaceDir}" && nohup python3 -m http.server ${FILE_SERVER_PORT} --bind 0.0.0.0 > /dev/null 2>&1 &`,
          )
          await new Promise((r) => setTimeout(r, 1000))
        }
      } catch {
        // Best effort
      }
      const fileName = filePath.split("/").pop() || ""
      const relativePath = filePath.startsWith(workspaceDir + "/")
        ? filePath.slice(workspaceDir.length + 1)
        : fileName
      const signedPreview = await sandbox.getSignedPreviewUrl(FILE_SERVER_PORT, FILE_SERVER_URL_TTL)
      const mediaUrl = `${signedPreview.url}/${encodeURIComponent(relativePath)}`
      return NextResponse.json({ url: mediaUrl, fileName, path: filePath })
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

  const contentType = request.headers.get("content-type") || ""

  // Upload action via FormData
  if (contentType.includes("multipart/form-data")) {
    const contentLength = parseInt(request.headers.get("content-length") || "", 10)
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return NextResponse.json({ error: "Missing or invalid Content-Length" }, { status: 411 })
    }
    if (contentLength > MAX_UPLOAD_SIZE + 4096) {
      return NextResponse.json({ error: `Request too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 413 })
    }
    try {
      const formData = await request.formData()
      const action = formData.get("action") as string
      if (action !== "upload") {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      }

      const sandboxId = formData.get("sandboxId") as string
      const daytonaKey = formData.get("key") as string
      const dirPath = formData.get("path") as string
      const file = formData.get("file") as File | null

      if (!sandboxId || !daytonaKey || !dirPath) {
        return NextResponse.json({ error: "Missing sandboxId, key, or path" }, { status: 400 })
      }
      if (!validateWorkspacePath(dirPath)) {
        return NextResponse.json({ error: "Invalid workspace path" }, { status: 403 })
      }
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 413 })
      }

      const safeName = sanitizeFilename(file.name)
      const remotePath = normalizePosixPath(`${dirPath.replace(/\/$/, "")}/${safeName}`)
      if (!remotePath.startsWith(WORKSPACE_PREFIX)) {
        return NextResponse.json({ error: "Resolved path escapes workspace" }, { status: 403 })
      }
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { Daytona } = await getDaytonaSDK()
      const daytona = new Daytona({
        apiKey: daytonaKey,
        apiUrl: "https://app.daytona.io/api",
      })
      const sandbox = await daytona.get(sandboxId)

      // Ensure parent directory exists (workspace mkdir is fire-and-forget in useChat)
      await sandbox.process.executeCommand(`mkdir -p "${dirPath.replace(/\/$/, "")}"`)

      await sandbox.fs.uploadFile(buffer, remotePath)

      // Verify the upload succeeded by downloading and checking size
      try {
        const downloaded = await sandbox.fs.downloadFile(remotePath)
        if (downloaded.length !== buffer.length) {
          return NextResponse.json({ error: "Upload verification failed: size mismatch" }, { status: 502 })
        }
      } catch {
        return NextResponse.json({ error: "Upload verification failed: file not readable" }, { status: 502 })
      }

      return NextResponse.json({ filename: safeName, path: remotePath, size: file.size })
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid filename") {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 500 },
      )
    }
  }

  // JSON actions (mkdir, etc.)
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

  if (!validateWorkspacePath(dirPath)) {
    return NextResponse.json({ error: "Invalid workspace path" }, { status: 403 })
  }

  try {
    const { Daytona } = await getDaytonaSDK()
    const daytona = new Daytona({
      apiKey: daytonaKey,
      apiUrl: "https://app.daytona.io/api",
    })
    const sandbox = await daytona.get(sandboxId)

    if (action === "mkdir") {
      const safeDirPath = normalizePosixPath(dirPath)
      await sandbox.process.executeCommand(`mkdir -p "${safeDirPath}"`)
      return NextResponse.json({ ok: true, path: safeDirPath })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workspace request failed" },
      { status: 500 },
    )
  }
}
