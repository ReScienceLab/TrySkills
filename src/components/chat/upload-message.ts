export interface UploadedFile {
  filename: string
  path: string
  size?: number
  isImage: boolean
}

const PREVIEWABLE_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"])

export function isPreviewableImageName(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return PREVIEWABLE_IMAGE_EXTS.has(name.slice(dot).toLowerCase())
}

export function formatUploadedFilesMessage(text: string, files: UploadedFile[]): string {
  const trimmed = text.trim()
  if (!files.length) return trimmed

  const fileLines = files.map((file) => {
    if (file.isImage) return `![${file.filename}](./${file.filename})`
    return `- [${file.filename}](./${file.filename})`
  })
  const attachmentBlock = ["Attached files:", "", ...fileLines].join("\n")

  return trimmed ? `${trimmed}\n\n${attachmentBlock}` : attachmentBlock
}
