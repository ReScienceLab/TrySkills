import { describe, it, expect, vi } from "vitest";

vi.mock("@lobehub/icons", () => ({
  OpenRouter: () => null,
  Anthropic: () => null,
  OpenAI: () => null,
  Google: () => null,
  NousResearch: () => null,
  Kimi: () => null,
  Minimax: () => null,
}));

import { PROVIDERS, getProvider } from "@/lib/providers/registry";

describe("providers/registry", () => {
  it("exports 7 providers", () => {
    expect(PROVIDERS).toHaveLength(7);
  });

  it("each provider has required fields", () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.keyUrl).toMatch(/^https:\/\//);
      expect(p.envVar).toBeTruthy();
      expect(p.hermesProvider).toBeTruthy();
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it("provider IDs are unique", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getProvider returns the correct provider", () => {
    const p = getProvider("openrouter");
    expect(p).toBeDefined();
    expect(p!.name).toBe("OpenRouter");
  });

  it("getProvider returns undefined for unknown id", () => {
    expect(getProvider("nonexistent")).toBeUndefined();
  });

  it("openrouter is the first provider (default)", () => {
    expect(PROVIDERS[0].id).toBe("openrouter");
  });

  it("all models are non-empty strings", () => {
    for (const p of PROVIDERS) {
      for (const m of p.models) {
        expect(typeof m).toBe("string");
        expect(m.length).toBeGreaterThan(0);
      }
    }
  });

  it("openai maps to hermes provider 'custom' (not openrouter)", () => {
    const p = getProvider("openai");
    expect(p!.hermesProvider).toBe("custom");
    expect(p!.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("nous uses custom hermes provider with explicit base_url", () => {
    const p = getProvider("nous");
    expect(p!.hermesProvider).toBe("custom");
    expect(p!.baseUrl).toBe("https://inference-api.nousresearch.com/v1");
  });

  it("kimi maps to hermes provider 'kimi-coding' without hardcoded base_url", () => {
    const p = getProvider("kimi");
    expect(p!.hermesProvider).toBe("kimi-coding");
    expect(p!.baseUrl).toBeUndefined();
  });

  it("minimax uses anthropic endpoint", () => {
    const p = getProvider("minimax");
    expect(p!.hermesProvider).toBe("minimax");
    expect(p!.baseUrl).toBe("https://api.minimax.io/anthropic");
  });

  it("providers with baseUrl have it set", () => {
    for (const p of PROVIDERS) {
      if (p.baseUrl) {
        expect(p.baseUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("new providers are present", () => {
    expect(getProvider("nous")).toBeDefined();
    expect(getProvider("kimi")).toBeDefined();
    expect(getProvider("minimax")).toBeDefined();
  });
});
