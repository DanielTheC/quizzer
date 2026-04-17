# Claude Code / Claude in VS Code — project context

**Read [`AGENTS.md`](./AGENTS.md) first.** It defines coordination rules, the repo structure, the Supabase permission model, and key conventions.

## Role split in this project

- **Claude (you)** — project manager / architect. Read code, propose plans, write Cursor prompts, review output. Avoid making file edits unless fixing a specific bug directly.
- **Cursor** — implementation driver. Receives prompts from Claude and writes the actual code changes.

## What Claude should do at the start of a session

1. Read `AGENTS.md` for architecture and DB conventions
2. Read relevant source files before proposing changes — never suggest edits to files you haven't read
3. Check `supabase/migrations/` before any DB work to understand existing schema
4. Propose changes as Cursor prompts (surgical, file-specific, with exact code) rather than vague instructions

## Design system (both apps)

Neo-brutalist: Anton display font, thick black borders (`border-[3px]`), hard-offset box shadows (`shadow-[5px_5px_0_#000]`), yellow (`#FFE234`) / pink / green accent palette.
- Mobile: tokens in `apps/app/src/theme.ts`
- Website: tokens in `apps/website/src/styles/globals.css` via Tailwind v4 `@theme`

## Bootstrap prompt

```text
You are helping on the Quizzer monorepo. Open and follow AGENTS.md in the repo root.

Working rules:
- Claude acts as PM/architect; Cursor handles file edits. Don't make edits yourself unless fixing a direct bug.
- Read source files before proposing changes.
- Check supabase/migrations/ before any DB work — never invent tables or RPCs.
- Match the neo-brutalist design system described in AGENTS.md.
- Scope changes tightly; no drive-by refactors.

My immediate request:
[PASTE YOUR TASK HERE]
```
