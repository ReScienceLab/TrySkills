"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { parseSkillUrl } from "@/lib/skill/url-parser";
import { fetchSkillTree, type TreeNode } from "@/lib/skill/tree";
import { SkillTree } from "@/components/skill-tree";

const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
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
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "google",
    name: "Google AI",
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash"],
  },
];

interface GlowNode {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  brightness: number;
  targetBrightness: number;
  phase: number;
  speed: number;
  radius: number;
  drift: number;
}

function GlowMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GlowNode[]>([]);
  const maskRef = useRef<HTMLImageElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;

    const nodes: GlowNode[] = [];
    const count = 25;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      nodes.push({
        x,
        y,
        originX: x,
        originY: y,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        brightness: 0,
        targetBrightness: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.006,
        radius: 200 + Math.random() * 300,
        drift: 200 + Math.random() * 250,
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/bg.svg";
    img.onload = () => {
      maskRef.current = img;
    };
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      mouseRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    init();
    window.addEventListener("resize", init);

    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio;
      const time = Date.now() * 0.001;
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        const dxO = node.x - node.originX;
        const dyO = node.y - node.originY;
        const distO = Math.sqrt(dxO * dxO + dyO * dyO);
        if (distO > node.drift) {
          node.vx -= (dxO / distO) * 0.1;
          node.vy -= (dyO / distO) * 0.1;
        }
        node.vx += (Math.random() - 0.5) * 0.06;
        node.vy += (Math.random() - 0.5) * 0.06;
        const spd = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (spd > 2.2) {
          node.vx *= 2.2 / spd;
          node.vy *= 2.2 / spd;
        }

        node.targetBrightness =
          (Math.sin(time * node.speed * 60 + node.phase) + 1) * 0.5;
        node.brightness += (node.targetBrightness - node.brightness) * 0.015;
      }

      const connectionDist = 350 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha =
              (1 - dist / connectionDist) *
              Math.min(nodes[i].brightness, nodes[j].brightness) *
              0.25;
            if (alpha > 0.01) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.strokeStyle = `rgba(80, 160, 255, ${alpha})`;
              ctx.lineWidth = 1.5 * dpr;
              ctx.stroke();
            }
          }
        }
      }

      for (const node of nodes) {
        if (node.brightness > 0.03) {
          const r = node.radius * dpr;
          const gradient = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            r,
          );
          gradient.addColorStop(
            0,
            `rgba(80, 160, 255, ${node.brightness * 0.45})`,
          );
          gradient.addColorStop(
            0.3,
            `rgba(0, 100, 220, ${node.brightness * 0.2})`,
          );
          gradient.addColorStop(1, "rgba(0, 71, 171, 0)");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      const mouseRadius = 250 * dpr;
      const mouseGradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        mouseRadius,
      );
      mouseGradient.addColorStop(0, "rgba(100, 180, 255, 0.5)");
      mouseGradient.addColorStop(0.3, "rgba(60, 140, 255, 0.2)");
      mouseGradient.addColorStop(1, "rgba(0, 71, 171, 0)");
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouseRadius, 0, Math.PI * 2);
      ctx.fillStyle = mouseGradient;
      ctx.fill();

      if (maskRef.current) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(maskRef.current, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(rafRef.current);
    };
  }, [init]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="TrySkills.sh" width={28} height={28} />
          <span
            className="text-white/90 text-lg"
            style={{ fontFamily: "var(--font-bilbo)" }}
          >
            TrySkills.sh
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Skills
          </a>
          <a
            href="https://agentskills.io/specification"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Docs
          </a>
          <a
            href="https://github.com/ReScienceLab/TrySkills"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
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
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>

        <span className="text-sm text-white/30">ReScience Lab Inc.</span>
      </div>
    </footer>
  );
}

