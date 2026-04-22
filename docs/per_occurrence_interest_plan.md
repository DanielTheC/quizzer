# Per-occurrence interest redesign — v1 plan

Status: design locked (2026-04-20). Pre-launch cut-over, no feature flag.

## Goal

Replace the current lifetime `(user, quiz_event)` interest flag with a per-occurrence RSVP that resets after each occurrence date passes. Let operators control how many occurrences are scheduled (three-month rolling contract baseline). Let players express interest in specific future dates and see upcoming occurrences per venue.

## Scope summary

Mobile app + website + Supabase. One migration, one Cursor prompt, one backfill step.

## Locked design decisions

### Recurrence

- Operators set frequency per `quiz_event`: `weekly | monthly | quarterly | one_off`.
- Operators set `start_date` and `occurrences_planned` (how many future occurrences to materialise).
- Monthly / quarterly use "nth weekday of month" (e.g. "2nd Tuesday"). `nth_week` = 1..5, NULL for weekly/one_off.
- Operator-only: create, set N, set start date, extend, edit the rule. Editing the rule **regenerates future occurrences** (past ones stay as-is).
- When an operator changes the rule mid-stream, any interest rows on now-stale future occurrence dates are dropped (the dates no longer exist).
- Out of occurrences → quiz stays visible with "next occurrence: none scheduled" (nudge to renew). Not hidden.

### Cancellation

- Per-occurrence cancellation, not the whole quiz.
- `cancelled_by ∈ {host, publican, operator}`. `host` stubbed — current rule is hosts can't cancel, only unclaim. Kept in enum for future.
- Cancelled occurrence is **not replaced** — quiz has one fewer live date.
- `penalty_applied bool DEFAULT false` column stubbed; penalty calc logic is out of v1 scope.

### Host / publican

- Claims remain at the `quiz_event` level (claim a recurring slot).
- Host can **release a specific occurrence** without unclaiming the recurring quiz. Released occurrences reopen to other allowlisted hosts.
- `substitute_host_user_id` tracks who picks up a released occurrence; falls back to the quiz_event claim for the rest.

### Player

- "Interested" is per `(user, quiz_event, occurrence_date)`. Explicit opt-in per date. No auto-carry-forward.
- "Saved" is a separate concept, lifetime, bookmark-only. Must be decoupled from interest in the app.
- Find-a-quiz list: one row per quiz, count reflects the **next (soonest non-cancelled future) occurrence**.
- Quiz detail: show the next 4 future occurrences as chips with per-occurrence interest count + per-occurrence RSVP toggle.

### Reset

- Cron hourly (idempotent). `DELETE FROM quiz_event_interests WHERE occurrence_date < (now() AT TIME ZONE 'Europe/London')::date;`
- Timezone is Europe/London throughout (DST-aware).

### Rollout

