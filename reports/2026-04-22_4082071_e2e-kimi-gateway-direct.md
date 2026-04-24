# E2E Test Report: Gateway Direct + Kimi Model (PR#11)

**Date**: 2026-04-22
**Commit**: `4082071` (refactor: remove all legacy WebUI references)
**PR**: [#11](https://github.com/ReScienceLab/TrySkills/pull/11) targeting `main`
**Preview**: `tryskillssh-git-perf-30s-cold-create-resciencelab.vercel.app`

## Summary

Full E2E test of PR#11 on Vercel preview with Kimi (kimi-k2.6) as the LLM provider. All tests passed after deploying the Convex schema migration (`webuiUrl` -> `gatewayUrl`).

## Test Environment

- **Browser**: agent-browser (headless Chromium)
- **Auth**: Vercel Protection Bypass + Clerk sign-in token (dev instance)
- **Daytona**: Free tier, GHCR image fallback (no snapshot)
- **LLM Provider**: Kimi (kimi-k2.6)
- **Skill**: `factory-ai/skills/code-review`

## Pre-test: Convex Schema Migration

Before testing, the Convex dev deployment still had the old `webuiUrl`/`webuiUrlCreatedAt` fields. The migration was performed:
1. Widened schema to accept both old (`webuiUrl`) and new (`gatewayUrl`) fields
2. Deployed widened schema
3. Cleared all data: 1 sandbox, 2 API keys, 5 skill trials
4. Narrowed schema back to `gatewayUrl` only
5. Deployed final schema

## Test Results

### Test 1: Cold Create (GHCR image fallback)

| Metric | Value | Status |
|--------|-------|--------|
| SDK loaded | 64ms | - |
| Snapshot create | Failed (expected) | - |
| GHCR image create | 1,332ms | PASS |
| Config + skill upload | 3,875ms | - |
| Gateway health check | 5,948ms | PASS |
| Signed URL obtained | 6,530ms | PASS |
| **Total cold create** | **6.5s** | PASS |

### Test 2: Chat Streaming (auto-init message)

| Metric | Value | Status |
|--------|-------|--------|
| `/api/hermes` POST | 200 OK | PASS |
| SSE stream | Content deltas received | PASS |
| `skill_view` tool | Loaded github-code-review | PASS |
| Assistant response | Full skill description with options A/B/C | PASS |
| Rich markdown | Bold, code blocks, links rendered | PASS |

### Test 3: Multi-turn Conversation

| Metric | Value | Status |
|--------|-------|--------|
| Follow-up message | "Show me the review checklist" | - |
| Context preserved | Yes (referenced previous turn) | PASS |
| Rich response | Full checklist with categories, emoji, tables | PASS |
| GitHub PR actions | APPROVE/REQUEST_CHANGES/COMMENT described | PASS |
| Send button state | Disabled during stream, enabled after | PASS |

## Bug Found & Fixed During Test

### Convex Schema Mismatch (pre-existing)

| Field | Detail |
|-------|--------|
| **Symptom** | "Failed to save sandbox record" after successful sandbox creation |
| **Root cause** | Convex dev deployment still had `webuiUrl` (required field) but code sends `gatewayUrl` |
| **Error** | `ArgumentValidationError: Object is missing the required field 'webuiUrl'` |
| **Fix** | Widen-migrate-narrow: deployed widened schema, cleared all old data, narrowed to `gatewayUrl` only |

### Expired Daytona API Key

| Field | Detail |
|-------|--------|
| **Symptom** | "Invalid credentials" during sandbox creation |
| **Root cause** | Local Daytona CLI config had an expired API key |
| **Fix** | Updated with fresh key via Settings page |

## Architecture Verified

```
Browser -> /api/hermes (POST) -> Gateway :8642 /v1/chat/completions
                                    |
                              OpenAI SSE format
                              data: {"choices":[{"delta":{"content":"..."}}]}
                              event: hermes.tool.progress (custom)
                              data: [DONE]
```

- No WebUI process on sandbox
- Gateway serves `/health`, `/v1/models`, `/v1/chat/completions`
- Kimi provider configured via `/root/.hermes/config.yaml`
- Config written to `/root/.hermes/` (Gateway runs as root)

## Performance

| Metric | Value |
|--------|-------|
| Cold create (GHCR) | **6.5s** |
| First response (auto-init) | ~54s total (includes LLM processing) |
| Multi-turn response | ~2m 16s (full checklist, long response) |
