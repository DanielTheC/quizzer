import { NextRequest, NextResponse } from "next/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREQUENCIES = new Set(["one_off", "weekly", "monthly", "not_sure"]);
const EXISTING_STATUSES = new Set(["already_runs", "wants_to_start"]);

function optionalString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

function optionalEnum(value: unknown, allowed: Set<string>): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !allowed.has(value)) return undefined;
  return value;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent")?.trim() || null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const {
    venue_name,
    contact_name,
    email,
    phone,
    city,
    frequency,
    existing,
    message,
    website,
  } = body as Record<string, unknown>;

  if (typeof website === "string" && website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const venueName = typeof venue_name === "string" ? venue_name.trim() : "";
  const contactName = typeof contact_name === "string" ? contact_name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const phoneValue = optionalString(phone, 30);
  const cityValue = optionalString(city, 120);
  const frequencyValue = optionalEnum(frequency, FREQUENCIES);
  const existingValue = optionalEnum(existing, EXISTING_STATUSES);
  const messageValue = optionalString(message, 4000);

  if (
    venueName.length < 2 ||
    venueName.length > 200 ||
    contactName.length < 2 ||
    contactName.length > 200 ||
    !EMAIL_RE.test(normalizedEmail) ||
    phoneValue === undefined ||
    cityValue === undefined ||
    frequencyValue === undefined ||
    existingValue === undefined ||
    messageValue === undefined
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  const { count, error: countError } = await supabase
    .from("venue_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("email", normalizedEmail)
    .eq("status", "new");

  if (countError) {
    captureSupabaseError("api.venue_enquiry.pending_count", countError, { ip });
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "Too many recent enquiries for this email" }, { status: 429 });
  }

  const { error } = await supabase.from("venue_enquiries").insert({
    venue_name: venueName,
    contact_name: contactName,
    email: normalizedEmail,
    phone: phoneValue,
    city: cityValue,
    frequency: frequencyValue,
    existing: existingValue,
    message: messageValue,
    status: "new",
    source_ip: ip,
    user_agent: userAgent,
  });

  if (error) {
    captureSupabaseError("api.venue_enquiry.insert", error, { ip });
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
