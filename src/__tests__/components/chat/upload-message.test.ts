import { describe, expect, it } from "vitest"
import { formatUploadedFilesMessage, isPreviewableImageName, type UploadedFile } from "@/components/chat/upload-message"

function file(filename: string, isImage = isPreviewableImageName(filename)): UploadedFile {
  return {
    filename,
    path: `/root/.hermes/workspaces/session/${filename}`,
    size: 123,
    isImage,
  }
}

describe("upload message formatting", () => {
  it("renders image uploads as markdown image references", () => {
    expect(formatUploadedFilesMessage("can you read this image", [file("image.png")])).toBe(
      "can you read this image\n\nAttached files:\n\n![image.png](image.png)",
    )
  })

  it("renders non-image uploads as file list entries", () => {
    expect(formatUploadedFilesMessage("", [file("notes.txt")])).toBe(
      "Attached files:\n\n- `notes.txt`",
    )
  })

  it("keeps mixed uploads in a single attachment block", () => {
    expect(formatUploadedFilesMessage("review these", [file("screen.webp"), file("data.json")])).toBe(
      "review these\n\nAttached files:\n\n![screen.webp](screen.webp)\n- `data.json`",
    )
  })

  it("detects previewable image filenames case-insensitively", () => {
    expect(isPreviewableImageName("PHOTO.JPG")).toBe(true)
    expect(isPreviewableImageName("archive.zip")).toBe(false)
  })
})
