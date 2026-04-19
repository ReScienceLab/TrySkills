"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { GlowMesh } from "@/components/glow-mesh";
import { SiteHeader } from "@/components/site-header";

export default function SettingsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { config: savedConfig, loading, save, clear } = useKeyStore();

  const [provider, setProvider] = useState<Provider>(PROVIDERS[0]);
  const [model, setModel] = useState(PROVIDERS[0].models[0]);
  const [llmKey, setLlmKey] = useState("");
  const [sandboxKey, setSandboxKey] = useState("");
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!savedConfig) return;
    const p = PROVIDERS.find((p) => p.id === savedConfig.providerId) || PROVIDERS[0];
    setProvider(p);
    setModel(savedConfig.model || p.models[0]);
    setLlmKey(savedConfig.llmKey || "");
    setSandboxKey(savedConfig.sandboxKey || "");
  }, [savedConfig]);

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
    }
  };

  const handleSave = async () => {
    await save({ providerId: provider.id, model, llmKey, sandboxKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = async () => {
    await clear();
    setLlmKey("");
    setSandboxKey("");
    setProvider(PROVIDERS[0]);
    setModel(PROVIDERS[0].models[0]);
  };

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

  const hasKeys = llmKey.length > 5 && sandboxKey.length > 5;

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GlowMesh />
      <SiteHeader />

      <div className="flex-1 flex items-center justify-center relative z-10 px-6 pt-20 pb-10">
        <div className="w-full max-w-[640px]">
          <h1 className="text-2xl font-semibold text-white/90 mb-8">Settings</h1>

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
