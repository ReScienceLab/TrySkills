"use client";

import { useState } from "react";

const POPULAR_SKILLS = [
  {
    name: "frontend-design",
    owner: "anthropics",
    repo: "skills",
    description: "Guidelines for creating beautiful, modern web interfaces",
    installs: "311K",
  },
  {
    name: "code-review",
    owner: "anthropics",
    repo: "skills",
    description: "Thorough code review with security and performance focus",
    installs: "287K",
  },
  {
    name: "api-design",
    owner: "anthropics",
    repo: "skills",
    description: "RESTful and GraphQL API design best practices",
    installs: "198K",
  },
  {
    name: "testing",
    owner: "vercel",
    repo: "skills",
    description: "Comprehensive testing strategies and test generation",
    installs: "245K",
  },
  {
    name: "devops",
    owner: "vercel",
    repo: "skills",
    description: "CI/CD pipelines, Docker, and infrastructure automation",
    installs: "176K",
  },
  {
    name: "documentation",
    owner: "anthropics",
    repo: "skills",
    description: "Technical writing and documentation generation",
    installs: "152K",
  },
];

const PROVIDERS = [
  { name: "OpenRouter", models: "200+", color: "#8b5cf6" },
  { name: "Anthropic", models: "Claude", color: "#d97706" },
  { name: "OpenAI", models: "GPT", color: "#10a37f" },
  { name: "Google AI", models: "Gemini", color: "#4285f4" },
];

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="font-semibold text-[var(--text-primary)] tracking-tight text-[15px]">
            tryskills<span className="text-[var(--accent)]">.sh</span>
          </span>
        </a>
        <nav className="flex items-center gap-1">
          {[
            { label: "Docs", href: "https://agentskills.io/specification" },
            { label: "Skills", href: "https://skills.sh" },
            { label: "GitHub", href: "https://github.com/anthropics/tryskills.sh" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 px-4 py-1.5 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-md transition-colors"
          >
            Browse Skills
          </a>
        </nav>
      </div>
    </header>
  );
}

function UrlDemo() {
  const [active, setActive] = useState(false);

  return (
    <div
      className="animate-fade-in-up delay-300 mt-14 max-w-2xl mx-auto"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-code)] shadow-2xl shadow-black/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white/5 rounded-md px-4 py-1 text-sm font-mono text-white/60 flex items-center gap-1.5">
              <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                <span className={`transition-all duration-500 ${active ? "text-[var(--accent-muted)] font-medium" : "text-transparent w-0"}`}>
                  {active ? "try" : ""}
                </span>
                <span className="text-white/70">skills.sh</span>
                <span className="text-white/40">/anthropics/skills/frontend-design</span>
              </span>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className={`transition-all duration-500 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#8b5cf6] flex items-center justify-center text-lg">
                🎨
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">frontend-design</div>
                <div className="text-xs text-white/40">anthropics/skills · 311K installs</div>
              </div>
              <div className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium">
                Launch ▶
              </div>
            </div>
          </div>
          <div className={`transition-all duration-500 ${active ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"}`}>
            <div className="text-center text-sm text-white/30 py-1 select-none">
              hover to preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "Find a skill",
      desc: "Browse 1,400+ agent skills on skills.sh or GitHub.",
      mono: "skills.sh/anthropics/skills/frontend-design",
    },
    {
      num: "2",
      title: "Change the URL",
      desc: "Add \"try\" before skills.sh — one word, that's it.",
      mono: "tryskills.sh/anthropics/skills/frontend-design",
    },
    {
      num: "3",
      title: "Enter your keys",
      desc: "Your own LLM + sandbox API keys. They never leave the browser.",
      mono: "Keys stored in localStorage only",
    },
    {
      num: "4",
      title: "Chat with the agent",
      desc: "Live session in a cloud sandbox with the skill loaded.",
      mono: "hermes agent → :8642 → streaming",
    },
  ];

  return (
    <section className="py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
            How it works
          </h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            From discovery to a live agent session in under 30 seconds.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, i) => (
            <div key={step.num} className={`animate-fade-in-up delay-${(i + 1) * 100}`}>
              <div className="card p-6 h-full">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center text-sm font-bold mb-4">
                  {step.num}
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                  {step.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">
                  {step.desc}
                </p>
                <div className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-md inline-block">
                  {step.mono}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
      title: "Zero infrastructure",
      desc: "Pure client-side static app. Deploy on Vercel or Cloudflare Pages for free.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
      title: "Your keys, your control",
      desc: "API keys never leave your browser. All calls go directly from sandbox to provider.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>,
      title: "Cloud sandbox",
      desc: "Skills run in isolated Daytona sandboxes. Auto-cleanup. Nothing touches your machine.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
      title: "Open source",
      desc: "MIT licensed. Every line is auditable. Run locally with npm run dev.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
      title: "URL is the product",
      desc: "No accounts, no sign-ups. Just change the URL prefix and you're in.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>,
      title: "Any model, any provider",
      desc: "OpenRouter, Anthropic, OpenAI, Google AI — 200+ models to choose from.",
    },
  ];

  return (
    <section className="py-28 bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
            Built different
          </h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            Zero cost, zero trust, zero friction.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={f.title} className={`animate-fade-in-up delay-${(i + 1) * 100}`}>
              <div className="card p-6 h-full bg-white">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                  {f.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SkillGrid() {
  return (
    <section className="py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
            Popular skills
          </h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            1,400+ skills and growing. Try any of them instantly.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {POPULAR_SKILLS.map((skill, i) => (
            <a
              key={skill.name}
              href={`/${skill.owner}/${skill.repo}/${skill.name}`}
              className={`animate-fade-in-up delay-${(i + 1) * 100} group block`}
            >
              <div className="card p-5 h-full">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors mb-0.5">
                      {skill.name}
                    </h3>
                    <div className="text-xs text-[var(--text-muted)] mb-2">
                      {skill.owner}/{skill.repo} · {skill.installs} installs
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {skill.description}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </a>
          ))}
        </div>
        <div className="text-center mt-10">
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors text-sm font-medium"
          >
            Browse all skills on skills.sh
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

function UrlInput() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    let path = url;
    if (path.startsWith("https://skills.sh/")) path = path.replace("https://skills.sh/", "");
    else if (path.startsWith("skills.sh/")) path = path.replace("skills.sh/", "");
    else if (path.startsWith("https://github.com/")) path = path.replace("https://github.com/", "").replace("/tree/main/", "/");
    if (path) window.location.href = `/${path}`;
  };

  return (
    <section className="py-28 bg-[var(--bg-secondary)]">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
          Try any skill
        </h2>
        <p className="text-[var(--text-secondary)] mb-8">
          Paste a skills.sh URL or GitHub link
        </p>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-xl p-1.5 shadow-sm focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="skills.sh/owner/repo/skill-name"
              className="flex-1 bg-transparent px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none font-mono text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm transition-colors shrink-0"
            >
              Try it
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Providers() {
  return (
    <section className="py-16 border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium mb-8">
          Bring your own key from any provider
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {PROVIDERS.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5 text-[var(--text-tertiary)]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{p.models}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section className="py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
            Architecture
          </h2>
          <p className="text-[var(--text-secondary)]">
            Pure client-side. Your keys never touch our servers.
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-code)] p-8 max-w-3xl mx-auto font-mono text-sm shadow-xl">
          <pre className="text-blue-300/80 leading-loose overflow-x-auto">
{`┌─────────────────────────────────────────────────────┐
│                  BROWSER (all logic)                │
│                                                     │
│  URL Router → Config Panel → Sandbox → Chat UI      │
│  parse path   keys, model   Daytona    OpenAI       │
│  skill.sh→GH  localStorage  SDK        compat       │
└──────┬──────────────────────┬──────────────┬────────┘
       │                      │              │
       ▼                      ▼              ▼
 ┌───────────┐        ┌─────────────┐  ┌──────────┐
 │  GitHub   │        │  Daytona    │  │ Sandbox  │
 │  Raw API  │        │  API        │  │          │
 │           │        │ (your key)  │  │ hermes   │──→ LLM API
 │ SKILL.md  │        └─────────────┘  │ :8642    │  (your key)
 └───────────┘                         └──────────┘`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-28 bg-[var(--footer-bg)] text-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold mb-4 leading-tight">
          Stop installing.
          <br />
          Start trying.
        </h2>
        <p className="text-blue-100 mb-10 max-w-lg mx-auto text-lg">
          Add <code className="font-mono font-semibold text-white bg-white/10 px-2 py-0.5 rounded">try</code> to any skills.sh URL and launch a live agent session in seconds.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3 rounded-lg bg-white text-[var(--accent-hover)] font-semibold text-sm hover:bg-blue-50 transition-colors"
          >
            Browse Skills
          </a>
          <a
            href="https://github.com/anthropics/tryskills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3 rounded-lg bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="text-sm text-[var(--text-muted)]">
          tryskills.sh — MIT License
        </div>
        <div className="flex items-center gap-5 text-sm text-[var(--text-muted)]">
          <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-secondary)] transition-colors">
            Agent Skills Spec
          </a>
          <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-secondary)] transition-colors">
            skills.sh
          </a>
          <a href="https://github.com/anthropics/tryskills.sh" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-secondary)] transition-colors">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      <Header />

      {/* Hero */}
      <section className="pt-36 pb-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[var(--accent)] opacity-[0.03] blur-[120px] rounded-full" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="animate-fade-in mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-xs text-[var(--accent)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Open source · MIT · 1,400+ skills
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-5 animate-fade-in-up delay-100 leading-[1.1] text-[var(--text-primary)]">
            One URL prefix to{" "}
            <span className="text-gradient-blue">try any skill</span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto animate-fade-in-up delay-200 leading-relaxed">
            Add{" "}
            <code className="font-mono font-medium text-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded text-[15px]">try</code>
            {" "}before{" "}
            <code className="font-mono text-[var(--text-tertiary)]">skills.sh</code>
            {" "}and instantly launch a live agent session — powered by your own API keys, running in a cloud sandbox.
          </p>

          <UrlDemo />
        </div>
      </section>

      <HowItWorks />
      <Features />
      <SkillGrid />
      <UrlInput />
      <Providers />
      <Architecture />
      <CTA />
      <Footer />
    </main>
  );
}
