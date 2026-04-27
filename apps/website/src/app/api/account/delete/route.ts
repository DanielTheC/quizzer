import { NextResponse } from "next/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;
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
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createServiceRoleSupabaseClient>;
  try {
    adminClient = createServiceRoleSupabaseClient();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
  }

  const { data: userData, error: getUserErr } = await adminClient.auth.getUser(token);
  if (getUserErr || !userData?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (!checkRateLimit(userData.user.id)) {
    return NextResponse.json({ error: "Too many deletes. Try again later." }, { status: 429 });
  }

  const { error: delErr } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (delErr) {
    captureSupabaseError("api.account.delete.delete_user", delErr, {
      user_id: userData.user.id,
    });
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
