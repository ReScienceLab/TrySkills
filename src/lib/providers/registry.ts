export interface Provider {
  id: string;
  name: string;
  keyPrefix: string;
  keyUrl: string;
  models: string[];
  envVar: string;
  allowCustomModel?: boolean;
  checkEndpoint: string;
  checkAuthHeader: (key: string) => Record<string, string>;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    envVar: "OPENROUTER_API_KEY",
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
    checkEndpoint: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    checkAuthHeader: (key) => ({ "x-goog-api-key": key }),
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
