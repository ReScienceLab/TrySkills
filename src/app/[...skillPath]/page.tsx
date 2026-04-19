"use client";

import { useState, useEffect, useRef, use } from "react";

interface SkillMeta {
  name: string;
  description: string;
  author?: string;
  icon?: string;
  version?: string;
  installs?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolActivity?: string;
}

type SandboxState = "idle" | "creating" | "running" | "error";
type AppPhase = "preview" | "config" | "session";

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
- **Performance**: Optimized rendering, lazy loading, and code splitting
- **Animation**: Subtle, purposeful micro-interactions using CSS transitions and Framer Motion

## Usage

Ask the agent to build any frontend — landing pages, dashboards, forms, data visualizations.
The skill automatically applies best practices for visual hierarchy, whitespace, and color theory.
`,
  "anthropics/skills/code-review": `---
name: code-review
description: Thorough code review with security and performance focus, following industry best practices.
author: Anthropic
icon: "\uD83D\uDD0D"
version: "1.8.0"
---

# code-review

Automated code review that catches bugs, security vulnerabilities, and performance issues before they ship.
`,
  "vercel/skills/testing": `---
name: testing
description: Comprehensive testing strategies and test generation for modern applications.
author: Vercel
icon: "\u2705"
version: "3.0.1"
---

# testing

Generate unit tests, integration tests, and e2e tests with intelligent coverage analysis.
`,
};

const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      "anthropic/claude-sonnet-4",
      "anthropic/claude-haiku-4",
      "openai/gpt-4o",
      "google/gemini-2.0-flash",
      "meta-llama/llama-3.3-70b",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    base: "https://api.anthropic.com/v1",
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"],
  },
  {
    id: "openai",
    name: "OpenAI",
    base: "https://api.openai.com/v1",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "google",
    name: "Google AI",
    base: "https://generativelanguage.googleapis.com/v1beta",
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash"],
  },
];

function parseSkillFrontmatter(content: string): {
  meta: SkillMeta;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: { name: "Unknown Skill", description: content.slice(0, 200) },
      body: content,
    };
  }

  const frontmatter = match[1];
  const body = match[2];
  const meta: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      meta[key] = val;
    }
  }

  return {
    meta: {
      name: meta.name || "Unknown Skill",
      description: meta.description || "",
      author: meta.author,
      icon: meta.icon,
      version: meta.version,
    },
    body,
  };
}

function SkillPreview({
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
            {meta.icon || "⚡"}
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
        Configure & Launch ▶
      </button>
    </div>
  );
}

function ConfigPanel({
  onLaunch,
  onBack,
}: {
  onLaunch: () => void;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [model, setModel] = useState(PROVIDERS[0].models[0]);
  const [llmKey, setLlmKey] = useState("");
  const [sandboxKey, setSandboxKey] = useState("");
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [rememberKeys, setRememberKeys] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tryskills-config");
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.providerId) {
          const p = PROVIDERS.find((p) => p.id === config.providerId);
          if (p) {
            setProvider(p);
            setModel(config.model || p.models[0]);
          }
        }
        if (config.llmKey) setLlmKey(config.llmKey);
        if (config.sandboxKey) setSandboxKey(config.sandboxKey);
        setRememberKeys(true);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
    }
  };

  const handleLaunch = () => {
    if (rememberKeys) {
      localStorage.setItem(
        "tryskills-config",
        JSON.stringify({
          providerId: provider.id,
          model,
          llmKey,
          sandboxKey,
        }),
      );
    } else {
      localStorage.removeItem("tryskills-config");
    }
    onLaunch();
  };

  const isReady = llmKey.length > 5 && sandboxKey.length > 5;

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to preview
      </button>

      <div className="card p-8 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
          LLM Provider
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    provider.id === p.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-colors text-sm"
            >
              {provider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              API Key
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[var(--accent)] hover:underline"
              >
                Get a key →
              </a>
            </label>
            <div className="relative">
              <input
                type={showLlmKey ? "text" : "password"}
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder={`${provider.keyPrefix}...`}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-colors font-mono text-sm"
              />
              <button
                onClick={() => setShowLlmKey(!showLlmKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showLlmKey ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-8 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
          Sandbox
        </h2>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">
                Daytona
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                Free tier: 100 sandbox-hours/month
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Daytona API Key
              <a
                href="https://app.daytona.io"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[var(--accent)] hover:underline"
              >
                Get a key →
              </a>
            </label>
            <div className="relative">
              <input
                type={showSandboxKey ? "text" : "password"}
                value={sandboxKey}
                onChange={(e) => setSandboxKey(e.target.value)}
                placeholder="daytona-..."
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-colors font-mono text-sm"
              />
              <button
                onClick={() => setShowSandboxKey(!showSandboxKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showSandboxKey ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberKeys}
            onChange={(e) => setRememberKeys(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)] rounded"
          />
          <div>
            <span className="text-sm text-[var(--text-primary)]">
              Remember my keys
            </span>
            <span className="block text-xs text-[var(--text-muted)]">
              Stored in localStorage — never sent to any server
            </span>
          </div>
        </label>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-[var(--text-muted)] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-[var(--text-secondary)]">
            Estimated cost per session:{" "}
            <span className="text-[var(--accent)] font-medium">
              ~$0.02–0.10
            </span>
            <span className="text-[var(--text-muted)]">
              {" "}
              depending on model and usage
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLaunch}
        disabled={!isReady}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 active:scale-[0.98] ${
          isReady
            ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white hover:shadow-xl hover:shadow-[var(--accent)]/20 shadow-sm"
            : "bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed"
        }`}
      >
        {isReady ? "Launch Agent ▶" : "Enter API keys to launch"}
      </button>
    </div>
  );
}

