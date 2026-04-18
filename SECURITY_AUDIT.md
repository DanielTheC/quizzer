# Security Audit — 18 April 2026

Full-stack security audit of the Quizzer monorepo covering Supabase RLS, API routes, auth flows, and client-side security.

---

## Critical (3 items)

### C1. Auth tokens stored in AsyncStorage (not SecureStore)

**File:** `apps/app/src/lib/supabase.ts:24`
**Status:** Already fixed — SecureStore adapter is in place.

---

### C2. Sign-out doesn't revoke server-side session

**File:** `apps/app/src/context/AuthContext.tsx:97`
**Status:** Already fixed — `scope: "local"` has been removed.

---

### C3. Unauthenticated anonymous INSERT on host_applications

**Migration:** `20260418100000_host_applications_public_website_enquiry.sql`
**Status:** Prompt produced (see Critical prompts section below)

#### Cursor Prompt

```
## Task: Remove anonymous INSERT policy on host_applications and route submissions through a server-side API

The migration `20260418100000_host_applications_public_website_enquiry.sql` added a policy allowing the `anon` role to insert directly into `host_applications` with no identity binding, rate limiting, or bot protection. This must be removed and replaced with a server-side API route.

### Step 1 — New migration

Create `supabase/migrations/20260419100000_remove_anon_host_application_insert.sql`:

DROP POLICY IF EXISTS "Public website host enquiry insert"
  ON public.host_applications;

### Step 2 — New API route

Create `apps/website/src/app/api/host-enquiry/route.ts`:

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { full_name, email, phone, experience_notes, quiz_event_id } = body as Record<string, unknown>;

  if (
    typeof full_name !== "string" || full_name.trim().length < 2 || full_name.length > 200 ||
    typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.length > 30)) ||
    (experience_notes !== undefined && experience_notes !== null && (typeof experience_notes !== "string" || experience_notes.length > 2000))
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  // Rate limit: max 3 pending applications per email
  const { count } = await supabase
    .from("host_applications")
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase())
    .eq("status", "pending");

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "Too many pending applications for this email" }, { status: 429 });
  }

  const { error } = await supabase.from("host_applications").insert({
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? (phone as string).trim() : null,
    experience_notes: experience_notes ? (experience_notes as string).trim() : null,
    quiz_event_id: typeof quiz_event_id === "string" ? quiz_event_id : null,
    status: "pending",
  });

  if (error) {
    console.error("host-enquiry insert error:", error.message);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

### Step 3 — Update the form component

In `apps/website/src/components/sections/HostQuizForm.tsx`, find the existing `supabase.from("host_applications").insert(...)` call and replace it with a `fetch("/api/host-enquiry", ...)` call. Parse the response and handle errors/success the same way.

Remove the Supabase client import from this component if it is no longer used.

### Do NOT
- Add CAPTCHA in this prompt — that is a separate follow-up.
- Change any other RLS policies.
- Modify the existing authenticated-user INSERT policy ("Users insert own host application").
```

---

## High (7 items)

### H1. publican_venues — any authenticated user can self-link to any venue

**File:** `supabase/migrations/20260406100000_publican_venues.sql:25-29`

#### Cursor Prompt

```
## Task: Remove client-side INSERT/UPDATE/DELETE policies on publican_venues

Any authenticated user can currently link themselves to any venue by inserting into `publican_venues` with their own `user_id`. This gives them publican access to that venue's quizzes, messages, and push notifications.

### New migration

Create `supabase/migrations/20260419100000_lock_publican_venues_policies.sql`:

DROP POLICY IF EXISTS "Publicans insert own venue links" ON public.publican_venues;
DROP POLICY IF EXISTS "Publicans update own venue links" ON public.publican_venues;
DROP POLICY IF EXISTS "Publicans delete own venue links" ON public.publican_venues;

### Do NOT
- Touch the SELECT policy ("Publicans read own venue links") — publicans still need to read their own links.
- Touch the operator policies — operators manage these via the admin portal and `create-publican` API route.
- Modify any application code — the `create-publican` API route already uses the service role client to insert these rows.
```

---

### H2. Open redirect in portal sign-in ?next= parameter

**File:** `apps/website/src/app/portal/sign-in/PortalSignInForm.tsx:12,59`

#### Cursor Prompt

```
## Task: Restrict portal sign-in ?next= redirect to /portal paths only

In `apps/website/src/app/portal/sign-in/PortalSignInForm.tsx`, the `?next=` parameter accepts any path starting with `/`, which allows protocol-relative URLs like `//evil.com`.