- No feature flag. Cut over on deploy.
- Existing `quiz_event_interests` rows are dropped (they're lifetime, not per-date — cannot be migrated meaningfully).
- Existing `quiz_events` become `frequency='weekly'`, `start_date = next occurrence of day_of_week from deploy date`, `occurrences_planned=12`. Backfill materialises those 12 rows into `quiz_event_occurrences`.

---

## Migration SQL

File: `supabase/migrations/20260421100000_per_occurrence_interest.sql`

```sql
-- Per-occurrence interest + occurrence materialisation.
-- Replaces lifetime quiz_event_interests with (user, quiz_event, occurrence_date) RSVP.
-- Adds quiz_event_occurrences for cancellation + host release.

BEGIN;

-- 1. Frequency enum + columns on quiz_events -------------------------------

DO $$ BEGIN
  CREATE TYPE quiz_event_frequency AS ENUM ('weekly', 'monthly', 'quarterly', 'one_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE quiz_events
  ADD COLUMN IF NOT EXISTS frequency quiz_event_frequency NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS nth_week smallint CHECK (nth_week BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS occurrences_planned smallint NOT NULL DEFAULT 12
    CHECK (occurrences_planned >= 0 AND occurrences_planned <= 52);

COMMENT ON COLUMN quiz_events.frequency IS 'Operator-set cadence. Drives occurrence materialisation.';
COMMENT ON COLUMN quiz_events.nth_week IS '1..5 for monthly/quarterly (nth weekday of month). NULL for weekly/one_off.';
COMMENT ON COLUMN quiz_events.start_date IS 'First occurrence date. All materialised dates derive from this.';
COMMENT ON COLUMN quiz_events.occurrences_planned IS 'How many future occurrences to materialise. Operator-controlled (three-month rolling contract baseline).';

-- Drop the lifetime cancellation flag in favour of per-occurrence cancellation.
ALTER TABLE quiz_events DROP COLUMN IF EXISTS host_cancelled_at;

-- 2. Cancellation reason enum ----------------------------------------------

DO $$ BEGIN
  CREATE TYPE quiz_occurrence_cancelled_by AS ENUM ('host', 'publican', 'operator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Occurrences table -----------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_event_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  cancelled_at timestamptz,
  cancelled_by quiz_occurrence_cancelled_by,
  cancellation_reason text,
  penalty_applied boolean NOT NULL DEFAULT false,
  released_by_host_at timestamptz,
  substitute_host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_event_id, occurrence_date)
);

COMMENT ON TABLE quiz_event_occurrences IS 'Materialised future dates for a quiz. One row per scheduled occurrence.';

CREATE INDEX IF NOT EXISTS idx_quiz_event_occurrences_date ON quiz_event_occurrences (occurrence_date);
CREATE INDEX IF NOT EXISTS idx_quiz_event_occurrences_quiz_date ON quiz_event_occurrences (quiz_event_id, occurrence_date);

ALTER TABLE quiz_event_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Occurrences public read"
  ON quiz_event_occurrences FOR SELECT
  USING (true);

CREATE POLICY "Operators manage occurrences"
  ON quiz_event_occurrences FOR ALL
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

-- 4. Rewrite quiz_event_interests with occurrence_date in PK --------------

DROP TABLE IF EXISTS quiz_event_interests;

CREATE TABLE quiz_event_interests (
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_event_id, user_id, occurrence_date)
);

COMMENT ON TABLE quiz_event_interests IS 'Per-occurrence RSVP. Reset daily by cron when occurrence_date < today (Europe/London).';

CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_quiz_date
  ON quiz_event_interests (quiz_event_id, occurrence_date);
CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_user
  ON quiz_event_interests (user_id);

ALTER TABLE quiz_event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quiz interests"
  ON quiz_event_interests FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Occurrence generation helper -----------------------------------------
-- Given (start_date, day_of_week 0..6, frequency, nth_week, count) returns N dates.

CREATE OR REPLACE FUNCTION public.generate_quiz_occurrence_dates(
  p_start_date date,
  p_day_of_week smallint,     -- 0 = Sunday .. 6 = Saturday (Postgres convention)
  p_frequency quiz_event_frequency,
  p_nth_week smallint,        -- 1..5 or NULL
  p_count smallint
) RETURNS SETOF date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d date;
  anchor date;
  month_cursor date;
  step_months int;
  nth int;
  produced int := 0;
BEGIN
  IF p_count <= 0 THEN RETURN; END IF;

  IF p_frequency = 'one_off' THEN
    RETURN NEXT p_start_date;
    RETURN;
  END IF;

  IF p_frequency = 'weekly' THEN
    -- snap start_date forward to first matching weekday
    anchor := p_start_date + ((7 + p_day_of_week - EXTRACT(DOW FROM p_start_date)::int) % 7);
    FOR i IN 0..(p_count - 1) LOOP
      RETURN NEXT anchor + (i * 7);
    END LOOP;
    RETURN;
  END IF;

  -- monthly / quarterly: nth weekday of month
  step_months := CASE p_frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 END;
  nth := COALESCE(p_nth_week, 1);
  month_cursor := date_trunc('month', p_start_date)::date;

  WHILE produced < p_count LOOP
    -- first matching weekday of this month
    d := month_cursor + ((7 + p_day_of_week - EXTRACT(DOW FROM month_cursor)::int) % 7);
    -- bump to nth
    d := d + ((nth - 1) * 7);
    -- only accept if still in the same month (5th weekday may overflow → skip)
    IF EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM month_cursor) AND d >= p_start_date THEN
      RETURN NEXT d;
      produced := produced + 1;
    END IF;
    month_cursor := (month_cursor + make_interval(months => step_months))::date;
    -- safety: bail at 10y lookahead
    IF month_cursor > p_start_date + interval '10 years' THEN EXIT; END IF;
  END LOOP;
END;
$$;

-- 6. Materialisation RPC: regenerates future occurrences for a quiz -------

CREATE OR REPLACE FUNCTION public.rebuild_quiz_event_occurrences(p_quiz_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
  today_uk date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF NOT public.is_operator() THEN
    RAISE EXCEPTION 'operator only';
  END IF;

  SELECT id, day_of_week, frequency, nth_week, start_date, occurrences_planned
    INTO q
  FROM quiz_events WHERE id = p_quiz_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- drop future uncancelled occurrences; keep past + already-cancelled rows for audit
  DELETE FROM quiz_event_occurrences
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date >= today_uk
     AND cancelled_at IS NULL;

  INSERT INTO quiz_event_occurrences (quiz_event_id, occurrence_date)
  SELECT p_quiz_event_id, d
  FROM public.generate_quiz_occurrence_dates(
    GREATEST(q.start_date, today_uk),
    q.day_of_week::smallint,
    q.frequency,
    q.nth_week,
    q.occurrences_planned
  ) d
  ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

  -- drop stale interest rows for dates no longer scheduled
  DELETE FROM quiz_event_interests i
   WHERE i.quiz_event_id = p_quiz_event_id
     AND i.occurrence_date >= today_uk
     AND NOT EXISTS (
       SELECT 1 FROM quiz_event_occurrences o
        WHERE o.quiz_event_id = i.quiz_event_id
          AND o.occurrence_date = i.occurrence_date
          AND o.cancelled_at IS NULL
     );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_quiz_event_occurrences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_quiz_event_occurrences(uuid) TO authenticated;

-- 7. Operator cancel-occurrence RPC ---------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_quiz_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date,
  p_cancelled_by quiz_occurrence_cancelled_by,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- v1: operator only (publican cancellation gated by penalty flow, deferred)
  IF NOT public.is_operator() THEN RETURN false; END IF;

  UPDATE quiz_event_occurrences
     SET cancelled_at = now(),
         cancelled_by = p_cancelled_by,
         cancellation_reason = p_reason
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND cancelled_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  DELETE FROM quiz_event_interests
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_quiz_occurrence(uuid, date, quiz_occurrence_cancelled_by, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_quiz_occurrence(uuid, date, quiz_occurrence_cancelled_by, text) TO authenticated;

-- 8. Host release-occurrence RPC -----------------------------------------

CREATE OR REPLACE FUNCTION public.release_quiz_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_current_host boolean;
BEGIN
  -- host must own the claim on this quiz_event
  SELECT EXISTS (
    SELECT 1 FROM quiz_claims c
     WHERE c.quiz_event_id = p_quiz_event_id
       AND c.host_user_id = auth.uid()
       AND c.released_at IS NULL
  ) INTO is_current_host;

  IF NOT is_current_host THEN RETURN false; END IF;

  UPDATE quiz_event_occurrences
     SET released_by_host_at = now(),
         substitute_host_user_id = NULL
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND cancelled_at IS NULL
     AND released_by_host_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_quiz_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_quiz_occurrence(uuid, date) TO authenticated;

-- 9. Public per-occurrence count RPC (replaces lifetime RPC) -------------

DROP FUNCTION IF EXISTS public.get_quiz_event_interest_count(uuid);

CREATE OR REPLACE FUNCTION public.get_quiz_event_interest_count(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM quiz_event_interests
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_event_interest_count(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_event_interest_count(uuid, date) TO anon, authenticated;

-- 10. Public "next occurrence" helper used by find-a-quiz -----------------

CREATE OR REPLACE FUNCTION public.get_next_quiz_occurrence(p_quiz_event_id uuid)
RETURNS TABLE (occurrence_date date, interest_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.occurrence_date,
         (SELECT count(*)::bigint FROM quiz_event_interests i
           WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date)
  FROM quiz_event_occurrences o
  WHERE o.quiz_event_id = p_quiz_event_id
    AND o.occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
    AND o.cancelled_at IS NULL
  ORDER BY o.occurrence_date ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_next_quiz_occurrence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_quiz_occurrence(uuid) TO anon, authenticated;

-- 11. Upcoming occurrences (for detail screen chips) ---------------------

CREATE OR REPLACE FUNCTION public.get_upcoming_quiz_occurrences(
  p_quiz_event_id uuid,
  p_limit smallint DEFAULT 4
) RETURNS TABLE (
  occurrence_date date,
  cancelled boolean,
  interest_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.occurrence_date,
         (o.cancelled_at IS NOT NULL) AS cancelled,
         (SELECT count(*)::bigint FROM quiz_event_interests i
           WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date)
  FROM quiz_event_occurrences o
  WHERE o.quiz_event_id = p_quiz_event_id
    AND o.occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
  ORDER BY o.occurrence_date ASC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_quiz_occurrences(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_quiz_occurrences(uuid, smallint) TO anon, authenticated;

-- 12. host_quiz_dashboard_rows: drop host_cancelled_at, add next-occurrence
DROP FUNCTION IF EXISTS public.host_quiz_dashboard_rows();

CREATE OR REPLACE FUNCTION public.host_quiz_dashboard_rows()
RETURNS TABLE (
  quiz_event_id uuid,
  venue_id uuid,
  venue_name text,
  day_of_week integer,
  start_time text,
  next_occurrence_date date,
  next_occurrence_interest_count bigint,
  host_capacity_note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    q.id,
    q.venue_id,
    v.name,
    q.day_of_week::integer,
    q.start_time::text,
    n.occurrence_date,
    COALESCE(n.interest_count, 0),
    q.host_capacity_note
  FROM quiz_events q
  INNER JOIN venues v ON v.id = q.venue_id
  LEFT JOIN LATERAL public.get_next_quiz_occurrence(q.id) n ON TRUE
  WHERE q.is_active = true
    AND public.is_allowlisted_host()
  ORDER BY q.day_of_week, q.start_time, v.name;
$$;

REVOKE ALL ON FUNCTION public.host_quiz_dashboard_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_quiz_dashboard_rows() TO authenticated;

-- host_patch_quiz_event_host_fields: drop cancellation params (no longer host-level)
DROP FUNCTION IF EXISTS public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean);

CREATE OR REPLACE FUNCTION public.host_patch_quiz_event_host_fields(
  p_quiz_event_id uuid,
  p_capacity_note text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN RETURN false; END IF;
  UPDATE quiz_events SET host_capacity_note = p_capacity_note WHERE id = p_quiz_event_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text) TO authenticated;

-- 13. Cron: hourly sweep of expired interest rows ------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('quiz_event_interests_sweep')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'quiz_event_interests_sweep');
    PERFORM cron.schedule(
      'quiz_event_interests_sweep',
      '5 * * * *',
      $sweep$
        DELETE FROM public.quiz_event_interests
         WHERE occurrence_date < (now() AT TIME ZONE 'Europe/London')::date
      $sweep$
    );
  END IF;
END $$;

-- 14. Backfill ----------------------------------------------------------

-- set start_date on existing quiz_events: next matching weekday from today (UK)
UPDATE quiz_events SET start_date = (
  (now() AT TIME ZONE 'Europe/London')::date
  + ((7 + day_of_week::int - EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London')::date)::int) % 7)
) WHERE start_date IS NULL;

-- materialise 12 occurrences per active weekly quiz
INSERT INTO quiz_event_occurrences (quiz_event_id, occurrence_date)
SELECT q.id, d
FROM quiz_events q,
LATERAL public.generate_quiz_occurrence_dates(
  q.start_date,
  q.day_of_week::smallint,
  q.frequency,
  q.nth_week,
  q.occurrences_planned
) d
WHERE q.is_active = true
ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

COMMIT;
```

---

## Cursor prompts (run in order)

Each prompt is self-contained. Stop between prompts, typecheck, fix issues, then move on. Don't bundle them — keep diffs reviewable.

---

### Prompt 1 — Apply the migration & regenerate Supabase types

```text
You are Cursor on the Quizzer monorepo. Follow AGENTS.md.

Task: apply the per-occurrence interest migration and regenerate types.

1. Create the file supabase/migrations/20260421100000_per_occurrence_interest.sql
   with the SQL from docs/per_occurrence_interest_plan.md ("Migration SQL" section).
   Copy it verbatim. Do not edit.

2. From apps/website, run:
     npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/supabase/types.ts
   If the types file doesn't exist yet, create it at apps/website/src/lib/supabase/types.ts.
   If apps/app needs its own copy, duplicate to apps/app/src/lib/supabase/types.ts.

3. Do NOT change any callsite in this PR. Type errors surfaced by the regenerated
   types are expected and will be fixed by the following prompts. Commit with:
   "migration: per-occurrence interest + occurrences + regenerate types".

Acceptance: migration file present, types regenerated, commit made.
```

---

### Prompt 2 — Mobile: split Saved from Interested

```text
Follow AGENTS.md. Pre-req: prompt 1 applied.

Goal: SavedQuizzesContext today conflates "saved" (bookmark) with "interested"
(quiz_event_interests sync). Split them.

Files:
- Rewrite apps/app/src/context/SavedQuizzesContext.tsx to be bookmark-only:
  - Keep AsyncStorage key "saved_quiz_ids".
  - REMOVE all imports from lib/quizInterestSyncQueue.
  - REMOVE the remote fetch/merge of quiz_event_interests.
  - REMOVE interestSignInSheetVisible/Gate/dismissInterestSignInSheet (these
    belong to InterestedOccurrencesContext now).
  - Keep savedIds, isSaved, addSaved, removeSaved, toggleSaved, clearSaved.

- Create apps/app/src/context/InterestedOccurrencesContext.tsx:
  - State shape: Set<`${quiz_event_id}:${yyyy-mm-dd}`>.
  - AsyncStorage key "interested_occurrences" (JSON: {v:1, entries:string[]}).
  - API: isInterested(quizId, date), addInterested(quizId, date),
    removeInterested(quizId, date), toggleInterested(quizId, date),
    interestSignInSheetVisible, dismissInterestSignInSheet.
  - On auth SIGNED_IN: hydrate by calling supabase
      .from("quiz_event_interests")
      .select("quiz_event_id, occurrence_date")
      .eq("user_id", uid)
      .gte("occurrence_date", todayUkISO())
    Merge into local Set.
  - On sign-out: clear interest queue, clear local state.
  - Reuse the NetInfo / AppState flush pattern from old SavedQuizzesContext.
  - Move the "sign-in nudge sheet" gating logic here (trigger only on a new
    Interested add while signed out).

- Add app/src/lib/dateUtils.ts helper todayUkISO() returning
  (new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London'}).format(new Date()))
  i.e. "YYYY-MM-DD" in UK local time.

- Update App.tsx (or wherever providers mount) to wrap children in both
  SavedQuizzesProvider AND InterestedOccurrencesProvider.

- Grep apps/app for every callsite of useSavedQuizzes(). For each caller,
  decide: is it a bookmark action ("save this quiz") or an RSVP
  ("I'll attend this date")? Update to use the correct context. Most
  find-a-quiz row taps are bookmark; the quiz-detail "I'm interested"
  button is the RSVP.

Acceptance:
- `npm run typecheck` in apps/app passes.
- Tapping the bookmark on a list row does NOT insert into quiz_event_interests.
- Tapping "I'm interested" on a specific occurrence date DOES insert a row
  keyed to that date.
```

---

### Prompt 3 — Mobile: rewrite the interest sync queue for per-occurrence

```text
Follow AGENTS.md. Pre-req: prompt 2 applied.

File: apps/app/src/lib/quizInterestSyncQueue.ts

Changes:
1. Extend InterestQueueOp to carry occurrenceDate (YYYY-MM-DD string):
     { kind: "upsert"; quizEventId: string; userId: string; occurrenceDate: string; attempts?: number }
     { kind: "delete"; quizEventId: string; occurrenceDate: string; attempts?: number }

2. Update isOp() type-guard to require occurrenceDate.

3. runUpsert(quizEventId, userId, occurrenceDate) — upsert row with
   occurrence_date, onConflict "quiz_event_id,user_id,occurrence_date".

4. runDelete(quizEventId, occurrenceDate) —
     .delete().eq("quiz_event_id", quizEventId).eq("occurrence_date", occurrenceDate).

5. flushInterestQueue options: change `savedIds: Set<string>` to
   `interestedKeys: Set<string>` where key = `${quizEventId}:${occurrenceDate}`.
   Skip ops that don't match local state.

6. upsertInterestOrQueue / deleteInterestOrQueue signatures take occurrenceDate.
   Remove bulk upsertInterestsOrQueue / deleteInterestsOrQueue — per-occurrence
   bulk ops aren't used by the new Interested context. If the bulk helpers are
   still imported somewhere after prompt 2, delete those imports.

7. On schema migration from stored queue v1 → v2: parseQueue should drop any
   op missing occurrenceDate silently. Bump STORED_QUEUE version to 2.

Consumer updates (InterestedOccurrencesContext from prompt 2):
- Pass occurrenceDate through on add/remove.
- flushInterestQueue({ sessionUserId, interestedKeys }).

Acceptance: typecheck passes; queue drains correctly after a sign-in with a
couple of pending ops; stored queue v1 rows are silently dropped.
```

---

### Prompt 4 — Mobile: update interest-count fetcher + quiz detail occurrences

```text
Follow AGENTS.md. Pre-req: prompt 3 applied.

File: apps/app/src/lib/quizEventInterestCount.ts
- fetchQuizEventInterestCount now takes (quizEventId: string, occurrenceDate: string).
- Calls supabase.rpc("get_quiz_event_interest_count",
    { p_quiz_event_id: quizEventId, p_occurrence_date: occurrenceDate }).
- Update every caller.

New: apps/app/src/lib/quizOccurrences.ts
- fetchUpcomingOccurrences(quizEventId, limit=4) →
    supabase.rpc("get_upcoming_quiz_occurrences",
      { p_quiz_event_id: quizEventId, p_limit: limit })
  Returns Array<{ occurrenceDate: string; cancelled: boolean; interestCount: number }>.
- fetchNextOccurrence(quizEventId) →
    supabase.rpc("get_next_quiz_occurrence", { p_quiz_event_id: quizEventId })
  Returns { occurrenceDate: string; interestCount: number } | null.

Quiz detail screen (grep for the component that renders quiz detail; likely
apps/app/src/screens/player/QuizDetailScreen.tsx or similar):
- Render 4 horizontal chips (reuse existing chip/pill component). Each chip:
    · Date label: formatPreviewTime or localised "Thu 23 Apr"
    · Interest count below
    · Pressable toggles InterestedOccurrencesContext
    · Cancelled chip: disabled + "Cancelled" badge
    · If fetchUpcomingOccurrences returns empty: show
      "Next occurrence: none scheduled" in neo-brutalist card.
- Remove the single "I'm interested" button (it's now per chip).

Acceptance: chip row renders for any active quiz; tapping a chip inserts /
deletes a row; cancelled chip is non-interactive; count updates optimistically
and reconciles on next fetch.
```

---

### Prompt 5 — Mobile: find-a-quiz list + map — next-occurrence only

```text
Follow AGENTS.md. Pre-req: prompt 4 applied.

Files:
- apps/app/src/screens/player/nearby/useNearbyQuizzes.ts
- apps/app/src/components/NearbyMapView.tsx
- Any list row component rendering find-a-quiz results.

Changes:
1. Extend the shape returned by useNearbyQuizzes with:
     nextOccurrenceDate: string | null
     nextOccurrenceInterestCount: number
   Fetch via a single batched query:
     supabase.from("quiz_event_occurrences")
       .select("quiz_event_id, occurrence_date, interest:quiz_event_interests(count)")
       .in("quiz_event_id", ids)
       .gte("occurrence_date", todayUkISO())
       .is("cancelled_at", null)
       .order("occurrence_date", { ascending: true })
   Reduce client-side to the earliest non-cancelled date per quiz.
   (If the embedded count selector gives trouble, fall back to calling
    get_next_quiz_occurrence per-id in parallel with Promise.all.)

2. Row label replaces "Every Thursday 20:30" with
   "Next: <Thu 23 Apr 20:30>" when a next occurrence exists.
   If no next occurrence → render the neo-brutalist "none scheduled" pill and
   disable the bookmark interaction? NO — bookmark is always available.
   Only the Interested action (which is no longer on the row) is unavailable.

3. Map callout: show next occurrence date + interest count.

Acceptance: list and map both surface next occurrence date; no reference to
lifetime counts; quizzes with zero future occurrences render the "none
scheduled" state.
```

---

### Prompt 6 — Mobile: host dashboard — remove cancellation UI, add per-occurrence release

```text
Follow AGENTS.md. Pre-req: prompt 5 applied.

Scope: host dashboard screen(s). Grep for callers of
  host_quiz_dashboard_rows, host_patch_quiz_event_host_fields, host_cancelled_at.

1. host_quiz_dashboard_rows now returns next_occurrence_date and
   next_occurrence_interest_count; host_cancelled_at is GONE.
   Update the row type and UI to show "Next: <date>  ·  <N> interested".

2. host_patch_quiz_event_host_fields now only takes (uuid, text).
   Remove any UI for "Cancel this quiz" / "Mark cancelled" / timestamp-picker
   flows — hosts can no longer lifetime-cancel. Keep the capacity-note editor.

3. Add an "Unclaim this date" action on the next-occurrence card. Calls:
     supabase.rpc("release_quiz_occurrence",
       { p_quiz_event_id: id, p_occurrence_date: nextDate })
   Confirm with a bottom-sheet. On success, refetch dashboard rows.

4. Grep apps/app for host_cancelled_at — every reference must be removed.
   This includes any cancellation banner on the player-facing quiz detail.

Acceptance: dashboard renders next-occurrence info; no host-initiated
cancellation UI remains; unclaim-this-date flow works end-to-end; grep for
host_cancelled_at returns zero matches in apps/app.
```

---

### Prompt 7 — Website: admin quiz form — frequency + start_date + occurrences

```text
Follow AGENTS.md. Pre-req: prompt 6 applied.

File: apps/website/src/components/admin/AdminQuizzesDashboard.tsx (or wherever
the quiz create/edit form lives — grep for where day_of_week + start_time are
edited).

Add form fields (neo-brutalist: Anton labels, border-[3px], shadow-[5px_5px_0_#000]):
- Frequency: select with options weekly / monthly / quarterly / one_off.
- Start date: <input type="date">.
- Occurrences planned: <input type="number" min=1 max=52 step=1>, default 12.
- Nth week (1..5): only rendered when frequency ∈ {monthly, quarterly}.
  Labelled "Which <weekday> of the month?" using the selected day_of_week.

Persistence:
- Update the insert / update payload to include frequency, nth_week,
  start_date, occurrences_planned.
- After a successful insert or update, call:
    supabase.rpc("rebuild_quiz_event_occurrences", { p_quiz_event_id: row.id })
  Surface RPC errors via the existing toast / error banner.

Validation:
- weekly / one_off must NOT send nth_week (coerce to null).
- monthly / quarterly REQUIRE nth_week.
- start_date required for all frequencies.

Acceptance: create + edit flows round-trip; after save, the upcoming-
occurrences list (prompt 8) reflects the new rule immediately.
```

---

### Prompt 8 — Website: admin quiz detail — cancel occurrence

```text
Follow AGENTS.md. Pre-req: prompt 7 applied.

Add an "Upcoming occurrences" section to the admin quiz detail view (same
file or a sibling under apps/website/src/components/admin/).

- Fetch: supabase.rpc("get_upcoming_quiz_occurrences",
    { p_quiz_event_id: id, p_limit: 12 }).
- Render each occurrence as a neo-brutalist row:
    [date] [interest count] [status badge] [Cancel button]
  Status badge:
    cancelled=false → green "Scheduled"
    cancelled=true  → red "Cancelled"
- Cancel button opens a modal with a reason textarea (required, >= 8 chars).
  On submit:
    supabase.rpc("cancel_quiz_occurrence", {
      p_quiz_event_id: id,
      p_occurrence_date: date,
      p_cancelled_by: "operator",
      p_reason: reason
    })
  Refetch on success.

Acceptance: operator can cancel any future occurrence; cancelled rows flip to
the cancelled badge; the mobile app's "Cancelled" chip appears on next fetch.
```

---

### Prompt 9 — Website: publican quiz detail — request cancellation (email-only)

```text
Follow AGENTS.md. Pre-req: prompt 8 applied.

Scope: publican portal's quiz detail view. Grep for publican_venues or the
publican quiz list page.

Add a read-only "Upcoming occurrences" list (same RPC as prompt 8) and a
"Request cancellation" button on each future non-cancelled row.

Button action (v1 is email-only — DO NOT call cancel_quiz_occurrence):
- Open a mailto: link to operator support email (put the address in
  apps/website/src/lib/config.ts under SUPPORT_EMAIL if not already there).
- Subject: "Cancellation request — <venue name> <date>".
- Body: pre-filled with quiz id, venue, date, empty reason placeholder.

Acceptance: publican sees the list, can click through to email. No RPC call
is made. Penalty flow is explicitly deferred.
```

---

### Final acceptance (all prompts applied)

- `npm run typecheck` passes in both `apps/app` and `apps/website`.
- Mobile: tapping "Interested" on a specific date inserts a row keyed to that date. Tapping the bookmark does not.
- After midnight Europe/London, yesterday's interest rows are gone on next fetch (cron sweep runs every hour).
- Host dashboard renders without `host_cancelled_at` references.
- Grep for the old signatures returns zero app/website matches: `get_quiz_event_interest_count(p_quiz_event_id uuid)` (single-arg form), `host_patch_quiz_event_host_fields` with five params, `host_cancelled_at`, `upsertInterestsOrQueue`, `deleteInterestsOrQueue`.
- Operator can create a weekly / monthly / quarterly / one-off quiz and cancel any future occurrence. Publican can email a cancellation request.

### Out of scope (defer)

- Penalty calculation on `penalty_applied`.
- Publican self-serve cancellation through `cancel_quiz_occurrence`.
- Notifications to interested players on cancellation.
- Operator "extend" UI (just edit `occurrences_planned` via the form in prompt 7 and re-save — it re-runs `rebuild_quiz_event_occurrences`).

---

## Open follow-ups (not in v1)

- Publican-initiated cancellation through `cancel_quiz_occurrence` with penalty application.
- Notifications to interested players when an occurrence is cancelled.
- Operator "extend" button that bumps `occurrences_planned` and re-runs `rebuild_quiz_event_occurrences`.
- Re-materialisation trigger when `frequency`/`nth_week`/`start_date` changes — v1 relies on the operator form explicitly calling `rebuild_quiz_event_occurrences`; a trigger would make it automatic.
- Audit log for operator cancellations (who, when, reason).
