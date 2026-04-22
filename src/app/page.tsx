"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { parseSkillUrl } from "@/lib/skill/url-parser";
import { fetchSkillTree, type TreeNode } from "@/lib/skill/tree";
import { SkillTree } from "@/components/skill-tree";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";
import { GitHubRateLimitError } from "@/lib/github-fetch";

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <nav aria-label="Footer links" className="flex items-center gap-6">
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
            Browse Skills
          </a>
          <a
            href="https://agentskills.io/specification"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            Specification
          </a>
          <a
            href="https://github.com/ReScienceLab/TrySkills"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </nav>

        <span className="text-sm text-white/30">ReScience Lab Inc.</span>
      </div>
    </footer>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"input" | "tree">("input");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [parsedPath, setParsedPath] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[] | null>(null);
  const [treeResolvedPath, setTreeResolvedPath] = useState("");
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setUrlError(null);

    const parsed = parseSkillUrl(url);
    if (!parsed) {
      setUrlError(
        "Invalid URL. Supported formats: skills.sh/owner/repo/skill, GitHub tree URL, or owner/repo/skill",
      );
      return;
    }
    setParsedPath(parsed);

    const segments = parsed.split("/").filter(Boolean);
    const owner = segments[0];
    const repo = segments[1];
    const skillName = segments.slice(2).join("/");

    setPhase("tree");
    setTreeLoading(true);
    setTreeError(null);
    setTreeData(null);

    try {
      const result = await fetchSkillTree(owner, repo, skillName);
      if (result) {
        setTreeData(result.tree);
        setTreeResolvedPath(result.resolvedPath);
      } else {
        setTreeError("Could not find skill directory in repository. The skill may still work — proceed to configure.");
      }
    } catch (err) {
      if (err instanceof GitHubRateLimitError) {
        setIsRateLimited(true);
        setTreeError(err.message);
      } else {
        setTreeError("Failed to fetch skill structure. The skill may still work — proceed to configure.");
      }
    } finally {
      setTreeLoading(false);
    }
  };

  const skillName = parsedPath?.split("/").filter(Boolean).slice(2).join("/") || "";

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />

      <SiteHeader />

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <h1
          className="text-white text-[80px] md:text-[100px] lg:text-[120px] leading-none mb-6 animate-fade-in"
          style={{ fontFamily: "var(--font-bilbo)" }}
        >
          TrySkills.sh
        </h1>

        <div className="flex items-center gap-4 mb-10 animate-fade-in-up delay-200">
          <p className="font-mono text-white/70 text-sm md:text-base tracking-wider">
            One URL to try any agent skill.
          </p>
          <a
            href="https://hermes-agent.nousresearch.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            powered by
            <Image
              src="/nousresearch.svg"
              alt="Hermes Agent"
              width={14}
              height={14}
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </a>
        </div>

        {phase === "input" ? (
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-[640px] animate-fade-in-up delay-300"
          >
            <div className="flex items-center bg-white overflow-hidden shadow-2xl shadow-black/30">
              <label htmlFor="skill-url-input" className="sr-only">Skill URL</label>
              <input
                id="skill-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://skills.sh/owner/repo/skill-name"
                className="flex-1 px-5 py-3.5 text-[#111] text-sm font-mono bg-transparent outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="px-5 py-3.5 bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] transition-colors shrink-0"
              >
                Configure
              </button>
            </div>
            {urlError && (
              <div className="mt-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {urlError}
              </div>
            )}
          </form>
        ) : phase === "tree" ? (
          <div className="w-full max-w-[640px] animate-fade-in-up space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setPhase("input"); setTreeData(null); setTreeError(null); setIsRateLimited(false); }}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                aria-label="Go back and change URL"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Change URL
              </button>
              <span className="font-mono text-xs text-white/30 truncate ml-4">
                {url}
              </span>
            </div>

            {treeLoading ? (
              <div className="border border-white/10 bg-white/[0.02] px-6 py-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin mb-4" />
                <span className="text-sm text-white/40">Fetching skill structure...</span>
              </div>
            ) : treeData ? (
              <SkillTree tree={treeData} skillName={skillName} resolvedPath={treeResolvedPath} />
            ) : treeError ? (
              <div className={`border px-4 py-3 ${isRateLimited ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/20 bg-yellow-500/5"}`}>
                <span className={`text-xs font-mono ${isRateLimited ? "text-red-400" : "text-yellow-400/80"}`}>{treeError}</span>
                {isRateLimited && !isSignedIn && (
                  <div className="mt-3 flex items-center gap-3">
                    <SignInButton mode="modal">
                      <button className="px-3 py-1.5 bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors">
                        Sign in with GitHub
                      </button>
                    </SignInButton>
                    <span className="text-xs text-white/30">to increase API limits</span>
                  </div>
                )}
                {isRateLimited && isSignedIn && (
                  <div className="mt-2">
                    <span className="text-xs text-white/40">
                      Please wait a few minutes and try again.
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {!authLoaded ? (
              <button
                disabled
                className="w-full py-3 text-sm font-medium bg-white/10 text-white/30 cursor-not-allowed transition-all"
              >
                Loading...
              </button>
            ) : isSignedIn ? (
              <button
                onClick={() => {
                  if (parsedPath) window.location.href = parsedPath;
                }}
                disabled={treeLoading || !parsedPath}
                className={`w-full py-3 text-sm font-medium transition-all ${
                  treeLoading || !parsedPath
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                Configure & Launch
              </button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl={parsedPath || "/"}>
                <button
                  disabled={treeLoading}
                  className={`w-full py-3 text-sm font-medium transition-all ${
                    treeLoading
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-white text-black hover:bg-white/90"
                  }`}
                >
                  Sign in to Configure & Launch
                </button>
              </SignInButton>
            )}
          </div>
        ) : null}
      </div>

      <Footer />
    </main>
  );
}
