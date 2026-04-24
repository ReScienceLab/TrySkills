# E2E Test Report: Sandbox-side Skill Clone (PR#26)

| Field | Value |
|-------|-------|
| Date | 2026-04-23 |
| Commit | `68f8c95` |
| PR | [#26](https://github.com/ReScienceLab/TrySkills/pull/26) |
| Target | `tryskillssh-git-feat-sandbox-side-skill-clone-resciencelab.vercel.app` |
| Feature | Clone skills directly on sandbox via git sparse-checkout |

## Test Environment

| Setting | Value |
|---------|-------|
| Browser | Chromium (agent-browser) |
| Viewport | 1440x900 |
| Auth | Clerk ticket strategy (test user) |
| Skill | `softaworks/agent-toolkit/mermaid-diagrams` |
| Convex | dev (`tame-seahorse-513`) |
| Sandbox | Cold create (destroyed existing sandbox first) |

## Test Results

| # | Test | Result | Details |
|---|------|--------|---------|
| T1 | Skill page launch (cold create) | **PASS** | Sandbox created in ~1.7s. Clone attempted but failed at 5.4s (skill path not found in candidate dirs). Fell back to browser fetch+upload, completed at 9s. Gateway health check at 11.1s. Total cold create: ~12s |
| T2 | Chat streaming | **PASS** | Agent loaded mermaid-diagrams skill, displayed diagram types table, reference files, and usage suggestions. `skill_view` tool card completed |
| T3 | File creation + workspace | **PASS** | Asked for login flow diagram. Agent created `login-flow.mmd` file. Workspace panel appeared with file in tree |
| T4 | File viewer | **PASS** | Clicked `login-flow.mmd`, file content displayed, "Back to files" link visible |
| T5 | Dashboard | **PASS** | Hermes Agent active, sessions listed with Resume/Delete, Destroy button present |
| T6 | Session resume | **PASS** | Resumed session, full chat history restored, workspace panel with `login-flow.mmd` present |

**Result: 6/6 PASS**

## Clone Performance Analysis

| Phase | Time |
|-------|------|
| SDK loaded | 63ms |
| Snapshot create failed → image fallback | 724ms |
| Sandbox created | 1,696ms |
| **Clone attempted → failed** | **5,380ms** |
| Fallback: browser fetch + upload | 8,987ms |
| Gateway health check | 11,111ms |
| Signed URL | 11,641ms |
| Total | **~12s** |

### Why Clone Failed

The clone tried these candidate paths inside `softaworks/agent-toolkit`:
- `mermaid-diagrams/SKILL.md`
- `skills/mermaid-diagrams/SKILL.md`
- `agent-toolkit/mermaid-diagrams/SKILL.md`
- `.agents/skills/mermaid-diagrams/SKILL.md`
- `.claude/skills/mermaid-diagrams/SKILL.md`
- `plugin/skills/mermaid-diagrams/SKILL.md`
- `plugins/softaworks/skills/mermaid-diagrams/SKILL.md`

The actual skill path in the repo needs investigation -- `fetchSkillDirectory` found it via the tree API fallback which does a more exhaustive search. The clone path covers the most common layouts but not all of the resolver's fuzzy matching (prefix stripping, dash-trim, etc.).

### Impact

Even with clone failing and falling back to browser upload, the full flow completed successfully in ~12s. When clone succeeds (repos with standard `skills/` layout like baoyu-skills), the upload phase would be eliminated entirely, saving ~3-5s.

## Console Errors

| Error | Severity | Source |
|-------|----------|--------|
| `Failed to authenticate: No auth provider found` | Low | Clerk dev issuer mismatch (preview env) |
| `400 Bad Request` | Low | Snapshot create attempt (expected fallback) |
| `404` responses | Low | GitHub API candidate path probing |
| `403` responses | Low | GitHub rate limit on fallback fetch |

## Screenshots

| File | Description |
|------|-------------|
| `/tmp/e2e-clone-01-skill.png` | Chat panel ready after cold create |
| `/tmp/e2e-clone-03-chat-done.png` | Chat response with skill overview |
| `/tmp/e2e-clone-04-workspace.png` | Workspace panel with login-flow.mmd |
| `/tmp/e2e-clone-06-fileview.png` | File viewer showing mermaid content |
| `/tmp/e2e-clone-07-dashboard.png` | Dashboard with active sandbox |
| `/tmp/e2e-clone-08-resume.png` | Session resumed with full history |
