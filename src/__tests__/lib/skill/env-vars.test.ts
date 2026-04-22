import { describe, it, expect } from "vitest"
import { extractSkillEnvVars } from "@/lib/skill/env-vars"

describe("extractSkillEnvVars", () => {
  it("parses Hermes required_environment_variables (objects)", () => {
    const content = `---
name: gif-search
description: Search for GIFs
required_environment_variables:
  - name: TENOR_API_KEY
    prompt: Tenor API key
    help: https://developers.google.com/tenor
    required_for: full functionality
  - name: GIPHY_API_KEY
    prompt: Giphy API key
---
# GIF Search
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: "TENOR_API_KEY",
      description: "Tenor API key",
      help: "https://developers.google.com/tenor",
      required: true,
    })
    expect(result[1]).toEqual({
      name: "GIPHY_API_KEY",
      description: "Giphy API key",
      help: undefined,
      required: true,
    })
  })

  it("parses Hermes required_environment_variables (simple strings)", () => {
    const content = `---
name: test
required_environment_variables:
  - TENOR_API_KEY
  - WEBHOOK_SECRET
---
# Test
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("TENOR_API_KEY")
    expect(result[0].required).toBe(true)
    expect(result[1].name).toBe("WEBHOOK_SECRET")
  })

  it("parses legacy prerequisites.env_vars", () => {
    const content = `---
name: test
prerequisites:
  env_vars: [CUSTOM_API_KEY, GITHUB_TOKEN]
---
# Test
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("CUSTOM_API_KEY")
    expect(result[1].name).toBe("GITHUB_TOKEN")
  })

  it("parses markdown body Environment Variables table", () => {
    const content = `---
name: baoyu-imagine
description: AI image generation
---
# Image Generation

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`DASHSCOPE_API_KEY\` | DashScope API key |
| \`ZAI_API_KEY\` (alias \`BIGMODEL_API_KEY\`) | Z.AI API key |
| \`REPLICATE_API_TOKEN\` | Replicate API token |
| \`JIMENG_ACCESS_KEY_ID\`, \`JIMENG_SECRET_ACCESS_KEY\` | Jimeng credentials |

## Usage
`
    const result = extractSkillEnvVars(content)
    const names = result.map((r) => r.name)
    expect(names).toContain("DASHSCOPE_API_KEY")
    expect(names).toContain("ZAI_API_KEY")
    expect(names).toContain("BIGMODEL_API_KEY")
    expect(names).toContain("REPLICATE_API_TOKEN")
    expect(names).toContain("JIMENG_ACCESS_KEY_ID")
    expect(names).toContain("JIMENG_SECRET_ACCESS_KEY")
  })

  it("filters out managed env vars", () => {
    const content = `---
name: test
---
# Test

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`OPENAI_API_KEY\` | OpenAI API key |
| \`OPENROUTER_API_KEY\` | OpenRouter API key |
| \`DASHSCOPE_API_KEY\` | DashScope API key |
| \`GOOGLE_API_KEY\` | Google API key |
`
    const result = extractSkillEnvVars(content)
    const names = result.map((r) => r.name)
    // These are managed by TrySkills LLM provider config
    expect(names).not.toContain("OPENAI_API_KEY")
    expect(names).not.toContain("OPENROUTER_API_KEY")
    expect(names).not.toContain("GOOGLE_API_KEY")
    // This is NOT managed
    expect(names).toContain("DASHSCOPE_API_KEY")
  })

  it("deduplicates across frontmatter and body", () => {
    const content = `---
name: test
required_environment_variables:
  - name: MY_API_KEY
    prompt: My API key
    help: https://example.com
---
# Test

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`MY_API_KEY\` | My API key |
| \`OTHER_KEY\` | Other key |
`
    const result = extractSkillEnvVars(content)
    const myKeys = result.filter((r) => r.name === "MY_API_KEY")
    expect(myKeys).toHaveLength(1)
    // Frontmatter takes priority (has help + required)
    expect(myKeys[0].help).toBe("https://example.com")
    expect(myKeys[0].required).toBe(true)
    expect(result.find((r) => r.name === "OTHER_KEY")).toBeDefined()
  })

  it("handles content without frontmatter", () => {
    const content = `# Some Skill

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`CUSTOM_TOKEN\` | Custom token |
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("CUSTOM_TOKEN")
  })

  it("returns empty for content with no env vars", () => {
    const content = `---
name: simple-skill
description: No env vars needed
---
# Simple Skill

Just does stuff.
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(0)
  })

  it("skips template patterns like <PROVIDER>_BASE_URL", () => {
    const content = `## Environment Variables

| Variable | Description |
|----------|-------------|
| \`DASHSCOPE_API_KEY\` | DashScope key |
| \`<PROVIDER>_BASE_URL\` | Per-provider endpoint |
| \`<PROVIDER>_IMAGE_MODEL\` | Per-provider model |
`
    const result = extractSkillEnvVars(content)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("DASHSCOPE_API_KEY")
  })
})
