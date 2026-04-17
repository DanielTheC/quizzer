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

- Prefer **small commits** or a **WIP branch** so any assistant’s output is easy to revert.
- If two suggestions conflict, **resolve in git**; don’t manually merge incompatible edits blind.
- Before a big handoff, `git status` and a short summary of **uncommitted** changes help the next session.

## Project expectations

- **Scope:** Stay inside the user’s stated task; avoid drive-by refactors.
- **Conventions:** Match surrounding code (naming, imports, patterns).
- **Secrets:** Never commit `.env` or keys; use existing `.env.example` patterns.
- **Database:** Do not invent RPCs or columns; follow existing migrations and Supabase patterns in `supabase/migrations/`.

## Repo sketch

```
quizzer/
├── apps/
│   ├── app/          React Native (Expo) — player-facing mobile app
│   └── website/      Next.js App Router — public site + admin + host portal
└── supabase/
    ├── migrations/   All schema changes; source of truth for DB structure
    └── functions/    Edge functions (if any)
```

### apps/app — Expo (React Native)
- **Players**: browse quizzes (`NearbyScreen`), save quizzes (`SavedScreen`), view details (`QuizDetailScreen`)
- **Hosts**: dashboard (`HostDashboardScreen`), run quiz (`RunQuizScreen`)
- Theme: `src/theme.ts` — neo-brutalist tokens (Anton font, yellow/pink/green palette, hard-offset shadows)
- Supabase client: `src/lib/supabase.ts`

### apps/website — Next.js
- **Public**: `/find-a-quiz`, `/find-a-quiz/[city]`, `/find-a-quiz/quiz/[id]`, blog, FAQ, etc.
- **Host portal**: `/portal` — publican-facing venue/message management
- **Operator admin**: `/admin` — triage, analytics, host management, quiz/venue CRUD
- Design: Tailwind v4, same neo-brutalist tokens as app via `globals.css`
- Supabase clients: `src/lib/supabase/browser.ts` (client), `src/lib/supabase/server.ts` (server)
- CMS: Sanity (homepage, blog, FAQ, city pages)

### Supabase permission model
Three distinct roles gated by separate functions:
- `is_operator()` — full admin access; checks `operator_users` table
- `is_allowlisted_host()` — approved quiz hosts; checks `host_allowlisted_emails`
- Publicans — venue managers; access via `publican_venues` table (no special function)

**Key tables:**
- `venues` — pubs/bars; has `lat`, `lng`, `what_to_expect`
- `quiz_events` — recurring quiz nights; `is_active`, `day_of_week`, `turn_up_guidance`
- `host_applications` — host sign-up requests; `status`: pending/approved/rejected
- `host_quiz_sessions` — completed nights recorded by hosts
- `host_venue_rates` — operator-set pay rate per host/venue
- `venue_images` — gallery photos; stored in Supabase Storage bucket `venue-images`
- `quiz_event_interests` — player interest/save counts
- `publican_messages` — venue manager → operator messages; `status`: open/in_progress/resolved

### Conventions
- **RLS**: Every table has RLS enabled. New tables need policies before client code will work.
- **RPCs**: Sensitive operations use `SECURITY DEFINER` functions gated by role checks.
- **Migrations**: Always `ADD COLUMN IF NOT EXISTS`; never destructive without explicit ask.
- **Storage**: `venue-images` bucket is public read; write requires storage object policies.

---

## Copy-paste — “Session bootstrap” (any assistant)

Use this at the **start** of a chat when picking up work:

```text
You are helping on the Quizzer monorepo. Read AGENTS.md in the repo root and follow it.

Working rules:
- One tool drives file edits per task; I may use you together with Cursor — don’t assume you’re the only editor.
- If I paste a Handoff block, treat it as authoritative for goal and constraints.
- Prefer minimal, task-scoped diffs; match existing code style.
- Don’t create migrations or Supabase RPCs unless I ask; align with existing supabase/migrations/.
- Check the permission model in AGENTS.md before any DB work — every table needs RLS policies.
- Ask only if blocked; otherwise proceed with reasonable defaults and state assumptions briefly.

My immediate request:
[PASTE YOUR TASK HERE]
```

Replace the last line with the actual task after pasting the block.
