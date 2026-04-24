---
tags: [thinking-card, tool-cards, sse-parsing, streaming, think-tag, codex-review]
category: feature
related:
  - 2026-04-23/daytona-dashboard-link.md
---

# Thinking Card & Enhanced Tool Cards for Chat UI

## Summary

Added ThinkingCard (collapsible reasoning display) and enhanced ToolCard (expand/collapse with args, preview, duration, error state) to the TrySkills chat interface, matching Hermes WebUI patterns.

PR: https://github.com/ReScienceLab/TrySkills/pull/28
Branch: `feat/thinking-and-toolcards`
Commits: 5 (1 feature + 4 fix commits from codex review loop)

## Architecture

### SSE Event Flow

The Hermes Gateway emits these SSE events (proxied through `/api/hermes`):

| Event | Purpose | TrySkills Handler |
|-------|---------|-------------------|
| `choices[0].delta.content` | Token stream (standard OpenAI) | `onDelta` |
| `event: reasoning` | Dedicated reasoning text | `onReasoning` (new) |
| `event: hermes.tool.progress` | Tool name + emoji (legacy) | `onToolProgress` |
| `event: tool` | Tool start with args/preview | `onToolStart` (new) |
| `event: tool_complete` | Tool done with duration/error | `onToolComplete` (new) |

### `<think>` Tag Fallback

Some models embed reasoning in `<think>...</think>` tags within the content stream instead of using dedicated SSE events. The parser handles this with:

1. **`thinkDecided` flag** -- detection only runs once at stream start
2. **Partial prefix buffering** -- if content starts with `<t`, `<thi`, etc., buffer until we can decide if it's `<think>` or not
3. **Flush on non-match** -- if prefix turns out not to be `<think>`, flush entire buffered `rawContent` to `onDelta`
4. **Incremental reasoning emission** -- each chunk inside `<think>` block is sent to `onReasoning` individually (never re-emit the full buffer)

### Key Gotcha: No Duplication

The parser must NOT re-emit accumulated reasoning on `</think>` close or `[DONE]`. Since reasoning is emitted incrementally per-delta, the close handler only emits the unsent portion of the current delta (calculated via `prevLen`).

## Files Changed

| File | What |
|------|------|
| `src/lib/sandbox/hermes-api.ts` | SSE parser: new event types, think-tag fallback, `onReasoning`/`onToolStart`/`onToolComplete` callbacks |
| `src/components/chat/use-chat.ts` | `thinkingText`/`isThinking` state, enhanced `ToolCall` type, error/cancel cleanup |
| `src/components/chat/chat-panel.tsx` | `ThinkingCard` component, enhanced `ToolCard` with expand/collapse |
| `src/__tests__/lib/sandbox/hermes-api.test.ts` | 6 new tests |
| `src/__tests__/components/chat/use-chat.test.ts` | 2 new tests |

## Codex Review Findings (9 issues across 4 rounds)

| # | Issue | Root Cause |
|---|-------|-----------|
| 1 | Non-string tool.args crash React | `{v}` renders objects directly |
| 2 | hadContent=true for reasoning-only | Set before think-block check |
| 3 | Chunk-split `<think>` tag leaks | No prefix buffering |
| 4 | rawContent reprocessing | Never cleared after detection |
| 5 | Buffered prefix loss | Only emitted current delta, not buffer |
| 6 | Reasoning duplication on `</think>` | Re-emitted full thinkBuffer |
| 7 | No isThinking cleanup on error/cancel | Only success path reset state |
| 8 | `[DONE]` re-emits thinkBuffer | Redundant branch from initial impl |
| 9 | No onToolCompleteRef on error/cancel | Workspace panel stays stale |

## Commands

```bash
# Run tests
cd .worktrees/feat-thinking-toolcards && npx vitest run

# Typecheck
npx tsc --noEmit

# Codex review loop
codex exec --dangerously-bypass-approvals-and-sandbox \
  'review https://github.com/ReScienceLab/TrySkills/pull/28 using gh...'
```

## Lessons

1. **Think-tag parsing is surprisingly hard** -- chunk boundaries, prefix ambiguity, incremental vs batch emission, multiple close points (`</think>`, `[DONE]`, abort). Each needs its own handling.
2. **Codex review loop is effective** -- 5 iterations caught 9 real bugs that unit tests missed. The key was writing regression tests after each fix to lock down behavior.
3. **`thinkDecided` flag pattern** -- when you only want to detect something once at stream start, a boolean flag is cleaner than clearing/resetting state.
4. **Always clean up new state in ALL exit paths** -- error, cancel, and done all need the same cleanup. Easy to forget error/cancel when adding new state.
