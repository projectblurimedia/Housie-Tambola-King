# Environment & API keys

Every secret lives in exactly one place. Only `*.example` files are committed.

| Where | File / place | Keys |
|---|---|---|
| App (public) | `app/.env` (local) · EAS environment variables (builds) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Admin web (public) | `admin-web/.env.local` · Vercel env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Edge Functions (secret) | `npx supabase secrets set …` (local copy: `supabase/functions/.env`) | `SEND_SMS_HOOK_SECRET`, `FAST2SMS_API_KEY` |
| Supabase CLI (your PC only) | `npx supabase login` + `npx supabase link --project-ref <ref>` | access token, DB password |

The anon key is public by design — Row Level Security and the SECURITY DEFINER RPCs protect the data. **Never** put the service-role key in the app or admin-web.

## One-time Supabase dashboard settings
1. **Authentication → Sign In / Providers**
   - Phone: **enabled** (provider can stay "Twilio" — the hook below replaces sending).
   - Allow anonymous sign-ins: **on** (guest play).
2. **Authentication → Hooks → Send SMS hook** → HTTPS → `https://<ref>.supabase.co/functions/v1/send-sms-hook` → *Generate secret* → copy it into `SEND_SMS_HOOK_SECRET`.
3. **Integrations → Cron**: pg_cron is enabled by the migration; jobs `housie-game-tick` (1 s), `housie-cleanup-stale`, `housie-cron-history-prune` should be listed.
4. **Realtime → Settings**: keep "Allow public access" **off** (game channels are private).

