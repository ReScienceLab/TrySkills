export interface ProviderData {
  id: string
  name: string
  keyPrefix: string
  keyUrl: string
  models: string[]
  envVar: string
  hermesProvider: string
  baseUrl?: string
  authType?: "api-key" | "oauth"
  allowCustomModel?: boolean
  checkEndpoint: string
  checkAuthHeader: (key: string) => Record<string, string>
  checkMethod?: "GET" | "POST"
  checkBody?: (key: string) => string
}

export const PROVIDER_DATA: ProviderData[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    envVar: "OPENROUTER_API_KEY",
    hermesProvider: "openrouter",
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
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
    hermesProvider: "anthropic",
    checkEndpoint: "https://api.anthropic.com/v1/models?limit=1",
    checkAuthHeader: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    hermesProvider: "custom",
    baseUrl: "https://api.openai.com/v1",
    checkEndpoint: "https://api.openai.com/v1/models?limit=1",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  },
  {
    id: "google",
    name: "Google AI",
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    envVar: "GOOGLE_API_KEY",
    hermesProvider: "gemini",
    checkEndpoint: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    checkAuthHeader: (key) => ({ "x-goog-api-key": key }),
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  },
  {
    id: "nous",
    name: "Nous Portal",
    keyPrefix: "",
    keyUrl: "https://portal.nousresearch.com",
    envVar: "NOUS_API_KEY",
    hermesProvider: "custom",
    baseUrl: "https://inference-api.nousresearch.com/v1",
    allowCustomModel: true,
    checkEndpoint: "https://inference-api.nousresearch.com/v1/chat/completions",
    checkMethod: "POST",
    checkAuthHeader: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
    checkBody: () => JSON.stringify({
      model: "nousresearch/hermes-4-70b",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    }),
    models: [
      "nousresearch/hermes-4-70b",
      "nousresearch/hermes-4-405b",
      "nousresearch/hermes-3-llama-3.1-70b",
    ],
  },
  {
    id: "kimi",
    name: "Kimi",
    keyPrefix: "",
    keyUrl: "https://platform.kimi.ai/console/api-keys",
    envVar: "KIMI_API_KEY",
    hermesProvider: "kimi-coding",
    checkEndpoint: "https://api.moonshot.ai/v1/models",
    checkAuthHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ["kimi-k2.6", "kimi-k2.5", "moonshot-v1-128k"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    keyPrefix: "",
    keyUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    envVar: "MINIMAX_API_KEY",
    hermesProvider: "minimax",
    baseUrl: "https://api.minimax.io/anthropic",
    checkEndpoint: "https://api.minimax.io/v1/chat/completions",
    checkMethod: "POST",
    checkAuthHeader: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
    checkBody: () => JSON.stringify({
      model: "MiniMax-M2.5",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    }),
    models: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.1"],
  },
]

export function getProviderData(id: string): ProviderData | undefined {
  return PROVIDER_DATA.find((p) => p.id === id)
}
