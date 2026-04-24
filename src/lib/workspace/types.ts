import type { LucideIcon } from "lucide-react"
import {
  Folder, FileText, FileJson, FileCode, FileCode2,
  Terminal as TerminalIcon, ImageIcon, File,
} from "lucide-react"

export interface FileEntry {
  name: string
  path: string
  type: "file" | "folder"
  size?: number
  modifiedAt?: string
  children?: FileEntry[]
}

export interface FileContent {
  type: "text" | "image"
  path: string
  content: string
}

export interface WorkspaceProvider {
  listFiles(sandboxId: string, sandboxKey: string, rootPath: string): Promise<FileEntry[]>
  readFile(sandboxId: string, sandboxKey: string, filePath: string): Promise<FileContent>
}

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  ".DS_Store",
  "logs",
])

export const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"])

export const CODE_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "json", "css", "html", "yml", "yaml",
  "sh", "py", "env", "toml", "cfg", "ini", "xml", "sql", "rs",
  "go", "rb", "java", "kt", "swift", "c", "cpp", "h", "hpp",
])

export function getFileExt(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ""
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(getFileExt(name))
}

export function isCodeFile(name: string): boolean {
  return CODE_EXTS.has(getFileExt(name))
}

export function isMarkdownFile(name: string): boolean {
  const ext = getFileExt(name)
  return ext === "md" || ext === "mdx"
}

export function getFileIcon(entry: FileEntry): LucideIcon {
  if (entry.type === "folder") return Folder
  const ext = getFileExt(entry.name)
  if (ext === "md" || ext === "mdx") return FileText
  if (ext === "json") return FileJson
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") return FileCode
  if (ext === "py") return FileCode2
  if (ext === "sh") return TerminalIcon
  if (IMAGE_EXTS.has(ext)) return ImageIcon
  return File
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
