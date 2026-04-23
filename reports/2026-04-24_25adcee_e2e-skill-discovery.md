# E2E Report: Skill Discovery Fix

| Field | Value |
|-------|-------|
| Date | 2026-04-24 |
| Commit | `25adcee` |
| PR | [#29](https://github.com/ReScienceLab/TrySkills/pull/29) |
| Target | `tryskillssh-git-fix-skill-discovery-hotload-resciencelab.vercel.app` |
| Skill | `soultrace-ai/soultrace-skill/soultrace` |
| Auth | Clerk ticket (test-agent@tryskills.sh) |

## Timing

| Phase | Duration |
|-------|----------|
| Sandbox create (snapshot) | 1.4s |
| npx skills add | 7.1s |
| Symlink to ~/.hermes/skills | 0.3s |
| Gateway health check | 2.2s |
| Signed URL | 0.6s |
| **Total cold create** | **~12s** |

## Test Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| T1 | Sandbox creation | PASS | Created from snapshot in ~1.4s |
| T2 | Skill install via npx | PASS | `npx skills add` completed in ~7.1s |
| T3 | Gateway starts after install | PASS | Health check passed at 11s |
| T4 | Chat panel loads | PASS | Green dot, timer, input box visible |
| T5 | Agent discovers soultrace skill | **PASS** | `skills_list` returned 68 skills (67 bundled + soultrace). Agent found soultrace by name with full metadata. |

## Key Finding

The fix works: adding `skills.external_dirs: [/root/.agents/skills]` to `config.yaml` allows Hermes to scan `~/.agents/skills/` where `npx skills add --agent universal` installs skills. The gateway restart ensures the skill index is fresh.

## Console Errors

Only `Refused to set unsafe header "User-Agent"` (expected, from fetch API restrictions in browser).

## Screenshots

| Step | File |
|------|------|
| Launch progress | `/tmp/e2e-01-soultrace-launch.png` |
| Chat ready | `/tmp/e2e-02-soultrace-progress.png` |
| Skill discovery | `/tmp/e2e-04-soultrace-discovery.png` |
