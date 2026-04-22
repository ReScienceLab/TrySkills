"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderTabs, ModelSelector, ApiKeyInput } from "@/components/provider-config";

export interface LaunchConfig {
  provider: Provider;
  model: string;
  llmKey: string;
  sandboxKey: string;
  envVars?: Record<string, string>;
}

export function ConfigPanel({
  onLaunch,
  onBack,
}: {
  onLaunch: (config: LaunchConfig) => void;
  onBack: () => void;
}) {
  const { config: savedConfig, loading, save } = useKeyStore();

  const configKey = useMemo(
    () =>
      savedConfig
        ? `${savedConfig.providerId}:${savedConfig.model}:${savedConfig.llmKey}:${savedConfig.sandboxKey}`
        : "empty",
    [savedConfig],
  );

  const initialProvider = useMemo(() => {
    if (!savedConfig) return PROVIDERS[0];
    return PROVIDERS.find((p) => p.id === savedConfig.providerId) || PROVIDERS[0];
  }, [savedConfig]);

  const initialModel = useMemo(
    () => (savedConfig?.model ? savedConfig.model : initialProvider.models[0]),
    [savedConfig, initialProvider],
  );

  const initialProviderKeys = useMemo(() => {
    return savedConfig?.providerKeys ?? (
      savedConfig?.llmKey ? { [savedConfig.providerId]: savedConfig.llmKey } : {}
    );
  }, [savedConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
      </div>
    );
  }

  return (
    <ConfigPanelForm
      key={configKey}
      initialProvider={initialProvider}
      initialModel={initialModel}
      initialProviderKeys={initialProviderKeys}
      initialSandboxKey={savedConfig?.sandboxKey ?? ""}
      initialEnvVars={savedConfig?.envVars}
      save={save}
      onLaunch={onLaunch}
      onBack={onBack}
    />
  );
}

function ConfigPanelForm({
  initialProvider,
  initialModel,
  initialProviderKeys,
  initialSandboxKey,
  initialEnvVars,
  save,
  onLaunch,
  onBack,
}: {
  initialProvider: Provider;
  initialModel: string;
  initialProviderKeys: Record<string, string>;
  initialSandboxKey: string;
  initialEnvVars?: Record<string, string>;
  save: (config: import("@/hooks/use-key-store").StoredConfig) => Promise<void>;
  onLaunch: (config: LaunchConfig) => void;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(initialProviderKeys);
  const [sandboxKey, setSandboxKey] = useState(initialSandboxKey);
  const [showSandboxKey, setShowSandboxKey] = useState(false);

  const llmKey = providerKeys[provider.id] ?? "";

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
    }
  };

  const handleLaunch = async () => {
    await save({
      providerId: provider.id,
      model,
      llmKey,
      sandboxKey,
      providerKeys,
    });
    onLaunch({ provider, model, llmKey, sandboxKey, envVars: initialEnvVars });
  };

  const isReady = llmKey.length > 5 && sandboxKey.length > 5;

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        aria-label="Go back"
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
            <label htmlFor="provider-select" className="block text-xs text-white/50 uppercase tracking-wider mb-2">Provider</label>
            <ProviderTabs activeId={provider.id} onChange={handleProviderChange} />
          </div>

          <div>
            <label htmlFor="model-select" className="block text-xs text-white/50 uppercase tracking-wider mb-2">Model</label>
            <ModelSelector provider={provider} value={model} onChange={setModel} />
          </div>

          <ApiKeyInput
            provider={provider}
            value={llmKey}
            onChange={(k) => setProviderKeys(prev => ({ ...prev, [provider.id]: k }))}
          />
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
          <label htmlFor="sandbox-key-input" className="block text-xs text-white/50 uppercase tracking-wider mb-2">
            Daytona API Key
            <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline normal-case tracking-normal">
              Get a key &rarr;
            </a>
          </label>
          <div className="relative">
            <input
              id="sandbox-key-input"
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

      {initialEnvVars && Object.keys(initialEnvVars).length > 0 && (
        <div className="border border-white/10 bg-white/[0.03] px-5 py-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L6.75 2.906" />
              </svg>
              <span className="text-xs text-white/50">
                {Object.keys(initialEnvVars).length} env variable{Object.keys(initialEnvVars).length !== 1 ? "s" : ""} configured
              </span>
            </div>
            <Link href="/settings" className="text-xs text-blue-400 hover:underline">Manage</Link>
          </div>
        </div>
      )}

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
