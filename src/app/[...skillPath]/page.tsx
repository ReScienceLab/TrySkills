"use client";

import { useState, useEffect, useMemo, useRef, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { SkillPreview } from "@/components/skill-preview";
import { ConfigPanel, type LaunchConfig } from "@/components/config-panel";
import { LaunchProgress } from "@/components/launch-progress";
import { SessionControl } from "@/components/session-control";
import { resolveSkillPath, fetchSkillContent, fetchSkillDirectory } from "@/lib/skill/resolver";
import { parseSkillFrontmatter } from "@/lib/skill/parser";
import { createHermesSandbox, destroySandbox } from "@/lib/sandbox/daytona";
import type { SandboxState, SandboxSession } from "@/lib/sandbox/types";

type AppPhase = "preview" | "config" | "launching" | "running";

const DEMO_SKILLS: Record<string, string> = {
  "anthropics/skills/frontend-design": `---
name: frontend-design
description: Guidelines for creating beautiful, modern web interfaces with attention to design principles, accessibility, and responsive layouts.
author: Anthropic
icon: "\uD83C\uDFA8"
version: "2.1.0"
---

# frontend-design

A comprehensive skill for creating production-quality web interfaces. This skill provides:

- **Design System Integration**: Apply consistent colors, typography, spacing, and component patterns
- **Responsive Layouts**: Mobile-first designs that adapt beautifully to any screen size
- **Accessibility (a11y)**: WCAG 2.1 AA compliance built into every component
- **Modern CSS**: Tailwind CSS, CSS Grid, Flexbox, and custom properties
- **Component Architecture**: Reusable, composable UI components

## Usage

Ask the agent to build any frontend — landing pages, dashboards, forms, data visualizations.
The skill automatically applies best practices for visual hierarchy, whitespace, and color theory.
`,
};

function Header({ owner, repo, skillName }: { owner: string; repo: string; skillName: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="TrySkills.sh" width={28} height={28} />
          <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
            tryskills<span className="text-[var(--accent)]">.sh</span>
          </span>
        </Link>
        <div className="font-mono text-xs text-[var(--text-muted)]">
          {owner}/{repo}/{skillName}
        </div>
      </div>
    </header>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-12 h-12 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin mb-6" />
      <div className="text-[var(--text-secondary)] text-sm">{message}</div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <div className="text-[var(--text-primary)] font-semibold mb-2">Failed to load skill</div>
      <div className="text-[var(--text-secondary)] text-sm mb-6 text-center max-w-md">{message}</div>
      <button onClick={onRetry} className="px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-all">
        Try again
      </button>
    </div>
  );
}

export default function SkillPage({
  params,
}: {
  params: Promise<{ skillPath: string[] }>;
}) {
  const resolvedParams = use(params);
  const { skillPath } = resolvedParams;

  const resolved = useMemo(() => resolveSkillPath(skillPath), [skillPath]);
  const { owner, repo, skillName } = resolved;
  const isValidPath = !!(owner && repo && skillName);

  const [phase, setPhase] = useState<AppPhase>("preview");
  const [loading, setLoading] = useState(isValidPath);
  const [fetchError, setFetchError] = useState<string | null>(
    isValidPath ? null : "Invalid skill path. Expected: /owner/repo/skill-name",
  );
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const launchConfigRef = useRef<LaunchConfig | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isValidPath) return;

    let cancelled = false;

    async function doFetch() {
      setLoading(true);
      setFetchError(null);
      try {
        const content = await fetchSkillContent(resolved);
        if (cancelled) return;
        if (content) {
          setSkillContent(content);
        } else {
          const skillKey = `${owner}/${repo}/${skillName}`;
          const demo = DEMO_SKILLS[skillKey];
          if (demo) {
            setSkillContent(demo);
          } else {
            throw new Error(`SKILL.md not found at ${owner}/${repo}/${skillName}`);
          }
        }
      } catch (err) {
        if (cancelled) return;
        const skillKey = `${owner}/${repo}/${skillName}`;
        const demo = DEMO_SKILLS[skillKey];
        if (demo) {
          setSkillContent(demo);
        } else {
          setFetchError(err instanceof Error ? err.message : "Failed to fetch SKILL.md");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    doFetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidPath, owner, repo, skillName, retryCount]);

  // Cleanup sandbox on page unload
  useEffect(() => {
    const cleanup = () => {
      if (session && launchConfigRef.current) {
        destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [session]);

  const handleLaunch = async (config: LaunchConfig) => {
    launchConfigRef.current = config;
    setPhase("launching");
    setSandboxState("creating");
    setSandboxError(undefined);

    try {
      const skillFiles = await fetchSkillDirectory(resolved);

      const result = await createHermesSandbox(
        {
          daytonaApiKey: config.sandboxKey,
          llmProvider: config.provider.id,
          llmApiKey: config.llmKey,
          llmModel: config.model,
        },
        skillName,
        skillFiles,
        (step) => setSandboxState(step as SandboxState),
      );

      setSession(result);
      setSandboxState("running");
      setPhase("running");

      // Auto-open webui in new window
      window.open(result.webuiUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setSandboxState("error");
      setSandboxError(err instanceof Error ? err.message : "Launch failed");
    }
  };

  const handleStop = async () => {
    if (session && launchConfigRef.current) {
      setSandboxState("cleaning");
      try {
        await destroySandbox(launchConfigRef.current.sandboxKey, session.sandboxId);
      } catch {
        // best effort cleanup
      }
    }
    setSession(null);
    setSandboxState("idle");
    setPhase("preview");
  };

  const handleRetryLaunch = () => {
    if (launchConfigRef.current) {
      handleLaunch(launchConfigRef.current);
    }
  };

  const parsed = skillContent
    ? parseSkillFrontmatter(skillContent)
    : { meta: { name: skillName, description: "" }, body: "" };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <Header owner={owner} repo={repo} skillName={skillName} />

      <div className="relative z-10 pt-24 pb-12 max-w-3xl mx-auto px-6">
        {loading && <LoadingState message="Fetching SKILL.md from GitHub..." />}

        {fetchError && <ErrorState message={fetchError} onRetry={() => setRetryCount((c) => c + 1)} />}

        {!loading && !fetchError && skillContent && phase === "preview" && (
          <SkillPreview
            meta={parsed.meta}
            body={parsed.body}
            owner={owner}
            repo={repo}
            skillName={skillName}
            onLaunch={() => setPhase("config")}
          />
        )}

        {!loading && !fetchError && phase === "config" && (
          <ConfigPanel
            onLaunch={handleLaunch}
            onBack={() => setPhase("preview")}
          />
        )}

        {phase === "launching" && (
          <LaunchProgress
            state={sandboxState}
            error={sandboxError}
            onRetry={handleRetryLaunch}
            onCancel={() => {
              handleStop();
              setPhase("config");
            }}
          />
        )}

        {phase === "running" && session && (
          <SessionControl
            webuiUrl={session.webuiUrl}
            startedAt={session.startedAt}
            onStop={handleStop}
          />
        )}
      </div>
    </main>
  );
}
