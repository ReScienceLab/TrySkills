import { githubFetch } from "@/lib/github-fetch"
import { parseSkillFrontmatter } from "./parser"

export interface DiscoveredSkill {
  skillName: string
  skillPath: string
  name: string
  description: string
  icon?: string
}

const KNOWN_SKILL_DIR_PREFIXES = [
  "skills/",
  ".agents/skills/",
  "plugin/skills/",
  "src/skills/",
]

const EXCLUDED_DIR_PREFIXES = [
  ".claude/skills/",
]

async function getDefaultBranch(owner: string, repo: string): Promise<string[]> {
  try {
    const res = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}`,
    )
    if (res.ok) {
      const data = await res.json()
      const defaultBranch = data.default_branch
      if (defaultBranch && defaultBranch !== "main" && defaultBranch !== "master") {
        return [defaultBranch, "main", "master"]
      }
    }
  } catch {
    // Fall through to defaults
  }
  return ["main", "master"]
}

export async function discoverSkills(
  owner: string,
  repo: string,
): Promise<DiscoveredSkill[]> {
  const branches = await getDefaultBranch(owner, repo)

  for (const branch of branches) {
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
        let skillName = dirPath

        // Strip known directory prefixes to get the skill-relative name
        // Handle plugins/{owner}/skills/{skill} pattern
        const pluginsMatch = skillName.match(/^plugins\/[^/]+\/skills\/(.+)/)
        if (pluginsMatch) {
          skillName = pluginsMatch[1]
        } else {
          // Handle .github/plugins/{repo}/skills/{...rest} pattern
          const ghPluginsMatch = skillName.match(/^\.github\/plugins\/[^/]+\/skills\/(.+)/)
          if (ghPluginsMatch) {
            skillName = ghPluginsMatch[1]
          } else {
            for (const prefix of KNOWN_SKILL_DIR_PREFIXES) {
              if (skillName.startsWith(prefix)) {
                skillName = skillName.slice(prefix.length)
                break
              }
            }
          }
        }

        const displayName = (meta.name && meta.name !== "Unknown Skill")
          ? meta.name
          : skillName.split("/").pop() || skillName

        return {
          skillName,
          skillPath: `/${owner}/${repo}/${skillName}`,
          name: displayName,
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
