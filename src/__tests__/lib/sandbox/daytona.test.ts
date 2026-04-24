import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockUploadFile = vi.fn();
const mockExecuteCommand = vi.fn();
const mockGetSignedPreviewUrl = vi.fn();

vi.mock("@lobehub/icons", () => ({
  OpenRouter: () => null,
  Anthropic: () => null,
  OpenAI: () => null,
  Google: () => null,
  NousResearch: () => null,
  Kimi: () => null,
  Minimax: () => null,
}));

vi.mock("@daytona/sdk", () => {
  return {
    Daytona: class MockDaytona {
      create = mockCreate;
      get = mockGet;
      delete = mockDelete;
      constructor() {}
    },
  };
});

import { createHermesSandbox, destroySandbox, installSkill, type SkillSource } from "@/lib/sandbox/daytona";
import type { SandboxConfig, SandboxState } from "@/lib/sandbox/types";

describe("sandbox/daytona", () => {
  const mockSandbox = {
    id: "sb-test-123",
    fs: { uploadFile: mockUploadFile },
    process: { executeCommand: mockExecuteCommand },
    getSignedPreviewUrl: mockGetSignedPreviewUrl,
  };

  const testConfig: SandboxConfig = {
    daytonaApiKey: "test-daytona-key",
    llmProvider: "openrouter",
    llmApiKey: "sk-or-test-key",
    llmModel: "anthropic/claude-sonnet-4",
  };

  const testSkillSource: SkillSource = {
    owner: "test-owner",
    repo: "test-repo",
    skillName: "test-skill",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(mockSandbox);
    mockExecuteCommand.mockResolvedValue({ exitCode: 0 });
    mockGetSignedPreviewUrl.mockResolvedValue({
      url: "https://8642-signedtoken.proxy.daytona.work",
      token: "signedtoken",
      sandboxId: "sb-test-123",
      port: 8642,
    });
  });

  it("creates a sandbox using snapshot (fast path)", async () => {
    const progress: SandboxState[] = [];

    const session = await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillSource,
      (step) => progress.push(step),
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: "hermes-ready",
        autoStopInterval: 30,
        public: true,
        envVars: expect.objectContaining({
          OPENROUTER_API_KEY: "sk-or-test-key",
          API_SERVER_ENABLED: "true",
        }),
      }),
      expect.objectContaining({ timeout: 120 }),
    );

    expect(session.sandboxId).toBe("sb-test-123");
    expect(session.state).toBe("running");
    expect(session.gatewayUrl).toContain("proxy.daytona.work");
    expect(session.gatewayBaseUrl).toContain("proxy.daytona.work");
  });

  it("passes userId as label when provided", async () => {
    await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillSource,
      () => {},
      "user-123",
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({
          tryskills: "true",
          userId: "user-123",
        }),
      }),
      expect.anything(),
    );
  });

  it("falls back to image then curl-install when snapshot not available", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("Snapshot not found"))
      .mockResolvedValueOnce(mockSandbox);

    const progress: SandboxState[] = [];

    const session = await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillSource,
      (step) => progress.push(step),
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(progress).toContain("configuring");
    expect(session.sandboxId).toBe("sb-test-123");
  });

  it("reports progress through snapshot stages", async () => {
    const progress: SandboxState[] = [];

    await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillSource,
      (step) => progress.push(step),
    );

    expect(progress).toContain("creating");
    expect(progress).toContain("configuring");
    expect(progress).toContain("uploading");
    expect(progress).toContain("starting");
    // Should NOT contain "installing" on snapshot path
    expect(progress).not.toContain("installing");
  });

  it("links pre-installed agent from /opt on snapshot path", async () => {
    await createHermesSandbox(testConfig, "my-skill", testSkillSource, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const linkCmd = allCmds.find((c: string) => c.includes("/opt/hermes-agent"));
    expect(linkCmd).toBeDefined();
    // Should NOT call install.sh on snapshot path
    const installCmd = allCmds.find((c: string) => c.includes("install.sh"));
    expect(installCmd).toBeUndefined();
  });

  it("installs skill via npx skills add on sandbox", async () => {
    await createHermesSandbox(
      testConfig,
      "my-skill",
      testSkillSource,
      () => {},
    );

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const npxCmd = allCmds.find((c: string) => c.includes("npx") && c.includes("skills add"));
    expect(npxCmd).toBeDefined();
    expect(npxCmd).toContain("test-owner/test-repo");
    expect(npxCmd).toContain("--skill");
    expect(npxCmd).toContain("--agent universal");
    // Symlink should be created
    const symlinkCmd = allCmds.find((c: string) => c.includes("ln -sfn"));
    expect(symlinkCmd).toBeDefined();
    // Upload should NOT be called when clone succeeds
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it("throws when npx skills add fails", async () => {
    mockExecuteCommand.mockImplementation((cmd: string) => {
      if (typeof cmd === "string" && cmd.includes("npx")) {
        return Promise.resolve({ exitCode: 1, result: "failed" });
      }
      return Promise.resolve({ exitCode: 0, result: "" });
    });

    await expect(createHermesSandbox(
      testConfig,
      "my-skill",
      testSkillSource,
      () => {},
    )).rejects.toThrow("npx skills add failed");
  });

  it("maps provider IDs to correct env var names", async () => {
    for (const [providerId, expectedEnvVar] of [
      ["anthropic", "ANTHROPIC_API_KEY"],
      ["openai", "OPENAI_API_KEY"],
      ["google", "GOOGLE_API_KEY"],
    ] as const) {
      mockCreate.mockResolvedValue(mockSandbox);
      await createHermesSandbox(
        { ...testConfig, llmProvider: providerId, llmApiKey: "test-key" },
        "test",
        testSkillSource,
        () => {},
      );

      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          envVars: expect.objectContaining({
            [expectedEnvVar]: "test-key",
          }),
        }),
        expect.anything(),
      );
    }
  });

  it("new providers map to correct env var names in sandbox", async () => {
    for (const [providerId, expectedEnvVar] of [
      ["kimi", "KIMI_API_KEY"],
      ["minimax", "MINIMAX_API_KEY"],
    ] as const) {
      mockCreate.mockResolvedValue(mockSandbox);
      await createHermesSandbox(
        { ...testConfig, llmProvider: providerId, llmApiKey: "test-key" },
        "test",
        testSkillSource,
        () => {},
      );

      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          envVars: expect.objectContaining({
            [expectedEnvVar]: "test-key",
          }),
        }),
        expect.anything(),
      );
    }
  });

  it("custom hermes providers (openai, nous) use OPENAI_API_KEY in sandbox", async () => {
    for (const providerId of ["openai", "nous"] as const) {
      mockCreate.mockResolvedValue(mockSandbox);
      await createHermesSandbox(
        { ...testConfig, llmProvider: providerId, llmApiKey: "test-key" },
        "test",
        testSkillSource,
        () => {},
      );

      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          envVars: expect.objectContaining({
            OPENAI_API_KEY: "test-key",
          }),
        }),
        expect.anything(),
      );
    }
  });

  it("starts gateway from /opt on snapshot path", async () => {
    await createHermesSandbox(testConfig, "test", testSkillSource, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const gwCmd = allCmds.find((c: string) => c.includes("hermes") && c.includes("gateway"));
    expect(gwCmd).toBeDefined();
    // No dashboard server (server.py) should be started -- only gateway
    const serverCmd = allCmds.find((c: string) => c.includes("server.py"));
    expect(serverCmd).toBeUndefined();
  });

  it("passes extra envVars from config to sandbox create and .env file", async () => {
    const configWithEnvVars: SandboxConfig = {
      ...testConfig,
      envVars: {
        OPENAI_API_KEY: "sk-extra-openai",
        GOOGLE_API_KEY: "AI-extra-google",
      },
    };

    await createHermesSandbox(
      configWithEnvVars,
      "test-skill",
      testSkillSource,
      () => {},
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        envVars: expect.objectContaining({
          OPENROUTER_API_KEY: "sk-or-test-key",
          OPENAI_API_KEY: "sk-extra-openai",
          GOOGLE_API_KEY: "AI-extra-google",
          API_SERVER_ENABLED: "true",
        }),
      }),
      expect.anything(),
    );

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const envCmd = allCmds.find((c: string) => c.includes(".env") && c.includes("ENVEOF"));
    expect(envCmd).toBeDefined();
    expect(envCmd).toContain("OPENAI_API_KEY=sk-extra-openai");
    expect(envCmd).toContain("GOOGLE_API_KEY=AI-extra-google");
  });

  it("gets signed preview URL on gateway port 8642", async () => {
    await createHermesSandbox(testConfig, "test", testSkillSource, () => {});
    expect(mockGetSignedPreviewUrl).toHaveBeenCalledWith(8642, 3600);
  });

  it("uses signed preview URL directly (no token query param)", async () => {
    mockGetSignedPreviewUrl.mockResolvedValue({
      url: "https://8642-signedtoken.proxy.daytona.work",
      token: "signedtoken",
      sandboxId: "sb-123",
      port: 8642,
    });

    const session = await createHermesSandbox(
      testConfig,
      "test",
      testSkillSource,
      () => {},
    );

    expect(session.gatewayBaseUrl).toBe(
      "https://8642-signedtoken.proxy.daytona.work",
    );
    expect(session.gatewayUrl).toBe(
      "https://8642-signedtoken.proxy.daytona.work",
    );
  });

  describe("destroySandbox", () => {
    it("deletes sandbox via active reference", async () => {
      await createHermesSandbox(testConfig, "test", testSkillSource, () => {});

      await destroySandbox("test-daytona-key", "sb-test-123");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("falls back to get+delete for unknown sandbox", async () => {
      mockGet.mockResolvedValue(mockSandbox);

      await createHermesSandbox(testConfig, "test", testSkillSource, () => {});
      await destroySandbox("test-daytona-key", "sb-test-123");

      await destroySandbox("test-key", "sb-unknown-456");
      expect(mockGet).toHaveBeenCalledWith("sb-unknown-456");
    });

    it("re-throws on cleanup errors so callers can preserve dashboard records", async () => {
      mockGet.mockRejectedValue(new Error("not found"));

      await expect(
        destroySandbox("test-key", "sb-nonexistent"),
      ).rejects.toThrow("not found");
    });
  });

  describe("installSkill", () => {
    it("installs skill files in a running sandbox without cleanup", async () => {
      mockGet.mockResolvedValue({ ...mockSandbox, state: "started" });

      const progress: SandboxState[] = [];
      const session = await installSkill(
        testConfig,
        "sb-test-123",
        "new-skill",
        testSkillSource,
        (step) => progress.push(step),
      );

      expect(progress).toContain("uploading");
      expect(session.sandboxId).toBe("sb-test-123");

      const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
      const npxCmd = allCmds.find((c: string) => c.includes("npx") && c.includes("skills add"));
      expect(npxCmd).toBeDefined();
      expect(npxCmd).toContain("test-owner/test-repo");
      // Should restart gateway after config rewrite so new env vars take effect
      const gwCmd = allCmds.find((c: string) => c.includes("hermes") && c.includes("gateway"));
      expect(gwCmd).toBeDefined();
    });

    it("skips gateway restart when skipConfigWrite is true (skills_list rescans disk)", async () => {
      mockGet.mockResolvedValue({ ...mockSandbox, state: "started" });

      await installSkill(
        testConfig,
        "sb-test-123",
        "new-skill",
        testSkillSource,
        () => {},
        { skipConfigWrite: true },
      );

      const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
      const killCmd = allCmds.find((c: string) => c.includes("pkill") && c.includes("gateway"));
      expect(killCmd).toBeUndefined();
    });

    it("recovers a stale gateway when health is down even if config is unchanged", async () => {
      mockGet.mockResolvedValue({ ...mockSandbox, state: "started" });

      let gatewayHealthy = false;
      mockExecuteCommand.mockImplementation((cmd: string) => {
        if (cmd.includes("curl -sf http://localhost:8642/health")) {
          return Promise.resolve({ exitCode: gatewayHealthy ? 0 : 7, result: "" });
        }
        if (cmd.includes("nohup") && cmd.includes("gateway run")) {
          gatewayHealthy = true;
          return Promise.resolve({ exitCode: 0, result: "" });
        }
        return Promise.resolve({ exitCode: 0, result: "" });
      });

      await installSkill(
        testConfig,
        "sb-test-123",
        "new-skill",
        testSkillSource,
        () => {},
        { skipConfigWrite: true },
      );

      const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
      expect(allCmds.some((c: string) => c.includes("rm -f /root/.hermes/gateway.pid /root/.hermes/gateway_state.json"))).toBe(true);
      expect(allCmds.some((c: string) => c.includes("nohup") && c.includes("gateway run"))).toBe(true);
    });

    it("throws on unexpected sandbox state", async () => {
      mockGet.mockResolvedValue({ ...mockSandbox, state: "error" });

      await expect(
        installSkill(testConfig, "sb-test-123", "test", testSkillSource, () => {}),
      ).rejects.toThrow("unexpected state");
    });
  });

  it("includes skills.external_dirs in config.yaml", async () => {
    await createHermesSandbox(testConfig, "test", testSkillSource, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const cfgCmd = allCmds.find((c: string) => c.includes("config.yaml") && c.includes("CFGEOF"));
    expect(cfgCmd).toBeDefined();
    expect(cfgCmd).toContain("external_dirs");
    expect(cfgCmd).toContain("/root/.agents/skills");
  });
});
