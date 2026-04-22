# TrySkills.sh

An open-source platform where users can instantly try any AI agent skill in a sandboxed environment. Built with Next.js 16, Convex, Clerk, and Daytona sandboxes.

## Core Commands

- Dev server: `bun dev`
- Build: `bun run build`
- Lint: `bun run lint`
- Test: `bun run test` (or `npx vitest run`)
- Type check: `npx tsc --noEmit`
- Convex dev: `npx convex dev --once`
- Convex prod deploy: `npx convex deploy --yes`

Always run type check + tests before committing.

## Project Layout

```
├── convex/              → Convex backend (schema, mutations, queries, crons)
├── src/
│   ├── app/             → Next.js App Router pages
│   │   ├── [...skillPath]/  → Skill page (launch + inline chat)
│   │   ├── api/hermes/      → Server-side proxy for Hermes Gateway API
│   │   ├── api/sandbox/     → Sandbox info + heartbeat API
│   │   ├── dashboard/       → User dashboard (sandbox + skill trials)
│   │   └── settings/        → API key settings
│   ├── components/
│   │   ├── chat/            → ChatPanel, useChat hook
│   │   └── ...              → ConfigPanel, LaunchProgress, etc.
│   ├── hooks/               → useKeyStore, useHeartbeat
│   └── lib/
│       ├── sandbox/         → daytona.ts, hermes-api.ts, types.ts
│       ├── skill/           → resolver, parser, url-parser
│       └── providers/       → LLM provider registry
├── scripts/                 → Build scripts (snapshot, etc.)
└── public/                  → Static assets
```

## Architecture

### Single Sandbox Per User
Each user gets one persistent Hermes agent sandbox (Daytona). Skills accumulate on disk without cleanup. Hermes loads the requested skill per chat session.

### Pool States
- `active` — sandbox running, accepting skill installs
- `creating` — cold create in progress (exclusive lock via `acquireCreateLock`)
- `stopped` — Daytona auto-stopped after 30min idle

### Launch Paths
1. **Instant** (~0ms): skill installed + config match + URL fresh + heartbeat recent → use stored URL
2. **Install** (~3-5s): upload skill files to running sandbox, get fresh signed URL
3. **Cold create** (~15-30s): create new Daytona sandbox from snapshot

### Multi-Tab Concurrency
- `getSandbox` is a **query** (read-only), multiple tabs read simultaneously
- Skill installs need **no lock** (concurrent uploads to separate directories)
- Cold create uses `acquireCreateLock` mutation (atomic pending-placeholder)
- Stale pending locks expire after 5 minutes

### Hermes API Proxy
All chat API calls go through `/api/hermes` (POST) server-side route which proxies to the Gateway's `/v1/chat/completions` endpoint. The proxy adds `X-Daytona-Skip-Preview-Warning` header to bypass the Daytona preview warning page and validates that `baseUrl` matches Daytona host patterns only.

### Session Management
Chat sessions are stored in Convex (`chatSessions` table), not in the Gateway. Each skill trial creates a Convex session that persists messages across page reloads. Users can resume sessions from the dashboard via `?session=` URL parameter.

## Convex

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

### Key Tables
- `sandboxes` — one row per user's sandbox (poolState, configHash, installedSkills, gatewayUrl)
- `skillTrials` — records each skill launch (capped at 50 per query)
- `chatSessions` — persistent chat sessions (skillPath, title, model, messages, timestamps)
- `apiKeys` — encrypted user API keys (Clerk + AES)

### Deployment
- Dev: `tame-seahorse-513` (set via `CONVEX_DEPLOYMENT` in `.env.local`)
- Prod: `acrobatic-malamute-199` (auto-detected by `npx convex deploy`)
- **After merging schema/function changes, always deploy to BOTH**: `npx convex dev --once` + `npx convex deploy --yes`

## Security Rules

- Never store raw API keys in Convex — use SHA-256 hash for `configHash`
- Proxy routes validate `baseUrl` against Daytona host regex before forwarding
- `respondApproval` surfaces errors (never silently swallow)
- Signed preview URLs have 1h TTL; instant path checks 50min freshness + 30min heartbeat

## Conventions

- TypeScript strict mode, no semicolons in new code
- Minimal comments — only when non-obvious
- Use `bun` for package management (not npm/yarn)
- `.gitignore` includes `package-lock.json`
- Test files: `src/__tests__/` mirrors `src/` structure, plus `convex/*.test.ts`
- Convex mutations: always verify `identity.tokenIdentifier` ownership
- Use `sanitizeSkillDir(skillPath)` (replaces `/` with `--`) for on-disk skill directories

## Gotchas

- Convex codegen requires `CONVEX_DEPLOYMENT` env var: `CONVEX_DEPLOYMENT="dev:tame-seahorse-513" npx convex codegen`
- Prod Convex needs `CLERK_JWT_ISSUER_DOMAIN` env var set in dashboard
- `EventSource` (SSE) cannot send custom headers — that's why the server proxy exists
- Daytona signed preview URLs embed auth in subdomain (`https://8787-{token}.proxy.daytona.work`)
- `autoLaunchLock` (Map) prevents duplicate auto-launches within the same SPA session
- `installSkill` accepts `{ skipConfigWrite: true }` when configHash matches to avoid concurrent config races
