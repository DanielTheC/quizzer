# Quiz occurrences v2 — claims, cancellations, notifications

Status: design locked 2026-04-22. Extends `docs/per_occurrence_interest_plan.md`.

## Goal

v1 plan (per_occurrence_interest_plan.md) introduced `quiz_event_occurrences` + per-occurrence interest. v2 layers in:

1. Host-facing **claim caps** (≤4 future per series; no same-day conflicts across series).
2. **24-hour unclaim cutoff** that blocks the action but notifies the operator of the attempt.
3. **`host_series_interests`** — hosts register to cover a series → auto-notified on unclaim / cancellation.
4. **Publican self-serve cancellation** (penalty calc deferred, but audit + notifications wired now).
5. **Cadence pills** (weekly / monthly / quarterly / one-off) on player UI.
6. **Finder = one card per occurrence** (was: one card per series with next-date label).
7. **Operator notifications inbox** extended with `late_unclaim_attempt` reason.

Cadence anchor simplification: `nth_week` is always `1`. Column stays (flex for later), but UI never exposes the picker — monthly/quarterly both mean "first <weekday> of the month".

---

## Schema delta (new migration)

File: `supabase/migrations/20260422100000_quiz_occurrences_v2.sql`

### Tables

```sql
-- Host series interest (a host flags willingness to cover a recurring quiz).
CREATE TABLE IF NOT EXISTS host_series_interests (
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_user_id, quiz_event_id)
);

ALTER TABLE host_series_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own series interest"
  ON host_series_interests FOR ALL TO authenticated
  USING (host_user_id = auth.uid() AND public.is_allowlisted_host())
  WITH CHECK (host_user_id = auth.uid() AND public.is_allowlisted_host());

CREATE POLICY "Operators read host series interest"
  ON host_series_interests FOR SELECT TO authenticated
  USING (public.is_operator());

-- Per-host-per-occurrence claim (distinct from series-level quiz_claims).
-- quiz_claims still models who owns the *series* contract; occurrence_claims models
-- who is actually hosting a given night. On claim, both rows are kept in sync
-- (claim creates occurrence_claims for the next N weeks if not already filled by
-- another host from released_by_host).
CREATE TABLE IF NOT EXISTS quiz_occurrence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  UNIQUE (quiz_event_id, occurrence_date) -- one active claim per occurrence
);

ALTER TABLE quiz_occurrence_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read own occurrence claims"
  ON quiz_occurrence_claims FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR public.is_operator());

-- No direct INSERT/UPDATE/DELETE policies — all writes go through RPCs below.

CREATE INDEX IF NOT EXISTS idx_quiz_occurrence_claims_host_future
  ON quiz_occurrence_claims (host_user_id, occurrence_date)
  WHERE released_at IS NULL;

-- Operator notifications inbox (extend existing if one already exists — grep first).
CREATE TABLE IF NOT EXISTS operator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,              -- 'late_unclaim_attempt' | 'occurrence_cancelled' | ...
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE operator_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read/ack own inbox"
  ON operator_notifications FOR ALL TO authenticated
  USING (public.is_operator()) WITH CHECK (public.is_operator());
```

### `quiz_events` additions

```sql
ALTER TABLE quiz_events
  ADD COLUMN IF NOT EXISTS cadence_pill_label text
  GENERATED ALWAYS AS (
    CASE frequency
      WHEN 'weekly' THEN 'Weekly'
      WHEN 'monthly' THEN 'Monthly'
      WHEN 'quarterly' THEN 'Quarterly'
      WHEN 'one_off' THEN 'One-off'
    END
  ) STORED;
```

(Generated column keeps the pill label in the DB so every client renders identically.)

### RPCs

