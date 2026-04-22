# E2E Test Report: Gateway Direct API (Remove WebUI)

**Date**: 2026-04-22
**Commit**: `5751a3c` (fix: write config/skills to /root/.hermes)
**PR**: [#11](https://github.com/ReScienceLab/TrySkills/pull/11) targeting `main`
**Preview**: `tryskillssh-git-perf-30s-cold-create-resciencelab.vercel.app`

## Summary

PR#11 removes the Hermes WebUI process entirely. The chat UI now talks directly to the Gateway's OpenAI-compatible `/v1/chat/completions` API via the `/api/hermes` server-side proxy. E2E testing uncovered a critical config path bug: the Gateway runs as root and reads from `/root/.hermes/`, but config was being written to `/home/daytona/.hermes/`. Fixed and verified.

## Test Environment

- **Local**: macOS, agent-browser (headless Chromium)
- **Auth**: Vercel Protection Bypass + Clerk sign-in token (dev instance)
- **Daytona**: Free tier, no `hermes-ready` snapshot (GHCR image fallback)
- **Hermes Agent**: v0.10.0

## Bug Found & Fixed

### P0: Config written to wrong directory

| Field | Detail |
|-------|--------|
| **Symptom** | Chat sends message, Gateway returns 200 with empty streaming response (no content deltas) |
| **Root cause** | Gateway runs as root, reads config from `/root/.hermes/config.yaml`. Code wrote config, .env, and skills to `/home/daytona/.hermes/` |
| **Error** | `model: String should have at least 1 character` -- Gateway sent empty model name to Anthropic API |
| **Fix** | Introduced `HERMES_HOME = "/root/.hermes"` constant, updated all 10 path references in `daytona.ts` + 3 in test file |
| **Commit** | `5751a3c` |

### Diagnosis steps

1. Chat panel showed user message but no assistant response (streaming hung)
2. `/api/hermes` proxy returned 200 with 326 bytes (near-empty SSE stream)
3. Direct curl to Gateway: `finish_reason: "stop"` with 0 completion tokens
4. Non-streaming call revealed error: `model: String should have at least 1 character`
5. Daytona SDK inspection: `_resolve_gateway_model()` returned `''`
6. `_load_gateway_config()` returned `{}` -- config file not found
7. `_hermes_home` = `/root/.hermes` but config written to `/home/daytona/.hermes/`

## E2E Test Results

### Test 1: Cold Create (GHCR image fallback)

| Metric | Value | Status |
|--------|-------|--------|
| SDK loaded | 64ms | - |
| Snapshot create | Failed (expected) | - |
| GHCR image create | 1,669ms | PASS |
| Config + skill upload | 4,166ms | - |
| Gateway health check | 6,295ms | PASS |
| Signed URL obtained | 6,890ms | PASS |
| **Total cold create** | **6.9s** | PASS |

### Test 2: Chat Streaming (auto-init message)

| Metric | Value | Status |
|--------|-------|--------|
| `/api/hermes` POST | 200 OK | PASS |
| SSE stream | Content deltas received | PASS |
| Assistant response | Rendered with markdown | PASS |
| Tool progress card | `skill_view` displayed | PASS |

### Test 3: Multi-turn Conversation

| Metric | Value | Status |
|--------|-------|--------|
| Follow-up message sent | "What tools do you have available?" | - |
| Context preserved | Yes (referenced previous turn) | PASS |
| Rich response | Tool listing with categories + formatting | PASS |
| Send button state | Disabled during stream, enabled after | PASS |

## Architecture Verified

```
Browser -> /api/hermes (POST) -> Gateway :8642 /v1/chat/completions
                                    |
                              OpenAI SSE format
                              data: {"choices":[{"delta":{"content":"..."}}]}
                              event: hermes.tool.progress (custom)
                              data: [DONE]
```

- No WebUI process running on sandbox
- Gateway serves `/health`, `/v1/models`, `/v1/chat/completions`
- Single model exposed: `hermes-agent` (routes to configured LLM)
- Config in `/root/.hermes/config.yaml` + `/root/.hermes/.env`
- Skills in `/root/.hermes/skills/<sanitized-path>/`

## Performance Comparison

| Launch Path | PR#9 (with WebUI) | PR#11 (Gateway only) | Improvement |
|-------------|--------------------|-----------------------|-------------|
| Cold create (GHCR) | ~94s | **6.9s** | 13.6x faster |

## Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| Convex auth fails on preview | Sandbox records not persisted | Dev Clerk issuer doesn't match preview Convex deployment |
| Skill not auto-loaded by path | Agent says "skill not found" | Hermes uses `skill_view` tool to load skills, not filesystem auto-detection |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/sandbox/daytona.ts` | `HERMES_HOME = "/root/.hermes"`, updated 10 path refs, removed `skipHealthCheck` |
| `src/app/[...skillPath]/page.tsx` | Removed `skipHealthCheck` option from installSkill call |
| `src/__tests__/lib/sandbox/daytona.test.ts` | Updated 3 expected paths |
