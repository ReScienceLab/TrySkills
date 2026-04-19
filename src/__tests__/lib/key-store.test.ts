import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from "@/lib/key-store";

describe("key-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no config is stored", () => {
    expect(loadConfig()).toBeNull();
  });

  it("saves and loads config", () => {
    const config: StoredConfig = {
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4",
      llmKey: "sk-or-test-key",
      sandboxKey: "daytona-test-key",
    };

    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded).toEqual(config);
  });

  it("clears config", () => {
    saveConfig({
      providerId: "openrouter",
      model: "test",
      llmKey: "key",
      sandboxKey: "key",
    });

    clearConfig();
    expect(loadConfig()).toBeNull();
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("tryskills-config", "not-valid-json");
    expect(loadConfig()).toBeNull();
  });

  it("preserves all fields through save/load cycle", () => {
    const config: StoredConfig = {
      providerId: "anthropic",
      model: "claude-sonnet-4-20250514",
      llmKey: "sk-ant-very-long-key-12345",
      sandboxKey: "daytona-sandbox-key-67890",
    };

    saveConfig(config);
    const loaded = loadConfig();

    expect(loaded!.providerId).toBe("anthropic");
    expect(loaded!.model).toBe("claude-sonnet-4-20250514");
    expect(loaded!.llmKey).toBe("sk-ant-very-long-key-12345");
    expect(loaded!.sandboxKey).toBe("daytona-sandbox-key-67890");
  });

  it("overwrites previous config on save", () => {
    saveConfig({
      providerId: "openrouter",
      model: "old-model",
      llmKey: "old-key",
      sandboxKey: "old-sandbox",
    });

    saveConfig({
      providerId: "anthropic",
      model: "new-model",
      llmKey: "new-key",
      sandboxKey: "new-sandbox",
    });

    const loaded = loadConfig();
    expect(loaded!.providerId).toBe("anthropic");
    expect(loaded!.model).toBe("new-model");
  });
});