```sql
-- host_claim_occurrence: atomic claim with 4-per-series + same-day guards.
CREATE OR REPLACE FUNCTION public.host_claim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_same_day uuid;
  future_count int;
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowlisted');
  END IF;

  -- Same-day conflict check (across all series)
  SELECT quiz_event_id INTO existing_same_day
  FROM quiz_occurrence_claims
  WHERE host_user_id = auth.uid()
    AND occurrence_date = p_occurrence_date
    AND released_at IS NULL
  LIMIT 1;
  IF existing_same_day IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'same_day_conflict',
      'conflicting_quiz_event_id', existing_same_day);
  END IF;

  -- 4-per-series cap (future + unreleased)
  SELECT count(*) INTO future_count
  FROM quiz_occurrence_claims
  WHERE host_user_id = auth.uid()
    AND quiz_event_id = p_quiz_event_id
    AND occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
    AND released_at IS NULL;
  IF future_count >= 4 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'series_cap_reached');
  END IF;

  INSERT INTO quiz_occurrence_claims (quiz_event_id, occurrence_date, host_user_id)
  VALUES (p_quiz_event_id, p_occurrence_date, auth.uid())
  ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_claimed');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.host_claim_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_claim_occurrence(uuid, date) TO authenticated;

-- host_unclaim_occurrence: blocks within 24h + logs operator notification.
CREATE OR REPLACE FUNCTION public.host_unclaim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hours_until numeric;
  claim_row record;
BEGIN
  SELECT * INTO claim_row FROM quiz_occurrence_claims
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND host_user_id = auth.uid()
    AND released_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_claim_holder');
  END IF;

  hours_until := EXTRACT(EPOCH FROM
    (p_occurrence_date::timestamptz AT TIME ZONE 'Europe/London') - now()) / 3600;

  IF hours_until < 24 THEN
    INSERT INTO operator_notifications (reason, payload)
    VALUES ('late_unclaim_attempt', jsonb_build_object(
      'quiz_event_id', p_quiz_event_id,
      'occurrence_date', p_occurrence_date,
      'host_user_id', auth.uid(),
      'hours_until', hours_until));
    RETURN jsonb_build_object('ok', false, 'code', 'too_late');
  END IF;

  UPDATE quiz_occurrence_claims
  SET released_at = now(), release_reason = 'host_unclaim'
  WHERE id = claim_row.id;

  -- Fire notification payload for host_series_interests readers to pick up
  -- (v1: in-app only — email integration deferred)
  INSERT INTO operator_notifications (reason, payload)
  VALUES ('occurrence_released', jsonb_build_object(
    'quiz_event_id', p_quiz_event_id,
    'occurrence_date', p_occurrence_date));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.host_unclaim_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_unclaim_occurrence(uuid, date) TO authenticated;

-- publican_cancel_occurrence: publican-initiated cancel (replaces email-only v1).
CREATE OR REPLACE FUNCTION public.publican_cancel_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_venue uuid;
  is_publican_for_venue boolean;
BEGIN
  SELECT venue_id INTO v_venue FROM quiz_events WHERE id = p_quiz_event_id;

  SELECT EXISTS (
    SELECT 1 FROM publican_profiles
    WHERE user_id = auth.uid() AND venue_id = v_venue
  ) INTO is_publican_for_venue;

  IF NOT is_publican_for_venue THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_publican_for_venue');
  END IF;

  UPDATE quiz_event_occurrences
  SET cancelled_at = now(),
      cancelled_by = 'publican',
      cancellation_reason = p_reason
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled_or_missing');
  END IF;

  -- Auto-release the active host claim
  UPDATE quiz_occurrence_claims
  SET released_at = now(), release_reason = 'publican_cancelled'
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND released_at IS NULL;

  INSERT INTO operator_notifications (reason, payload)
  VALUES ('occurrence_cancelled', jsonb_build_object(
    'quiz_event_id', p_quiz_event_id,
    'occurrence_date', p_occurrence_date,
    'cancelled_by', 'publican',
    'reason', p_reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.publican_cancel_occurrence(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publican_cancel_occurrence(uuid, date, text) TO authenticated;

-- Finder feed: one row per occurrence (not per series).
CREATE OR REPLACE FUNCTION public.get_upcoming_occurrences_feed(
  p_from date DEFAULT (now() AT TIME ZONE 'Europe/London')::date,
  p_to date DEFAULT ((now() AT TIME ZONE 'Europe/London')::date + 21)
) RETURNS TABLE (
  quiz_event_id uuid,
  occurrence_date date,
  venue_id uuid,
  venue_name text,
  cadence_pill_label text,
  cancelled boolean,
  interest_count bigint,
  has_host boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.quiz_event_id,
    o.occurrence_date,
    q.venue_id,
    v.name,
    q.cadence_pill_label,
    (o.cancelled_at IS NOT NULL),
    (SELECT count(*)::bigint FROM quiz_event_interests i
      WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date),
    EXISTS (
      SELECT 1 FROM quiz_occurrence_claims c
      WHERE c.quiz_event_id = o.quiz_event_id
        AND c.occurrence_date = o.occurrence_date
        AND c.released_at IS NULL
    )
  FROM quiz_event_occurrences o
  INNER JOIN quiz_events q ON q.id = o.quiz_event_id
  INNER JOIN venues v ON v.id = q.venue_id
  WHERE q.is_active = true
    AND o.occurrence_date BETWEEN p_from AND p_to
  ORDER BY o.occurrence_date, v.name;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_occurrences_feed(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_occurrences_feed(date, date) TO anon, authenticated;
```

