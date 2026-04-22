import type { ComponentType } from "react";
import { OpenRouter, Anthropic, OpenAI, Google, NousResearch, Kimi, Minimax } from "@lobehub/icons";
import { PROVIDER_DATA, type ProviderData } from "./provider-data";
export { getProviderData } from "./provider-data";

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface Provider extends ProviderData {
  Icon: ComponentType<IconProps>;
}

const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  openrouter: OpenRouter,
  anthropic: Anthropic,
  openai: OpenAI,
  google: Google,
  nous: NousResearch,
  kimi: Kimi,
  minimax: Minimax,
};

export const PROVIDERS: Provider[] = PROVIDER_DATA.map((p) => ({
  ...p,
  Icon: ICON_MAP[p.id] ?? OpenRouter,
}));

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
