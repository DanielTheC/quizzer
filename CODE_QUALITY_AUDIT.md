# Code quality audit — action plan

Captured 2026-04-21. This file lists all findings from the code-quality audit plus the three Cursor prompts written to action the top three. Work from top to bottom; each section is self-contained and can be handed to Cursor in isolation.

---

## Audit summary

Eight findings from scanning the monorepo. Priority reflects impact on a v1 launch by a solo founder.

### High priority

| # | Finding | Status |
|---|---------|--------|
| 1 | Three files over 1200 LOC — `AdminQuizzesDashboard.tsx` (1320), `AdminHostsDashboard.tsx` (1260), `RunQuizScreen.tsx` (1276). 20+ `useState` per file. | Deferred — shrinks naturally as #2/#3/#4 land. Don't do a big-bang split. |
| 2 | `formatTime` / `formatFee` / `formatPrize` duplicated across 15+ files. Two distinct time formats (`20:00` and `8:00 PM`) must be preserved, not merged. | **Prompt A below.** |
| 3 | 145 `.from("table")` calls across 22 files — but each `.select()` is genuinely unique per caller. A query-helper layer is the wrong abstraction. | **Replaced by Prompt C (generated Database types).** |
| 4 | Inconsistent error reporting — 7 admin dashboards + 1 mobile hook call `captureSupabaseError`; the other ~29 Supabase-querying files silently drop errors. | **Prompt B below.** |

### Medium priority

| # | Finding | Status |
|---|---------|--------|
| 5 | Hand-maintained row types (`QuizEventRow`, `VenueRow`, etc.) defined inline in components. No generated `Database` type from Supabase. | **Prompt C below.** |
| 6 | Zero test files across the entire repo. `haversine`, `nextOccurrence`, formatters all untested. | Pending — start with 10 formatter tests after Prompt A lands. |
| 7 | Admin polling ignores Page Visibility API — `setInterval(60s)` runs when tab backgrounded. | Pending — 30-min fix. |

### Low priority

| # | Finding | Status |
|---|---------|--------|
| 8 | Env config drift — `apps/app/.env.example`, `SETUP_AND_ENV.md`, and actual code usage aren't fully synced (hit this today with the Maps key setup). | Pending — add missing items next time `.env.example` is touched. |

---

## Prompt A — extract formatters into shared `lib/formatters.ts`

**Context for Cursor:**
Quizzer monorepo with two apps — `apps/website` (Next.js) and `apps/app` (Expo RN). Formatting functions for time / day / fee / prize are duplicated across 15+ files with slightly different behaviors. The two apps don't share a package, so we duplicate the file, but within each app, consolidate into one module.

**Do not** unify functions with different output. Preserve every existing behavior exactly.

### Step 1 — Create `apps/website/src/lib/formatters.ts`

```ts
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Day-of-week number (0=Sun..6=Sat) → "Sun" / "Mon" / etc. Returns the number as a string if out of range. */
export function dayShort(day: number): string {
  return DAY_SHORT[day] ?? String(day);
}

/** "20:00:00" → "20:00". Leaves non-matching strings untouched. */
export function formatTime24(t: string): string {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

/** "20:00" or "20:00:00" → "8:00 PM". Used on public-facing pages. */
export function formatTime12(s: string): string {
  const parts = String(s).trim().split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** HTML <input type="time"> value. Same shape as formatTime24 today — kept as an alias for intent. */
export function toTimeInputValue(t: string): string {
  return formatTime24(t);
}

/** "20:00" → "20:00:00" for DB insert. Passes through anything already with seconds. */
export function normalizeStartTimeForDb(value: string): string {
  const v = value.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v;
}

/** Admin/portal: null or NaN → "—", else "£1.50". */
export function formatFeePenceOrDash(p: number | null | undefined): string {
  if (p == null || Number.isNaN(Number(p))) return "—";
  return `£${(Number(p) / 100).toFixed(2)}`;
}

/** Public pages: 0 / null → "Free", else "£1.50". */
export function formatFeePenceOrFree(p: number | null | undefined): string {
  const n = Number(p);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `£${(n / 100).toFixed(2)}`;
}

/** Admin: null → "—", else replaces underscores with spaces ("bar_tab" → "bar tab"). */
export function formatPrizeDisplay(p: string | null | undefined): string {
  if (!p) return "—";
  return p.replace(/_/g, " ");
}
```

### Step 2 — Create `apps/app/src/lib/formatters.ts`

Copy the same file to `apps/app/src/lib/formatters.ts` **plus** these two mobile-specific helpers at the bottom:

