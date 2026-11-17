# Deployment

## Backend (Supabase)
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                                   # apply migrations
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy send-sms-hook --no-verify-jwt
node scripts/smoke-test.mjs                            # end-to-end check
```
Then do the dashboard steps in `docs/environment.md`, sign in once with your phone, and run `scripts/make-admin.sql`.

## App (EAS)
```bash
cd app
npx eas init                       # creates the EAS project, writes extra.eas.projectId
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment preview --environment production --visibility plaintext
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon> --environment preview --environment production --visibility plaintext
npx eas build -p android --profile preview      # installable APK for testing
npx eas build -p android --profile production   # AAB for Play Store
npx eas update --channel production             # JS-only fixes over the air
```

## Admin web (Vercel)
Import `admin-web/` as a Vercel project (framework Vite), set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, deploy. `vercel.json` handles SPA routing; `noindex` is set in `index.html`.

## CI
`.github/workflows/`: `app-ci` (typecheck, tests, Android bundle), `admin-web-ci` (build), `supabase-ci` (applies all migrations to a fresh local Supabase + `db lint`).