---

## Cursor prompts — run in order, typecheck + fix between each

### Prompt 1 — Apply the v2 migration

```text
You are Cursor on the Quizzer monorepo. Follow AGENTS.md.

Pre-req: migration 20260421100000_per_occurrence_interest.sql already applied.

Task:
1. Create supabase/migrations/20260422100000_quiz_occurrences_v2.sql with the SQL
   from docs/quiz_occurrences_v2_plan.md ("Schema delta" section). Copy verbatim.

2. Before copying: grep the migrations directory for an existing operator_notifications
   table. If one already exists, DROP that block from the new migration and instead
   ALTER the existing table to add any missing columns / reasons. Never drop tables.

3. Apply locally: `npx supabase db reset --local` and confirm it applies cleanly.

4. Regenerate types:
     npx supabase gen types typescript --project-id <PROJECT_ID>
       > apps/website/src/lib/supabase/types.ts
   Duplicate to apps/app/src/lib/supabase/types.ts.

5. Do NOT update callsites. Commit as:
   "migration: quiz occurrences v2 — claim caps, unclaim cutoff, publican cancel"

Acceptance: migration file present, types regenerated, reset runs clean.
```

### Prompt 2 — Host app: claim / unclaim via new RPCs

```text
Follow AGENTS.md. Pre-req: prompt 1.

Scope: apps/app host dashboard.

1. Grep for existing claim callsites (`quiz_claims` direct inserts or
   `host_claim_quiz` RPC). Replace with `host_claim_occurrence` per-occurrence
   flow.

2. Claim UX:
   - Next-occurrence card gets a "Claim this night" button (shown when no active
     claim). Calls supabase.rpc("host_claim_occurrence", { p_quiz_event_id, p_occurrence_date }).
   - On error code, show toast:
       'series_cap_reached' → "You already have 4 upcoming nights of this quiz."
       'same_day_conflict'  → "You've claimed another quiz on that date."
       'not_allowlisted'    → "You're not on the host allowlist for this venue."
       'already_claimed'    → "Another host got there first."
   - On success: optimistic state → refetch dashboard.

3. Unclaim UX:
   - "Unclaim this night" button on claimed occurrences. Calls
     supabase.rpc("host_unclaim_occurrence", { ... }).
   - On 'too_late': show neo-brutalist error card explaining the 24h rule and
     that the operator has been notified. Do NOT retry automatically.

4. Claimed-nights list: new screen section "My upcoming nights" listing future
   occurrence claims for the signed-in host (select from quiz_occurrence_claims
   where host_user_id = auth.uid() AND released_at IS NULL AND occurrence_date >= today).

Acceptance: host can claim up to 4 nights of a series; 5th is rejected; same-day
conflict is rejected; unclaim within 24h is rejected and operator inbox gets a
late_unclaim_attempt row.
```