```ts
/** Mobile map sheet: 0 → "Free entry", else "Entry £1.50". */
export function formatEntryFeeLine(pence: number): string {
  if (pence === 0) return "Free entry";
  return `Entry £${(pence / 100).toFixed(2)}`;
}

/** Mobile QuizCard pill: uppercase, underscores→spaces, truncated to 28 chars with ellipsis. */
export function formatPrizePill(prize: string): string {
  const raw = prize?.replace(/_/g, " ").trim() || "Prize TBC";
  const upper = raw.split(/\s+/).filter(Boolean).map((w) => w.toUpperCase()).join(" ");
  return upper.length > 28 ? `${upper.slice(0, 26)}…` : upper;
}
```

### Step 3 — Migrate website consumers

For each file below: delete the local function and `import { ... } from "@/lib/formatters"`. Update call sites where the function name changed.

| File | Delete | Import & rename |
|------|--------|-----------------|
| `apps/website/src/lib/quizzes.ts:65` | `formatTime`, `formatEntryFee` | `formatTime12 as formatTime`, `formatFeePenceOrFree as formatEntryFee` |
| `apps/website/src/components/portal/PublicanDashboard.tsx:41` | `formatTime`, `formatFeePence` | `formatTime24 as formatTime`, `formatFeePenceOrDash as formatFeePence` |
| `apps/website/src/components/admin/AdminTriageDashboard.tsx:130` | `formatTime`, `dayShortLabel` | `formatTime24 as formatTime`, `dayShort as dayShortLabel` |
| `apps/website/src/components/admin/AdminQuizzesDashboard.tsx:68-92` | `formatTimeDisplay`, `toTimeInputValue`, `normalizeStartTimeForDb`, `formatFeePence`, `formatPrizeDisplay` | `formatTime24 as formatTimeDisplay`, `toTimeInputValue`, `normalizeStartTimeForDb`, `formatFeePenceOrDash as formatFeePence`, `formatPrizeDisplay` |
| `apps/website/src/components/admin/AdminHostsDashboard.tsx:66` | `formatTime` | `formatTime24 as formatTime` |
| `apps/website/src/components/admin/AdminAnalyticsDashboard.tsx:54-60` | `formatTime`, `formatPrizeDisplay` | `formatTime24 as formatTime`, `formatPrizeDisplay` |

### Step 4 — Migrate mobile consumers

| File | Delete | Import |
|------|--------|--------|
| `apps/app/src/components/NearbyMapView.tsx:15-30` | `DAY_SHORT`, `dayShort`, `formatPreviewTime`, `formatEntryFeeLine` | `dayShort`, `formatTime24 as formatPreviewTime`, `formatEntryFeeLine` |
| `apps/app/src/screens/player/QuizDetailScreen.tsx:67` | `formatTime` | `formatTime24 as formatTime` |
| `apps/app/src/screens/host/HostProfileScreen.tsx:40` | `formatTime` | `formatTime24 as formatTime` |
| `apps/app/src/screens/host/AvailableQuizzesScreen.tsx:32` | `formatTime` | `formatTime24 as formatTime` |
| `apps/app/src/screens/host/MyClaimsScreen.tsx:35` | `formatTime` | `formatTime24 as formatTime` |
| `apps/app/src/lib/notifications.ts:36` | `formatTime` | `formatTime24 as formatTime` |
| `apps/app/src/components/QuizCard.tsx:69` | `formatPrizePill` | `formatPrizePill` |

### Step 5 — Verify

1. `cd apps/website && npx tsc --noEmit` — zero errors
2. `cd apps/app && npx tsc --noEmit` — zero errors
3. `grep -rn "function formatTime\|function formatFee\|function formatPrize\|function dayShort\|function formatPreviewTime\|function formatEntryFeeLine\|function normalizeStartTimeForDb\|function toTimeInputValue" apps/ --include="*.ts" --include="*.tsx"` should return **zero** hits outside the two new `formatters.ts` files.

### Constraints

- Do not unify `formatTime12` and `formatTime24`.
- Do not unify the three fee formatters — each has distinct null/zero handling.
- Do not touch `AdminQuizzesDashboard.tsx` line 12's `DAY_NAMES` unless it exactly matches `dayShort`; if it does, replace with `dayShort`.
- Do not change any call-site semantics. If a consumer renames on import (`as formatTime`), keep the original name used in JSX to minimize diff.
- No other refactors in the files you touch.

---

## Prompt B — add `runSupabase` wrapper + retrofit silent-failure files

