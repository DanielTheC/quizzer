# Claude Code / Claude in VS Code — project context

**Read [`AGENTS.md`](./AGENTS.md) first.** It defines how AI tools and humans coordinate in this repo (single driver per task, handoff format, git discipline).

## Bootstrap prompt (paste into a new Claude chat)

```text
You are helping on the Quizzer monorepo. Open and follow AGENTS.md in the repo root.

Working rules:
- One assistant drives file edits per task; I also use Cursor—coordinate via git and explicit handoffs, not parallel edits on the same files.
- If I paste a "Handoff" block from AGENTS.md, treat goal and constraints as authoritative.
- Scope changes to my request; match existing patterns in the touched app (`apps/app` = Expo, `apps/website` = Next.js).
- Do not invent Supabase RPCs, tables, or migrations unless I explicitly request them; check `supabase/migrations/` for truth.
- Prefer small, reviewable diffs. State assumptions briefly if you must guess.

My immediate request:
[PASTE YOUR TASK HERE]
```

After the block, paste your specific task and any file paths or errors.
