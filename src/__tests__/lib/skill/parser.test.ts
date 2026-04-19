import { describe, it, expect } from "vitest";
import { parseSkillFrontmatter } from "@/lib/skill/parser";

describe("parseSkillFrontmatter", () => {
  it("parses valid frontmatter with all fields", () => {
    const content = `---
name: frontend-design
description: Beautiful web interfaces
author: Anthropic
icon: "\uD83C\uDFA8"
version: "2.1.0"
---

# frontend-design

Some body content here.`;

    const { meta, body } = parseSkillFrontmatter(content);
    expect(meta.name).toBe("frontend-design");
    expect(meta.description).toBe("Beautiful web interfaces");
    expect(meta.author).toBe("Anthropic");
    expect(meta.icon).toBe("\uD83C\uDFA8");
    expect(meta.version).toBe("2.1.0");
    expect(body).toContain("# frontend-design");
    expect(body).toContain("Some body content here.");
  });

  it("parses frontmatter with minimal fields", () => {
    const content = `---
name: test-skill
description: A test skill
---

Body.`;

    const { meta, body } = parseSkillFrontmatter(content);
    expect(meta.name).toBe("test-skill");
    expect(meta.description).toBe("A test skill");
    expect(meta.author).toBeUndefined();
    expect(meta.icon).toBeUndefined();
    expect(meta.version).toBeUndefined();
    expect(body.trim()).toBe("Body.");
  });

  it("handles content without frontmatter", () => {
    const content = "Just plain text without frontmatter delimiters.";
    const { meta, body } = parseSkillFrontmatter(content);
    expect(meta.name).toBe("Unknown Skill");
    expect(meta.description).toBe("Just plain text without frontmatter delimiters.");
    expect(body).toBe(content);
  });

  it("handles empty content", () => {
    const { meta, body } = parseSkillFrontmatter("");
    expect(meta.name).toBe("Unknown Skill");
    expect(body).toBe("");
  });

  it("strips quotes from frontmatter values", () => {
    const content = `---
name: "quoted-name"
description: 'single-quoted'
---

Body.`;

    const { meta } = parseSkillFrontmatter(content);
    expect(meta.name).toBe("quoted-name");
    expect(meta.description).toBe("single-quoted");
  });

  it("handles colons in description values", () => {
    const content = `---
name: test
description: This has: a colon in it
---

Body.`;

    const { meta } = parseSkillFrontmatter(content);
    expect(meta.description).toBe("This has: a colon in it");
  });
});
