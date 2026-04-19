"use client";

import { useState } from "react";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { loadConfig, saveConfig, clearConfig } from "@/lib/key-store";

export interface LaunchConfig {
  provider: Provider;
  model: string;
  llmKey: string;
  sandboxKey: string;
}

function getInitialConfig() {
  if (typeof window === "undefined") {
    return { provider: PROVIDERS[0], model: PROVIDERS[0].models[0], llmKey: "", sandboxKey: "", remember: false };
  }
  const saved = loadConfig();
  if (!saved) {
    return { provider: PROVIDERS[0], model: PROVIDERS[0].models[0], llmKey: "", sandboxKey: "", remember: false };
  }
  const p = PROVIDERS.find((p) => p.id === saved.providerId) || PROVIDERS[0];
  return {
    provider: p,
    model: saved.model || p.models[0],
    llmKey: saved.llmKey || "",
    sandboxKey: saved.sandboxKey || "",
    remember: true,
  };
}

export function ConfigPanel({
  onLaunch,
  onBack,
}: {
  onLaunch: (config: LaunchConfig) => void;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(() => getInitialConfig().provider);
  const [model, setModel] = useState(() => getInitialConfig().model);
  const [llmKey, setLlmKey] = useState(() => getInitialConfig().llmKey);
  const [sandboxKey, setSandboxKey] = useState(() => getInitialConfig().sandboxKey);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [rememberKeys, setRememberKeys] = useState(() => getInitialConfig().remember);

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
    }
  };

  const handleLaunch = () => {
    if (rememberKeys) {
      saveConfig({
        providerId: provider.id,
        model,
        llmKey,
        sandboxKey,
      });
    } else {
      clearConfig();
    }
    onLaunch({ provider, model, llmKey, sandboxKey });
  };

  const isReady = llmKey.length > 5 && sandboxKey.length > 5;

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to preview
      </button>

      <div className="card p-8 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
          LLM Provider
        </h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Provider</label>
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
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-colors text-sm"
            >
              {provider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              API Key
              <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--accent)] hover:underline">
                Get a key &rarr;
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs"
              >
                {showLlmKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-8 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Sandbox</h2>
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">Daytona</div>
            <span className="text-xs text-[var(--text-muted)]">Free tier: $200 credits</span>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Daytona API Key
              <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--accent)] hover:underline">
                Get a key &rarr;
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs"
              >
                {showSandboxKey ? "Hide" : "Show"}
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
            <span className="text-sm text-[var(--text-primary)]">Remember my keys</span>
            <span className="block text-xs text-[var(--text-muted)]">
              Stored in localStorage &mdash; never sent to any server
            </span>
          </div>
        </label>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="text-sm text-[var(--text-secondary)]">
            Estimated cost per session:{" "}
            <span className="text-[var(--accent)] font-medium">~$0.02&ndash;0.10</span>
            <span className="text-[var(--text-muted)]"> depending on model and usage</span>
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
        {isReady ? "Launch Agent" : "Enter API keys to launch"}
      </button>
    </div>
  );
}
