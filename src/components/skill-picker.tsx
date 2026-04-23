"use client"

import type { DiscoveredSkill } from "@/lib/skill/discovery"

function SkillCard({ skill, onClick }: { skill: DiscoveredSkill; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-all p-4 group"
    >
      <div className="flex items-start gap-3">
        {skill.icon && (
          <span className="text-lg shrink-0 mt-0.5">{skill.icon}</span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors truncate">
            {skill.name}
          </h3>
          {skill.description && (
            <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">
              {skill.description}
            </p>
          )}
          <span className="text-[10px] font-mono text-white/20 mt-2 block truncate">
            {skill.skillName}
          </span>
        </div>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 bg-white/10 rounded shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-2/3" />
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
        </div>
      </div>
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
      <div className="flex items-center justify-between">
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {owner}/{repo}
        </a>
        {skills && (
          <span className="text-xs text-white/30">
            {skills.length} skill{skills.length !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <span className="text-xs font-mono text-yellow-400/80">{error}</span>
        </div>
      ) : skills && skills.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-sm text-white/40">No skills found in this repository.</p>
          <p className="text-xs text-white/20 mt-2">
            Skills are detected by looking for <code className="text-white/30">SKILL.md</code> files
            in the repository.
          </p>
        </div>
      ) : skills ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.skillPath}
              skill={skill}
              onClick={() => onSelect(skill)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