Find where `nextPath` is derived from searchParams and replace:

const nextPath = searchParams.get("next")?.trim() || "/portal";

With:

function safeNextPath(raw: string | null): string {
  const t = raw?.trim() ?? "";
  if (t.startsWith("/portal") && !t.startsWith("//")) return t;
  return "/portal";
}
const nextPath = safeNextPath(searchParams.get("next"));

Then simplify the `router.push` call to just `router.push(nextPath)` — no conditional needed since the function already guarantees a safe value.

### Do NOT
- Change the admin sign-in form — it already has this pattern.
- Add any other auth changes.
```

---

### H3. CSP uses unsafe-eval + unsafe-inline globally

**File:** `apps/website/next.config.ts:5`

#### Cursor Prompt

```
## Task: Remove unsafe-eval and unsafe-inline from global CSP, scope to /studio

In `apps/website/next.config.ts`, the CSP header currently applies `'unsafe-eval'` and `'unsafe-inline'` to all routes.

Split the headers config into two source entries:

1. Global (all routes except /studio) — remove `'unsafe-eval'` and `'unsafe-inline'`:

{
  source: "/((?!studio).*)",
  headers: [
    {
      key: "Content-Security-Policy",
      value: "script-src 'self' https://cdn.sanity.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://cdn.sanity.io; frame-ancestors 'none'",
    },
  ],
},

2. Studio route only — keep unsafe-eval (Sanity Studio requires it):

{
  source: "/studio/:path*",
  headers: [
    {
      key: "Content-Security-Policy",
      value: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.sanity.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://cdn.sanity.io; frame-ancestors 'none'",
    },
  ],
},

Preserve all other security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) on both source entries.

### Do NOT
- Add nonce-based CSP in this prompt — that is a follow-up.
- Change any other config in next.config.ts.
```

---

### H4. Sanity Studio at /studio has no server-side auth gating

**Files:** `apps/website/src/app/studio/[[...index]]/page.tsx`, `apps/website/src/middleware.ts`

#### Cursor Prompt

```
## Task: Add Sanity Studio to middleware matcher and add auth guard

### Step 1 — Update middleware matcher

In `apps/website/src/middleware.ts`, add `/studio` to the matcher array:

matcher: ["/portal", "/portal/:path*", "/admin", "/admin/:path*", "/auth", "/auth/:path*", "/studio", "/studio/:path*"]

### Step 2 — Add auth guard layout

In `apps/website/src/app/studio/layout.tsx`, add a server-side operator check before rendering the Studio:

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/sign-in");
  }

  const { data: isOp } = await supabase.rpc("is_operator");
  if (!isOp) {
    redirect("/admin/sign-in");
  }

  return <>{children}</>;
}

### Do NOT
- Change the Studio page component itself.
- Add any UI (loading states, error pages) — just redirect.
```

---

### H5. venues table — RLS enablement not confirmed in migrations

**Status:** No migration contains ENABLE ROW LEVEL SECURITY for venues.

#### Cursor Prompt

```
## Task: Ensure venues table has RLS enabled via migration

Create `supabase/migrations/20260419100001_ensure_venues_rls.sql`:

-- Defensive: ensure RLS is enabled on venues.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.
ALTER TABLE IF EXISTS public.venues ENABLE ROW LEVEL SECURITY;

### Do NOT
- Add or change any RLS policies — existing policies are correct.
- Touch any other tables.
```

---

### H6. Any allowlisted host can cancel any quiz event

**File:** `supabase/migrations/20260403120000_host_dashboard_interests.sql`

#### Cursor Prompt

```
## Task: Add assignment check to host_patch_quiz_event_host_fields()

Create `supabase/migrations/20260419100002_restrict_host_patch_to_assigned.sql`:

CREATE OR REPLACE FUNCTION public.host_patch_quiz_event_host_fields(
  p_quiz_event_id uuid,
  p_host_capacity_note text DEFAULT NULL,
  p_host_cancelled_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RAISE EXCEPTION 'Not an allowlisted host';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_claims
    WHERE quiz_event_id = p_quiz_event_id
      AND host_user_id = auth.uid()
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'You are not assigned to this quiz';
  END IF;

  UPDATE public.quiz_events
  SET
    host_capacity_note = COALESCE(p_host_capacity_note, host_capacity_note),
    host_cancelled_at  = p_host_cancelled_at
  WHERE id = p_quiz_event_id;
END;
$$;

Read the existing function in `20260403120000_host_dashboard_interests.sql` first to confirm the signature matches.

### Do NOT
- Change the function signature or return type.
- Modify any other functions.
```

---

### H7. Debug screens compiled into production bundle

**Files:** `apps/app/src/screens/DebugScreen.tsx`, `apps/app/src/screens/DebugEnvScreen.tsx`

#### Cursor Prompt

```
## Task: Delete debug screens that expose environment details

Delete these two files entirely:
- `apps/app/src/screens/DebugScreen.tsx`
- `apps/app/src/screens/DebugEnvScreen.tsx`

Search the codebase for any imports of `DebugScreen` or `DebugEnvScreen` (likely in navigator files or barrel exports). Remove those imports and any navigator Screen registrations that reference them.

### Do NOT
- Add __DEV__ guards instead — just delete them.
```

---

## Medium (11 items)

### M1. dangerouslySetInnerHTML with JSON-LD — </script> escape gap

**File:** `apps/website/src/app/find-a-quiz/quiz/[id]/page.tsx:122-129`

#### Cursor Prompt

```
## Task: Safely escape JSON-LD script injection in quiz detail page

### Step 1 — Add helper

Create `apps/website/src/lib/json-ld.ts`:

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

### Step 2 — Use it

In `apps/website/src/app/find-a-quiz/quiz/[id]/page.tsx`, replace both:

  dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
  dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}

with:

  dangerouslySetInnerHTML={{ __html: safeJsonLd(eventJsonLd) }}
  dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}

Search the rest of the codebase for any other dangerouslySetInnerHTML + JSON.stringify combos and apply the same fix.

### Do NOT
- Remove the JSON-LD blocks — they're needed for SEO.
- Change the structured data builders in lib/structured-data.ts.
```

---

### M2. Apple Sign-In nonce uses Math.random()

**File:** `apps/app/src/lib/auth/appleSignIn.ts:8-14`

#### Cursor Prompt

```
## Task: Replace Math.random() with crypto-secure random in Apple Sign-In nonce

In `apps/app/src/lib/auth/appleSignIn.ts`, replace the `randomNonce` function with:

import * as Crypto from "expo-crypto";

function randomNonce(length = 32): string {
  const bytes = Crypto.getRandomBytes(length);
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[bytes[i] % chars.length];
  }
  return s;
}

expo-crypto is already a dependency. Add `getRandomBytes` to the existing import.

### Do NOT
- Change the SHA-256 hashing logic below — that part is correct.
- Touch any other auth files.
```

---

### M3. is_allowlisted_operator() uses JWT email, not UUID

**File:** `supabase/migrations/20260408100000_publican_messages.sql:61-80`

#### Cursor Prompt

```
## Task: Replace is_allowlisted_operator() with is_operator() in all RLS policies

Create `supabase/migrations/20260419100003_standardise_operator_check.sql`.

Grep all migration files for `is_allowlisted_operator` and replace every policy that references it with `is_operator()` instead. Example:

DROP POLICY IF EXISTS "Operators read all messages" ON public.publican_messages;
CREATE POLICY "Operators read all messages"
  ON public.publican_messages
  FOR SELECT
  TO authenticated
  USING (public.is_operator());

Repeat for every policy found. Also check RPC functions that call is_allowlisted_operator() internally and update those too.

### Do NOT
- Drop the is_allowlisted_operator() function yet — do that in a follow-up once all references are confirmed removed.
- Touch is_operator() — it is correct.
- Change is_allowlisted_host() in this prompt.
```

---

### M4. host_quiz_dashboard_rows() exposes all quizzes to any host

**File:** `supabase/migrations/20260403120000_host_dashboard_interests.sql:32-61`

#### Cursor Prompt

```
## Task: Restrict host_quiz_dashboard_rows() to quizzes the host is assigned to

Create `supabase/migrations/20260419100004_scope_host_dashboard_to_claims.sql`.

Use CREATE OR REPLACE FUNCTION. Read the existing function first to confirm exact return columns. Add a JOIN to quiz_claims:

  JOIN public.quiz_claims qc ON qc.quiz_event_id = qe.id
    AND qc.host_user_id = auth.uid()
    AND qc.status IN ('pending', 'confirmed')

Keep the is_allowlisted_host() guard as a first check.

