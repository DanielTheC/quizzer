import type { Metadata } from "next";
import { PublicanDashboard } from "@/components/portal/PublicanDashboard";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard · Publican portal",
  robots: { index: false, follow: false },
};

export default async function PortalDashboardPage() {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("publican_profiles")
    .select("id, venue_id, first_name, last_name, email, venues ( id, name, address, postcode )")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const venueRaw = profile.venues;
  const venue = Array.isArray(venueRaw) ? venueRaw[0] : venueRaw;
  const venueId = profile.venue_id;

  const venueProps = {
    id: venueId,
    name: typeof venue?.name === "string" && venue.name.trim() ? venue.name.trim() : "Venue",
    address: typeof venue?.address === "string" ? venue.address : null,
    postcode: typeof venue?.postcode === "string" ? venue.postcode : null,
  };

  const { data: events, error: evErr } = await supabase
    .from("quiz_events")
    .select("id, day_of_week, start_time, entry_fee_pence, is_active")
    .eq("venue_id", venueId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (evErr) {
    console.error("[portal] quiz_events:", evErr.message);
  }

  const eventRows = events ?? [];
  const eventIds = eventRows.map((e) => e.id);

  const interestByEventId = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: interestRows, error: intErr } = await supabase
      .from("quiz_event_interests")
      .select("quiz_event_id")
      .in("quiz_event_id", eventIds);
    if (intErr) {
      console.error("[portal] quiz_event_interests:", intErr.message);
    }
    for (const r of interestRows ?? []) {
      const qid = r.quiz_event_id as string;
      interestByEventId.set(qid, (interestByEventId.get(qid) ?? 0) + 1);
    }
  }

  const claimByEventId = new Map<string, { status: string; host_email: string }>();
  if (eventIds.length > 0) {
    const { data: claimRows, error: claimErr } = await supabase
      .from("quiz_claims")
      .select("quiz_event_id, status, host_email")
      .in("quiz_event_id", eventIds)
      .in("status", ["pending", "confirmed"]);
    if (claimErr) {
      console.error("[portal] quiz_claims:", claimErr.message);
    }
    for (const c of claimRows ?? []) {
      const eid = c.quiz_event_id as string;
      if (!claimByEventId.has(eid)) {
        claimByEventId.set(eid, {
          status: String(c.status),
          host_email: String(c.host_email ?? ""),
        });
      }
    }
  }

  const quizEvents = eventRows.map((e) => ({
    id: e.id,
    day_of_week: e.day_of_week,
    start_time: e.start_time,
    entry_fee_pence: e.entry_fee_pence,
    is_active: Boolean(e.is_active),
    interest_count: interestByEventId.get(e.id) ?? 0,
    claim: claimByEventId.get(e.id) ?? null,
  }));

  const { data: msgRows, error: msgErr } = await supabase
    .from("publican_messages")
    .select("id, message_type, body, status, created_at, operator_reply")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (msgErr) {
    console.error("[portal] publican_messages:", msgErr.message);
  }

  const recentMessages = (msgRows ?? []).map((m) => ({
    id: m.id as string,
    message_type: String(m.message_type),
    body: String(m.body ?? ""),
    status: String(m.status),
    created_at: String(m.created_at),
    operator_reply: m.operator_reply != null ? String(m.operator_reply) : null,
  }));

  return (
    <PublicanDashboard
      venue={venueProps}
      profile={{
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      }}
      quizEvents={quizEvents}
      recentMessages={recentMessages}
    />
  );
}
