# AI collaboration — Cursor & Claude (and humans)

This repo may be edited with **multiple assistants** (e.g. Cursor in-repo agent, Claude in VS Code or claude.ai). These rules keep work **predictable and reversible**.

## One driver per task

- For a given change, pick **one** tool to **apply edits** to the filesystem.
- Use the other for **review, design, debugging ideas, or read-only analysis** unless the human explicitly merges two outputs in git.
- Avoid two agents editing the **same files at the same time** without coordination.

## Handoff to another assistant (or future you)

When switching tools or sessions, paste (or commit) a block like this:

```text
## Handoff
- Goal:
- Constraints: (e.g. "only apps/app", "no new migrations", "match existing patterns in X")
- Done so far: (bullets or commit SHAs)
- Next step:
- Open risks / TODO:
- Key paths: (files or folders)
```

If there was an error, paste the **full message** and **command** you ran.

## Git is the integration layer

- Prefer **small commits** or a **WIP branch** so any assistant's output is easy to revert.
- If two suggestions conflict, **resolve in git**; don't manually merge incompatible edits blind.
- Before a big handoff, `git status` and a short summary of **uncommitted** changes help the next session.

## Project expectations

- **Scope:** Stay inside the user's stated task; avoid drive-by refactors.
- **Conventions:** Match surrounding code (naming, imports, patterns).
- **Secrets:** Never commit `.env` or keys; use existing `.env.example` patterns.
- **Database:** Do not invent RPCs or columns; follow existing migrations in `supabase/migrations/`.

---

## Repo sketch

```
quizzer/
├── apps/
│   ├── app/          React Native (Expo) — player + host mobile app
│   └── website/      Next.js App Router — public site + admin + publican portal
└── supabase/
    ├── migrations/   All schema changes; source of truth for DB structure
    └── functions/    Edge functions (if any)
```

---

## apps/app — Expo (React Native)

### Player screens
- `NearbyScreen` — browse quizzes (list + map view), filters, Tonight mode, sort
- `SavedScreen` — saved/bookmarked quizzes with day-of-week filter pills
- `QuizDetailScreen` — full quiz detail with venue image gallery
- `LoginScreen` / `SignUpScreen` / `PhoneSignInScreen` — auth flows

### Host screens
- `HostDashboardScreen` — host landing; links to Available Quizzes + My Claims
- `HostHomeScreen` — Run Quiz home (start new / resume)
- `AvailableQuizzesScreen` — unclaimed quiz events; host taps Claim → creates pending claim
- `MyClaimsScreen` — host's claims (pending/confirmed/rejected); confirmed → Run Quiz
- `RunQuizScreen` — live quiz running (teams, scores, halftime, leaderboard, prizes)
- `PackQuestionsScreen` — view quiz pack questions
- `HostProfileScreen` — editable first/last name, stats, claims history, session history
- `HostApplyScreen` — host application form

### Key lib files
- `src/lib/quizPack.ts` — fetch/cache quiz packs; `getLatestPack()` skips `local-*` cached IDs
- `src/lib/hostAccess.ts` — `fetchIsAllowlistedHost()`, `authEmailForHost()`
- `src/lib/runQuizStorage.ts` — local quiz state persistence + session history
- `src/lib/quizEventDetailCache.ts` — prefetch/cache quiz event detail

### Theme
`src/theme.ts` — neo-brutalist tokens: Anton font, `#FFD400` yellow, pink, green, hard-offset shadows, 3px black borders.

---

## apps/website — Next.js App Router

### Public pages
`/find-a-quiz`, `/find-a-quiz/[city]`, `/find-a-quiz/quiz/[id]`, blog, FAQ, host-a-quiz, about-us, contact-us, terms, privacy. CMS via Sanity.

### Publican portal `/portal`
Venue managers (publicans) log in to see their venue's quizzes, interest stats, send/receive messages.
- `/portal/sign-in` — existing sign-in page
- `/portal/(protected)/` — protected layout; redirects to sign-in if no `publican_profiles` row
- `PublicanDashboard` component — venue info, quiz events, messages

