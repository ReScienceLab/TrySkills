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

beforeEach(() => {
  vi.clearAllMocks()
})

describe("discoverSkills", () => {
  it("discovers multiple skills from a repo", async () => {
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/baoyu-comic/SKILL.md", type: "blob" },
          { path: "skills/baoyu-imagine/SKILL.md", type: "blob" },
          { path: "skills/baoyu-translate/SKILL.md", type: "blob" },
          { path: "README.md", type: "blob" },
          { path: "skills/baoyu-comic/scripts", type: "tree" },
        ],
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Baoyu Comic\ndescription: Create comics\nicon: \uD83C\uDFA8\n---\n# Comic",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Baoyu Imagine\ndescription: Generate images\n---\n# Imagine",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Baoyu Translate\ndescription: Translate text\n---\n# Translate",
      })

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
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/my-skill/SKILL.md", type: "blob" },
          { path: ".claude/skills/dev-only/SKILL.md", type: "blob" },
        ],
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "---\nname: My Skill\ndescription: A skill\n---\n",
    })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].skillName).toBe("my-skill")
  })

  it("returns empty array when no SKILL.md files found", async () => {
    mockGithubFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tree: [
            { path: "README.md", type: "blob" },
            { path: "src/index.ts", type: "blob" },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(0)
  })

  it("falls back to master branch", async () => {
    mockGithubFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tree: [
            { path: "skills/a-skill/SKILL.md", type: "blob" },
          ],
        }),
      })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "---\nname: A Skill\ndescription: Something\n---\n",
    })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(mockGithubFetch).toHaveBeenCalledTimes(2)
  })

  it("handles SKILL.md fetch failures gracefully", async () => {
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/good-skill/SKILL.md", type: "blob" },
          { path: "skills/bad-skill/SKILL.md", type: "blob" },
        ],
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Good Skill\ndescription: Works\n---\n",
      })
      .mockResolvedValueOnce({ ok: false })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe("Good Skill")
  })

  it("sorts skills alphabetically by name", async () => {
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/z-skill/SKILL.md", type: "blob" },
          { path: "skills/a-skill/SKILL.md", type: "blob" },
          { path: "skills/m-skill/SKILL.md", type: "blob" },
        ],
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Zebra\ndescription: Z\n---\n",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Apple\ndescription: A\n---\n",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Mango\ndescription: M\n---\n",
      })

    const skills = await discoverSkills("owner", "repo")
    expect(skills.map((s) => s.name)).toEqual(["Apple", "Mango", "Zebra"])
  })

  it("uses directory name as fallback when no frontmatter name", async () => {
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/my-skill/SKILL.md", type: "blob" },
        ],
      }),
    })

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
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/category/sub-skill/SKILL.md", type: "blob" },
          { path: "deep/nested/skill/SKILL.md", type: "blob" },
        ],
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Sub Skill\ndescription: Nested\n---\n",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Deep Skill\ndescription: Deep\n---\n",
      })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(2)
    const sub = skills.find((s) => s.name === "Sub Skill")
    const deep = skills.find((s) => s.name === "Deep Skill")
    expect(sub?.skillPath).toBe("/owner/repo/category/sub-skill")
    expect(deep?.skillPath).toBe("/owner/repo/deep/nested/skill")
  })

  it("strips known skill directory prefixes", async () => {
    mockGithubFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: "skills/baoyu-comic/SKILL.md", type: "blob" },
          { path: ".agents/skills/polish/SKILL.md", type: "blob" },
        ],
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Comic\ndescription: Comics\n---\n",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "---\nname: Polish\ndescription: Polish\n---\n",
      })

    const skills = await discoverSkills("owner", "repo")
    expect(skills).toHaveLength(2)
    const comic = skills.find((s) => s.name === "Comic")
    const polish = skills.find((s) => s.name === "Polish")
    expect(comic?.skillPath).toBe("/owner/repo/baoyu-comic")
    expect(polish?.skillPath).toBe("/owner/repo/polish")
  })
})
