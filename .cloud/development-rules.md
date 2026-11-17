# Development Rules

## Code
- TypeScript strict everywhere. Small focused modules; comment only the non-obvious *why*.
- Screens compose; logic lives in hooks/services; pure rules in `game/engine` with tests.
- No hardcoded user-visible strings in the app — translation keys in both `en.json` and `te.json`.
- Client errors: RPCs raise bare `UPPER_SNAKE` codes → `errors.<CODE>` keys. Never show raw server text.

## Database / RPC
- New behaviour = new migration file `supabase/migrations/<timestamp>_<name>.sql`. Never edit a migration that has been pushed to production; add a new one.
- Every client-callable function: `security definer set search_path = ''`, fully-qualified names, validates `_require_player()` / `_require_admin()`, explicit `grant execute ... to authenticated`.
- Internal helpers start with `_` and must have EXECUTE revoked from `public, anon, authenticated`.
- Anything touching game state must be idempotent or row-locked (lock the games row).
- Broadcast every state change on `room:<id>` via `_broadcast` (never from clients).

## Verification before "done"
1. `cd app && npx tsc --noEmit && npx vitest run`
2. `cd admin-web && npm run build`
3. Migrations applied (`npx supabase db push`) then `node scripts/smoke-test.mjs` passes.
4. Docs updated (`docs/*.md`, `.cloud/project-context.md`).

## Git
`main` ← `develop` ← `feature/<area>-<desc>`. Commits: `feat(game): …`, `fix(wallet): …`.
