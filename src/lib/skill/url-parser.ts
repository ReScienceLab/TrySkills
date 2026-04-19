const KNOWN_SKILL_DIRS = [
  "skills/",
  ".agents/skills/",
  ".claude/skills/",
  "plugin/skills/",
  "plugins/",
  ".github/plugins/",
  "src/skills/",
];

export function parseSkillUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;

  // Reject obviously malicious input
  if (url.includes("..") || url.includes("<") || url.includes(">") || url.includes("javascript:")) {
    return null;
  }

  // skills.sh URL: https://skills.sh/owner/repo/skill-name
  if (url.includes("skills.sh/")) {
    const match = url.match(/skills\.sh\/(.+)/);
    return match ? validatePath(`/${match[1]}`) : null;
  }

  // tryskills.sh URL: already in correct format
  if (url.includes("tryskills.sh/")) {
    const match = url.match(/tryskills\.sh\/(.+)/);
    return match ? validatePath(`/${match[1]}`) : null;
  }

  // GitHub URL: https://github.com/owner/repo/tree/branch/path/to/skill
  if (url.includes("github.com/")) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/);
    if (!match) return null;

    const owner = match[1];
    const repo = match[2];
    const treePath = match[3] || "";

    if (!treePath) {
      // Just a repo URL, no path -- can't determine skill
      return null;
    }

    // Strip known skill directory prefixes from the tree path
    let skillName = treePath;
    // Remove trailing slash
    skillName = skillName.replace(/\/$/, "");

    // Handle plugins/{owner}/skills/{skill} pattern first (before generic strip)
    const pluginsMatch = skillName.match(/^plugins\/[^/]+\/skills\/(.+)/);
    if (pluginsMatch) {
      skillName = pluginsMatch[1];
    } else {
      // Handle .github/plugins/{repo}/skills/{category}/{skill} pattern
      const ghPluginsMatch = skillName.match(/^\.github\/plugins\/[^/]+\/skills\/(?:[^/]+\/)?(.+)/);
      if (ghPluginsMatch) {
        skillName = ghPluginsMatch[1];
      } else {
        // Strip known simple prefixes
        for (const dir of KNOWN_SKILL_DIRS) {
          if (dir === "plugins/") continue; // already handled above
          if (skillName.startsWith(dir)) {
            skillName = skillName.slice(dir.length);
            break;
          }
        }
      }
    }

    // Remove trailing slash again
    skillName = skillName.replace(/\/$/, "");

    if (!skillName) return null;

    return validatePath(`/${owner}/${repo}/${skillName}`);
  }

  // Plain path: owner/repo/skill-name (no protocol)
  if (url.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+/)) {
    return validatePath(`/${url}`);
  }

  return null;
}

function validatePath(path: string): string | null {
  // Must have at least 3 segments: /owner/repo/skill
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 3) return null;

  // Each segment must be safe (no path traversal, no special chars)
  const safeSegment = /^[a-zA-Z0-9_.:@-]+$/;
  for (const seg of segments) {
    if (!safeSegment.test(seg)) return null;
  }

  return `/${segments.join("/")}`;
}
