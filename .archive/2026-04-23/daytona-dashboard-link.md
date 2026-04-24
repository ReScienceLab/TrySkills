---
tags: [dashboard, daytona, sandbox, external-link, ui]
category: feature
---

# Add Daytona Dashboard Link to Sandbox Card

## Context
Users on `/dashboard` had no way to jump to the Daytona web console for their sandbox. The sandbox ID was displayed with a copy button but no direct link.

## Solution
Added an external link (`↗`) next to the sandbox ID copy button that opens `https://app.daytona.io/dashboard/sandboxes/{sandboxId}` in a new tab.

## File Changed
- `src/app/dashboard/page.tsx` — added `<a>` tag after the copy button (around line 208)

## Daytona Dashboard URL Format
```
https://app.daytona.io/dashboard/sandboxes/{sandboxId}?tab=terminal
```
The `?tab=terminal` query param is optional; without it, the dashboard opens to the default tab.

## PR
- Branch: `feat/daytona-dashboard-link` (from `develop`)
- PR: https://github.com/ReScienceLab/TrySkills/pull/27
- Worktree: `.worktrees/feat-daytona-link`
