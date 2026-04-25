"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { PROVIDERS } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderSection } from "@/components/provider-config";
import { EnvVarsEditor } from "@/components/env-vars-editor";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/product-ui";

function SettingsPageSkeleton() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-10 pt-20">
        <div className="w-full max-w-[640px]">
          <Skeleton className="mb-8 h-8 w-32" />
          <div className="mb-6">
            <Skeleton className="mb-3 h-4 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Surface key={index} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-[6px]" />
                  </div>
                </Surface>
              ))}
            </div>
          </div>
          <Surface className="mb-4 p-6">
            <Skeleton className="mb-5 h-5 w-28" />
            <Skeleton className="h-10 rounded-[6px]" />
          </Surface>
          <Surface className="p-6">
            <Skeleton className="mb-5 h-5 w-44" />
            <Skeleton className="h-10 rounded-[6px]" />
          </Surface>
        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { config: savedConfig, loading, save, clear } = useKeyStore();

  if (!isLoaded || loading) {
    return <SettingsPageSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <Surface className="max-w-md p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold text-foreground">Sign in to manage settings</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Your API keys will be encrypted and stored securely in your account.
            </p>
            <SignInButton mode="modal">
              <Button>
                Sign in with GitHub
              </Button>
            </SignInButton>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <SettingsForm
      key={savedConfig ? `${savedConfig.providerId}:${savedConfig.sandboxKey}:${JSON.stringify(savedConfig.envVars ?? {})}` : "empty"}
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-10 pt-20">
        <div className="w-full max-w-[640px]">
          <h1 className="mb-8 text-2xl font-semibold text-foreground">Settings</h1>

          <div className="mb-6">
            <h2 className="mb-3 font-mono text-sm font-medium uppercase text-muted-foreground">LLM Providers</h2>
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

          <Surface className="mb-4">
            <div className="px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Sandbox</h2>
                <span className="text-xs text-muted-foreground">Daytona &middot; $200 free credits</span>
              </div>
            </div>
            <div className="px-6 py-5">
              <label htmlFor="settings-sandbox-key" className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">
                Daytona API Key
                <a href="https://app.daytona.io/dashboard/keys" target="_blank" rel="noopener noreferrer" className="ml-2 font-sans normal-case text-[#58a6ff] hover:underline">
                  Get a key &rarr;
                </a>
              </label>
              <div className="relative">
                <Input
                  id="settings-sandbox-key"
                  type={showSandboxKey ? "text" : "password"}
                  value={sandboxKey}
                  onChange={(e) => setSandboxKey(e.target.value)}
                  placeholder="dtn_..."
                  className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowSandboxKey(!showSandboxKey)}
                  aria-label={showSandboxKey ? "Hide Daytona API key" : "Show Daytona API key"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showSandboxKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </Surface>

          <Surface className="mb-4">
            <div className="px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Environment Variables</h2>
                <span className="text-xs text-muted-foreground">For skills that need extra API keys</span>
              </div>
            </div>
            <div className="px-6 py-5">
              <EnvVarsEditor value={envVars} onChange={setEnvVars} />
            </div>
          </Surface>

          <div className="mb-4 rounded-lg bg-[rgba(10,114,239,0.08)] px-5 py-3 shadow-[0_0_0_1px_rgba(10,114,239,0.18)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-[#58a6ff]" />
              <span className="text-xs text-[#58a6ff]">
                Keys are encrypted and saved to your account automatically
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasKeys}
              className={`flex-1 ${saved ? "bg-[rgba(10,114,239,0.18)] text-[#58a6ff]" : ""}`}
            >
              {saved ? "Saved!" : "Save Settings"}
            </Button>
            {savedConfig && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleClear}
              >
                Clear Keys
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
