import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockUploadFile = vi.fn();
const mockExecuteCommand = vi.fn();
const mockGetPreviewLink = vi.fn();

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

import { createHermesSandbox, destroySandbox, type SkillFile } from "@/lib/sandbox/daytona";
import type { SandboxConfig, SandboxState } from "@/lib/sandbox/types";

describe("sandbox/daytona", () => {
  const mockSandbox = {
    id: "sb-test-123",
    fs: { uploadFile: mockUploadFile },
    process: { executeCommand: mockExecuteCommand },
    getPreviewLink: mockGetPreviewLink,
  };

  const testConfig: SandboxConfig = {
    daytonaApiKey: "test-daytona-key",
    llmProvider: "openrouter",
    llmApiKey: "sk-or-test-key",
    llmModel: "anthropic/claude-sonnet-4",
  };

  const testSkillFiles: SkillFile[] = [
    { path: "SKILL.md", content: "---\nname: test\n---\n# Test" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(mockSandbox);
    mockExecuteCommand.mockResolvedValue({ exitCode: 0 });
    mockGetPreviewLink.mockResolvedValue({
      url: "https://preview.daytona.io/sb-test-123",
      token: "tok-abc",
    });
  });

  it("creates a sandbox using snapshot (fast path)", async () => {
    const progress: SandboxState[] = [];

    const session = await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillFiles,
      (step) => progress.push(step),
    );

    // First call should use the snapshot param
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: "hermes-ready",
        ephemeral: true,
        autoStopInterval: 15,
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
    expect(session.webuiUrl).toContain("preview.daytona.io");
  });

  it("falls back to cold install when snapshot not available", async () => {
    // First call (snapshot) fails, second call (fallback) succeeds
    mockCreate
      .mockRejectedValueOnce(new Error("Snapshot not found"))
      .mockResolvedValueOnce(mockSandbox);

    const progress: SandboxState[] = [];

    const session = await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillFiles,
      (step) => progress.push(step),
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(progress).toContain("installing");
    expect(session.sandboxId).toBe("sb-test-123");
  });

  it("reports progress through snapshot stages", async () => {
    const progress: SandboxState[] = [];

    await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillFiles,
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
    await createHermesSandbox(testConfig, "my-skill", testSkillFiles, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const linkCmd = allCmds.find((c: string) => c.includes("/opt/hermes-agent"));
    expect(linkCmd).toBeDefined();
    // Should NOT call install.sh on snapshot path
    const installCmd = allCmds.find((c: string) => c.includes("install.sh"));
    expect(installCmd).toBeUndefined();
  });

  it("uploads skill files to /home/daytona/.hermes/skills/", async () => {
    await createHermesSandbox(
      testConfig,
      "my-skill",
      [
        { path: "SKILL.md", content: "# Skill" },
        { path: "scripts/setup.sh", content: "#!/bin/bash" },
      ],
      () => {},
    );

    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      "/home/daytona/.hermes/skills/my-skill/SKILL.md",
    );
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      "/home/daytona/.hermes/skills/my-skill/scripts/setup.sh",
    );
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
        testSkillFiles,
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

  it("starts gateway and webui from /opt on snapshot path", async () => {
    await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const gwCmd = allCmds.find((c: string) => c.includes("hermes") && c.includes("gateway"));
    const webuiCmd = allCmds.find((c: string) => c.includes("server.py"));
    expect(gwCmd).toBeDefined();
    expect(webuiCmd).toBeDefined();
    expect(webuiCmd).toContain("8787");
  });

  it("gets preview link on webui port 8787", async () => {
    await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});
    expect(mockGetPreviewLink).toHaveBeenCalledWith(8787);
  });

  it("appends token to webui URL when present", async () => {
    mockGetPreviewLink.mockResolvedValue({
      url: "https://preview.daytona.io/sb-123",
      token: "secret-token",
    });

    const session = await createHermesSandbox(
      testConfig,
      "test",
      testSkillFiles,
      () => {},
    );

    expect(session.webuiUrl).toBe(
      "https://preview.daytona.io/sb-123?token=secret-token",
    );
  });

  it("handles webui URL without token", async () => {
    mockGetPreviewLink.mockResolvedValue({
      url: "https://preview.daytona.io/sb-123",
      token: "",
    });

    const session = await createHermesSandbox(
      testConfig,
      "test",
      testSkillFiles,
      () => {},
    );

    expect(session.webuiUrl).toBe("https://preview.daytona.io/sb-123");
  });

  describe("destroySandbox", () => {
    it("deletes sandbox via active reference", async () => {
      await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});

      await destroySandbox("test-daytona-key", "sb-test-123");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("falls back to get+delete for unknown sandbox", async () => {
      mockGet.mockResolvedValue(mockSandbox);

      await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});
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
});
