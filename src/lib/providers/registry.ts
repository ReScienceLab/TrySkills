export interface Provider {
  id: string;
  name: string;
  keyPrefix: string;
  keyUrl: string;
  models: string[];
  envVar: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    envVar: "OPENROUTER_API_KEY",
    models: [
      "anthropic/claude-sonnet-4",
      "anthropic/claude-haiku-4",
      "openai/gpt-4o",
      "google/gemini-2.0-flash",
      "meta-llama/llama-3.3-70b",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "google",
    name: "Google AI",
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    envVar: "GOOGLE_API_KEY",
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash"],
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
