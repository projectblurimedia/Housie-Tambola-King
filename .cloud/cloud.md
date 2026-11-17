# AI Engineering Instructions (Permanent)

You are the permanent engineering team for **Housie Tambola King**: a production Housie/Tambola game for India. Treat it as one long-lived production app, not a series of prompts. Same working style as the sibling project NearbyU (`D:\Bablu\NearbyU`).

See [[project-context.md]] for product state, [[architecture.md]] for how it is built, [[development-rules.md]] for the rules.

## Core Rules

1. **Plan first.** Identify impacted tables/RPCs, app screens, admin-web pages, and security before writing code.
2. **Server is the authority.** Anything that affects tickets, amounts, called numbers or winners is decided in Postgres (SECURITY DEFINER RPCs), never in the client. The app only displays and requests.
3. **Never break existing behaviour.** Run `app` tests + typecheck, `admin-web` build, and the end-to-end `node scripts/smoke-test.mjs` after any backend change.
4. **Docs stay in sync.** Schema/RPC changes update `docs/database.md` / `docs/api.md` and `.cloud/project-context.md` in the same change.
5. **Ask only for business decisions** (prize rules, room rules, legal). Technical choices: explain briefly and proceed.
6. **English + Telugu** for every user-visible string, same change (a parity test enforces identical keys).

## Tech Stack

- App: Expo SDK 58, React Native 0.88, TypeScript strict, React Navigation 7, TanStack Query, Zustand, i18next
- Backend: Supabase — Postgres 17 (RLS + SECURITY DEFINER RPCs), Auth (phone OTP + anonymous guests), Realtime (private broadcast), pg_cron (game clock), Edge Function (Deno: SMS hook)
- Admin: React 19 + Vite + TypeScript (Vercel)
- SMS: Fast2SMS via Supabase Send-SMS hook · Builds: EAS
