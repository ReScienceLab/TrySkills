"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SignInButton, useAuth } from "@clerk/nextjs"
import { Github, NousResearch } from "@lobehub/icons"
import {
  ArrowLeft,
  BookOpenText,
  CornerDownLeft,
  Globe2,
  LockKeyhole,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageContent, PageShell, StatusBadge, Surface } from "@/components/product-ui"
import { SiteHeader } from "@/components/site-header"
import { SkillPicker } from "@/components/skill-picker"
import { SkillTree } from "@/components/skill-tree"
import { GitHubRateLimitError } from "@/lib/github-fetch"
import { discoverSkills, type DiscoveredSkill } from "@/lib/skill/discovery"
import { fetchSkillTree, type TreeNode } from "@/lib/skill/tree"
import { parseRepoUrl, parseSkillUrl } from "@/lib/skill/url-parser"

function Footer() {
  return (
    <footer className="relative z-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
      <PageContent className="flex min-h-14 flex-col gap-3 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <nav aria-label="Footer links" className="flex flex-wrap items-center gap-4">
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Globe2 className="size-4" />
            Browse Skills
          </a>
          <a
            href="https://agentskills.io/specification"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <BookOpenText className="size-4" />
            Specification
          </a>
          <a
            href="https://github.com/ReScienceLab/TrySkills"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Github size={16} />
            GitHub
          </a>
        </nav>
        <span>ReScience Lab Inc.</span>
      </PageContent>
    </footer>
  )
}

function SkillTreeSkeleton() {
  const widths = ["w-44", "w-64", "w-56", "w-72", "w-48", "w-60", "w-52"]

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
        <Skeleton className="h-4 w-full max-w-[420px]" />
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      <div className="space-y-2 px-4 py-4">
        <Skeleton className="h-4 w-36" />
        {widths.map((width, index) => (
          <div key={`${width}-${index}`} className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground/40">
              {index % 3 === 0 ? "├──" : index % 3 === 1 ? "│" : "└──"}
            </span>
            <Skeleton className={`h-4 ${width}`} />
          </div>
        ))}
      </div>
    </Surface>
  )
}