### Prompt 3 — Host app: series interest toggle + released-night feed

```text
Follow AGENTS.md. Pre-req: prompt 2.

1. On the host view of a quiz (series-level), add "Cover this quiz" toggle:
   - State from host_series_interests (primary key host_user_id + quiz_event_id).
   - Toggle upserts or deletes the row (direct table access via RLS — policies are
     already in the migration).

2. New screen: "Open nights" — future occurrences where there is no active claim,
   filtered to series the host has flagged in host_series_interests.
   Query:
     select o.*, q.venue_id, v.name
     from quiz_event_occurrences o
     join quiz_events q on q.id = o.quiz_event_id
     join venues v on v.id = q.venue_id
     join host_series_interests hsi on hsi.quiz_event_id = q.id
     where hsi.host_user_id = auth.uid()
       and o.cancelled_at is null
       and o.occurrence_date >= today_uk()
       and not exists (
         select 1 from quiz_occurrence_claims c
         where c.quiz_event_id = o.quiz_event_id
           and c.occurrence_date = o.occurrence_date
           and c.released_at is null
       )
     order by o.occurrence_date;

3. Each row has a "Claim" button wired to host_claim_occurrence.

Acceptance: flagging a series appears in Open Nights; claiming removes it from
the list; unflagging removes the series from the list.
```

### Prompt 4 — Operator: inbox integration for late-unclaim + cancellations

```text
Follow AGENTS.md. Pre-req: prompt 3.

File: the operator Home dashboard action inbox (grep for the existing Action Inbox
component — likely apps/website/src/components/admin/ActionInbox.tsx or similar).

1. Add two new inbox reasons:
   - 'late_unclaim_attempt': red badge. Payload shows quiz + date + host name
     (resolve host name via auth.users → host_allowlisted_emails join) +
     "<N> hours until quiz".
   - 'occurrence_cancelled': amber badge. Payload shows quiz + date + cancelled_by
     + reason.

2. Acknowledge button sets read_at = now() via:
     update operator_notifications set read_at = now() where id = $1
   (RLS already gates to operators.)

3. Sort unread first, then by created_at desc. Limit 50.

Acceptance: triggering a late unclaim from the mobile app (in dev, use a fake
same-day occurrence) makes a row appear here within a fetch cycle.
```

### Prompt 5 — Publican portal: self-serve cancel + interest count

```text
Follow AGENTS.md. Pre-req: prompt 4.

Scope: apps/website/src/app/portal (publican portal). Replace the mailto flow from
v1 plan prompt 9 with direct RPC calls.

1. In the publican's quiz detail, replace "Request cancellation" button on each
   future non-cancelled occurrence row with "Cancel this night".
2. Opens a modal with a reason textarea (min 8 chars). Submit calls:
     supabase.rpc("publican_cancel_occurrence",
       { p_quiz_event_id: id, p_occurrence_date: date, p_reason: reason })
3. On { ok: true }: optimistic flip to "Cancelled" badge, refetch.
4. On { ok: false, code: 'not_publican_for_venue' }: show access-denied toast.

5. Interest count column: each upcoming occurrence row shows interest_count from
   get_upcoming_quiz_occurrences. No user list — count only.

6. Remove SUPPORT_EMAIL mailto link from prompt 9 of v1 (grep and delete).

Acceptance: publican cancels a night → host claim auto-released, operator inbox
row created, occurrence shows as cancelled everywhere.
```

### Prompt 6 — Player app: cadence pills + one-card-per-occurrence finder