### Do NOT
- Change the RLS policies on quiz_events.
- Change the function signature or return type.
```

---

### M5. record_host_quiz_session() — any host can record sessions for any venue

**File:** `supabase/migrations/20260412100000_host_quiz_sessions.sql:33-86`

#### Cursor Prompt

```
## Task: Add venue assignment check to record_host_quiz_session()

Create `supabase/migrations/20260419100005_restrict_host_session_to_assigned.sql`.

Read the existing function first. Add this check after the is_allowlisted_host() guard:

  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_claims qc
    JOIN public.quiz_events qe ON qe.id = qc.quiz_event_id
    WHERE qe.venue_id = p_venue_id
      AND qc.host_user_id = auth.uid()
      AND qc.status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'You do not have a claim for a quiz at this venue';
  END IF;

Use CREATE OR REPLACE FUNCTION and copy the full function body.

### Do NOT
- Change the function signature or return type.
- Modify the fee lookup logic.
```

---

### M6. quiz_claims.host_email not validated against JWT

**File:** `supabase/migrations/20260420110000_quiz_claims_host_fee_override.sql:8-11`

#### Cursor Prompt

```
## Task: Enforce host_email matches JWT in quiz_claims INSERT policy

Create `supabase/migrations/20260419100006_quiz_claims_email_check.sql`:

Read the existing INSERT policy name from the quiz_claims migration files first.

DROP POLICY IF EXISTS "Hosts insert own claims" ON public.quiz_claims;
CREATE POLICY "Hosts insert own claims"
  ON public.quiz_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    host_user_id = auth.uid()
    AND public.is_allowlisted_host()
    AND host_email = lower(trim(auth.jwt()->>'email'))
  );

### Do NOT
- Change SELECT/UPDATE/DELETE policies.
- Alter the table schema.
```

---

### M7. File upload validation is client-side only

**File:** `apps/website/src/components/admin/AdminQuizzesDashboard.tsx:388`

#### Cursor Prompt

```
## Task: Add storage-level file type and size validation for venue images

Create `supabase/migrations/20260419100007_venue_image_storage_validation.sql`.

Read the existing storage policies in migrations first (search for storage.objects and venue). Add:

DROP POLICY IF EXISTS "Operators upload venue images" ON storage.objects;
CREATE POLICY "Operators upload venue images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'venue-images'
    AND public.is_operator()
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'))
  );

UPDATE storage.buckets
SET file_size_limit = 8388608
WHERE id = 'venue-images';

### Do NOT
- Remove the client-side checks in AdminQuizzesDashboard — keep those as UX feedback.
- Change the upload path or bucket structure.
```

---

### M8. CORS wildcard on Edge Functions

**Files:** `supabase/functions/notify-quiz-attendees/index.ts`, `supabase/functions/notify-quiz-cancelled/index.ts`

#### Cursor Prompt

```
## Task: Replace wildcard CORS with specific origins on Edge Functions

In both files, replace:

  "Access-Control-Allow-Origin": "*"

With:

  "Access-Control-Allow-Origin": "https://quizzerapp.co.uk"

Apply to both the OPTIONS handler and regular response headers.

### Do NOT
- Add any other CORS headers.
- Change the Authorization or Bearer token handling.
```

---

### M9. quiz_questions.host_notes world-readable

**File:** `supabase/migrations/20250117000000_quiz_packs.sql:34-36`

#### Cursor Prompt

```
## Task: Hide host_notes from anonymous quiz_questions reads

Create `supabase/migrations/20260419100008_restrict_host_notes.sql`:

REVOKE SELECT (host_notes) ON public.quiz_questions FROM anon;
REVOKE SELECT (host_notes) ON public.quiz_questions FROM authenticated;

Then create a SECURITY DEFINER wrapper for hosts/operators who need it, or handle via the existing quiz_answers join path.

Read the existing table columns in 20250117000000_quiz_packs.sql first. Check if the app or website queries host_notes directly and update those queries if needed.

### Do NOT
- Change the quiz_answers table policies.
- Remove the USING (true) policy on quiz_packs or quiz_rounds.
```

---

### M10. No rate limiting on POST /api/admin/create-publican

**File:** `apps/website/src/app/api/admin/create-publican/route.ts`

#### Cursor Prompt

```
## Task: Add basic rate limiting to the create-publican API route

Add an in-memory rate limiter at the top of `apps/website/src/app/api/admin/create-publican/route.ts`:

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

After the is_operator check, add:

if (!checkRateLimit(user.id)) {
  return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
}

