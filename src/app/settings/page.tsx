"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderSection } from "@/components/provider-config";
import { EnvVarsEditor } from "@/components/env-vars-editor";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";

export default function SettingsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { config: savedConfig, loading, save, clear } = useKeyStore();

  if (!isLoaded || loading) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GlowMesh />
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center relative z-10 px-6">
          <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-white/90 mb-2">Sign in to manage settings</h2>
            <p className="text-sm text-white/50 mb-6">
              Your API keys will be encrypted and stored securely in your account.
            </p>
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
                Sign in with GitHub
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <SettingsForm
      key={savedConfig ? `${savedConfig.providerId}:${savedConfig.sandboxKey}` : "empty"}
      savedConfig={savedConfig}
      save={save}
      clear={clear}
    />
  );
}

function SettingsForm({
  savedConfig,
  save,
  clear,
}: {
  savedConfig: import("@/hooks/use-key-store").StoredConfig | null;
  save: (config: import("@/hooks/use-key-store").StoredConfig) => Promise<void>;
  clear: () => Promise<void>;
}) {
  const initialActiveId = savedConfig?.providerId ?? PROVIDERS[0].id;
  const initialProviderKeys = savedConfig?.providerKeys ?? (
    savedConfig?.llmKey ? { [savedConfig.providerId]: savedConfig.llmKey } : {}
  );
  const initialModels: Record<string, string> = {};
  for (const p of PROVIDERS) {
    initialModels[p.id] = p.id === savedConfig?.providerId
      ? savedConfig.model
      : p.models[0];
  }

  const [activeProviderId, setActiveProviderId] = useState(initialActiveId);
  const [expandedId, setExpandedId] = useState<string | null>(initialActiveId);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(initialProviderKeys);
  const [providerModels, setProviderModels] = useState<Record<string, string>>(initialModels);
  const [sandboxKey, setSandboxKey] = useState(savedConfig?.sandboxKey ?? "");
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [envVars, setEnvVars] = useState<Record<string, string>>(savedConfig?.envVars ?? {});
  const [saved, setSaved] = useState(false);

  const activeKey = providerKeys[activeProviderId] ?? "";
  const hasKeys = activeKey.length > 5 && sandboxKey.length > 5;

  const handleSave = async () => {
    await save({
      providerId: activeProviderId,
      model: providerModels[activeProviderId] ?? PROVIDERS.find(p => p.id === activeProviderId)!.models[0],
      llmKey: activeKey,
      sandboxKey,
      providerKeys,
      envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = async () => {
    await clear();
    setProviderKeys({});
    setProviderModels(Object.fromEntries(PROVIDERS.map(p => [p.id, p.models[0]])));
    setSandboxKey("");
    setEnvVars({});
    setActiveProviderId(PROVIDERS[0].id);
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />
      <SiteHeader />

      <div className="flex-1 flex items-center justify-center relative z-10 px-6 pt-20 pb-10">
        <div className="w-full max-w-[640px]">
          <h1 className="text-2xl font-semibold text-white/90 mb-8">Settings</h1>

          <div className="mb-6">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">LLM Providers</h2>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <ProviderSection
                  key={p.id}
                  provider={p}
                  isActive={activeProviderId === p.id}
                  isExpanded={expandedId === p.id}
                  onToggleActive={() => setActiveProviderId(p.id)}
                  onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  model={providerModels[p.id] ?? p.models[0]}
                  onModelChange={(m) => setProviderModels(prev => ({ ...prev, [p.id]: m }))}
                  apiKey={providerKeys[p.id] ?? ""}
                  onApiKeyChange={(k) => setProviderKeys(prev => ({ ...prev, [p.id]: k }))}
                />
              ))}
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
              <label htmlFor="settings-sandbox-key" className="block text-xs text-white/50 uppercase tracking-wider mb-2">
                Daytona API Key
                <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline normal-case tracking-normal">
                  Get a key &rarr;
                </a>
              </label>
              <div className="relative">
                <input
                  id="settings-sandbox-key"
                  type={showSandboxKey ? "text" : "password"}
                  value={sandboxKey}
                  onChange={(e) => setSandboxKey(e.target.value)}
                  placeholder="dtn_..."
                  className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
                />
                <button
                  onClick={() => setShowSandboxKey(!showSandboxKey)}
                  aria-label={showSandboxKey ? "Hide Daytona API key" : "Show Daytona API key"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
                >
                  {showSandboxKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className="border border-white/20 bg-black/40 backdrop-blur-sm mb-4">
            <div className="px-6 py-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white/90">Environment Variables</h2>
                <span className="text-xs text-white/30">For skills that need extra API keys</span>
              </div>
            </div>
            <div className="px-6 py-5">
              <EnvVarsEditor value={envVars} onChange={setEnvVars} />
            </div>
          </div>

          <div className="border border-green-500/20 bg-green-500/5 px-5 py-3 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-xs text-green-400/60">
                Keys are encrypted and saved to your account automatically
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!hasKeys}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                hasKeys
                  ? saved
                    ? "bg-green-500 text-white"
                    : "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {saved ? "Saved!" : "Save Settings"}
            </button>
            {savedConfig && (
              <button
                onClick={handleClear}
                className="px-6 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all"
              >
                Clear Keys
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
