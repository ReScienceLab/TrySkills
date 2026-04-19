import { describe, it, expect } from "vitest";
import { parseSkillUrl } from "@/lib/skill/url-parser";

describe("parseSkillUrl", () => {
  describe("skills.sh URLs", () => {
    it("parses https://skills.sh/owner/repo/skill", () => {
      expect(parseSkillUrl("https://skills.sh/anthropics/skills/frontend-design"))
        .toBe("/anthropics/skills/frontend-design");
    });

    it("parses skills.sh/owner/repo/skill (no protocol)", () => {
      expect(parseSkillUrl("skills.sh/vercel-labs/skills/find-skills"))
        .toBe("/vercel-labs/skills/find-skills");
    });
  });

  describe("GitHub URLs", () => {
    it("parses GitHub tree URL with skills/ prefix", () => {
      expect(parseSkillUrl("https://github.com/ReScienceLab/opc-skills/tree/main/skills/banner-creator"))
        .toBe("/ReScienceLab/opc-skills/banner-creator");
    });

    it("parses GitHub tree URL with direct skill path", () => {
      expect(parseSkillUrl("https://github.com/anthropics/skills/tree/main/frontend-design"))
        .toBe("/anthropics/skills/frontend-design");
    });

    it("parses GitHub tree URL with .agents/skills/ prefix", () => {
      expect(parseSkillUrl("https://github.com/pbakaus/impeccable/tree/main/.agents/skills/polish"))
        .toBe("/pbakaus/impeccable/polish");
    });

    it("parses GitHub tree URL with .claude/skills/ prefix", () => {
      expect(parseSkillUrl("https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max"))
        .toBe("/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max");
    });

    it("parses GitHub tree URL with plugin/skills/ prefix", () => {
      expect(parseSkillUrl("https://github.com/microsoft/github-copilot-for-azure/tree/main/plugin/skills/azure-ai"))
        .toBe("/microsoft/github-copilot-for-azure/azure-ai");
    });

    it("parses GitHub tree URL with plugins/{owner}/skills/ prefix", () => {
      expect(parseSkillUrl("https://github.com/expo/skills/tree/main/plugins/expo/skills/building-native-ui"))
        .toBe("/expo/skills/building-native-ui");
    });

    it("handles different branch names", () => {
      expect(parseSkillUrl("https://github.com/hugmouse/skills/tree/master/value"))
        .toBe("/hugmouse/skills/value");
    });

    it("handles trailing slash", () => {
      expect(parseSkillUrl("https://github.com/ReScienceLab/opc-skills/tree/main/skills/seo-geo/"))
        .toBe("/ReScienceLab/opc-skills/seo-geo");
    });

    it("returns null for repo-only URL without tree path", () => {
      expect(parseSkillUrl("https://github.com/anthropics/skills"))
        .toBeNull();
    });
  });

  describe("plain paths", () => {
    it("parses owner/repo/skill format", () => {
      expect(parseSkillUrl("anthropics/skills/frontend-design"))
        .toBe("/anthropics/skills/frontend-design");
    });

    it("parses with colons (google stitch)", () => {
      expect(parseSkillUrl("google-labs-code/stitch-skills/react:components"))
        .toBe("/google-labs-code/stitch-skills/react:components");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty input", () => {
      expect(parseSkillUrl("")).toBeNull();
    });

    it("returns null for whitespace-only input", () => {
      expect(parseSkillUrl("   ")).toBeNull();
    });

    it("trims whitespace", () => {
      expect(parseSkillUrl("  anthropics/skills/pdf  "))
        .toBe("/anthropics/skills/pdf");
    });

    it("handles tryskills.sh URL", () => {
      expect(parseSkillUrl("https://tryskills.sh/obra/superpowers/brainstorming"))
        .toBe("/obra/superpowers/brainstorming");
    });
  });

  describe("security validation", () => {
    it("rejects path traversal attempts", () => {
      expect(parseSkillUrl("owner/../etc/passwd")).toBeNull();
      expect(parseSkillUrl("https://github.com/owner/repo/tree/main/../../etc")).toBeNull();
    });

    it("rejects XSS payloads", () => {
      expect(parseSkillUrl("<script>alert(1)</script>")).toBeNull();
      expect(parseSkillUrl("javascript:alert(1)")).toBeNull();
    });

    it("rejects paths with only owner/repo (no skill)", () => {
      expect(parseSkillUrl("https://skills.sh/owner/repo")).toBeNull();
    });

    it("rejects random text", () => {
      expect(parseSkillUrl("hello world")).toBeNull();
      expect(parseSkillUrl("https://example.com/something")).toBeNull();
    });

    it("rejects paths with special characters", () => {
      expect(parseSkillUrl("owner/repo/skill name with spaces")).toBeNull();
      expect(parseSkillUrl("owner/repo/<script>")).toBeNull();
    });

    it("allows valid characters in skill names", () => {
      expect(parseSkillUrl("google-labs-code/stitch-skills/react:components"))
        .toBe("/google-labs-code/stitch-skills/react:components");
      expect(parseSkillUrl("owner/repo/skill.v2"))
        .toBe("/owner/repo/skill.v2");
      expect(parseSkillUrl("owner/repo/my_skill"))
        .toBe("/owner/repo/my_skill");
    });
  });
});
