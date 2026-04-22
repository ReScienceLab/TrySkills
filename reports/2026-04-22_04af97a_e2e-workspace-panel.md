# E2E Test Report: Workspace Panel (PR#21)

**Date**: 2026-04-22
**Commit**: `04af97a` (feat-workspace-panel branch)
**PR**: [#21](https://github.com/ReScienceLab/TrySkills/pull/21)
**Preview**: `tryskillssh-git-feat-workspace-panel-resciencelab.vercel.app`
**Test User**: `test-agent@tryskills.sh` (Clerk ID: `user_3CeZ9bPCOqMWvvQ3dTOOvQdl8ZV`)

## Summary

Full E2E test of workspace panel feature on Vercel preview deployment. All core tests passed. Per-session workspace directories, file tree, file viewer, and dashboard integration all working correctly.

## Test Environment

- **Browser**: agent-browser (headless Chromium, 1440x900 viewport)
- **Auth**: Vercel Protection Bypass (`x-vercel-protection-bypass`) + Clerk sign-in token (dev instance, ticket strategy)
- **LLM Provider**: Kimi (kimi-k2.6)
- **Skill**: `softaworks/agent-toolkit/mermaid-diagrams`
- **Convex**: Dev deployment `tame-seahorse-513` (schema deployed with `workspacePath` field)

## Test Results

### 1. Vercel SSO Bypass + Clerk Auth
- **Status**: PASS
- Vercel protection bypassed via `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie=samesitenone`
- Clerk sign-in via ticket strategy: `sess_3CiUTfeAuwGP3rebD8PNtoZWjXU`
- Automated in a single script (no manual clicking)

### 2. Skill Page - No Auto-Send + Pre-Filled Input
- **Status**: PASS
- Navigated to `/softaworks/agent-toolkit/mermaid-diagrams`
- Auto-launch triggered with saved config (sandbox created from snapshot)
- Chat area is empty -- no automatic first message sent
- Input box pre-filled with `I want to try the /softaworks/agent-toolkit/mermaid-diagrams skill`
- User must press Send to start conversation

### 3. Chat Streaming + Session Creation
- **Status**: PASS
- Sent pre-filled message, agent responded with full skill overview
- `skill_view` tool ran successfully
- Convex session created with `workspacePath` field
- URL updated with `?session=js767mcxk0zabyrebbkz6b3cgn85abx5`

### 4. Per-Session Workspace + File Creation
- **Status**: PASS
- Sent: "Create a simple flowchart diagram and save it to a .mmd file"
- Agent wrote file to `/root/.hermes/workspaces/9c82345aa6284570/flowchart.mmd` (per-session workspace!)
- System message instructing workspace directory was followed correctly
- Tools executed: `skill_view`, `skills_list`, `skill_view`, `write_file`

### 5. Workspace Panel Auto-Open
- **Status**: PASS
- Workspace panel appeared on right side (360px) after `write_file` completed
- Panel header shows "Workspace" with refresh and close buttons
- File tree shows `flowchart.mmd` with file icon

### 6. File Viewer
- **Status**: PASS
- Clicked `flowchart.mmd` in file tree
- "Back to files" navigation link appeared
- File content rendered as monospace code:
  ```
  flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great! Keep going]
    ...
  ```
- Close button (x) visible

### 7. Dashboard
- **Status**: PASS
- Dashboard shows three sections:
  - **Hermes Agent**: Active, 2 vCPU, 4 GB, 10 GB, Region US, current skill visible
  - **Chat Sessions**: `mermaid-diagrams session`, kimi-k2.6, 2 messages, Resume + Delete buttons
  - **Skill Trials**: Multiple mermaid-diagrams entries

## Issue Found & Fixed During Testing

### Convex Schema Not Deployed
- **Severity**: Blocker (E2E)
- **Symptom**: `ArgumentValidationError: Object contains extra field 'workspacePath' that is not in the validator`
- **Cause**: New `workspacePath` field added to `chatSessions` table but Convex dev deployment not updated
- **Fix**: Ran `CONVEX_DEPLOYMENT="dev:tame-seahorse-513" npx convex dev --once` to deploy schema
- **Note**: Must also deploy to prod (`npx convex deploy --yes`) before merging

## Architecture Verified

```
User sends message
  → ChatPanel.send()
    → useChat.stream() prepends system message with workspace dir
    → /api/hermes → Gateway /v1/chat/completions (streaming)
  → Agent writes to /root/.hermes/workspaces/{workspaceId}/
  → tool_progress SSE events trigger workspace refresh
  → useWorkspace.onToolComplete("write_file")
    → /api/workspace?action=list → Daytona SDK → sandbox.fs.listFiles()
  → WorkspacePanel auto-opens with file tree
  → Click file → /api/workspace?action=read → FileViewer renders content
```

## Pre-Merge Checklist

- [x] Convex dev deployed with `workspacePath` field
- [ ] Convex prod deploy: `npx convex deploy --yes`
- [ ] Merge PR#21 to main
