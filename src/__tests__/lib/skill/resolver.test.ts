import { describe, it, expect } from "vitest";
import { resolveSkillPath } from "@/lib/skill/resolver";

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
