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
      <div className="border border-white/20 bg-black/40 p-8 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0">
            {meta.icon || "\u26A1"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white/90 mb-1">
              {meta.name || skillName}
            </h1>
            <div className="text-sm text-white/40 mb-3">
              by {owner}/{repo}
              {meta.version && (
                <span className="ml-2 text-white/30">
                  v{meta.version}
                </span>
              )}
              {meta.installs && (
                <span className="ml-2">{meta.installs} installs</span>
              )}
            </div>
            <p className="text-white/60 leading-relaxed">
              {meta.description}
            </p>
          </div>
        </div>
      </div>

      {body && (
        <div className="border border-white/20 bg-black/40 p-8 mb-6">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">
            Skill Documentation
          </h2>
          <div className="prose prose-sm max-w-none text-white/60 leading-relaxed whitespace-pre-wrap">
            {body.slice(0, 2000)}
            {body.length > 2000 && (
              <span className="text-white/30">
                ... ({Math.round(body.length / 1000)}K chars)
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onLaunch}
        className="w-full py-4 bg-white text-black font-semibold text-lg transition-all hover:bg-white/90 active:scale-[0.98]"
      >
        Configure &amp; Launch
      </button>
    </div>
  );
}
