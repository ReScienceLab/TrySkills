"use client";

import type { SkillMeta } from "@/lib/skill/resolver";

export function SkillPreview({
  meta,
  body,
  owner,
  repo,
  skillName,
  onLaunch,
}: {
  meta: SkillMeta;
  body: string;
  owner: string;
  repo: string;
  skillName: string;
  onLaunch: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="card p-8 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center text-3xl shrink-0">
            {meta.icon || "\u26A1"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              {meta.name || skillName}
            </h1>
            <div className="text-sm text-[var(--text-muted)] mb-3">
              by {owner}/{repo}
              {meta.version && (
                <span className="ml-2 text-[var(--text-tertiary)]">
                  v{meta.version}
                </span>
              )}
              {meta.installs && (
                <span className="ml-2">{meta.installs} installs</span>
              )}
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {meta.description}
            </p>
          </div>
        </div>
      </div>

      {body && (
        <div className="card p-8 mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Skill Documentation
          </h2>
          <div className="prose prose-sm max-w-none text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
            {body.slice(0, 2000)}
            {body.length > 2000 && (
              <span className="text-[var(--text-muted)]">
                ... ({Math.round(body.length / 1000)}K chars)
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onLaunch}
        className="w-full py-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-lg transition-all duration-200 hover:shadow-xl hover:shadow-[var(--accent)]/20 active:scale-[0.98] shadow-sm"
      >
        Configure & Launch
      </button>
    </div>
  );
}
