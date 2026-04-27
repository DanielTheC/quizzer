import {
  createServerSupabaseClientSafe,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isOperator, error: rpcError } = await supabase.rpc("is_operator");
  if (rpcError) {
    captureSupabaseError("api.admin.create_publican.is_operator", rpcError);
    return NextResponse.json({ error: "Could not verify access" }, { status: 500 });
  }
  if (!isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many invites. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const venue_id = typeof o.venue_id === "string" ? o.venue_id.trim() : "";
  const first_name = typeof o.first_name === "string" ? o.first_name : null;
  const last_name = typeof o.last_name === "string" ? o.last_name : null;

  if (!email || !venue_id) {
    return NextResponse.json({ error: "email and venue_id are required" }, { status: 400 });
  }

  let adminClient: ReturnType<typeof createServiceRoleSupabaseClient>;
  try {
    adminClient = createServiceRoleSupabaseClient();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const { data: inviteData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name: first_name?.trim() || undefined,
      last_name: last_name?.trim() || undefined,
    },
    redirectTo: `${origin}/portal/accept-invite?next=${encodeURIComponent("/portal/welcome")}`,
  });

  const newUser = inviteData?.user;
  if (authError || !newUser) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 });
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("publican_profiles")
    .select("id, venue_id")
    .eq("id", newUser.id)
    .maybeSingle();

  if (existingProfileError) {
    captureSupabaseError("api.admin.create_publican.profile_lookup", existingProfileError, {
      user_id: newUser.id,
      venue_id,
    });
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (existingProfile) {
    if (existingProfile.venue_id === venue_id) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Publican is already linked to another venue" }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("publican_profiles").insert({
    id: newUser.id,
    venue_id,
    email,
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
  });

  if (profileError) {
    captureSupabaseError("api.admin.create_publican.profile_insert", profileError, {
      user_id: newUser.id,
      venue_id,
    });
    const { error: delErr } = await adminClient.auth.admin.deleteUser(newUser.id);
    if (delErr) {
      console.error("create-publican rollback deleteUser:", delErr.message);
    }
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
