# Housie Tambola King

Production Housie / Tambola game for India — English + Telugu.

- **Create / Join rooms** — public or private, Normal or Series (game after game), fully custom prizes (Fast 3/5/7, Lines, Columns, Full Housie) with casual ₹ amounts.
- Numbers called aloud on every phone, tap-to-strike, first-to-complete wins, same-number ties split, animated winner announcements, saved series standings.
- Solo vs bots and Caller Mode for home games; admin dashboard.

```
app/         Expo (SDK 58) React Native + TypeScript player app
admin-web/   React + Vite admin dashboard (Vercel)
supabase/    migrations (schema, RLS, room/series game engine, cron clock), SMS Edge Function
scripts/     smoke-test.mjs (end-to-end), make-admin.sql
docs/        environment, deployment, game rules, API
.cloud/      engineering memory/instructions (loaded via CLAUDE.md)
```

## Quick start
1. Create a Supabase project, then follow **docs/deployment.md** (migrations, functions, secrets) and **docs/environment.md** (keys + dashboard settings).
2. `cd app && cp .env.example .env` → fill URL + anon key → `npm install` → `npx expo start` (everything works in Expo Go; installable APK: `npx eas build -p android --profile preview`).
3. `cd admin-web && cp .env.example .env.local` → `npm install && npm run dev`.
4. `node scripts/smoke-test.mjs` — plays a full 2-player game against your backend.

## Checks
```bash
cd app && npx tsc --noEmit && npx vitest run
cd admin-web && npm run build
```
