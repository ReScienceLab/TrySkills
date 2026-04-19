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

  it("creates a sandbox with correct parameters", async () => {
    const progress: SandboxState[] = [];

    const session = await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillFiles,
      (step) => progress.push(step),
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        autoStopInterval: 60,
        public: true,
        envVars: expect.objectContaining({
          OPENROUTER_API_KEY: "sk-or-test-key",
          API_SERVER_ENABLED: "true",
          GATEWAY_ALLOW_ALL_USERS: "true",
        }),
      }),
      expect.objectContaining({ timeout: 300 }),
    );

    expect(session.sandboxId).toBe("sb-test-123");
    expect(session.state).toBe("running");
    expect(session.webuiUrl).toContain("preview.daytona.io");
  });

  it("reports progress through all stages", async () => {
    const progress: SandboxState[] = [];

    await createHermesSandbox(
      testConfig,
      "test-skill",
      testSkillFiles,
      (step) => progress.push(step),
    );

    expect(progress).toContain("creating");
    expect(progress).toContain("uploading");
    expect(progress).toContain("starting");
  });

  it("installs hermes-agent and hermes-webui via executeCommand", async () => {
    await createHermesSandbox(testConfig, "my-skill", testSkillFiles, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const installCmd = allCmds.find((c: string) => c.includes("hermes-agent/main/scripts/install.sh"));
    expect(installCmd).toBeDefined();
    const webuiCmd = allCmds.find((c: string) => c.includes("hermes-webui"));
    expect(webuiCmd).toBeDefined();
  });

  it("uploads skill files to ~/.hermes/skills/", async () => {
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

  it("starts gateway and hermes-webui", async () => {
    await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});

    const allCmds = mockExecuteCommand.mock.calls.map((c: string[]) => c[0]);
    const gwCmd = allCmds.find((c: string) => c.includes("hermes gateway run"));
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

    it("does not throw on cleanup errors", async () => {
      mockGet.mockRejectedValue(new Error("not found"));

      await expect(
        destroySandbox("test-key", "sb-nonexistent"),
      ).resolves.not.toThrow();
    });
  });
});