**Context for Cursor:**
Quizzer has `captureSupabaseError` in `apps/website/src/lib/observability/supabaseErrors.ts` and `apps/app/src/lib/sentryInit.ts`. Admin dashboards (7 website files) + one mobile hook use it. The other ~29 Supabase-querying files don't — errors are silently swallowed in production.

Goal: add a thin `runSupabase` helper that bundles the common "check error → report → throw" pattern, then retrofit the files currently dropping errors. **Do not touch the 7 admin dashboards that already call `captureSupabaseError` directly.**

### Step 1 — Add `runSupabase` to website

Create `apps/website/src/lib/observability/runSupabase.ts`:

```ts
import { captureSupabaseError, type SupabaseReportableError } from "./supabaseErrors";

type SupabaseResultLike<T> = { data: T | null; error: SupabaseReportableError | null };

/**
 * Run a Supabase query, report errors to Sentry, throw on failure, return data on success.
 * Replaces the `const { data, error } = await x; if (error) { capture(); throw }` boilerplate.
 */
export async function runSupabase<T>(
  operation: string,
  query: () => PromiseLike<SupabaseResultLike<T>>,
  extras?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await query();
  if (error) {
    captureSupabaseError(operation, error, extras);
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error(`Supabase ${operation}: no data returned`);
  }
  return data;
}
```

### Step 2 — Add `runSupabase` to mobile

Create `apps/app/src/lib/runSupabase.ts`:

```ts
import { captureSupabaseError } from "./sentryInit";

type SupabaseResultLike<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export async function runSupabase<T>(
  operation: string,
  query: () => PromiseLike<SupabaseResultLike<T>>,
): Promise<T> {
  const { data, error } = await query();
  if (error) {
    captureSupabaseError(operation, error);
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error(`Supabase ${operation}: no data returned`);
  }
  return data;
}
```

### Step 3 — Retrofit website files that drop errors

Naming convention: `<surface>.<verb>_<entity>`, e.g. `portal.venues_list`, `portal.message_insert`, `marketing.quizzes_list`, `api.host_enquiry_insert`.

Retrofit:
- `apps/website/src/lib/stats.ts` — prefix `marketing.`
- `apps/website/src/lib/quizzes.ts` — prefix `marketing.`
- `apps/website/src/app/api/host-enquiry/route.ts` — prefix `api.host_enquiry.`
- `apps/website/src/app/api/admin/create-publican/route.ts` — prefix `api.admin.create_publican.`
- `apps/website/src/components/portal/PublicanNewMessageForm.tsx` — prefix `portal.`
- `apps/website/src/components/portal/PublicanDashboard.tsx` — prefix `portal.`
- `apps/website/src/app/portal/(shell)/layout.tsx` — prefix `portal.`
- `apps/website/src/app/portal/(shell)/(protected)/layout.tsx` — prefix `portal.`
- `apps/website/src/app/portal/(shell)/(protected)/page.tsx` — prefix `portal.`
- `apps/website/src/app/portal/(shell)/(protected)/messages/page.tsx` — prefix `portal.`
- `apps/website/src/app/portal/(shell)/(protected)/venues/[venueId]/page.tsx` — prefix `portal.`
- `apps/website/src/components/admin/AdminShell.tsx` — prefix `admin.shell.`

**DO NOT touch** (already reporting correctly, large files):
- `AdminHostsDashboard.tsx`, `AdminTriageDashboard.tsx`, `AdminPacksDashboard.tsx`, `AdminQuizzesDashboard.tsx`, `AdminVenuesDashboard.tsx`, `AdminAnalyticsDashboard.tsx`, `AdminMessagesDashboard.tsx`

### Step 4 — Retrofit mobile files that drop errors

**DO NOT touch** `useNearbyQuizzes.ts` (already reports). Retrofit:
- `apps/app/src/navigation/RootNavigator.tsx` — prefix `nav.`
- `apps/app/src/context/SavedQuizzesContext.tsx` — prefix `saved.`
- `apps/app/src/lib/fetchClosestOtherQuizzes.ts` — prefix `player.`
- `apps/app/src/lib/hostAccess.ts` — prefix `host.access.`
- `apps/app/src/lib/quizInterestSyncQueue.ts` — prefix `player.interest.`
- `apps/app/src/lib/quizPack.ts` — prefix `host.pack.`
- `apps/app/src/lib/quizEventDetailCache.ts` — prefix `player.`
- `apps/app/src/lib/notifications.ts` — prefix `notifications.`
- `apps/app/src/screens/player/SavedScreen.tsx` — prefix `player.`
- `apps/app/src/screens/player/QuizDetailScreen.tsx` — prefix `player.`
- `apps/app/src/screens/host/HostApplyScreen.tsx` — prefix `host.`
- `apps/app/src/screens/host/HostProfileScreen.tsx` — prefix `host.`
- `apps/app/src/screens/host/HostDashboardScreen.tsx` — prefix `host.`
- `apps/app/src/screens/host/MyClaimsScreen.tsx` — prefix `host.claims.`
- `apps/app/src/screens/host/AvailableQuizzesScreen.tsx` — prefix `host.available.`
- `apps/app/src/screens/host/RunQuizScreen.tsx` — prefix `host.run.` (1276-line file — only touch Supabase calls, no other refactor)
- `apps/app/src/screens/host/HostSetupScreen.tsx` — prefix `host.setup.`

