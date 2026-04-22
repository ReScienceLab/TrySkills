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

export function getFileIcon(entry: FileEntry): string {
  if (entry.type === "folder") return "\u{1F4C1}"
  const ext = getFileExt(entry.name)
  if (ext === "md" || ext === "mdx") return "\u{1F4C4}"
  if (ext === "json") return "\u{1F4CB}"
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") return "\u{1F4DC}"
  if (ext === "py") return "\u{1F40D}"
  if (ext === "sh") return "\u{1F4DF}"
  if (IMAGE_EXTS.has(ext)) return "\u{1F5BC}\u{FE0F}"
  return "\u{1F4C3}"
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
