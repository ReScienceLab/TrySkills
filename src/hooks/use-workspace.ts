"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { FileEntry, FileContent } from "@/lib/workspace/types"
import { daytonaProvider } from "@/lib/workspace/daytona-provider"

const POLL_INTERVAL_MS = 5000
const DEBOUNCE_MS = 2000

const FILE_MODIFYING_TOOLS = new Set([
  "write_file", "patch", "terminal", "create_file", "edit_file",
  "create_folder", "delete_file", "move_file", "save_file",
])

export function useWorkspace(
  sandboxId: string | null,
  sandboxKey: string | null,
  workspacePath: string | null,
  isStreaming: boolean,
) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const lastRefreshRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasLoadedRef = useRef(false)

  const refreshTree = useCallback(async () => {
    if (!sandboxId || !sandboxKey || !workspacePath) return

    const now = Date.now()
    if (now - lastRefreshRef.current < DEBOUNCE_MS) return
    lastRefreshRef.current = now

    setLoadingTree(true)
    setTreeError(null)
    try {
      const result = await daytonaProvider.listFiles(sandboxId, sandboxKey, workspacePath)
      setEntries(result)
      if (!hasLoadedRef.current && result.length > 0) {
        hasLoadedRef.current = true
        setPanelOpen(true)
      }
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoadingTree(false)
    }
  }, [sandboxId, sandboxKey, workspacePath])

  const selectFile = useCallback(async (entry: FileEntry) => {
    if (!sandboxId || !sandboxKey) return
    setSelectedFile(entry)
    setLoadingFile(true)
    setFileError(null)
    setFileContent(null)
    try {
      const content = await daytonaProvider.readFile(sandboxId, sandboxKey, entry.path)
      setFileContent(content)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to read file")
    } finally {
      setLoadingFile(false)
    }
  }, [sandboxId, sandboxKey])

  const closeFile = useCallback(() => {
    setSelectedFile(null)
    setFileContent(null)
    setFileError(null)
  }, [])

  const onToolComplete = useCallback((toolName: string) => {
    if (FILE_MODIFYING_TOOLS.has(toolName)) {
      void refreshTree()
    }
  }, [refreshTree])

  // Initial load
  useEffect(() => {
    if (!sandboxId || !sandboxKey || !workspacePath) return
    const now = Date.now()
    if (now - lastRefreshRef.current < DEBOUNCE_MS) return
    lastRefreshRef.current = now

    let cancelled = false
    setLoadingTree(true)
    setTreeError(null)

    daytonaProvider.listFiles(sandboxId, sandboxKey, workspacePath)
      .then((result) => {
        if (cancelled) return
        setEntries(result)
        if (!hasLoadedRef.current && result.length > 0) {
          hasLoadedRef.current = true
          setPanelOpen(true)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setTreeError(err instanceof Error ? err.message : "Failed to load files")
      })
      .finally(() => {
        if (!cancelled) setLoadingTree(false)
      })

    return () => { cancelled = true }
  }, [sandboxId, sandboxKey, workspacePath])

  // Poll while streaming
  useEffect(() => {
    if (!isStreaming || !sandboxId || !sandboxKey || !workspacePath) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    pollTimerRef.current = setInterval(() => {
      void refreshTree()
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [isStreaming, sandboxId, sandboxKey, workspacePath, refreshTree])

  return {
    entries,
    selectedFile,
    fileContent,
    loadingTree,
    loadingFile,
    treeError,
    fileError,
    panelOpen,
    setPanelOpen,
    refreshTree,
    selectFile,
    closeFile,
    onToolComplete,
  }
}
