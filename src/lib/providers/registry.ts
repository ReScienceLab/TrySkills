import type { ComponentType } from "react";
import { OpenRouter, Anthropic, OpenAI, Google, NousResearch, Kimi, Minimax } from "@lobehub/icons";

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface Provider {
  id: string;
  name: string;
  Icon: ComponentType<IconProps>;
  keyPrefix: string;
  keyUrl: string;
  models: string[];
  envVar: string;
  inferenceProvider: string;
  baseUrl?: string;
  authType?: "api-key" | "oauth";
  allowCustomModel?: boolean;
  checkEndpoint: string;
  checkAuthHeader: (key: string) => Record<string, string>;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    Icon: OpenRouter,
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    envVar: "OPENROUTER_API_KEY",
    inferenceProvider: "openrouter",
    allowCustomModel: true,
    checkEndpoint: "https://openrouter.ai/api/v1/models?supported_parameters=temperature&per_page=1",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-opus-4.7",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-5.4",
      "openai/gpt-5.4-mini",
      "google/gemini-2.5-flash",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    Icon: Anthropic,
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
    inferenceProvider: "anthropic",
    checkEndpoint: "https://api.anthropic.com/v1/models?limit=1",
    checkAuthHeader: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"],
  },
  {
    id: "openai",
    name: "OpenAI",
    Icon: OpenAI,
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    inferenceProvider: "openai",
    checkEndpoint: "https://api.openai.com/v1/models?limit=1",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  },
  {
    id: "google",
    name: "Google AI",
    Icon: Google,
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    envVar: "GOOGLE_API_KEY",
    inferenceProvider: "gemini",
    checkEndpoint: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    checkAuthHeader: (key) => ({ "x-goog-api-key": key }),
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  },
  {
    id: "nous",
    name: "Nous Portal",
    Icon: NousResearch,
    keyPrefix: "",
    keyUrl: "https://portal.nousresearch.com",
    envVar: "NOUS_API_KEY",
    inferenceProvider: "custom",
    baseUrl: "https://inference-api.nousresearch.com/v1",
    allowCustomModel: true,
    checkEndpoint: "https://inference-api.nousresearch.com/v1/models",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["Hermes-4.3-36B", "Hermes-4-70B", "Hermes-4-405B"],
  },
  {
    id: "kimi",
    name: "Kimi",
    Icon: Kimi,
    keyPrefix: "",
    keyUrl: "https://platform.kimi.ai/console/api-keys",
    envVar: "KIMI_API_KEY",
    inferenceProvider: "custom",
    baseUrl: "https://api.moonshot.ai/v1",
    checkEndpoint: "https://api.moonshot.ai/v1/models",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["kimi-k2.6", "kimi-k2.5", "moonshot-v1-128k"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    Icon: Minimax,
    keyPrefix: "",
    keyUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    envVar: "MINIMAX_API_KEY",
    inferenceProvider: "custom",
    baseUrl: "https://api.minimax.io/v1",
    checkEndpoint: "https://api.minimax.io/v1/models",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1"],
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
