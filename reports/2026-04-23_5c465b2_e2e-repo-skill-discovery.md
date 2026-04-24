# E2E Test Report: Repo Skill Discovery

| Field | Value |
|-------|-------|
| Date | 2026-04-23 |
| Commit | `5c465b2` |
| PR | [#24](https://github.com/ReScienceLab/TrySkills/pull/24) |
| Target | `tryskillssh-git-feat-repo-skill-discovery-resciencelab.vercel.app` |
| Feature | Auto-discover skills from repository URL |

## Test Environment

| Setting | Value |
|---------|-------|
| Browser | Chromium (agent-browser) |
| Viewport | 1440x900 |
| Auth | Clerk ticket strategy (test user) |
| Convex | dev (`tame-seahorse-513`) |

## Test Results

| # | Test | Result | Details |
|---|------|--------|---------|
| T1 | Single-skill repo (forrestchang/andrej-karpathy-skills) | **PASS** | Detected 1 skill (`karpathy-guidelines`), auto-navigated directly to skill page, sandbox launch started |
| T2 | Multi-skill repo URL (github.com/jimliu/baoyu-skills) | **PASS** | Entered full GitHub URL, transitioned to repo picker phase |
| T3 | Skill picker grid display | **PASS** | 21 skills found, 3-column responsive grid, each card shows name + description + directory name, GitHub link + skill count badge |
| T4 | Skill selection -> tree preview | **PASS** | Clicked `baoyu-article-illustrator`, tree preview loaded with 36 files, directory structure with folders (prompts, references/config, palettes, styles), "Configure & Launch" button ready |
| T5 | Plain owner/repo text input | **PASS** | Entered `forrestchang/andrej-karpathy-skills` (no github.com prefix), auto-navigated to single skill |
| T6 | Invalid repo (nonexistent) | **PASS** | Shows "No skills found in this repository" empty state with SKILL.md hint, "0 skills found" badge, "Change URL" back button |
| T7 | Console errors | **PASS** | No discovery-related errors. Known Clerk dev/preview issuer mismatch (expected in preview env). 404s from GitHub API for nonexistent repo (expected). |

**Result: 7/7 PASS**

## Skills Discovered (baoyu-skills)

All 21 skills correctly detected and displayed:
baoyu-article-illustrator, baoyu-comic, baoyu-compress-image, baoyu-cover-image, baoyu-danger-gemini-web, baoyu-danger-x-to-markdown, baoyu-diagram, baoyu-format-markdown, baoyu-image-cards, baoyu-image-gen, baoyu-imagine, baoyu-infographic, baoyu-markdown-to-html, baoyu-post-to-wechat, baoyu-post-to-weibo, baoyu-post-to-x, baoyu-slide-deck, baoyu-translate, baoyu-url-to-markdown, baoyu-xhs-images, baoyu-youtube-transcript

## Key Behaviors Verified

1. **Single-skill auto-navigate**: Repos with exactly 1 skill skip the picker and go directly to the skill page
2. **Multi-skill picker**: Repos with multiple skills show a responsive card grid
3. **Skill metadata**: Frontmatter name, description parsed and displayed correctly
4. **Tree preview**: Selecting a skill from the picker loads the file tree with correct directory structure
5. **Plain text input**: `owner/repo` format (without github.com) works correctly
6. **Empty state**: Nonexistent repos show friendly "No skills found" message
7. **Navigation**: "Change URL" back button returns to input phase

## Console Errors

| Error | Severity | Source |
|-------|----------|--------|
| `Failed to authenticate: No auth provider found` | Low | Clerk dev/preview issuer mismatch (known, preview-only) |
| `Failed to load resource: 404` | Low | GitHub API returning 404 for nonexistent repo (expected) |

## Screenshots

| File | Description |
|------|-------------|
| `/tmp/e2e-01-home.png` | Homepage with updated placeholder |
| `/tmp/e2e-02-karpathy-discovery.png` | Single-skill auto-navigate to launch |
| `/tmp/e2e-03-baoyu-discovery.png` | Skill picker grid (21 skills) |
| `/tmp/e2e-04-skill-tree.png` | Tree preview after skill selection |
| `/tmp/e2e-05-plain-repo.png` | Plain owner/repo auto-navigate |
| `/tmp/e2e-06-invalid-repo.png` | Empty state for nonexistent repo |

## Notes

- The skill card buttons have very long description text which caused `agent-browser click` to timeout; worked around by using `document.querySelector('.grid button')?.click()` via JS eval
- Placeholder text updated from `skills.sh/owner/repo/skill-name` to `github.com/owner/repo or owner/repo/skill`
- Default branch detection not tested in E2E (would require a repo with non-main/master default branch)
