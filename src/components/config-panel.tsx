"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Server, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderTabs, ModelSelector, ApiKeyInput } from "@/components/provider-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, Surface } from "@/components/product-ui";

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
        <div className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
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
      envVars: initialEnvVars,
    });
    onLaunch({ provider, model, llmKey, sandboxKey, envVars: initialEnvVars });
  };

  const isReady = llmKey.length > 5 && sandboxKey.length > 5;

  return (
    <div className="animate-fade-in">
      <Button onClick={onBack} aria-label="Go back" variant="ghost" size="sm" className="mb-6">
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <Surface className="mb-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <span className="flex size-8 items-center justify-center rounded-[6px] bg-white/[0.04] shadow-[var(--shadow-border)]">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">LLM Provider</h2>
            <p className="text-xs text-muted-foreground">Choose the model that powers the agent.</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label htmlFor="provider-select" className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">Provider</label>
            <ProviderTabs activeId={provider.id} onChange={handleProviderChange} />
          </div>

          <div>
            <label htmlFor="model-select" className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">Model</label>
            <ModelSelector provider={provider} value={model} onChange={setModel} />
          </div>

          <ApiKeyInput
            provider={provider}
            value={llmKey}
            onChange={(k) => setProviderKeys(prev => ({ ...prev, [provider.id]: k }))}
          />
        </div>
      </Surface>

      <Surface className="mb-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <span className="flex size-8 items-center justify-center rounded-[6px] bg-white/[0.04] shadow-[var(--shadow-border)]">
            <Server className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Sandbox</h2>
              <StatusBadge tone="neutral">Daytona</StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">$200 free credits available from Daytona.</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <label htmlFor="sandbox-key-input" className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">
            Daytona API Key
            <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 font-sans normal-case text-[#58a6ff] hover:underline">
              Get a key
            </a>
          </label>
          <div className="relative">
            <Input
              id="sandbox-key-input"
              type={showSandboxKey ? "text" : "password"}
              value={sandboxKey}
              onChange={(e) => setSandboxKey(e.target.value)}
              placeholder="dtn_..."
              className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              onClick={() => setShowSandboxKey(!showSandboxKey)}
              aria-label={showSandboxKey ? "Hide Daytona API key" : "Show Daytona API key"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showSandboxKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </Surface>

      <div className="mb-4 rounded-[8px] bg-[rgba(0,163,92,0.1)] px-5 py-3 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-[#6ee7a8]" />
          <span className="text-xs text-[#9ff5c3]">
            Keys are encrypted and saved to your account automatically
          </span>
        </div>
      </div>

      {initialEnvVars && Object.keys(initialEnvVars).length > 0 && (
        <div className="mb-4 rounded-[8px] bg-white/[0.03] px-5 py-3 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {Object.keys(initialEnvVars).length} env variable{Object.keys(initialEnvVars).length !== 1 ? "s" : ""} configured
              </span>
            </div>
            <Link href="/settings" className="text-xs text-[#58a6ff] hover:underline">Manage</Link>
          </div>
        </div>
      )}

      <Button
        onClick={handleLaunch}
        disabled={!isReady}
        className="w-full"
        size="lg"
      >
        {isReady ? "Launch Agent" : "Enter API keys to launch"}
        {isReady && <ArrowRight className="size-4" />}
      </Button>
    </div>
  );
}
