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
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      <div className="border border-white/20 bg-black/40 backdrop-blur-sm mb-4">
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white/90">LLM Provider</h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Provider</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
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
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
            >
              {provider.models.map((m) => (
                <option key={m} value={m} className="bg-[#111] text-white">{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
              API Key
              <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline normal-case tracking-normal">
                Get a key &rarr;
              </a>
            </label>
            <div className="relative">
              <input
                type={showLlmKey ? "text" : "password"}
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder={`${provider.keyPrefix}...`}
                className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
              />
              <button
                onClick={() => setShowLlmKey(!showLlmKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
              >
                {showLlmKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-white/20 bg-black/40 backdrop-blur-sm mb-4">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white/90">Sandbox</h2>
            <span className="text-xs text-white/30">Daytona &middot; $200 free credits</span>
          </div>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
            Daytona API Key
            <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline normal-case tracking-normal">
              Get a key &rarr;
            </a>
          </label>
          <div className="relative">
            <input
              type={showSandboxKey ? "text" : "password"}
              value={sandboxKey}
              onChange={(e) => setSandboxKey(e.target.value)}
              placeholder="daytona-..."
              className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
            />
            <button
              onClick={() => setShowSandboxKey(!showSandboxKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
            >
              {showSandboxKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-black/20 px-5 py-3 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberKeys}
            onChange={(e) => setRememberKeys(e.target.checked)}
            className="w-4 h-4 accent-blue-500 rounded"
          />
          <div>
            <span className="text-sm text-white/70">Remember my keys</span>
            <span className="block text-xs text-white/30">
              Stored in localStorage &mdash; never sent to any server
            </span>
          </div>
        </label>
      </div>

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
  );
}
