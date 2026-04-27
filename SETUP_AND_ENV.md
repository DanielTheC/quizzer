# Quizzer — setup, env vars, and off-Cursor tasks

Use this as a **checklist** for things you configure outside the editor (Vercel, Supabase, Google Cloud, Sentry, EAS). Values are **never** committed; copy from each dashboard into `.env` / hosting UI.

---

## 1. Repo layout

| Area | Path | Notes |
|------|------|--------|
| Mobile (Expo) | `apps/app` | `.env` next to `package.json` |
| Marketing + admin + portal (Next.js) | `apps/website` | `.env.local` locally; Vercel env vars in production |
| Supabase SQL | `supabase/migrations` | Apply to your hosted project |
| Dev-only SQL helpers | `supabase/dev_publican_portal_seed.sql` | Manual run in SQL Editor |

---

## 2. Website (`apps/website`) — environment variables

Copy `apps/website/.env.example` → `.env.local` and fill in.

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (portal/admin) | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (publican invites) | Supabase → API → `service_role` (secret). Server-only; set in Vercel + `.env.local`. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Used as a fallback origin for `inviteUserByEmail` `redirectTo` when the request `Origin` header isn't present (e.g. local curl). Set in Vercel Production to the production domain. |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | For CMS pages | Sanity manage → project id |
| `NEXT_PUBLIC_SANITY_DATASET` | Optional | Default `production` |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Optional | e.g. `2024-01-01` |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry → project → Client Keys (DSN) |
| `NEXT_PUBLIC_SENTRY_ISSUES_URL` | Optional | Your Sentry **Issues** page URL (deep link from Admin → Observability) |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | e.g. `0.05` (server/edge traces) |
| `SENTRY_ORG` | Optional | For **source maps** on Vercel build |
| `SENTRY_PROJECT` | Optional | Same |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry → Auth tokens; **secret** — set in Vercel only, never in git |
| `NEXT_PUBLIC_DEBUG_QUIZZES` | Optional | `true` to show data-source banner on find-a-quiz |

**Vercel**

1. **Project → Settings → General → Root Directory:** `apps/website` (required for `/admin`, `/portal` routes).
2. **Settings → Environment Variables:** add the `NEXT_PUBLIC_*` (and optional Sentry build vars) for Production + Preview.
3. Add `SUPABASE_SERVICE_ROLE_KEY` as a **secret** env var (Production + Preview). Server-only — do not check "Available in browser".

---

## 3. Mobile app (`apps/app`) — environment variables

Copy `apps/app/.env.example` → `.env` and fill in.

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Same Supabase project URL as website |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same anon key as website |
| `EXPO_PUBLIC_WEBSITE_URL` | Yes | Production website base URL, e.g. `https://www.quizzerapp.co.uk`; used by mobile to call website API routes that need service-role. |
| `EXPO_PUBLIC_DEV_SKIP_AUTH` | Dev only | `1` / `true` — **omit in production**; skips login with a fake user |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Android maps | Google Cloud → APIs → Maps SDK for Android |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Sentry RN project DSN |

After changes: `npx expo start --clear`.

**Full Google Sign-In + Supabase (email + OAuth)** — step-by-step (Google Cloud + Supabase redirect URLs + Expo): see **`apps/app/AUTH_SETUP.md`**.

Summary (details in that file):

| Where | What you configure |
|--------|--------------------|
| **Google Cloud** | OAuth **Web** client; **Authorised redirect URIs** = `https://<project-ref>.supabase.co/auth/v1/callback` only |
| **Supabase** | Authentication → Providers: **Email**, **Google** (paste Client ID + Secret) |
| **Supabase** | Authentication → URL Configuration → **Redirect URLs**: `quizzer://auth/callback` + any `exp://...` URLs you use in Expo Go (see AUTH_SETUP) |

**EAS cloud builds** — `.env` is not uploaded. Use EAS env / secrets. See **`apps/app/INTERNAL_TESTING.md`**.

---

## 4. Sentry (website + app)

1. Create org + project(s) at [sentry.io](https://sentry.io).
2. **Website:** set `NEXT_PUBLIC_SENTRY_DSN` in Vercel + locally. Optional: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` for source maps on build.
3. **App:** set `EXPO_PUBLIC_SENTRY_DSN` in `.env` and in **EAS** for `preview` / `production`.
4. **Find Supabase-related errors:** Sentry → Issues → filter tag **`supabase:true`** (admin triage reports failed queries with an `operation` tag).

Admin UI: **Observability** (`/admin/observability`) shows whether the DSN is configured and can link to Issues if you set `NEXT_PUBLIC_SENTRY_ISSUES_URL`.

---

## 5. Supabase — roles, portal, and dev data

Applied via **SQL Editor** or **CLI migrations** (your normal process).

| Task | What to do |
|------|------------|
| **Migrations** | Run all files in `supabase/migrations` against your project (order by filename). |
| **Operator (admin `/admin`)** | Insert into `public.operator_users` with your `auth.users.id`. See migration comment in `20260410100000_operator_users.sql`. |
| **Publican portal venues** | Rows in `public.publican_venues` link `user_id` ↔ `venue_id`. Empty table = no venues in portal until you insert. |
| **Dev pub + quiz + link (testing)** | Edit user UUID in `supabase/dev_publican_portal_seed.sql`, run in SQL Editor (`prize` must be enum e.g. `voucher`, not free text). |

**Supabase logs:** Dashboard → **Logs** / **Reports** for API and Postgres (separate from Sentry client errors).

---

## 6. Related docs in this repo

| File | Contents |
|------|----------|
| `apps/app/AUTH_SETUP.md` | Google OAuth + Supabase + redirect URLs (full walkthrough) |
| `apps/app/INTERNAL_TESTING.md` | EAS `preview`, env secrets, build commands |
| `apps/website/SUPABASE_QUIZZES_DEBUG.md` | Website + Supabase quiz listing |
| `apps/website/.env.example` | Website env template |
| `apps/app/.env.example` | App env template |

---

## 7. Quick verification

- **Website:** `cd apps/website && npm run dev` → home, `/portal`, `/admin/sign-in`.
- **App:** `cd apps/app && npx expo start` → sign-in, Google flow if configured.
- **Vercel:** latest deployment built from `apps/website` root; env vars set for Production.

If you add new `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` keys in code, update **this file** and the matching **`.env.example`** so the list stays accurate.

---

## 8. Supabase Auth — invite emails (publican onboarding)

| Setting | Where | Value |
|---|---|---|
| SMTP host/user/pass/sender | Supabase → Authentication → Emails → SMTP Settings | A real provider (Resend, Postmark, SendGrid). The default Supabase shared SMTP is rate-limited to ~3 emails/hour and unsuitable for production. |
| Site URL | Supabase → Authentication → URL Configuration | The production website origin, e.g. https://quizzerapp.co.uk |
| Redirect URLs allowlist | Same screen | `https://quizzerapp.co.uk/auth/callback`, plus your preview/Vercel URL pattern, plus `http://localhost:3000/auth/callback` for dev |
| Email template — Invite | Supabase → Authentication → Emails → Templates → Invite | Default template works. The button URL uses `{{ .ConfirmationURL }}` which Supabase generates against the `redirectTo` we pass in the API route. |

If a publican never receives the invite email, check Supabase logs (Authentication → Logs) for the SMTP send result. The website's `/auth/callback` route is the destination — confirm it's in the Redirect URLs allowlist.
