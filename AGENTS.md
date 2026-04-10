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

## Repo sketch (high level)

- `apps/app` — React Native (Expo) client.
- `apps/website` — Next.js site (e.g. admin).
- `supabase/` — migrations, seeds, functions.

Refer to each app’s `package.json` for scripts and stack details.

---

## Copy-paste — “Session bootstrap” (any assistant)

Use this at the **start** of a chat when picking up work:

```text
You are helping on the Quizzer monorepo. Read AGENTS.md in the repo root and follow it.

Working rules:
- One tool drives file edits per task; I may use you together with Cursor—don’t assume you’re the only editor.
- If I paste a Handoff block, treat it as authoritative for goal and constraints.
- Prefer minimal, task-scoped diffs; match existing code style.
- Don’t create migrations or Supabase RPCs unless I ask; align with existing `supabase/migrations`.
- Ask only if blocked; otherwise proceed with reasonable defaults and state assumptions briefly.

My immediate request:
[PASTE YOUR TASK HERE]
```

Replace the last line with the actual task after pasting the block.
