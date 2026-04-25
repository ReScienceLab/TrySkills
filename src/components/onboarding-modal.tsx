"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Eye, EyeOff } from "lucide-react";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { useKeyStore } from "@/hooks/use-key-store";
import { ProviderTabs, ModelSelector, ApiKeyInput } from "@/components/provider-config";
import type { SkillEnvVar } from "@/lib/skill/env-vars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to TrySkills.sh — API key setup"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)]">
        <div className="px-6 py-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <h2 className="text-lg font-semibold text-foreground">Welcome to TrySkills.sh</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your API keys to start trying skills. Takes about 2 minutes.
          </p>
        </div>

        <div className="px-6 py-2 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-1">
            {(hasEnvVarsStep ? [1, 2, "envvars", 3] as const : [1, 2, 3] as const).map((s, i) => {
              const stepOrder = (v: Step) => v === 1 ? 0 : v === 2 ? 1 : v === "envvars" ? 2 : 3;
              const filled = stepOrder(step) >= stepOrder(s);
              return (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className={`h-1 flex-1 rounded-full transition-colors ${filled ? "bg-foreground" : "bg-white/10"}`} />
                </div>
              );
            })}
          </div>
          <div className="mb-2 mt-1 flex justify-between text-[10px] text-muted-foreground">
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-foreground shadow-[var(--shadow-border)]">1</div>
                <div>
                  <div className="text-sm font-medium text-foreground">Get a Daytona Sandbox Key</div>
                  <div className="text-xs text-muted-foreground">Free $200 credits, no credit card needed</div>
                </div>
              </div>

              <a
                href="https://app.daytona.io/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3 shadow-[var(--shadow-border)] transition-all hover:bg-white/[0.07] hover:shadow-[var(--shadow-border-strong)]"
              >
                <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                <div className="flex-1">
                  <div className="text-sm text-foreground">Open Daytona Dashboard</div>
                  <div className="text-xs text-muted-foreground">app.daytona.io/dashboard/keys</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>

              <div>
                <label htmlFor="onboarding-sandbox-key" className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">
                  Paste your Daytona API Key
                </label>
                <div className="relative">
                  <Input
                    id="onboarding-sandbox-key"
                    type={showSandboxKey ? "text" : "password"}
                    value={sandboxKey}
                    onChange={(e) => setSandboxKey(e.target.value)}
                    placeholder="dtn_..."
                    className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
                    autoFocus
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-foreground shadow-[var(--shadow-border)]">2</div>
                <div>
                  <div className="text-sm font-medium text-foreground">Configure your LLM Provider</div>
                  <div className="text-xs text-muted-foreground">Choose a provider and paste your API key</div>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">Provider</label>
                <ProviderTabs activeId={provider.id} onChange={handleProviderChange} />
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">Model</label>
                <ModelSelector provider={provider} value={model} onChange={setModel} />
              </div>

              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3 shadow-[var(--shadow-border)] transition-all hover:bg-white/[0.07] hover:shadow-[var(--shadow-border-strong)]"
              >
                <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                <div className="flex-1">
                  <div className="text-sm text-foreground">Get {provider.name} API Key</div>
                  <div className="text-xs text-muted-foreground">{provider.keyUrl.replace("https://", "")}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>

              <ApiKeyInput
                provider={provider}
                value={llmKey}
                onChange={setLlmKey}
              />

              {saveError && (
                <div className="rounded-lg bg-[rgba(255,91,79,0.10)] p-3 text-xs text-[#ff8f86] shadow-[0_0_0_1px_rgba(255,91,79,0.22)]">
                  {saveError}
                </div>
              )}
            </div>
          )}

          {step === "envvars" && hasEnvVarsStep && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-foreground shadow-[var(--shadow-border)]">3</div>
                <div>
                  <div className="text-sm font-medium text-foreground">Skill Environment Variables</div>
                  <div className="text-xs text-muted-foreground">This skill uses additional API keys (optional)</div>
                </div>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {skillEnvVars!.map((v) => (
                  <div key={v.name} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`onboard-env-${v.name}`} className="font-mono text-xs text-foreground">{v.name}</label>
                      {v.help && (
                        <a href={v.help} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#58a6ff] hover:underline">
                          Get key &rarr;
                        </a>
                      )}
                    </div>
                    {v.description && <p className="text-[11px] text-muted-foreground">{v.description}</p>}
                    <div className="relative">
                      <Input
                        id={`onboard-env-${v.name}`}
                        type={envVarVisible.has(v.name) ? "text" : "password"}
                        value={envVarValues[v.name] ?? ""}
                        onChange={(e) => setEnvVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                        placeholder={`Enter ${v.name}`}
                        className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setEnvVarVisible((prev) => {
                          const next = new Set(prev);
                          if (next.has(v.name)) next.delete(v.name); else next.add(v.name);
                          return next;
                        })}
                        aria-label={envVarVisible.has(v.name) ? `Hide ${v.name}` : `Show ${v.name}`}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {envVarVisible.has(v.name) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                You can configure these later in Settings if you don&#39;t have them now.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-center py-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#58a6ff]" />
              <div>
                <div className="mb-1 text-lg font-semibold text-foreground">You&apos;re all set!</div>
                <div className="text-sm text-muted-foreground">
                  Your keys are encrypted and saved. You can now try any skill instantly.
                </div>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                You can update your keys anytime in Settings.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between px-6 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          {(step === 2 || step === "envvars") ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(step === "envvars" ? 2 : 1)}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={sandboxKey.length < 5}
            >
              Next
            </Button>
          )}

          {step === 2 && (
            <Button
              type="button"
              onClick={() => hasEnvVarsStep ? setStep("envvars") : handleFinish()}
              disabled={llmKey.length < 5 || saving}
            >
              {saving && !hasEnvVarsStep ? "Saving..." : hasEnvVarsStep ? "Next" : "Save & Finish"}
            </Button>
          )}

          {step === "envvars" && (
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Finish"}
              </Button>
            </div>
          )}

          {step === 3 && (
            <Button
              type="button"
              onClick={onComplete}
            >
              Start Trying Skills
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
