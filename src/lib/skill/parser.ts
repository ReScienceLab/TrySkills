import type { SkillMeta } from "./resolver";

export function parseSkillFrontmatter(content: string): {
  meta: SkillMeta;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: { name: "Unknown Skill", description: content.slice(0, 200) },
      body: content,
    };
  }

  const frontmatter = match[1];
  const body = match[2];
  const meta: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      meta[key] = val;
    }
  }

  return {
    meta: {
      name: meta.name || "Unknown Skill",
      description: meta.description || "",
      author: meta.author,
      icon: meta.icon,
      version: meta.version,
    },
    body,
  };
}