export default function Home() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const [url, setUrl] = useState("")
  const [phase, setPhase] = useState<"input" | "tree" | "repo">("input")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [parsedPath, setParsedPath] = useState<string | null>(null)
  const [treeData, setTreeData] = useState<TreeNode[] | null>(null)
  const [treeResolvedPath, setTreeResolvedPath] = useState("")
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [repoOwner, setRepoOwner] = useState("")
  const [repoName, setRepoName] = useState("")
  const [repoSkills, setRepoSkills] = useState<DiscoveredSkill[] | null>(null)
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [repoBranch, setRepoBranch] = useState<string | undefined>(undefined)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setUrlError(null)

    const parsed = parseSkillUrl(url)
    if (parsed) {
      setParsedPath(parsed)

      const segments = parsed.split("/").filter(Boolean)
      const owner = segments[0]
      const repo = segments[1]
      const skillName = segments.slice(2).join("/")

      setPhase("tree")
      setTreeLoading(true)
      setTreeError(null)
      setTreeData(null)

      try {
        const result = await fetchSkillTree(owner, repo, skillName)
        if (result) {
          setTreeData(result.tree)
          setTreeResolvedPath(result.resolvedPath)
        } else {
          setTreeError("Could not find skill directory in repository. The skill may still work, so you can continue to configure it.")
        }
      } catch (err) {
        if (err instanceof GitHubRateLimitError) {
          setIsRateLimited(true)
          setTreeError(err.message)
        } else {
          setTreeError("Failed to fetch skill structure. The skill may still work, so you can continue to configure it.")
        }
      } finally {
        setTreeLoading(false)
      }
      return
    }

    const repoInfo = parseRepoUrl(url)
    if (repoInfo) {
      setRepoOwner(repoInfo.owner)
      setRepoName(repoInfo.repo)
      setPhase("repo")
      setRepoLoading(true)
      setRepoError(null)
      setRepoSkills(null)

      try {
        const result = await discoverSkills(repoInfo.owner, repoInfo.repo)
        if (result.skills.length === 1) {
          window.location.href = result.skills[0].skillPath
          return
        }
        setRepoSkills(result.skills)
        setRepoBranch(result.branch)
      } catch (err) {
        if (err instanceof GitHubRateLimitError) {
          setIsRateLimited(true)
          setRepoError(err.message)
        } else {
          setRepoError("Failed to scan repository for skills.")
        }
      } finally {
        setRepoLoading(false)
      }
      return
    }

    setUrlError("Invalid URL. Use github.com/owner/repo, skills.sh/owner/repo/skill, or owner/repo/skill.")
  }

  const handleSkillSelect = (skill: DiscoveredSkill) => {
    setParsedPath(skill.skillPath)

    const segments = skill.skillPath.split("/").filter(Boolean)
    const owner = segments[0]
    const repo = segments[1]
    const selectedSkillName = segments.slice(2).join("/")

    setPhase("tree")
    setTreeLoading(true)
    setTreeError(null)
    setTreeData(null)

    fetchSkillTree(owner, repo, selectedSkillName, repoBranch)
      .then((result) => {
        if (result) {
          setTreeData(result.tree)
          setTreeResolvedPath(result.resolvedPath)
        } else {
          setTreeError("Could not find skill directory in repository. The skill may still work, so you can continue to configure it.")
        }
      })
      .catch((err) => {
        if (err instanceof GitHubRateLimitError) {
          setIsRateLimited(true)
          setTreeError(err.message)
        } else {
          setTreeError("Failed to fetch skill structure. The skill may still work, so you can continue to configure it.")
        }
      })
      .finally(() => {
        setTreeLoading(false)
      })
  }

  const resetToInput = () => {
    setPhase("input")
    setTreeData(null)
    setTreeError(null)
    setRepoSkills(null)
    setRepoError(null)
    setIsRateLimited(false)
    setRepoBranch(undefined)
  }

  const canConfigureLaunch = phase === "tree" && authLoaded && isSignedIn && !treeLoading && !!parsedPath
  const goToConfigureLaunch = useCallback(() => {
    if (parsedPath) window.location.href = parsedPath
  }, [parsedPath])

  useEffect(() => {
    if (!canConfigureLaunch) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("a, button, input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      goToConfigureLaunch()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canConfigureLaunch, goToConfigureLaunch])

  useEffect(() => {
    if (phase !== "input") return
    const frame = window.requestAnimationFrame(() => {
      urlInputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [phase])

  const skillName = parsedPath?.split("/").filter(Boolean).slice(2).join("/") || ""

  return (
    <PageShell className="flex flex-col overflow-hidden">
      <SiteHeader />

      <PageContent className="relative z-10 flex flex-1 flex-col items-center justify-center py-16 sm:py-24">
        <section className="w-full max-w-3xl text-center">
          <StatusBadge tone="blue" className="mb-6">
            Try any agent skill in a sandbox
          </StatusBadge>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.04] text-foreground md:text-6xl">
            TrySkills.sh
          </h1>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <p className="font-mono">One URL to try any agent skill.</p>
            <a
              href="https://hermes-agent.nousresearch.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              powered by
              <NousResearch size={14} />
            </a>
          </div>
        </section>

        <div className="mt-10 w-full max-w-3xl">
          {phase === "input" ? (
            <form onSubmit={handleSubmit} className="animate-fade-in-up">
              <Surface className="p-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="skill-url-input" className="sr-only">
                    Skill URL
                  </label>
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="skill-url-input"
                      ref={urlInputRef}
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="github.com/owner/repo or owner/repo/skill"
                      className="h-11 rounded-[6px] border-0 bg-white/[0.03] pl-9 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </div>
                  <Button type="submit" size="lg" className="sm:w-auto">
                    Configure
                    <CornerDownLeft className="size-4" />
                  </Button>
                </div>
              </Surface>
              {urlError && (
                <div className="mt-3 rounded-[6px] bg-[rgba(255,91,79,0.12)] px-4 py-2.5 text-left font-mono text-xs text-[#ffb4ac] shadow-[var(--shadow-border)]">
                  {urlError}
                </div>
              )}
            </form>
          ) : phase === "repo" ? (
            <div className="animate-fade-in-up space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={resetToInput} aria-label="Go back and change URL">
                  <ArrowLeft className="size-4" />
                  Change URL
                </Button>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {url}
                </span>
              </div>

              <SkillPicker
                owner={repoOwner}
                repo={repoName}
                skills={repoSkills}
                loading={repoLoading}
                error={repoError}
                onSelect={handleSkillSelect}
              />

              {isRateLimited && !isSignedIn && (
                <div className="flex items-center gap-3">
                  <SignInButton mode="modal">
                    <Button size="sm">Sign in with GitHub</Button>
                  </SignInButton>
                  <span className="text-xs text-muted-foreground">to increase API limits</span>
                </div>
              )}
            </div>
          ) : phase === "tree" ? (
            <div className="animate-fade-in-up space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={resetToInput} aria-label="Go back and change URL">
                  <ArrowLeft className="size-4" />
                  Change URL
                </Button>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {url}
                </span>
              </div>

              {treeLoading ? (
                <SkillTreeSkeleton />
              ) : treeData ? (
                <SkillTree tree={treeData} skillName={skillName} resolvedPath={treeResolvedPath} />
              ) : treeError ? (
                <Surface className={`p-4 ${isRateLimited ? "bg-[rgba(255,91,79,0.08)]" : "bg-white/[0.03]"}`}>
                  <span className={`font-mono text-xs ${isRateLimited ? "text-[#ffb4ac]" : "text-muted-foreground"}`}>
                    {treeError}
                  </span>
                  {isRateLimited && !isSignedIn && (
                    <div className="mt-3 flex items-center gap-3">
                      <SignInButton mode="modal">
                        <Button size="sm">Sign in with GitHub</Button>
                      </SignInButton>
                      <span className="text-xs text-muted-foreground">to increase API limits</span>
                    </div>
                  )}
                  {isRateLimited && isSignedIn && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Please wait a few minutes and try again.
                    </div>
                  )}
                </Surface>
              ) : null}

              {!authLoaded ? (
                <Button disabled className="w-full" size="lg">
                  Loading...
                </Button>
              ) : isSignedIn ? (
                <Button
                  onClick={goToConfigureLaunch}
                  disabled={treeLoading || !parsedPath}
                  className="w-full"
                  size="lg"
                  aria-keyshortcuts="Enter"
                >
                  Configure & Launch
                  <CornerDownLeft className="size-4" />
                </Button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl={parsedPath || "/"}>
                  <Button disabled={treeLoading} className="w-full" size="lg">
                    <LockKeyhole className="size-4" />
                    Sign in to Configure & Launch
                  </Button>
                </SignInButton>
              )}
            </div>
          ) : null}
        </div>

      </PageContent>

      <Footer />
    </PageShell>
  )
}
