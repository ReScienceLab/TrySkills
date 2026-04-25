"use client";

import { createElement, useState, useRef } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { checkProviderKey, type CheckResult } from "@/lib/providers/check-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, Surface } from "@/components/product-ui";

export function ProviderTabs({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-white/[0.03] p-1 shadow-[var(--shadow-border)] sm:grid-cols-4">
      {PROVIDERS.map((p) => {
        return (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-medium transition-all ${
            activeId === p.id
              ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          }`}
        >
          {createElement(p.Icon, { size: 14 })}
          {p.name}
        </button>
        );
      })}
    </div>
  );
}

export function ModelSelector({
  provider,
  value,
  onChange,
}: {
  provider: Provider;
  value: string;
  onChange: (model: string) => void;
}) {
  if (provider.allowCustomModel) {
    return (
      <>
        <Input
          list={`models-${provider.id}`}
          id={`model-input-${provider.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`e.g. ${provider.models[0]}`}
          aria-label={`Model for ${provider.name}`}
          className="h-10 border-0 bg-white/[0.03] font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
        />
        <datalist id={`models-${provider.id}`}>
          {provider.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Model for ${provider.name}`}
        className="h-10 w-full cursor-pointer appearance-none rounded-[6px] bg-white/[0.03] px-3 pr-9 font-mono text-sm text-foreground shadow-[var(--shadow-border)] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring"
      >
        {provider.models.map((m) => (
          <option key={m} value={m} className="bg-[#111] text-white">{m}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function ApiKeyInput({
  provider,
  value,
  onChange,
  showCheck,
}: {
  provider: Provider;
  value: string;
  onChange: (key: string) => void;
  showCheck?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const checkedKeyRef = useRef(value);

  const handleCheck = async () => {
    const keyAtStart = value;
    checkedKeyRef.current = keyAtStart;
    setChecking(true);
    setResult(null);
    const r = await checkProviderKey(provider, value);
    if (checkedKeyRef.current === keyAtStart) {
      setResult(r);
    }
    setChecking(false);
  };

  const inputId = `api-key-${provider.id}`;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block font-mono text-xs font-medium uppercase text-muted-foreground">
        API Key
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 font-sans normal-case text-[#58a6ff] hover:underline"
        >
          Get a key
        </a>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={inputId}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => { onChange(e.target.value); setResult(null); }}
            placeholder={`${provider.keyPrefix}...`}
            className="h-10 border-0 bg-white/[0.03] pr-11 font-mono shadow-[var(--shadow-border)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-ring"
          />
          <button
            onClick={() => setVisible(!visible)}
            aria-label={visible ? `Hide ${provider.name} API key` : `Show ${provider.name} API key`}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {showCheck && (
          <Button
            onClick={handleCheck}
            disabled={checking || value.length < 5}
            aria-label={`Check ${provider.name} API key validity`}
            variant="secondary"
            className={`shrink-0 ${
              result?.ok
                ? "bg-[rgba(0,163,92,0.14)] text-[#6ee7a8]"
                : result && !result.ok
                  ? "bg-[rgba(255,91,79,0.14)] text-[#ffb4ac]"
                  : ""
            }`}
          >
            {checking ? "..." : result?.ok ? "Valid" : result && !result.ok ? "Failed" : "Check"}
          </Button>
        )}
      </div>
      {result && !result.ok && (
        <p className="text-xs text-[#ffb4ac]">{result.error}</p>
      )}
    </div>
  );
}

export function ProviderSection({
  provider,
  isActive,
  isExpanded,
  onToggleActive,
  onToggleExpand,
  model,
  onModelChange,
  apiKey,
  onApiKeyChange,
}: {
  provider: Provider;
  isActive: boolean;
  isExpanded: boolean;
  onToggleActive: () => void;
  onToggleExpand: () => void;
  model: string;
  onModelChange: (m: string) => void;
  apiKey: string;
  onApiKeyChange: (k: string) => void;
}) {
  const hasKey = apiKey.length > 5;

  return (
    <Surface className={`transition-shadow ${
      isActive ? "shadow-[var(--shadow-card-hover)]" : ""
    }`}>
      <button
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        aria-label={`${provider.name} provider settings`}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            role="radio"
            aria-checked={isActive}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggleActive(); } }}
            className={`flex size-4 cursor-pointer items-center justify-center rounded-full shadow-[var(--shadow-border)] transition-all ${
              isActive
                ? "bg-foreground"
                : "bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            {isActive && (
              <div className="size-1.5 rounded-full bg-background" />
            )}
          </div>
          {createElement(provider.Icon, {
            size: 16,
            className: isActive ? "text-foreground" : "text-muted-foreground",
          })}
          <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
            {provider.name}
          </span>
          {hasKey && (
            <StatusBadge tone="develop" className="h-5">
              configured
            </StatusBadge>
          )}
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 px-5 pb-5 pt-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <div>
            <label className="mb-2 block font-mono text-xs font-medium uppercase text-muted-foreground">Model</label>
            <ModelSelector provider={provider} value={model} onChange={onModelChange} />
          </div>
          <ApiKeyInput
            provider={provider}
            value={apiKey}
            onChange={onApiKeyChange}
            showCheck
          />
        </div>
      )}
    </Surface>
  );
}