function getHomepageInitialConfig() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("tryskills-config");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ConfigPanel({
  skillUrl,
  onBack,
}: {
  skillUrl: string;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState(() => {
    const saved = getHomepageInitialConfig();
    if (saved?.providerId) {
      const p = PROVIDERS.find((p) => p.id === saved.providerId);
      if (p) return p;
    }
    return PROVIDERS[0];
  });
  const [model, setModel] = useState(() => {
    const saved = getHomepageInitialConfig();
    if (saved?.model) return saved.model;
    return PROVIDERS[0].models[0];
  });
  const [llmKey, setLlmKey] = useState(() => getHomepageInitialConfig()?.llmKey || "");
  const [sandboxKey, setSandboxKey] = useState(() => getHomepageInitialConfig()?.sandboxKey || "");
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
    }
  };

  const isReady = llmKey.length > 5 && sandboxKey.length > 5;

  const handleLaunch = () => {
    localStorage.setItem(
      "tryskills-config",
      JSON.stringify({
        providerId: provider.id,
        model,
        llmKey,
        sandboxKey,
      }),
    );
    const parsed = parseSkillUrl(skillUrl);
    if (!parsed) return;
    window.location.href = `${parsed}?launch=1`;
  };

  return (
    <div className="w-full max-w-[640px] animate-fade-in-up">
      <div className="border border-white/20 bg-black/40 backdrop-blur-sm">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-mono text-sm text-white/80 truncate flex-1 mr-4">
            {skillUrl}
          </div>
          <button
            onClick={onBack}
            className="text-xs text-white/40 hover:text-white/70 transition-colors shrink-0"
          >
            Change
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
              Provider
            </label>
            <div className="grid grid-cols-4 gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-3 py-2 text-xs font-medium transition-all ${
                    provider.id === p.id
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
            >
              {provider.models.map((m) => (
                <option key={m} value={m} className="bg-[#111] text-white">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
              LLM API Key
            </label>
            <div className="relative">
              <input
                type={showLlmKey ? "text" : "password"}
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder={`${provider.keyPrefix}...`}
                className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
              />
              <button
                onClick={() => setShowLlmKey(!showLlmKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
              >
                {showLlmKey ? "Hide" : "Show"}
              </button>
            </div>
            {!llmKey && (
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 px-3 py-2 bg-white/5 border border-dashed border-white/15 text-xs text-white/50 hover:text-white/80 hover:border-white/30 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Don&apos;t have one? Get your {provider.name} API key at{" "}
                <span className="text-white/70 underline underline-offset-2">
                  {provider.keyUrl.replace("https://", "")}
                </span>
              </a>
            )}
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
              Daytona Sandbox Key
            </label>
            <div className="relative">
              <input
                type={showSandboxKey ? "text" : "password"}
                value={sandboxKey}
                onChange={(e) => setSandboxKey(e.target.value)}
                placeholder="daytona-..."
                className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
              />
              <button
                onClick={() => setShowSandboxKey(!showSandboxKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
              >
                {showSandboxKey ? "Hide" : "Show"}
              </button>
            </div>
            {!sandboxKey && (
              <a
                href="https://app.daytona.io/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 px-3 py-2 bg-white/5 border border-dashed border-white/15 text-xs text-white/50 hover:text-white/80 hover:border-white/30 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Don&apos;t have one? Get a free Daytona API key at{" "}
                <span className="text-white/70 underline underline-offset-2">
                  app.daytona.io/dashboard/keys
                </span>
                <span className="ml-auto text-white/30">$200 free credits</span>
              </a>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={handleLaunch}
            disabled={!isReady}
            className={`w-full py-3 text-sm font-medium transition-all ${
              isReady
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {isReady ? "Launch Agent" : "Enter API keys to launch"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"input" | "tree" | "config">("input");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [parsedPath, setParsedPath] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[] | null>(null);
  const [treeResolvedPath, setTreeResolvedPath] = useState("");
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

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
    } catch {
      setTreeError("Failed to fetch skill structure. The skill may still work — proceed to configure.");
    } finally {
      setTreeLoading(false);
    }
  };

  const skillName = parsedPath?.split("/").filter(Boolean).slice(2).join("/") || "";

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />

      <Header />

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
              <input
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
                onClick={() => { setPhase("input"); setTreeData(null); setTreeError(null); }}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
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
              <div className="border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                <span className="text-xs text-yellow-400/80 font-mono">{treeError}</span>
              </div>
            ) : null}

            <button
              onClick={() => setPhase("config")}
              disabled={treeLoading}
              className={`w-full py-3 text-sm font-medium transition-all ${
                treeLoading
                  ? "bg-white/10 text-white/30 cursor-not-allowed"
                  : "bg-white text-black hover:bg-white/90"
              }`}
            >
              Configure & Launch
            </button>
          </div>
        ) : (
          <ConfigPanel skillUrl={url} onBack={() => setPhase("tree")} />
        )}
      </div>

      <Footer />
    </main>
  );
}
