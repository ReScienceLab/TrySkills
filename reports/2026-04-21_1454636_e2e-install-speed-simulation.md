# E2E Simulation Report: Install Speed + Sandbox Reliability

**Date**: 2026-04-21  
**Commit**: `1454636` (fix/sandbox-resources) on top of `f78d592` (perf/install-speed)  
**PRs**: [#8](https://github.com/ReScienceLab/TrySkills/pull/8) (perf) + [#9](https://github.com/ReScienceLab/TrySkills/pull/9) (resources)  
**Preview**: `tryskillssh-git-perf-install-speed-resciencelab.vercel.app`  
**Test User**: `test-agent@tryskills.sh` (Clerk ID: `user_3CeZ9bPCOqMWvvQ3dTOOvQdl8ZV`)  

## Test Environment

- **Auth bypass**: Vercel Protection Bypass (`x-vercel-protection-bypass` query param)
- **Clerk auth**: Sign-in token via Backend API → `Clerk.client.signIn.create({ strategy: 'ticket' })`
- **Daytona account**: Free tier, no `hermes-ready` snapshot (cold install path)
- **LLM**: Anthropic `claude-sonnet-4-6`
- **Browser**: agent-browser (headless Chromium via Playwright)

## Test Results

### Test 1: Instant Path (same skill, sandbox active)

| Metric | Value |
|--------|-------|
| **Result** | PASS |
| **Total time** | ~50ms (zero Daytona API calls) |
| **Server logs** | `[hermes-api] createSession` only |
| **Chat response** | Full skill info streamed successfully |

Console output: No `[daytona]` logs captured -- instant path used stored `webuiUrl` from Convex directly.

### Test 2: Install Path (different skill, sandbox active)

| Metric | Value |
|--------|-------|
| **Result** | PASS |
| **Total time** | ~4.4s |
| **SDK loaded** | 333ms |
| **Sandbox fetched** | 1,625ms |
| **Setup (mkdir + config)** | 3,572ms |
| **Files uploaded** | 4,103ms |
| **Health check** | skipped (active sandbox) |
| **Signed URL** | reused existing |
| **Chat response** | Remotion best practices streamed |

Key: `skipConfigWrite=true` (same config), `skipHealthCheck=true` (sandbox active), `reused existing signed URL`.

### Test 3: Install Path (third skill, 9 files)

| Metric | Value |
|--------|-------|
| **Result** | FAIL (upstream) |
| **Install time** | ~1.3s (9 files uploaded) |
| **SDK loaded** | 69ms |
| **Sandbox fetched** | 623ms |
| **Setup** | 914ms |
| **Files uploaded** | 1,326ms |
| **createSession** | 500 Internal Server Error x4 |

**Root cause**: `OSError: [Errno 28] No space left on device` inside Hermes WebUI. The 3GB default disk was full from cold install (hermes-agent 1.4GB + camoufox 680MB + pip cache).

### Test 4: Cold Create (fresh sandbox)

| Metric | Value |
|--------|-------|
| **Result** | PASS |
| **Total time** | ~94s |
| **Sandbox created** | 2,065ms |
| **Cold install (curl)** | 88,506ms |
| **Config written** | 88,506ms |
| **Files uploaded** | 89,491ms |
| **Health check (gateway + WebUI)** | 93,348ms |
| **Signed URL** | 93,846ms |
| **createSession** | Success on first try |
| **Chat response** | Full skill info streamed |

### Test 5: Stale Sandbox Record

| Metric | Value |
|--------|-------|
| **Result** | FAIL → FIXED |
| **Scenario** | Sandbox deleted via Daytona API, Convex record remains |
| **Error** | "Sandbox with ID or name fe440d21... not found" |
| **Fix** | Detect "not found", remove stale Convex record, fall through to cold create |

## Bugs Found & Fixed

| # | Severity | Bug | Root Cause | Fix |
|---|----------|-----|------------|-----|
| 1 | **P0** | Disk full → WebUI 500 on session creation | 3GB default disk, cold install uses 2.8GB | Request 10GB disk for cold install + cleanup tmp/cache |
| 2 | **P0** | WebUI not ready → "Upstream non-JSON" on first session | Health check only verified gateway (8642), not WebUI (8787) | Added WebUI health check: `curl -sf localhost:8787/` |
| 3 | **P1** | Chat stuck after single createSession failure | `initRef` set before retry, `startStream` swallows errors | Retry loop with 2s/4s/8s backoff, covers both createSession + sendMessage |
| 4 | **P1** | Stale sandbox record → permanent error | Sandbox deleted externally, Convex record remains | Detect "not found", remove record, fall through to cold create |
| 5 | **P2** | Reused signed URL timestamp renewed | `webuiUrlCreatedAt` updated even when URL not refreshed | Only update when `urlRefreshed=true` |
| 6 | **P2** | Undersized sandbox resources | Default 1 CPU / 2GB RAM / 3GB disk | Cold: 2/4/10, snapshot: inherits from image |

## Performance Improvements

| Launch Path | Before | After | Improvement |
|-------------|--------|-------|-------------|
| **Instant** (same skill + config) | ~0ms | ~50ms | Same (zero Daytona calls) |
| **Install** (new skill, active sandbox) | 8-15s | **1.3-4.4s** | 3-6x faster |
| **Cold create** (no snapshot) | ~120s+ (often fail) | **~94s** (reliable) | Now works |

### What made install faster:
1. **Batch mkdir**: One command for all directories (was per-file serial)
2. **500ms health poll**: Down from 2s (4x faster gateway detection)  
3. **Skip health check**: When sandbox already active
4. **Reuse signed URL**: Skip `getSignedPreviewUrl` API call when URL <50min old
5. **Skip config write**: When `configHash` unchanged

## Codex Review Summary

| Round | Issues | Status |
|-------|--------|--------|
| PR#8 R1 | 2 (URL timestamp renewal, sendMessage retry) | Fixed |
| PR#8 R2 | 0 | Clean |

## Open Items

1. **Build `hermes-ready` snapshot**: Would reduce cold create from ~94s to ~7s. The snapshot bakes hermes-agent + WebUI into the image layer.
2. **Hermes WebUI session limit**: After many sessions, the WebUI may need periodic restart. Not a TrySkills bug.
3. **Camoufox download**: Hermes auto-downloads a 680MB browser on first tool use. Could be pre-cached in snapshot.

## Files Changed

### PR #8 (perf/install-speed)
- `src/lib/sandbox/daytona.ts` — Batch mkdir, 500ms poll, skip health/URL, WebUI health check, retry, disk cleanup
- `src/app/[...skillPath]/page.tsx` — Pass `existingWebuiUrl`, `skipHealthCheck`, `urlRefreshed` handling
- `src/components/chat/use-chat.ts` — Retry with backoff (3 attempts), covers sendMessage
- `src/lib/sandbox/types.ts` — Added `urlRefreshed` to SandboxSession
- `src/__tests__/components/chat/use-chat.test.ts` — Updated retry test

### PR #9 (fix/sandbox-resources)
- `src/lib/sandbox/daytona.ts` — Resource constants (2 CPU / 4GB / 10GB), expanded cleanup
- `src/app/[...skillPath]/page.tsx` — Stale record handling ("not found" → remove + cold create)

## Test Commands

```bash
# Vercel bypass
BYPASS="0l7JL4iDe26npWOg1RwoN6Mapd34BP8R"
agent-browser open "${PREVIEW}?x-vercel-protection-bypass=${BYPASS}&x-vercel-set-bypass-cookie=samesitenone"

# Clerk sign-in
TOKEN=$(curl -s -X POST https://api.clerk.com/v1/sign_in_tokens \
  -H "Authorization: Bearer $CLERK_SECRET" \
  -d '{"user_id":"user_3CeZ9bPCOqMWvvQ3dTOOvQdl8ZV"}' | jq -r .token)
agent-browser eval "window.Clerk.client.signIn.create({strategy:'ticket',ticket:'$TOKEN'}).then(r=>window.Clerk.setActive({session:r.createdSessionId}))"

# Check sandbox logs
node -e "const{Daytona}=require('@daytona/sdk');(async()=>{const d=new Daytona({apiKey:'$KEY',apiUrl:'https://app.daytona.io/api'});const s=await d.get('$ID');console.log((await s.process.executeCommand('tail -50 /tmp/hermes-webui.log')).result)})()"
```
