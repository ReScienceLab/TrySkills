"use client";

import { useState } from "react";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderTabs, ModelSelector, ApiKeyInput } from "@/components/provider-config";
import type { SkillEnvVar } from "@/lib/skill/env-vars";

type Step = 1 | 2 | "envvars" | 3;

export function OnboardingModal({
  onComplete,
  skillEnvVars,
}: {
  onComplete: () => void;
  skillEnvVars?: SkillEnvVar[];
}) {
  const { save } = useKeyStore();
  const hasEnvVarsStep = skillEnvVars && skillEnvVars.length > 0;
  const [step, setStep] = useState<Step>(1);
  const [provider, setProvider] = useState<Provider>(PROVIDERS[0]);
  const [model, setModel] = useState(PROVIDERS[0].models[0]);
  const [llmKey, setLlmKey] = useState("");
  const [sandboxKey, setSandboxKey] = useState("");
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [envVarValues, setEnvVarValues] = useState<Record<string, string>>({});
  const [envVarVisible, setEnvVarVisible] = useState<Set<string>>(new Set());
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
      const envVars = Object.fromEntries(
        Object.entries(envVarValues).filter(([, v]) => v.trim()),
      );
      await save({
        providerId: provider.id,
        model,
        llmKey,
        sandboxKey,
        providerKeys: { [provider.id]: llmKey },
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
      });
      setStep(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save keys. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to TrySkills.sh — API key setup"
    >
      <div className="w-full max-w-lg border border-white/20 bg-[#0a0a0a] shadow-2xl">
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white/90">Welcome to TrySkills.sh</h2>
          <p className="text-sm text-white/40 mt-1">
            Set up your API keys to start trying skills. Takes about 2 minutes.
          </p>
        </div>

        <div className="px-6 py-2 border-b border-white/10">
          <div className="flex items-center gap-1">
            {(hasEnvVarsStep ? [1, 2, "envvars", 3] as const : [1, 2, 3] as const).map((s, i) => {
              const stepOrder = (v: Step) => v === 1 ? 0 : v === 2 ? 1 : v === "envvars" ? 2 : 3;
              const filled = stepOrder(step) >= stepOrder(s);
              return (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className={`h-1 flex-1 transition-colors ${filled ? "bg-white" : "bg-white/10"}`} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-white/30 mt-1 mb-2">
            <span>Sandbox</span>
            <span>LLM Provider</span>
            {hasEnvVarsStep && <span>Env Vars</span>}
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
                <label htmlFor="onboarding-sandbox-key" className="block text-xs text-white/50 uppercase tracking-wider mb-2">
                  Paste your Daytona API Key
                </label>
                <div className="relative">
                  <input
                    id="onboarding-sandbox-key"
                    type={showSandboxKey ? "text" : "password"}
                    value={sandboxKey}
                    onChange={(e) => setSandboxKey(e.target.value)}
                    placeholder="dtn_..."
                    className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
                    autoFocus
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
                <ProviderTabs activeId={provider.id} onChange={handleProviderChange} />
              </div>

              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Model</label>
                <ModelSelector provider={provider} value={model} onChange={setModel} />
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

              <ApiKeyInput
                provider={provider}
                value={llmKey}
                onChange={setLlmKey}
              />

              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {saveError}
                </div>
              )}
            </div>
          )}

          {step === "envvars" && hasEnvVarsStep && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60">3</div>
                <div>
                  <div className="text-sm font-medium text-white/90">Skill Environment Variables</div>
                  <div className="text-xs text-white/40">This skill uses additional API keys (optional)</div>
                </div>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {skillEnvVars!.map((v) => (
                  <div key={v.name} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`onboard-env-${v.name}`} className="text-xs font-mono text-white/70">{v.name}</label>
                      {v.help && (
                        <a href={v.help} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline">
                          Get key &rarr;
                        </a>
                      )}
                    </div>
                    {v.description && <p className="text-[11px] text-white/30">{v.description}</p>}
                    <div className="relative">
                      <input
                        id={`onboard-env-${v.name}`}
                        type={envVarVisible.has(v.name) ? "text" : "password"}
                        value={envVarValues[v.name] ?? ""}
                        onChange={(e) => setEnvVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                        placeholder={`Enter ${v.name}`}
                        className="w-full px-3 py-2 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:border-white/30 transition-colors placeholder:text-white/20"
                      />
                      <button
                        onClick={() => setEnvVarVisible((prev) => {
                          const next = new Set(prev);
                          if (next.has(v.name)) next.delete(v.name); else next.add(v.name);
                          return next;
                        })}
                        aria-label={envVarVisible.has(v.name) ? `Hide ${v.name}` : `Show ${v.name}`}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
                      >
                        {envVarVisible.has(v.name) ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-white/30">
                You can configure these later in Settings if you don&#39;t have them now.
              </p>
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
          {(step === 2 || step === "envvars") ? (
            <button
              onClick={() => setStep(step === "envvars" ? 2 : 1)}
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
              onClick={() => hasEnvVarsStep ? setStep("envvars") : handleFinish()}
              disabled={llmKey.length < 5 || saving}
              className={`px-6 py-2 text-sm font-medium transition-all ${
                llmKey.length >= 5 && !saving
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {saving && !hasEnvVarsStep ? "Saving..." : hasEnvVarsStep ? "Next" : "Save & Finish"}
            </button>
          )}

          {step === "envvars" && (
            <div className="flex gap-2">
              <button
                onClick={handleFinish}
                disabled={saving}
                className={`px-6 py-2 text-sm font-medium transition-all ${
                  !saving
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving..." : "Save & Finish"}
              </button>
            </div>
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
