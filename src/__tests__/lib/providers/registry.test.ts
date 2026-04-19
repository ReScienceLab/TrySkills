import { describe, it, expect } from "vitest";
import { PROVIDERS, getProvider } from "@/lib/providers/registry";

describe("providers/registry", () => {
  it("exports 4 providers", () => {
    expect(PROVIDERS).toHaveLength(4);
  });

  it("each provider has required fields", () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.keyPrefix).toBeTruthy();
      expect(p.keyUrl).toMatch(/^https:\/\//);
      expect(p.envVar).toBeTruthy();
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
});
