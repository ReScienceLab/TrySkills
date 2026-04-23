import { describe, it, expect, vi, beforeEach } from "vitest"
import { discoverSkills } from "@/lib/skill/discovery"

const mockGithubFetch = vi.fn()
vi.mock("@/lib/github-fetch", () => ({
  githubFetch: (...args: unknown[]) => mockGithubFetch(...args),
  GitHubRateLimitError: class extends Error {
    resetAt: number
    constructor(resetAt: number) {
      super("Rate limited")
      this.name = "GitHubRateLimitError"
      this.resetAt = resetAt
    }
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const defaultBranchMock = {
  ok: true,
  json: async () => ({ default_branch: "main" }),
}

beforeEach(() => {
  vi.clearAllMocks()
})

function mockTree(tree: { path: string; type: string }[]) {
  return {
    ok: true,
    json: async () => ({ tree }),
  }
}

function mockSkillMd(name: string, description: string, icon?: string) {
  const frontmatter = icon
    ? `---\nname: ${name}\ndescription: ${description}\nicon: ${icon}\n---\n`
    : `---\nname: ${name}\ndescription: ${description}\n---\n`
  return {
    ok: true,
    text: async () => frontmatter,
  }
}

describe("discoverSkills", () => {
  it("discovers multiple skills from a repo", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/baoyu-comic/SKILL.md", type: "blob" },
        { path: "skills/baoyu-imagine/SKILL.md", type: "blob" },
        { path: "skills/baoyu-translate/SKILL.md", type: "blob" },
        { path: "README.md", type: "blob" },
        { path: "skills/baoyu-comic/scripts", type: "tree" },
      ]))

    mockFetch
      .mockResolvedValueOnce(mockSkillMd("Baoyu Comic", "Create comics", "\uD83C\uDFA8"))
      .mockResolvedValueOnce(mockSkillMd("Baoyu Imagine", "Generate images"))
      .mockResolvedValueOnce(mockSkillMd("Baoyu Translate", "Translate text"))

    const skills = await discoverSkills("JimLiu", "baoyu-skills")

    expect(skills).toHaveLength(3)
    expect(skills[0]).toEqual({
      skillName: "baoyu-comic",
      skillPath: "/JimLiu/baoyu-skills/baoyu-comic",
      name: "Baoyu Comic",
      description: "Create comics",
      icon: "\uD83C\uDFA8",
    })
    expect(skills[1].name).toBe("Baoyu Imagine")
    expect(skills[2].name).toBe("Baoyu Translate")
  })

  it("excludes skills in .claude/skills directories", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/my-skill/SKILL.md", type: "blob" },
        { path: ".claude/skills/dev-only/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce(mockSkillMd("My Skill", "A skill"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillName).toBe("my-skill")
  })

  it("returns empty array when no SKILL.md files found", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "README.md", type: "blob" },
        { path: "src/index.ts", type: "blob" },
      ]))
      .mockResolvedValueOnce({ ok: false })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(0)
  })

  it("falls back to master branch", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(mockTree([
        { path: "skills/a-skill/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce(mockSkillMd("A Skill", "Something"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
  })

  it("handles SKILL.md fetch failures gracefully", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/good-skill/SKILL.md", type: "blob" },
        { path: "skills/bad-skill/SKILL.md", type: "blob" },
      ]))

    mockFetch
      .mockResolvedValueOnce(mockSkillMd("Good Skill", "Works"))
      .mockResolvedValueOnce({ ok: false })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe("Good Skill")
  })

  it("sorts skills alphabetically by name", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/z-skill/SKILL.md", type: "blob" },
        { path: "skills/a-skill/SKILL.md", type: "blob" },
        { path: "skills/m-skill/SKILL.md", type: "blob" },
      ]))

    mockFetch
      .mockResolvedValueOnce(mockSkillMd("Zebra", "Z"))
      .mockResolvedValueOnce(mockSkillMd("Apple", "A"))
      .mockResolvedValueOnce(mockSkillMd("Mango", "M"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills.map((s) => s.name)).toEqual(["Apple", "Mango", "Zebra"])
  })

  it("uses directory name as fallback when no frontmatter name", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/my-skill/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "# My Skill\n\nJust a description without frontmatter.",
    })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillName).toBe("my-skill")
    expect(skills[0].name).toBe("my-skill")
  })

  it("preserves full skill path for nested directories", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/category/sub-skill/SKILL.md", type: "blob" },
        { path: "deep/nested/skill/SKILL.md", type: "blob" },
      ]))

    mockFetch
      .mockResolvedValueOnce(mockSkillMd("Sub Skill", "Nested"))
      .mockResolvedValueOnce(mockSkillMd("Deep Skill", "Deep"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(2)
    const sub = skills.find((s) => s.name === "Sub Skill")
    const deep = skills.find((s) => s.name === "Deep Skill")
    expect(sub?.skillPath).toBe("/owner/repo/category/sub-skill")
    expect(deep?.skillPath).toBe("/owner/repo/deep/nested/skill")
  })

  it("strips known skill directory prefixes", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "skills/baoyu-comic/SKILL.md", type: "blob" },
        { path: ".agents/skills/polish/SKILL.md", type: "blob" },
      ]))

    mockFetch
      .mockResolvedValueOnce(mockSkillMd("Comic", "Comics"))
      .mockResolvedValueOnce(mockSkillMd("Polish", "Polish"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(2)
    const comic = skills.find((s) => s.name === "Comic")
    const polish = skills.find((s) => s.name === "Polish")
    expect(comic?.skillPath).toBe("/owner/repo/baoyu-comic")
    expect(polish?.skillPath).toBe("/owner/repo/polish")
  })

  it("strips plugins/{owner}/skills/ prefix", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: "plugins/expo/skills/building-native-ui/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce(mockSkillMd("Building Native UI", "Build UI"))

    const skills = await discoverSkills("expo", "skills")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillPath).toBe("/expo/skills/building-native-ui")
  })

  it("strips .github/plugins/ prefix and preserves nested paths", async () => {
    mockGithubFetch
      .mockResolvedValueOnce(defaultBranchMock)
      .mockResolvedValueOnce(mockTree([
        { path: ".github/plugins/myrepo/skills/judge/judge-backup-verified/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce(mockSkillMd("My GH Skill", "From .github"))

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillPath).toBe("/owner/repo/judge/judge-backup-verified")
  })

  it("detects non-standard default branch", async () => {
    mockGithubFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ default_branch: "X" }),
      })
      .mockResolvedValueOnce(mockTree([
        { path: "mod/ccal/SKILL.md", type: "blob" },
      ]))

    mockFetch.mockResolvedValueOnce(mockSkillMd("Calendar", "Cal tool"))

    const skills = await discoverSkills("x-cmd", "x-cmd")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillPath).toBe("/x-cmd/x-cmd/mod/ccal")
    expect(mockGithubFetch).toHaveBeenCalledWith(
      expect.stringContaining("/git/trees/X?"),
    )
  })
})
