"use client"

import { Github } from "@lobehub/icons"
import { ArrowRight, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge, Surface } from "@/components/product-ui"
import type { DiscoveredSkill } from "@/lib/skill/discovery"

function SkillCard({ skill, onClick }: { skill: DiscoveredSkill; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left"
    >
      <Surface className="h-full p-4 transition-shadow group-hover:shadow-[var(--shadow-card-hover)]">
        <div className="flex h-full items-start gap-3">
          {skill.icon ? (
            <span className="mt-0.5 shrink-0 text-lg">{skill.icon}</span>
          ) : (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-[#58a6ff]" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-foreground transition-colors">
              {skill.name}
            </h3>
            {skill.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {skill.description}
              </p>
            )}
            <span className="mt-3 block truncate font-mono text-[11px] text-muted-foreground">
              {skill.skillName}
            </span>
          </div>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </Surface>
    </button>
  )
}

function SkeletonCard() {
  return (
    <Surface className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-5 shrink-0 rounded-[6px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </Surface>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.skillPath}
              skill={skill}
              onClick={() => onSelect(skill)}
            />
          ))}
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
