"use client";

import { useState, useRef } from "react";
import { PROVIDERS, type Provider } from "@/lib/providers/registry";
import { checkProviderKey, type CheckResult } from "@/lib/providers/check-key";

export function ProviderTabs({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
      {PROVIDERS.map((p) => {
        const Icon = p.Icon;
        return (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-2 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeId === p.id
              ? "bg-white text-black"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          <Icon size={14} className={`${activeId === p.id ? "text-black" : "text-white/60"}`} />
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
        <input
          list={`models-${provider.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`e.g. ${provider.models[0]}`}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
    >
      {provider.models.map((m) => (
        <option key={m} value={m} className="bg-[#111] text-white">{m}</option>
      ))}
    </select>
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

  return (
    <div className="space-y-2">
      <label className="block text-xs text-white/50 uppercase tracking-wider">
        API Key
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-blue-400 hover:underline normal-case tracking-normal"
        >
          Get a key &rarr;
        </a>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => { onChange(e.target.value); setResult(null); }}
            placeholder={`${provider.keyPrefix}...`}
            className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 text-white/90 text-sm font-mono outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
          />
          <button
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {showCheck && (
          <button
            onClick={handleCheck}
            disabled={checking || value.length < 5}
            className={`px-4 py-2.5 text-xs font-medium border transition-all shrink-0 ${
              result?.ok
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : result && !result.ok
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            } ${checking || value.length < 5 ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {checking ? "..." : result?.ok ? "Valid" : result && !result.ok ? "Failed" : "Check"}
          </button>
        )}
      </div>
      {result && !result.ok && (
        <p className="text-xs text-red-400">{result.error}</p>
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
  const IconComponent = provider.Icon;

  return (
    <div className={`border transition-colors ${
      isActive ? "border-white/30" : "border-white/10"
    } bg-black/40 backdrop-blur-sm`}>
      <button
        onClick={onToggleExpand}
        className="w-full px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            role="radio"
            aria-checked={isActive}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggleActive(); } }}
            className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
              isActive
                ? "border-white bg-white"
                : "border-white/30 hover:border-white/50"
            }`}
          >
            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-black" />
            )}
          </div>
          <IconComponent size={16} className={isActive ? "text-white" : "text-white/50"} />
          <span className={`text-sm font-medium ${isActive ? "text-white" : "text-white/60"}`}>
            {provider.name}
          </span>
          {hasKey && (
            <span className="text-[10px] text-green-400/60 bg-green-400/10 px-1.5 py-0.5">
              configured
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Model</label>
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
    </div>
  );
}