### Step 5 — Migration pattern (apply consistently)

**Before:**
```ts
const { data, error } = await supabase.from("venues").select("id, name").eq("user_id", uid);
if (error) {
  console.error(error);
  return [];
}
return data ?? [];
```

**After:**
```ts
const data = await runSupabase("portal.venues_by_user", () =>
  supabase.from("venues").select("id, name").eq("user_id", uid)
);
return data;
```

**Special cases:**

1. **`.single()` / `.maybeSingle()`** — `null` is a legitimate result, not an error. **Do not use `runSupabase`.** Keep existing pattern but add a direct `captureSupabaseError` call if missing:
   ```ts
   const { data, error } = await supabase.from("x").select().eq("id", id).maybeSingle();
   if (error) {
     captureSupabaseError("portal.x_by_id", error);
     throw new Error(error.message);
   }
   ```
2. **`.rpc()` calls** — same pattern as `.from()`.
3. **Callers that swallow errors and return a fallback** — preserve behavior with try/catch:
   ```ts
   try {
     return await runSupabase("portal.x_list", () => supabase.from("x").select());
   } catch {
     return [];
   }
   ```
   Throw still fires inside, so Sentry gets it.

### Step 6 — Verify

1. `cd apps/website && npx tsc --noEmit` — zero errors
2. `cd apps/app && npx tsc --noEmit` — zero errors
3. After deploy, check Sentry for new `supabase:true` tags in operation paths you haven't seen before (`portal.*`, `host.*`).

### Constraints

- Do not modify the 7 admin dashboards or `useNearbyQuizzes.ts`.
- Do not change any visible UX (toasts, fallback values).
- Do not invent new table names.
- Operation strings follow `<surface>.<verb>_<entity>` — short and greppable.

---

## Prompt C — generate Database types + replace hand-typed row shapes

**Context for Cursor:**
Quizzer uses `createClient` from `@supabase/supabase-js` untyped. Every Supabase result is cast by hand into interfaces like `QuizEventRow` defined inline in components. Generated `Database` types replace all hand-typed row shapes and add column-name validation at compile time.

### Prerequisites (before running Cursor)

1. `npm i -g supabase`
2. `supabase login`
3. `supabase link --project-ref xcmqvnddhcmombiqflny`

### Step 1 — Generate `database.types.ts`

From repo root:

```bash
supabase gen types typescript --linked > supabase/database.types.ts
```

Alternative: Supabase Dashboard → Project Settings → API → Database → copy the TypeScript types block → save to `supabase/database.types.ts`.

### Step 2 — Share it across both apps

Create `apps/website/src/lib/database.types.ts`:

```ts
export type { Database } from "../../../../supabase/database.types";

import type { Database } from "../../../../supabase/database.types";

export type Tables = Database["public"]["Tables"];
export type Enums = Database["public"]["Enums"];

/** Shorthand: Row<"venues"> → Database["public"]["Tables"]["venues"]["Row"] */
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
```

Same content to `apps/app/src/lib/database.types.ts` with matching relative path.

### Step 3 — Type the Supabase clients

