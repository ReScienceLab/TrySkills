"use client";

import { useState } from "react";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const { save } = useKeyStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [provider, setProvider] = useState<Provider>(PROVIDERS[0]);
  const [model, setModel] = useState(PROVIDERS[0].models[0]);
  const [llmKey, setLlmKey] = useState("");
  const [sandboxKey, setSandboxKey] = useState("");
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((p) => p.id === id);
    if (p) {
      setProvider(p);
      setModel(p.models[0]);
      setLlmKey("");
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await save({ providerId: provider.id, model, llmKey, sandboxKey });
      setStep(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save keys. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg border border-white/20 bg-[#0a0a0a] shadow-2xl">
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white/90">Welcome to TrySkills.sh</h2>
          <p className="text-sm text-white/40 mt-1">
            Set up your API keys to start trying skills. Takes about 2 minutes.
          </p>
        </div>

        <div className="px-6 py-2 border-b border-white/10">
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`h-1 flex-1 transition-colors ${
                  s <= step ? "bg-white" : "bg-white/10"
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-white/30 mt-1 mb-2">
            <span>Sandbox</span>
            <span>LLM Provider</span>
            <span>Done</span>
          </div>
        </div>

        <div className="px-6 py-6">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60">1</div>
                <div>
                  <div className="text-sm font-medium text-white/90">Get a Daytona Sandbox Key</div>
                  <div className="text-xs text-white/40">Free $200 credits, no credit card needed</div>
                </div>
              </div>

              <a
                href="https://app.daytona.io/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 hover:border-white/30 transition-all group"
              >
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm text-white/70 group-hover:text-white transition-colors">Open Daytona Dashboard</div>
                  <div className="text-xs text-white/30">app.daytona.io/dashboard/keys</div>
                </div>
                <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>

              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
                  Paste your Daytona API Key
                </label>
                <div className="relative">
                  <input
                    type={showSandboxKey ? "text" : "password"}
                    value={sandboxKey}
                    onChange={(e) => setSandboxKey(e.target.value)}
                    placeholder="dtn_..."
                    className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    autoFocus
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
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60">2</div>
                <div>
                  <div className="text-sm font-medium text-white/90">Configure your LLM Provider</div>
                  <div className="text-xs text-white/40">Choose a provider and paste your API key</div>
                </div>
              </div>

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
                {provider.allowCustomModel ? (
                  <>
                    <input
                      list={`onboarding-models-${provider.id}`}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. anthropic/claude-sonnet-4.6"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    />
                    <datalist id={`onboarding-models-${provider.id}`}>
                      {provider.models.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                  >
                    {provider.models.map((m) => (
                      <option key={m} value={m} className="bg-[#111] text-white">{m}</option>
                    ))}
                  </select>
                )}
              </div>

              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 hover:border-white/30 transition-all group"
              >
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm text-white/70 group-hover:text-white transition-colors">Get {provider.name} API Key</div>
                  <div className="text-xs text-white/30">{provider.keyUrl.replace("https://", "")}</div>
                </div>
                <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>

              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
                  Paste your {provider.name} API Key
                </label>
                <div className="relative">
                  <input
                    type={showLlmKey ? "text" : "password"}
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder={`${provider.keyPrefix}...`}
                    className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowLlmKey(!showLlmKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
                  >
                    {showLlmKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {saveError}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-center py-4">
              <svg className="w-12 h-12 mx-auto text-green-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-lg font-semibold text-white/90 mb-1">You're all set!</div>
                <div className="text-sm text-white/50">
                  Your keys are encrypted and saved. You can now try any skill instantly.
                </div>
              </div>
              <div className="text-xs text-white/30 pt-2">
                You can update your keys anytime in Settings.
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-between">
          {step > 1 && step < 3 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={sandboxKey.length < 5}
              className={`px-6 py-2 text-sm font-medium transition-all ${
                sandboxKey.length >= 5
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleFinish}
              disabled={llmKey.length < 5 || saving}
              className={`px-6 py-2 text-sm font-medium transition-all ${
                llmKey.length >= 5 && !saving
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save & Finish"}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-white text-black text-sm font-medium hover:bg-white/90 transition-all"
            >
              Start Trying Skills
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
