# Debugging Supabase quiz data on the website

The find-a-quiz pages load **cities** and **quiz listings** from Supabase when configured; otherwise they use static fallback data.

## Quick check: why am I still seeing mock data?

1. **See the data source on the page**  
   In `apps/website/.env.local` add:
   ```env
   NEXT_PUBLIC_DEBUG_QUIZZES=true
   ```
   Restart the dev server (`npm run dev` in `apps/website`), then open **http://localhost:3000/find-a-quiz**.  
   A yellow bar at the top will show either:
   - **"Data: quizzes from supabase (N), cities from supabase (M)"** → Supabase is working.
   - **"Data: quizzes from mock (8), cities from static (5)"** → App is using fallback data.

2. **Check the terminal**  
   When you load `/find-a-quiz`, the **server** (not browser) console will show one of:
   - **"Supabase quizzes: not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/website/.env.local"**  
     → Env vars are missing or in the wrong place. Put them in **`apps/website/.env.local`** (not repo root).
   - **"Supabase quiz_events: 0 rows (is_active=true). Check DB has data and RLS allows SELECT."**  
     → Env is set but the query returns nothing (no data, or RLS blocking).

3. **Confirm env file location**  
   The file must be **`apps/website/.env.local`** (same folder as `package.json`). Example:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   Restart the dev server after changing `.env.local`.

## Data flow

1. **`/find-a-quiz`**
   - `getQuizzesForSite()` → `fetchQuizzesFromSupabase()`; if that returns `[]`, uses mock quizzes.
   - `getCities()` → Supabase `venues` table, distinct `city`; if that returns `[]`, uses static city list.
   - Cities and counts are derived from the same quiz list, so if Supabase quizzes are empty, counts are from mock data.

2. **`/find-a-quiz/[city]`**
   - `getCities()` for static params and to know if the slug is valid.
   - `getQuizzesByCity(slug)` → filters full Supabase quiz list by `q.city === slug`; if empty, falls back to `getQuizzesForCity(slug)` (which can return mock data).

3. **Supabase query (quizzes)**  
   In `src/lib/quizzes.ts`:

   ```ts
   supabase
     .from("quiz_events")
     .select("id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, lat, lng)")
     .eq("is_active", true)
     .order("day_of_week", { ascending: true })
     .order("start_time", { ascending: true })
   ```

   - **Tables:** `quiz_events` (with FK `venue_id` → `venues.id`).
   - **Columns used:** `id`, `day_of_week`, `start_time`, `entry_fee_pence`, `prize`, `is_active`, and nested `venues.*`.
   - **Relation:** PostgREST may return the join as `venue` or `venues`; the code uses `row.venues ?? row.venue`.

4. **City slug vs DB value**
   - `venues.city` is stored as-is (e.g. `"London"`, `"Manchester"`).
   - Slugs are normalised with `toCitySlug()`: lowercased, spaces → `-` (e.g. `"London"` → `"london"`).
   - Filtering is `q.city === citySlug` where `q.city` is the slug derived from the venue’s `city`, so URL `/find-a-quiz/london` matches venues with `city` "London" or "london".

## Why you might still see mock data

1. **Env not set**  
   `getSupabaseSafe()` returns `null` if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. Then both quiz and city fetches return `[]` and the app uses static data.

2. **Supabase returns no rows**
   - No rows in `quiz_events` with `is_active = true`.
   - No rows in `venues` (so `getCities()` is empty and the app uses static cities; quiz list can still be from Supabase if there are quiz_events with a join to venues, but typically there are no venues then either).
   - **RLS:** If Row Level Security is enabled on `quiz_events` or `venues` and the anon key has no `SELECT` policy, queries return empty (or error). Check Supabase Dashboard → Authentication → Policies.

3. **Query/relation error**
   - Column name typo (e.g. `venue_id` must exist on `quiz_events`).
   - Relation name: the code accepts both `venue` and `venues` in the response. If your API returns a different key, add it in `rowToQuiz`.

## Enable debug logging

In `apps/website/.env.local`:

```env
NEXT_PUBLIC_DEBUG_QUIZZES=true
```

Restart the dev server, then open `/find-a-quiz` or a city page. In the **server** terminal you should see logs like:

- `[website] Supabase quizzes: client not configured` – env missing.
- `[website] Supabase quiz_events: error? <message> rowCount: 0 firstRowKeys: []` – error or empty data / wrong shape.
- `[website] Supabase getCities: error? ... rowCount: N` – cities query result.

Use these to see whether the client is configured, whether the queries error, and what shape the first quiz row has (so you can confirm `venue` vs `venues`).

## Checklist for real data

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `apps/website/.env.local`.
- [ ] `quiz_events` has at least one row with `is_active = true` and valid `venue_id`.
- [ ] `venues` has rows with the same `id` as `quiz_events.venue_id`, and `city` set (e.g. "London").
- [ ] RLS allows `SELECT` for the anon role on `quiz_events` and `venues` (or RLS is off for these tables).
