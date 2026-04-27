import type { Metadata } from "next";
import { PublicanDashboard } from "@/components/portal/PublicanDashboard";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

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

  const { data: profile, error: profileError } = await supabase
    .from("publican_profiles")
    .select("id, venue_id, first_name, last_name, email, venues ( id, name, address, postcode )")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    captureSupabaseError("portal.dashboard_profile_by_user", profileError, { user_id: user.id });
  }

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
    captureSupabaseError("portal.dashboard_events_by_venue", evErr, { venue_id: venueId });
  }

  const eventRows = events ?? [];
  const eventIds = eventRows.map((e) => e.id);

  const interestByEventId = new Map<
    string,
    {
      upcoming_interest_count: number;
      next_occurrence_date: string | null;
      next_occurrence_interest_count: number;
    }
  >();
  if (eventIds.length > 0) {
    const { data: interestRows, error: intErr } = await supabase.rpc(
      "publican_dashboard_event_interest",
      { p_venue_id: venueId },
    );
    if (intErr) {
      captureSupabaseError("portal.dashboard_interest_summary", intErr, {
        venue_id: venueId,
      });
    }
    for (const raw of (interestRows ?? []) as Array<{
      quiz_event_id?: string | null;
      upcoming_interest_count?: number | string | null;
      next_occurrence_date?: string | null;
      next_occurrence_interest_count?: number | string | null;
    }>) {
      const qid = String(raw.quiz_event_id ?? "");
      if (!qid) continue;
      interestByEventId.set(qid, {
        upcoming_interest_count: Number(raw.upcoming_interest_count ?? 0) || 0,
        next_occurrence_date: raw.next_occurrence_date ? String(raw.next_occurrence_date) : null,
        next_occurrence_interest_count: Number(raw.next_occurrence_interest_count ?? 0) || 0,
      });
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
      captureSupabaseError("portal.dashboard_claims_by_events", claimErr);
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
    upcoming_interest_count: interestByEventId.get(e.id)?.upcoming_interest_count ?? 0,
    next_occurrence_date: interestByEventId.get(e.id)?.next_occurrence_date ?? null,
    next_occurrence_interest_count: interestByEventId.get(e.id)?.next_occurrence_interest_count ?? 0,
    claim: claimByEventId.get(e.id) ?? null,
  }));

  const { data: msgRows, error: msgErr } = await supabase
    .from("publican_messages")
    .select("id, message_type, body, status, created_at, operator_reply")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (msgErr) {
    captureSupabaseError("portal.dashboard_messages_by_venue", msgErr, { venue_id: venueId });
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