```text
Follow AGENTS.md. Pre-req: prompt 5.

File: apps/app/src/screens/player/nearby/useNearbyQuizzes.ts + the finder list/map
components.

1. Replace the current "one row per quiz_event" query with one row per occurrence:
     supabase.rpc("get_upcoming_occurrences_feed",
       { p_from: todayUkISO(), p_to: todayUkPlusDaysISO(21) })
   Returns 3 weeks of rows. Client groups and sorts by date.

2. Card changes:
   - Primary label: formatted occurrence_date + start_time ("Tue 28 Apr · 20:30").
   - Secondary: venue name.
   - Cadence pill (neo-brutalist small pill, uppercase Anton): cadence_pill_label
     from the feed ("WEEKLY" / "MONTHLY" / "QUARTERLY" / "ONE-OFF").
   - Cancelled: overlay "CANCELLED" ribbon in red + disable interest toggle.
   - Interest count shown as "<N> going".
   - "No host yet" pill when has_host = false.

3. Bookmark (saved) remains at series level — tapping the bookmark on any
   occurrence card of the same series toggles that series. Visual: bookmark icon
   filled when isSaved(quiz_event_id).

4. Map: each pin = next occurrence of that venue's quiz; callout shows same info
   as the card.

Acceptance: finder renders 3 weeks of occurrences; same series appears multiple
times (once per week for weekly quizzes); cadence pill shows correctly; cancelled
nights render with the ribbon.
```

### Prompt 7 — Player app: quiz detail shows next 2–3 weeks + per-occurrence interest

```text
Follow AGENTS.md. Pre-req: prompt 6.

File: apps/app/src/screens/player/QuizDetailScreen.tsx (grep if name differs).

1. Above the existing content, add "Upcoming dates" row — 3 chips for the next
   3 future occurrences via get_upcoming_quiz_occurrences(id, 3).

2. Each chip:
   - Date + time.
   - Interest count below.
   - Pressable toggles InterestedOccurrencesContext per (quiz_event_id, date).
   - Cancelled chip: disabled + red "Cancelled" sub-label.

3. Remove the single lifetime "I'm interested" button introduced in v1 — now
   strictly per-chip.

4. Add the cadence pill next to the venue name (same component as finder).

Acceptance: chips render, interest count updates, saving the series still
works via the bookmark icon unchanged.
```

### Prompt 8 — Operator: schedule view uses occurrences, admin form drops nth_week picker

```text
Follow AGENTS.md. Pre-req: prompt 7.

1. apps/website admin quiz create/edit form (prompt 7 of v1 plan):
   - Remove the nth_week input entirely.
   - When frequency = monthly or quarterly, persist nth_week = 1 automatically.
   - Labels updated: "First <weekday> of the month" (static).

2. Operator Schedule view (apps/website admin Quizzes tab — grep for 'Schedule'):
   - Query get_upcoming_occurrences_feed for 8 weeks.
   - Group by date, show venue + host claim status per row.
   - Click row → opens occurrence detail with Cancel button (operator reason:
     'operator', uses existing cancel_quiz_occurrence RPC from v1).

3. Any remaining references to a 'nth weekday' picker in UI copy/code: remove.

Acceptance: operator form has only frequency + start_date + occurrences_planned
(+ existing fields); Schedule view lists next 8 weeks of occurrences with host
+ interest + cancellation controls.
```

---

## Final acceptance

- `npm run typecheck` passes in `apps/app` and `apps/website`.
- Host cannot claim a 5th future night of the same series.
- Host cannot claim two different series on the same date.
- Unclaim within 24h returns `too_late` and creates `operator_notifications.reason = 'late_unclaim_attempt'`.
- Publican cancels → occurrence marked cancelled, claim auto-released, operator inbox row created.
- Finder shows one card per occurrence across 3 weeks with cadence pills.
- Detail screen shows next 3 occurrences as chips, per-chip interest toggle.
- Series-level "Cover this quiz" toggle writes to `host_series_interests`.
- Open Nights screen surfaces unclaimed occurrences for a host's flagged series.

## Deferred

- Email/push notifications to `host_series_interests` when an occurrence is released or cancelled (v1 is DB rows only — the UI polls).
- Penalty calculation for publican cancellations (`penalty_applied` flag stays stubbed).
- Notifications to interested players on cancellation.
- `nth_week > 1` UI exposure.
