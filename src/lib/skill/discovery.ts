import { githubFetch } from "@/lib/github-fetch"
import { parseSkillFrontmatter } from "./parser"

export interface DiscoveredSkill {
  skillName: string
  skillPath: string
  name: string
  description: string
  icon?: string
}

const EXCLUDED_DIR_PREFIXES = [
  ".claude/skills/",
  ".github/",
]

export async function discoverSkills(
  owner: string,
  repo: string,
): Promise<DiscoveredSkill[]> {
  for (const branch of ["main", "master"]) {
    const treeRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    ).catch((err) => {
      if (err.name === "GitHubRateLimitError") throw err
      return null
    })

    if (!treeRes || !treeRes.ok) continue

    const data = await treeRes.json()
    const items = (data.tree || []) as { path: string; type: string }[]

    const skillMdFiles = items.filter(
      (item) =>
        item.type === "blob" &&
        (item.path.endsWith("/SKILL.md") || item.path.endsWith("/skill.md")),
    )

    if (skillMdFiles.length === 0) continue

    const filtered = skillMdFiles.filter((item) => {
      return !EXCLUDED_DIR_PREFIXES.some((prefix) => item.path.startsWith(prefix))
    })

    if (filtered.length === 0) continue

    const skills: DiscoveredSkill[] = []

    const fetches = filtered.map(async (item) => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`
      try {
        const res = await fetch(rawUrl)
        if (!res.ok) return null

        const content = await res.text()
        const { meta } = parseSkillFrontmatter(content)

        const dirPath = item.path.replace(/\/SKILL\.md$/i, "")
        const skillName = dirPath.split("/").pop() || dirPath

        return {
          skillName,
          skillPath: `/${owner}/${repo}/${skillName}`,
          name: meta.name || skillName,
          description: meta.description || "",
          icon: meta.icon,
        } satisfies DiscoveredSkill
      } catch {
        return null
      }
    })

    const results = await Promise.all(fetches)
    for (const result of results) {
      if (result) skills.push(result)
    }

    skills.sort((a, b) => a.name.localeCompare(b.name))
    return skills
  }

  return []
}
