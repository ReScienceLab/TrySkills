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
        image: "ghcr.io/resciencelab/tryskills-hermes:0.1.0",
        ephemeral: true,
        autoStopInterval: 60,
        public: true,
        envVars: expect.objectContaining({
          LLM_PROVIDER: "OPENROUTER",
          LLM_API_KEY: "sk-or-test-key",
          LLM_MODEL: "anthropic/claude-sonnet-4",
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

  it("uploads skill files to the correct path", async () => {
    await createHermesSandbox(
      testConfig,
      "my-skill",
      [
        { path: "SKILL.md", content: "# Skill" },
        { path: "scripts/setup.sh", content: "#!/bin/bash" },
      ],
      () => {},
    );

    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      "/root/.hermes/skills/my-skill/SKILL.md",
    );
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      "/root/.hermes/skills/my-skill/scripts/setup.sh",
    );
  });

  it("maps provider IDs to correct env var prefixes", async () => {
    for (const [providerId, expectedEnv] of [
      ["anthropic", "ANTHROPIC"],
      ["openai", "OPENAI"],
      ["google", "GOOGLE"],
    ] as const) {
      mockCreate.mockResolvedValue(mockSandbox);
      await createHermesSandbox(
        { ...testConfig, llmProvider: providerId },
        "test",
        testSkillFiles,
        () => {},
      );

      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          envVars: expect.objectContaining({
            LLM_PROVIDER: expectedEnv,
          }),
        }),
        expect.anything(),
      );
    }
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

      // Reset active state by destroying first
      await createHermesSandbox(testConfig, "test", testSkillFiles, () => {});
      await destroySandbox("test-daytona-key", "sb-test-123");

      // Now try with unknown ID
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
