import { describe, it, expect } from "vitest";
import type { SandboxState, SandboxConfig, SandboxSession, PoolState } from "@/lib/sandbox/types";

describe("sandbox/types", () => {
  it("SandboxState covers all lifecycle states", () => {
    const states: SandboxState[] = [
      "idle",
      "creating",
      "configuring",
      "installing",
      "uploading",
      "starting",
      "swapping",
      "restarting",
      "running",
      "error",
      "cleaning",
    ];
    expect(states).toHaveLength(11);
  });

  it("PoolState covers all pool states", () => {
    const states: PoolState[] = ["warm", "active", "swapping", "stopped"];
    expect(states).toHaveLength(4);
  });

  it("SandboxConfig is structurally valid", () => {
    const config: SandboxConfig = {
      daytonaApiKey: "test-key",
      llmProvider: "openrouter",
      llmApiKey: "sk-or-test",
      llmModel: "anthropic/claude-sonnet-4",
    };
    expect(config.daytonaApiKey).toBeTruthy();
    expect(config.llmProvider).toBeTruthy();
    expect(config.llmApiKey).toBeTruthy();
    expect(config.llmModel).toBeTruthy();
  });

  it("SandboxSession is structurally valid", () => {
    const session: SandboxSession = {
      sandboxId: "sb-123",
      webuiUrl: "https://preview.daytona.io/sb-123?prompt=test",
      webuiBaseUrl: "https://preview.daytona.io/sb-123",
      state: "running",
      startedAt: Date.now(),
    };
    expect(session.sandboxId).toBeTruthy();
    expect(session.webuiUrl).toMatch(/^https:\/\//);
    expect(session.state).toBe("running");
    expect(session.startedAt).toBeGreaterThan(0);
  });
});
