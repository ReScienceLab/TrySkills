import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSkillPath, fetchSkillContent } from "@/lib/skill/resolver";

describe("resolveSkillPath", () => {
  it("parses a standard 3-segment path", () => {
    const result = resolveSkillPath(["anthropics", "skills", "frontend-design"]);
    expect(result.owner).toBe("anthropics");
    expect(result.repo).toBe("skills");
    expect(result.skillName).toBe("frontend-design");
    expect(result.rawBaseUrl).toBe(
      "https://api.github.com/repos/anthropics/skills/contents/frontend-design",
    );
  });

  it("handles nested skill paths", () => {
    const result = resolveSkillPath(["owner", "repo", "category", "skill-name"]);
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.skillName).toBe("category/skill-name");
  });

  it("handles missing segments gracefully", () => {
    const result = resolveSkillPath([]);
    expect(result.owner).toBe("");
    expect(result.repo).toBe("");
    expect(result.skillName).toBe("");
  });

  it("handles single segment", () => {
    const result = resolveSkillPath(["only-owner"]);
    expect(result.owner).toBe("only-owner");
    expect(result.repo).toBe("");
    expect(result.skillName).toBe("");
  });

  it("handles two segments (no skill name)", () => {
    const result = resolveSkillPath(["owner", "repo"]);
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.skillName).toBe("");
  });
});

describe("fetchSkillContent with fallback paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns content from primary path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/main/find-skills/SKILL.md")) {
        return new Response("# Primary", { status: 200 });
      }
      return new Response("", { status: 404 });
    });

    const resolved = resolveSkillPath(["owner", "repo", "find-skills"]);
    const content = await fetchSkillContent(resolved);
    expect(content).toBe("# Primary");
    fetchSpy.mockRestore();
  });

  it("falls back to repo-name subdirectory path", async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      callCount++;
      if (String(url).includes("/main/skills/find-skills/SKILL.md")) {
        return new Response("# Fallback repo-subdir", { status: 200 });
      }
      return new Response("", { status: 404 });
    });

    const resolved = resolveSkillPath(["vercel-labs", "skills", "find-skills"]);
    const content = await fetchSkillContent(resolved);
    expect(content).toBe("# Fallback repo-subdir");
    expect(callCount).toBeGreaterThan(1);
    fetchSpy.mockRestore();
  });

  it("returns null when all paths fail", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );

    const resolved = resolveSkillPath(["nonexistent", "repo", "skill"]);
    const content = await fetchSkillContent(resolved);
    expect(content).toBeNull();
    fetchSpy.mockRestore();
  });
});