function ChatInterface({
  skillName,
  onStop,
}: {
  skillName: string;
  sandboxState: SandboxState;
  onStop: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `I've loaded the **${skillName}** skill. I can help you with anything this skill covers. What would you like to work on?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content:
          "This is a demo of the chat interface. In production, this would stream responses from the Hermes agent running in your Daytona sandbox, powered by your selected LLM provider and model.",
        timestamp: new Date(),
        toolActivity: "sandbox: hermes gateway → LLM API → streaming response",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(false);
    }, 1500);
  };

  const tokenEstimate = messages.reduce(
    (acc, m) => acc + Math.ceil(m.content.length / 4),
    0,
  );

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
              {msg.toolActivity && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono flex items-center gap-2">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  {msg.toolActivity}
                </div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="card px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span
                    className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"
                    style={{ animationDelay: "200ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"
                    style={{ animationDelay: "400ms" }}
                  />
                </div>
                Agent is thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center gap-3 mb-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
            Running
          </span>
          <span>{formatTime(sessionTime)}</span>
          <span>{tokenEstimate.toLocaleString()} tokens</span>
          <span className="ml-auto">
            ~${(tokenEstimate * 0.000003).toFixed(4)}
          </span>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 card">
            <div className="flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder="Send a message..."
                className="flex-1 bg-transparent px-5 py-3.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none text-sm"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="px-4 py-2 mr-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
          <button
            onClick={onStop}
            className="px-5 py-3.5 rounded-xl bg-[var(--error)]/20 text-[var(--error)] hover:bg-[var(--error)]/30 transition-colors text-sm font-medium shrink-0"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
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

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-[var(--error)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <div className="text-[var(--text-primary)] font-semibold mb-2">
        Failed to load skill
      </div>
      <div className="text-[var(--text-secondary)] text-sm mb-6 text-center max-w-md">
        {message}
      </div>
      <button
        onClick={onRetry}
        className="px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-all"
      >
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

  const [phase, setPhase] = useState<AppPhase>("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [sandboxState, setSandboxState] = useState<SandboxState>("idle");

  const owner = skillPath[0] || "";
  const repo = skillPath[1] || "";
  const skillName = skillPath.slice(2).join("/") || "";

  const fetchSkill = async () => {
    setLoading(true);
    setError(null);

    const skillKey = `${owner}/${repo}/${skillName}`;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillName}/SKILL.md`;

    try {
      const res = await fetch(rawUrl);
      if (!res.ok) {
        const demo = DEMO_SKILLS[skillKey];
        if (demo) {
          setSkillContent(demo);
          return;
        }
        throw new Error(
          res.status === 404
            ? `SKILL.md not found at ${owner}/${repo}/${skillName}`
            : `GitHub returned ${res.status}`,
        );
      }
      const text = await res.text();
      setSkillContent(text);
    } catch (err) {
      const demo = DEMO_SKILLS[skillKey];
      if (demo) {
        setSkillContent(demo);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch SKILL.md");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (owner && repo && skillName) {
      fetchSkill();
    } else {
      setLoading(false);
      setError("Invalid skill path. Expected: /owner/repo/skill-name");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, skillName]);

  const handleLaunchSession = () => {
    setSandboxState("creating");
    setTimeout(() => {
      setSandboxState("running");
      setPhase("session");
    }, 2000);
  };

  const handleStop = () => {
    setSandboxState("idle");
    setPhase("preview");
  };

  const parsed = skillContent
    ? parseSkillFrontmatter(skillContent)
    : { meta: { name: skillName, description: "" }, body: "" };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
              tryskills<span className="text-[var(--accent)]">.sh</span>
            </span>
          </a>
          <div className="font-mono text-xs text-[var(--text-muted)]">
            {owner}/{repo}/{skillName}
          </div>
        </div>
      </header>

      <div className="relative z-10 pt-24 pb-12 max-w-3xl mx-auto px-6">
        {loading && <LoadingState message="Fetching SKILL.md from GitHub..." />}

        {error && <ErrorState message={error} onRetry={fetchSkill} />}

        {!loading && !error && skillContent && phase === "preview" && (
          <SkillPreview
            meta={parsed.meta}
            body={parsed.body}
            owner={owner}
            repo={repo}
            skillName={skillName}
            onLaunch={() => setPhase("config")}
          />
        )}

        {!loading && !error && phase === "config" && (
          <ConfigPanel
            onLaunch={handleLaunchSession}
            onBack={() => setPhase("preview")}
          />
        )}

        {phase === "session" && sandboxState === "creating" && (
          <LoadingState message="Creating sandbox... Installing Hermes agent..." />
        )}

        {phase === "session" && sandboxState === "running" && (
          <ChatInterface
            skillName={parsed.meta.name || skillName}
            sandboxState={sandboxState}
            onStop={handleStop}
          />
        )}
      </div>
    </main>
  );
}