**Website** — `apps/website/src/lib/supabase/browser.ts` (and `server.ts`):

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(url, key);
}
```

Apply `<Database>` generic to every `createClient` / `createServerClient` / `createBrowserClient` call including service-role clients in `apps/website/src/app/api/*/route.ts`.

**Mobile** — `apps/app/src/lib/supabase.ts:28`:

```ts
import type { Database } from "./database.types";
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, { ... });
```

### Step 4 — Replace hand-typed row shapes

Use `Pick<Row<"venues">, "id" | "name" | "city">` for subsets; `Row<"venues">` for full rows.

**Website:**
- `AdminQuizzesDashboard.tsx:34-58` — delete `type VenueRow`, `type VenueImage`, `type QuizEventRow`, replace with `Pick<Row<...>>` equivalents.
- `AdminHostsDashboard.tsx:10-51` — same pattern for `host_allowlist`, `quiz_claims`.
- `AdminTriageDashboard.tsx` — any inline row types.
- `AdminAnalyticsDashboard.tsx` — any inline row types.
- `PublicanDashboard.tsx` — any inline row types.
- `apps/website/src/lib/quizzes.ts` — any hand-typed row shapes.

**Mobile:**
- `apps/app/src/screens/player/nearby/nearbyTypes.ts` — rewrite `QuizEvent` as `Row<"quiz_events"> & { venues: Pick<Row<"venues">, "name" | ...> | null; interest_count?: number }`.
- `apps/app/src/components/NearbyMapView.types.ts` — same approach.
- Any screen with inline row types — replace with `Row<"...">` / `Pick<Row<"...">, ...>`.

### Step 5 — Extract the one real duplicate select

In `apps/website/src/lib/quizzes.ts`, lines 150 and 175 contain identical `"id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, borough, lat, lng)"`.

Extract to module-level constant:

```ts
const QUIZ_EVENT_LIST_WITH_VENUE_SELECT =
  "id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, borough, lat, lng)";
```

Use in both call sites. Do NOT hunt for "similar" selects elsewhere — they're intentionally different.

### Step 6 — Add a sync script

Add to root `package.json`:

```json
"scripts": {
  "db:types": "supabase gen types typescript --linked > supabase/database.types.ts"
}
```

Update `SETUP_AND_ENV.md` section 5: *"After every migration, run `npm run db:types` and commit the updated `supabase/database.types.ts`."*

### Step 7 — Verify

1. `cd apps/website && npx tsc --noEmit` — zero errors
2. `cd apps/app && npx tsc --noEmit` — zero errors
3. `grep -rn "type QuizEventRow\|interface QuizEventRow\|type VenueRow\|interface VenueRow" apps/` — returns only the generated types import, not hand-definitions
4. Hover over `.select("...")` results should show a properly-typed row, not `any`

### Constraints

- Do not invent table names or columns.
- Do not rewrite any `.select()` strings. Only the one in Step 5 is being consolidated.
- Do not try to generalize fetch functions — no `fetchVenues()`, `fetchQuizzes()` wrappers.
- Use `Pick<Row<...>>` for partial selects — don't widen types unnecessarily.
- Generated types live at `supabase/database.types.ts` (root). The two `apps/*/src/lib/database.types.ts` are thin re-exports.

---

## Pending items (not yet scripted into prompts)

### #6 — Add formatter tests (after Prompt A lands)

- Install Vitest in `apps/website` and `apps/app`: `npm i -D vitest @vitest/ui`
- Add `"test": "vitest"` to each `package.json`
- Create `apps/website/src/lib/formatters.test.ts` and `apps/app/src/lib/formatters.test.ts`
- Minimum coverage: 3–4 cases per formatter function (happy path + null + edge case)

### #7 — Fix polling to respect Page Visibility API

- `AdminQuizzesDashboard.tsx:348-361` (and equivalent `setInterval` blocks in other admin dashboards) already have a `visibilitychange` listener for refresh-on-focus, but the `setInterval` itself keeps firing when hidden.
- Fix: inside the interval callback, `if (document.visibilityState !== "visible") return;` before calling `load()`.
- Audit all admin dashboards for the same pattern.

### #8 — Close env config drift

Triggered by today's Google Maps setup (Apr 2026): `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` was present in `.env.example` but the SHA-1 / EAS / Play App Signing steps weren't documented in `SETUP_AND_ENV.md`.

- When setting up a new EAS-baked env var, update:
  - `apps/app/.env.example` — list the var with a one-line description
  - `SETUP_AND_ENV.md` — describe where to get the value + any cloud-side setup (SHA-1 restrictions, billing, etc.)
  - Confirm the var is added to EAS for **both** `preview` and `production` environments

### Large-file split (audit item #1)

Do **not** schedule a big-bang split of `AdminQuizzesDashboard.tsx` / `AdminHostsDashboard.tsx` / `RunQuizScreen.tsx`. Let these shrink organically as Prompts A/B/C extract shared code, and only split further when touching them for a feature.

---

## Suggested order of execution

1. **Prompt A** (formatters) — lowest risk, mechanical, ~30 min.
2. **Prompt B** (error wrapper) — medium risk, high value. ~2 h. Do after A so retrofits import clean formatters.
3. **Prompt C** (Database types) — highest value, ~2–3 h. Needs Supabase CLI linked.
4. Formatter tests (#6) — ~1 h after A.
5. Polling fix (#7) — 30 min, standalone.
6. Env drift (#8) — ad-hoc next time an env var is touched.
