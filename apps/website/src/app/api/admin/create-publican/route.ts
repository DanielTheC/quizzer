import {
  createServerSupabaseClientSafe,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    console.error("is_operator:", rpcError.message);
    return NextResponse.json({ error: "Could not verify access" }, { status: 500 });
  }
  if (!isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const { data: inviteData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name: first_name?.trim() || undefined,
      last_name: last_name?.trim() || undefined,
    },
  });

  const newUser = inviteData?.user;
  if (authError || !newUser) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("publican_profiles").insert({
    id: newUser.id,
    venue_id,
    email,
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
  });

  if (profileError) {
    const { error: delErr } = await adminClient.auth.admin.deleteUser(newUser.id);
    if (delErr) {
      console.error("create-publican rollback deleteUser:", delErr.message);
    }
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