### Do NOT
- Install Redis or external dependencies.
- Change the auth or operator verification logic.
```

---

### M11. Portal shell doesn't hard-fail on profile fetch error

**File:** `apps/website/src/app/portal/(shell)/layout.tsx:20-30`

#### Cursor Prompt

```
## Task: Add error handling to portal shell layout profile fetch

In `apps/website/src/app/portal/(shell)/layout.tsx`, after the publican_profiles query, add:

if (profileError) {
  redirect("/portal/sign-in");
}

Also redirect if profile is null/undefined — a signed-in user with no publican profile should not see the shell.

Read the file first to see the exact query shape.

### Do NOT
- Add error UI or toast — just redirect to sign-in.
- Change the inner (protected) layout checks.
```

---

## Low (6 items)

### L1. Production console.log/console.warn leak Supabase errors

**Files:** `apps/app/src/screens/player/nearby/useNearbyQuizzes.ts:71`, `apps/app/src/lib/hostAccess.ts:37,68`, `apps/app/src/lib/notifications.ts:256,259`

#### Cursor Prompt

```
## Task: Gate production console.log/warn statements behind __DEV__

Search the `apps/app/src/` directory for all `console.log` and `console.warn` calls that output Supabase errors or sensitive data. For each one that is NOT already wrapped in `if (__DEV__)`, wrap it:

if (__DEV__) console.warn("...", error);

Known locations:
- `apps/app/src/screens/player/nearby/useNearbyQuizzes.ts:71` — unconditional console.log of full error object
- `apps/app/src/lib/hostAccess.ts:37,68` — console.warn of RPC errors
- `apps/app/src/lib/notifications.ts:256,259` — console.warn of notification errors

### Do NOT
- Remove the log statements entirely — they are useful in development.
- Add a logging library or abstraction.
```

---

### L2. NEXT_PUBLIC_DEBUG_QUIZZES could leak to production

**File:** `apps/website/src/app/find-a-quiz/page.tsx:20`

#### Cursor Prompt

```
## Task: Guard debug banner against production exposure

In `apps/website/src/app/find-a-quiz/page.tsx`, change:

const SHOW_DATA_SOURCE_BANNER = process.env.NEXT_PUBLIC_DEBUG_QUIZZES === "true";

To:

const SHOW_DATA_SOURCE_BANNER = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_QUIZZES === "true";
```

---

### L3. Portal sign-out has no error handling

**File:** `apps/website/src/components/portal/PortalSignOutButton.tsx:22`

#### Cursor Prompt

```
## Task: Add error handling to portal sign-out

In `apps/website/src/components/portal/PortalSignOutButton.tsx`, wrap the sign-out call:

const { error } = await supabase.auth.signOut();
if (error) {
  console.error("Sign-out failed:", error.message);
}
router.push("/portal/sign-in");

Read the file first to confirm the exact structure.
```

---

### L4. publican_profiles.email not enforced to match auth.users email

**File:** `supabase/migrations/20260420140000_publican_profiles.sql`

**Action:** Consider adding a trigger that syncs `publican_profiles.email` when `auth.users.email` changes, or document that this is operator-managed and intentionally decoupled.

---

### L5. host_applications.quiz_event_id uses ON DELETE SET NULL

**File:** `supabase/migrations/20260411100000_admin_triage.sql:4`

**Action:** Consider changing to `ON DELETE RESTRICT` to prevent accidental quiz deletion when hosts are assigned. Low priority — only matters if quizzes are deleted (rare operation).

---

### L6. visionTool included in production Sanity config

**File:** `apps/website/src/sanity.config.ts:64`

#### Cursor Prompt

```
## Task: Conditionally include visionTool in Sanity config

In `apps/website/src/sanity.config.ts`, change:

visionTool({ defaultApiVersion: "2024-01-01" })

To conditionally include it:

...(process.env.NODE_ENV !== "production" ? [visionTool({ defaultApiVersion: "2024-01-01" })] : [])
```

---

## Correctly Implemented (no action needed)

- Admin portal uses `getUser()` (not `getSession()`) server-side
- Admin role check via server-side `is_operator()` RPC, not client claims
- Portal venue page enforces IDOR check (`profile.venue_id !== venueId`)
- `SUPABASE_SERVICE_ROLE_KEY` never exposed to client bundles
- OAuth uses PKCE flow correctly
- Security headers (HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy) all present
- No hardcoded secrets found in source files
- `.env` files properly gitignored (not committed to history)
- Apple Sign-In nonce is SHA-256 hashed before sending to Apple
