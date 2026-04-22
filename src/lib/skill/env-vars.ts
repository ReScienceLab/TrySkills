export interface SkillEnvVar {
  name: string
  description?: string
  help?: string
  required?: boolean
}

const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]{2,}$/

// Env vars we inject ourselves -- skip these in detection
const MANAGED_ENV_VARS = new Set([
  "API_SERVER_ENABLED",
  "API_SERVER_CORS_ORIGINS",
  "GATEWAY_ALLOW_ALL_USERS",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "NOUS_API_KEY",
  "KIMI_API_KEY",
  "MINIMAX_API_KEY",
])

export function extractSkillEnvVars(content: string): SkillEnvVar[] {
  const seen = new Map<string, SkillEnvVar>()

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (fmMatch) {
    parseRequiredEnvVars(fmMatch[1], seen)
    parseLegacyPrereqs(fmMatch[1], seen)
    parseBodyEnvVarsTable(fmMatch[2], seen)
  } else {
    parseBodyEnvVarsTable(content, seen)
  }

  return [...seen.values()].filter((v) => !MANAGED_ENV_VARS.has(v.name))
}

function parseRequiredEnvVars(frontmatter: string, seen: Map<string, SkillEnvVar>) {
  // Match `required_environment_variables:` block
  const blockMatch = frontmatter.match(
    /^required_environment_variables:\s*\n((?:[ \t]+.*\n?)*)/m,
  )
  if (!blockMatch) return

  const block = blockMatch[1]
  // Parse list items: `- name: VAR` or `- VAR`
  const items = block.split(/\n(?=\s*-\s)/)
  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed.startsWith("-")) continue

    // Simple string: `- TENOR_API_KEY`
    const simpleMatch = trimmed.match(/^-\s+([A-Z][A-Z0-9_]+)\s*$/)
    if (simpleMatch) {
      seen.set(simpleMatch[1], { name: simpleMatch[1], required: true })
      continue
    }

    // Object with fields: `- name: VAR`
    const nameMatch = item.match(/name:\s*["']?([A-Z][A-Z0-9_]+)["']?/)
    if (nameMatch) {
      const name = nameMatch[1]
      const promptMatch = item.match(/prompt:\s*(.+)/)
      const helpMatch = item.match(/help:\s*(.+)/)
      seen.set(name, {
        name,
        description: promptMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
        help: helpMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
        required: true,
      })
    }
  }
}

function parseLegacyPrereqs(frontmatter: string, seen: Map<string, SkillEnvVar>) {
  // Match `prerequisites:` block with `env_vars: [VAR1, VAR2]`
  const match = frontmatter.match(/env_vars:\s*\[([^\]]+)\]/)
  if (!match) return

  const vars = match[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
  for (const v of vars) {
    if (ENV_VAR_PATTERN.test(v) && !seen.has(v)) {
      seen.set(v, { name: v, required: true })
    }
  }
}

function parseBodyEnvVarsTable(body: string, seen: Map<string, SkillEnvVar>) {
  // Find `## Environment Variables` section
  const sectionMatch = body.match(
    /##\s+Environment\s+Variables\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
  )
  if (!sectionMatch) return

  const section = sectionMatch[1]
  // Parse markdown table rows: | `VAR_NAME` | description |
  const rows = section.split("\n")
  for (const row of rows) {
    if (!row.includes("|") || row.match(/^[\s|:-]+$/)) continue

    // Extract backtick-wrapped env var names
    const varMatches = row.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean)
    const description = cells[1]?.replace(/`[^`]+`/g, "").trim() || undefined

    for (const m of varMatches) {
      const name = m[1]
      // Skip template patterns like <PROVIDER>_BASE_URL
      if (name.includes("<") || name.includes(">")) continue
      if (!seen.has(name)) {
        seen.set(name, { name, description })
      }
    }
  }
}
