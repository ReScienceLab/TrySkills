# E2E Report: Skill Discovery Fix (v2)

| Field | Value |
|-------|-------|
| Date | 2026-04-24 |
| Commit | `318c006` |
| PR | [#29](https://github.com/ReScienceLab/TrySkills/pull/29) |
| Target | `tryskillssh-git-fix-skill-discovery-hotload-resciencelab.vercel.app` |
| Skill | `soultrace-ai/soultrace-skill/soultrace` |
| Auth | Clerk ticket (test-agent@tryskills.sh) |
| LLM | OpenRouter (default) |

## Changes Tested

1. `skills.external_dirs: [/root/.agents/skills]` added to Hermes config.yaml
2. Gateway restart skipped when `skipConfigWrite=true` (Hermes `skills_list` hot-reloads from disk)

## Cold Create Timing

| Phase | Duration |
|-------|----------|
| SDK load | 35ms |
| Snapshot create (with fallback) | 1.5s |
| npx skills add | 5.2s |
| Symlink | 0.2s |
| Gateway start + health check | 2.1s |
| Signed URL | 0.7s |
| **Total** | **~10s** |

## Test Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| T1 | Homepage | **PASS** | Nav links, skill URL input, signed in |
| T2 | Skill page launch | **PASS** | Cold create ~10s, chat panel ready |
| T3 | Skill discovery | **PASS** | Agent confirms: "Yes. Total skill count: 68." (67 bundled + soultrace) |
| T4 | Dashboard | **PASS** | Sandbox info, sessions, skill trials all visible |
| T5 | Session resume | **PASS** | Previous chat history loaded, input ready |

**5/5 PASS**

## Key Findings

1. **Skill discovery works without gateway restart**: `skills_list` tool rescans disk on every call. Adding `skills.external_dirs` to config.yaml is sufficient.
2. **Hot-swap timing saved ~2-3s**: No gateway restart needed when config unchanged, so the install path is just `npx skills add` + symlink (~6-7s).
3. **Wake-from-stopped fragility**: First attempt failed with health check timeout after waking sandbox from stopped state. Gateway started but didn't respond. Retry also failed because `skipConfigWrite=true` didn't restart the dead gateway. Fresh cold create worked fine.

## Known Issue

When a sandbox wakes from stopped and the gateway fails to start, retrying with `skipConfigWrite=true` won't restart the gateway (by design). The user must destroy and recreate. This is a pre-existing issue unrelated to this PR.

## Console Errors

| Error | Severity | Notes |
|-------|----------|-------|
| Clerk auth mismatch (OIDC domain) | Low | Dev/preview Clerk mismatch, expected |
| 404 resource | Low | Likely stale asset after force-push rebuild |
| Health check timeout (1st attempt) | Medium | Sandbox wake issue, pre-existing |

## Screenshots

| Step | File |
|------|------|
| Homepage | `/tmp/e2e-01-home.png` |
| Skill launch | `/tmp/e2e-02-skill.png` |
| Health timeout | `/tmp/e2e-02c-error.png` |
| Skill discovery | `/tmp/e2e-03-discovery.png` |
| Dashboard | `/tmp/e2e-04-dashboard.png` |
| Session resume | `/tmp/e2e-05-resume.png` |
