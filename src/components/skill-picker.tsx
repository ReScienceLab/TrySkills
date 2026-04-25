"use client"

import { Github } from "@lobehub/icons"
import { ArrowRight, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge, Surface } from "@/components/product-ui"
import type { DiscoveredSkill } from "@/lib/skill/discovery"

function SkillRow({ skill, index, owner, repo, onClick }: { skill: DiscoveredSkill; index: number; owner: string; repo: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[3rem_minmax(0,1.05fr)_minmax(12rem,1fr)_auto] sm:px-4"
    >
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {index.toString().padStart(2, "0")}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-5 shrink-0 items-center justify-center">
          {skill.icon ? (
            <span className="text-base leading-none">{skill.icon}</span>
          ) : (
            <span className="size-2 rounded-full bg-[#58a6ff]" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {skill.name}
          </span>
          <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
            {owner}/{repo}/{skill.skillName}
          </span>
        </span>
      </span>
      <span className="hidden min-w-0 text-sm leading-6 text-muted-foreground sm:block">
        <span className="line-clamp-2">{skill.description || "No description provided."}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-4 sm:grid-cols-[3rem_minmax(0,1.05fr)_minmax(12rem,1fr)_auto] sm:px-4">
      <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
        {index.toString().padStart(2, "0")}
      </span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="hidden h-4 w-full sm:block" />
      <Skeleton className="size-4" />
    </div>
  )
}

export function SkillPicker({
  owner,
  repo,
  skills,
  loading,
  error,
  onSelect,
}: {
  owner: string
  repo: string
  skills: DiscoveredSkill[] | null
  loading: boolean
  error: string | null
  onSelect: (skill: DiscoveredSkill) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Github size={14} />
          <span className="truncate">{owner}/{repo}</span>
        </a>
        {skills && (
          <StatusBadge tone="neutral">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
          </StatusBadge>
        )}
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
          <div className="hidden grid-cols-[3rem_minmax(0,1.05fr)_minmax(12rem,1fr)_auto] gap-3 px-4 py-3 font-mono text-[11px] uppercase text-muted-foreground shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)] sm:grid">
            <span>#</span>
            <span>Skill</span>
            <span>Description</span>
            <span />
          </div>
          <div className="divide-y divide-white/[0.08]">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} index={i + 1} />
            ))}
          </div>
        </div>
      ) : error ? (
        <Surface className="bg-[rgba(255,91,79,0.08)] px-4 py-3">
          <span className="font-mono text-xs text-[#ffb4ac]">{error}</span>
        </Surface>
      ) : skills && skills.length === 0 ? (
        <Surface className="px-6 py-10 text-center">
          <SearchX className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No skills found in this repository.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Skills are detected by looking for <code className="text-foreground">SKILL.md</code> files.
          </p>
        </Surface>
      ) : skills ? (
        <div className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
          <div className="hidden grid-cols-[3rem_minmax(0,1.05fr)_minmax(12rem,1fr)_auto] gap-3 px-4 py-3 font-mono text-[11px] uppercase text-muted-foreground shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)] sm:grid">
            <span>#</span>
            <span>Skill</span>
            <span>Description</span>
            <span />
          </div>
          <div className="divide-y divide-white/[0.08]">
            {skills.map((skill, index) => (
              <SkillRow
                key={skill.skillPath}
                skill={skill}
                index={index + 1}
                owner={owner}
                repo={repo}
                onClick={() => onSelect(skill)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {skills && skills.length > 1 && (
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Select one skill to inspect its files
        </Button>
      )}
    </div>
  )
}
