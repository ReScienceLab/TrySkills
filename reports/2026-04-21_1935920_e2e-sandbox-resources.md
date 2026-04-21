# E2E Simulation Report: Sandbox Resources + Stale Record Handling

**Date**: 2026-04-21
**Commit**: `1935920` (fix/sandbox-resources)
**PR**: [#9](https://github.com/ReScienceLab/TrySkills/pull/9) targeting `perf/install-speed`
**Preview**: `tryskillssh-git-fix-sandbox-resources-resciencelab.vercel.app`

## Summary

Addressed disk-full failures on cold install, stale sandbox record handling, under-provisioned resources, and dead-sandbox recovery across instant/install/cold-create paths. 5 rounds of codex review, all issues fixed.

## Test Environment

- **Local**: macOS, agent-browser (headless Chromium)
- **Sandbox**: awn-sandbox (Lightsail 2CPU/8GB), droid v0.99.0 + agent-browser + codex
- **Auth**: Vercel Protection Bypass + Clerk sign-in token
- **Daytona**: Free tier, no `hermes-ready` snapshot (cold install path)

## E2E Test Results

### Test 1: Instant Path (same skill, sandbox active)
| Metric | Value | Status |
|--------|-------|--------|
| Server-side Daytona calls | 0 | PASS |
| Time to ChatPanel | ~50ms | PASS |
| Chat response | Streamed successfully | PASS |

### Test 2: Install Path (different skill, active sandbox)
| Metric | Value | Status |
|--------|-------|--------|
| SDK loaded | 333ms | - |
| Sandbox fetched | 1,625ms | - |
| Setup (mkdir + config) | 3,572ms | - |
| Files uploaded (1 file) | 4,103ms | - |
| Health check | skipped | - |
| Signed URL | reused | - |
| **Total install** | **4.4s** | PASS |

### Test 3: Install Path (9-file skill, active sandbox)
| Metric | Value | Status |
|--------|-------|--------|
| SDK loaded | 69ms | - |
| Sandbox fetched | 623ms | - |
| Setup | 914ms | - |
| Files uploaded (9 files) | 1,326ms | - |
| **Total install** | **1.3s** | PASS (install) |
| createSession | 500 Internal Server Error | FAIL (upstream) |

**Root cause**: `OSError: [Errno 28] No space left on device` -- 3GB disk full from cold install.

### Test 4: Cold Create (fresh sandbox)
| Metric | Value | Status |
|--------|-------|--------|
| Sandbox created (fallback) | 2,065ms | - |
| Cold install (curl) | 88,506ms | - |
| Config written | 88,506ms | - |
| Files uploaded | 89,491ms | - |
| Health check (gateway + WebUI) | 93,348ms | - |
| Signed URL | 93,846ms | - |
| createSession | Success first try | PASS |
| **Total cold create** | **~94s** | PASS |

### Test 5: Stale Sandbox Record
| Scenario | Status |
|----------|--------|
| Sandbox deleted via Daytona API, Convex record remains | FAIL → FIXED |
| Error: "Sandbox with ID or name ... not found" | Detected + removed stale record |
| Falls through to cold create | PASS |

### Test 6: Sandbox E2E on awn-sandbox (droid-driven)
| Step | Status |
|------|--------|
| Homepage loads | PASS |
| Sign-in modal renders | PASS |
| Clerk auth flow | PASS (unauthenticated flows) |
| Lint issues detected | FIXED (unused vars) |
| Droid session | Crashed at 27min (Bedrock message limit) |

## Bugs Found & Fixed

| # | Round | Severity | Bug | Fix |
|---|-------|----------|-----|-----|
| 1 | E2E | **P0** | 3GB disk full on cold install (ENOSPC) | Request 10GB disk for cold fallback + cleanup tmp/cache |
| 2 | E2E | **P1** | Stale Convex record after external sandbox deletion | Detect "not found", await remove, fall through to cold create |
| 3 | E2E | **P2** | Default 1 CPU / 2GB RAM undersized | Set `COLD_RESOURCES = { cpu: 2, memory: 4, disk: 10 }` |
| 4 | Lint | **P3** | Unused `SNAPSHOT_RESOURCES` constant | Removed |
| 5 | Lint | **P3** | Unused `webuiCmd` variable | Removed |
| 6 | Codex R1 | **P1** | Instant path dead sandbox → ChatPanel with dead URL | Added `sessionFailed` flag + "Reconnect" button in ChatPanel |
| 7 | Codex R1 | **P1** | Old 3GB sandboxes keep hitting ENOSPC | "Reconnect" destroys old sandbox, cold creates with 10GB |
| 8 | Codex R2 | **P1** | Reconnect drops page into blank state | Reset `autoLaunchFired` + `autoLaunchLock` before phase change |
| 9 | Codex R3 | **P1** | Reconnect removes record fire-and-forget → race | `await removeSandboxRecord` before re-enabling auto-launch |
| 10 | Codex R4 | **P1** | Reconnect orphans Daytona sandbox | Call `destroySandbox` before removing Convex record |

## Codex Review Summary

| Round | Issues | Status |
|-------|--------|--------|
| R1 | 2 P1 (dead sandbox recovery, old sandbox resources) | Fixed |
| R2 | 1 P1 (blank page after Reconnect) | Fixed |
| R3 | 1 P1 (fire-and-forget race on Reconnect) | Fixed |
| R4 | 1 P1 (orphaned Daytona sandbox on Reconnect) | Fixed |
| R5 | 0 | **Clean** |

## Commits (6)

```
1935920 fix: destroy Daytona sandbox in Reconnect to prevent orphans (R4)
28aaefd fix: await removeSandboxRecord in onSessionError before re-launch
3029db9 fix: clear auto-launch lock on Reconnect so fresh launch triggers
a5fd53e fix: address codex review for PR#9 - dead sandbox recovery
41ed062 chore: remove unused SNAPSHOT_RESOURCES constant and webuiCmd variable
1454636 fix: sandbox resource config + stale record handling
```

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/sandbox/daytona.ts` | Resource constants, disk cleanup, removed unused vars |
| `src/app/[...skillPath]/page.tsx` | Stale record handling, Reconnect callback with destroySandbox |
| `src/components/chat/chat-panel.tsx` | Reconnect button when sessionFailed |
| `src/components/chat/use-chat.ts` | sessionFailed state flag |

## Tests

118 tests passing across 13 test files.

## Open Items

1. **Build `hermes-ready` snapshot**: Would reduce cold create from ~94s to ~7s
2. **Hermes WebUI session limit**: WebUI may need periodic restart after many sessions
3. **Sandbox-level resource inspection**: Currently no way to check if existing sandbox has sufficient disk before reuse
