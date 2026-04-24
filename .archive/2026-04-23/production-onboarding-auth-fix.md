---
tags: [vercel, convex, clerk, auth, jwt, production, onboarding, env-vars]
category: debugging
---

# Production Onboarding Auth Failure Fix - 2026-04-23

## Summary
First production onboarding failed due to Vercel env vars with trailing `\n` and missing `aud` claim in Clerk JWT template.

## Context
- **Branch**: develop
- **Commit**: 5eaa9d3
- **Environment**: Production (tryskills.sh)
- **Convex Prod**: acrobatic-malamute-199
- **Clerk Prod**: clerk.tryskills.sh

## Issues Encountered & Solutions

### 1. Vercel environment variables had trailing `\n`
All 5 production env vars were stored with a trailing newline character, causing invalid URLs and keys.

**Affected vars**: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**Symptoms**: Convex WebSocket auth failures, `acquireCreateLock` server errors

**Fix**:
```bash
printf 'https://acrobatic-malamute-199.convex.cloud' | npx vercel env update NEXT_PUBLIC_CONVEX_URL production --yes
printf 'prod:acrobatic-malamute-199' | npx vercel env update CONVEX_DEPLOYMENT production --yes
printf 'https://acrobatic-malamute-199.convex.site' | npx vercel env update NEXT_PUBLIC_CONVEX_SITE_URL production --yes
printf 'pk_live_...' | npx vercel env update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes
printf 'sk_live_...' | npx vercel env update CLERK_SECRET_KEY production --yes
```

**Key insight**: Use `printf` (not `echo`) to avoid trailing newlines when piping to `vercel env update`.

**Verification**:
```bash
npx vercel env pull .env.prod.tmp --environment production --yes
# Check no \n at end of values
```

### 2. Clerk JWT template missing `aud` claim
`convex/auth.config.ts` sets `applicationID: "convex"`, which requires `aud: "convex"` in the JWT. The Clerk JWT template had empty Claims `{}`.

**Error**: `"No auth provider found matching the given token", check your server auth config`

**Fix**: In Clerk Dashboard -> JWT Templates -> `convex`, set Claims to:
```json
{
  "aud": "convex"
}
```

### 3. No test user in production Clerk
Dev and prod Clerk instances are separate. The test user only existed in dev.

**Fix**:
```bash
CLERK_SECRET="sk_live_..."
curl -s https://api.clerk.com/v1/users \
  -H "Authorization: Bearer $CLERK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email_address":["test-agent@tryskills.sh"],"first_name":"Test","last_name":"Agent","password":"..."}'
```

**Production test user ID**: `user_3CkT5Gg8vauwMuJrFyy0emuobUn`

## Key Commands

```bash
# Check Convex prod env vars
npx convex env list --prod

# Deploy Convex to prod
npx convex deploy --yes

# Deploy Vercel to prod
npx vercel --prod

# Verify JWT token contents in browser
# (in agent-browser or DevTools console)
const token = await window.Clerk.session.getToken({ template: 'convex', skipCache: true });
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload); // should have iss, aud, sub
```

## Lessons Learned
- Always use `printf` instead of `echo` when setting Vercel env vars via CLI to avoid trailing newlines
- Clerk JWT template Claims must explicitly include `"aud": "convex"` when using Convex's `applicationID` config
- Dev and prod Clerk instances are completely separate -- test users must be created in both
- After changing Clerk JWT template or Convex env vars, must redeploy both Convex (`npx convex deploy`) and Vercel (`npx vercel --prod`)
- Use `xxd` to inspect env vars for hidden characters: `npx convex env list --prod | xxd`
