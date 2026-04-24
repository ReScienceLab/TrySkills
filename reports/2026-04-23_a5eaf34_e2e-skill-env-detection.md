# E2E Test Report: Skill Env Var Auto-Detection

| Field | Value |
|-------|-------|
| Date | 2026-04-23 |
| Commit | `a5eaf34` |
| PR | [#23](https://github.com/ReScienceLab/TrySkills/pull/23) |
| Branch | `feat/skill-env-detection` |
| Target | `tryskillssh-git-feat-skill-env-detection-resciencelab.vercel.app` |

## Test Environment

| Component | Detail |
|-----------|--------|
| Browser | agent-browser (Chromium) |
| Viewport | 1440x900 |
| Auth | Clerk ticket strategy (test-agent@tryskills.sh) |
| LLM | OpenRouter (anthropic/claude-sonnet-4.6) |
| Skill | softaworks/agent-toolkit/mermaid-diagrams |
| Convex | dev:tame-seahorse-513 |

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| T1: Homepage | PASS | All nav links, signed in |
| T2: Skill Page Launch | PASS | Cold create after sandbox destroy (~50s) |
| T3: Chat Streaming | PASS | skill_view tool card, full response |
| T4: File Creation + Workspace | PASS | cicd-pipeline.mmd created, workspace panel visible |
| T5: File Viewer | PASS | File content in monospace, Back to files |
| T6: Dashboard | PASS | 3 sections, 3 sessions, active sandbox |
| T7: Session Resume | PASS | Full history, workspace restored |

**Result: 7/7 PASS**

## Feature-Specific Observations

### Env Var Detection
- mermaid-diagrams skill has NO env var declarations in its SKILL.md
- No env var prompt appeared during launch (correct behavior)
- The early fetch (`fetchSkillContent`) ran silently on page load without affecting launch timing

### Env Var Prompt (Not Triggered)
- Since the test skill has no env vars, the `EnvVarsPrompt` modal was not shown
- This confirms the feature correctly skips the prompt when no env vars are detected
- Full prompt testing requires a skill with env var declarations (e.g., baoyu-imagine)

## Known Issues

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | Medium | Stale sandbox from PR #22 had dead gateway, needed destroy + cold create | Pre-existing infra issue |

## Console Errors

| Error | Severity | Notes |
|-------|----------|-------|
| Clerk dev keys warning | Info | Expected on preview |
| Convex auth provider mismatch | Medium | Preview Clerk domain vs Convex config |
| 404 resource load | Low | Asset loading on preview |
| installSkill health check timeout (x2) | Medium | Stale sandbox, resolved after destroy |

## Screenshots

| Test | Path |
|------|------|
| T1: Homepage | `/tmp/e2e-01-home.png` |
| T2: Skill Launch | `/tmp/e2e-02-skill.png` |
| T3: Chat Streaming | `/tmp/e2e-03-chat.png` |
| T4: Workspace Panel | `/tmp/e2e-04-workspace.png` |
| T5: File Viewer | `/tmp/e2e-05-fileview.png` |
| T6: Dashboard | `/tmp/e2e-06-dashboard.png` |
| T7: Session Resume | `/tmp/e2e-07-resume.png` |
| Console Log | `/tmp/e2e-console.log` |
