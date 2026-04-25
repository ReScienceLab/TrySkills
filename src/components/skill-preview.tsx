"use client";

import type { SkillMeta } from "@/lib/skill/resolver";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/product-ui";

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
      <Surface className="mb-6 p-8">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.04] text-3xl shadow-[var(--shadow-border)]">
            {meta.icon || "\u26A1"}
          </div>
          <div className="flex-1">
            <h1 className="mb-1 text-2xl font-semibold text-foreground">
              {meta.name || skillName}
            </h1>
            <div className="mb-3 text-sm text-muted-foreground">
              by {owner}/{repo}
              {meta.version && (
                <span className="ml-2">
                  v{meta.version}
                </span>
              )}
              {meta.installs && (
                <span className="ml-2">{meta.installs} installs</span>
              )}
            </div>
            <p className="leading-relaxed text-muted-foreground">
              {meta.description}
            </p>
          </div>
        </div>
      </Surface>

      {body && (
        <Surface className="mb-6 p-8">
          <h2 className="mb-4 font-mono text-sm font-medium uppercase text-muted-foreground">
            Skill Documentation
          </h2>
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {body.slice(0, 2000)}
            {body.length > 2000 && (
              <span className="text-muted-foreground">
                ... ({Math.round(body.length / 1000)}K chars)
              </span>
            )}
          </div>
        </Surface>
      )}

      <Button
        type="button"
        onClick={onLaunch}
        className="h-12 w-full text-base"
      >
        Configure & Launch
      </Button>
    </div>
  );
}