### Operator admin `/admin`
Full operator back-office. Protected by `is_operator()`.

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin` | `AdminTriageDashboard` (exports `AdminHomeDashboard`) | Home dashboard: KPI strip, action inbox (applications + claims + messages), unhosted quizzes |
| `/admin/hosts` | `AdminHostsDashboard` | Tabbed: Roster · Allowlist (with default fee + first/last name) · Claims (confirm/reject) · Payroll |
| `/admin/quizzes` | `AdminQuizzesDashboard` | Quiz events CRUD; List + Schedule (weekly calendar) views; host status column; publican linking |
| `/admin/packs` | `AdminPacksDashboard` | Quiz pack manager; CSV import (comma or tab delimited); round/question accordion editor |
| `/admin/messages` | `AdminMessagesDashboard` | Publican messages; reply + status |
| `/admin/analytics` | `AdminAnalyticsDashboard` | Network summary, venue stats, recent sessions |
| `/admin/observability` | — | Error/event monitoring |

### Design
Tailwind v4, neo-brutalist: `border-[3px] border-quizzer-black`, `shadow-[5px_5px_0_#000]`, yellow `#FFD400`, Anton headings, hard-offset button hover (`translate-x-[1px] translate-y-[1px]`). Tokens in `globals.css` `@theme`.

### Supabase clients
- `src/lib/supabase/browser.ts` — `createBrowserSupabaseClient()`
- `src/lib/supabase/server.ts` — `createServerSupabaseClientSafe()`, `createServiceRoleSupabaseClient()`

---

## Supabase permission model

Three roles, each gated by a separate helper function:

| Role | Function | How it works |
|------|----------|-------------|
| Operator | `is_operator()` | checks `operator_users` table |
| Host | `is_allowlisted_host()` | checks `host_allowlisted_emails` (lowercase email match) |
| Publican | — | checks `publican_profiles` table (row exists for `auth.uid()`) |

### Key tables

| Table | Purpose |
|-------|---------|
| `venues` | Pubs/bars; `lat`, `lng`, `what_to_expect`, `borough` |
| `quiz_events` | Recurring quiz nights; `is_active`, `day_of_week`, `start_time`, `entry_fee_pence`, `host_fee_pence` (nullable override), `prize_1st/2nd/3rd` |
| `quiz_claims` | Host claims a quiz slot; `status`: pending/confirmed/rejected/cancelled. Partial unique index: one active (pending or confirmed) claim per quiz. |
| `host_applications` | Host sign-up requests; `status`: pending/approved/rejected |
| `host_allowlisted_emails` | Approved hosts; `email`, `default_fee_pence`, `first_name`, `last_name` |
| `host_quiz_sessions` | Completed quiz nights recorded by hosts |
| `host_venue_rates` | Operator-set pay rate per host/venue |
| `quiz_packs` | Quiz content packs |
| `quiz_rounds` | Rounds within a pack (1–9; round 9 = picture round) |
| `quiz_questions` | Questions within a round |
| `quiz_answers` | Answers; RLS restricts SELECT to `is_allowlisted_host()` |
| `venue_images` | Gallery photos; Supabase Storage bucket `venue-images` |
| `quiz_event_interests` | Player save/interest counts |
| `publican_messages` | Venue manager → operator messages; `status`: open/in_progress/resolved |
| `publican_profiles` | Links auth user to venue for publican portal access |
| `operator_users` | Operator user IDs |

### Conventions
- **RLS**: Every table has RLS enabled. New tables need policies before client code will work.
- **RPCs**: Sensitive operations use `SECURITY DEFINER` functions gated by role checks.
- **Migrations**: Always `ADD COLUMN IF NOT EXISTS`; never destructive without explicit ask.
- **Storage**: `venue-images` bucket is public read; write requires storage object policies.
- **Host fee resolution**: `quiz_events.host_fee_pence` overrides `host_allowlisted_emails.default_fee_pence`. NULL on quiz_events means use host default.
- **Quiz pack caching**: `getLatestPack()` skips any cached ID starting with `local-` (fallback pack sentinel) and fetches from Supabase instead.

---

## Copy-paste — "Session bootstrap" (any assistant)

Use this at the **start** of a chat when picking up work:

```text
You are helping on the Quizzer monorepo. Read AGENTS.md in the repo root and follow it.

Working rules:
- One tool drives file edits per task; I may use you together with Cursor — don't assume you're the only editor.
- If I paste a Handoff block, treat it as authoritative for goal and constraints.
- Prefer minimal, task-scoped diffs; match existing code style.
- Don't create migrations or Supabase RPCs unless I ask; align with existing supabase/migrations/.
- Check the permission model in AGENTS.md before any DB work — every table needs RLS policies.
- Ask only if blocked; otherwise proceed with reasonable defaults and state assumptions briefly.

My immediate request:
[PASTE YOUR TASK HERE]
```
