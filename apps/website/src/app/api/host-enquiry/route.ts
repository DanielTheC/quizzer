import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

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

  const { count, error: countError } = await supabase
    .from("host_applications")
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase())
    .eq("status", "pending");

  if (countError) {
    captureSupabaseError("api.host_enquiry.pending_count", countError, { ip });
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

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
    captureSupabaseError("api.host_enquiry.insert", error, { ip });
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
