import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { venueLinksFromPublicanProfile } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { VenueQuizSchedule, type VenueQuizEventRow } from "@/components/portal/VenueQuizSchedule";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

export const metadata: Metadata = {
  title: "Venue schedule · Portal",
  robots: { index: false, follow: false },
};

type InterestCountRow = {
  quiz_event_id: string;
  interest_count: number | string;
};

type PageProps = { params: Promise<{ venueId: string }> };

export default async function PublicanVenueSchedulePage({ params }: PageProps) {
  const { venueId } = await params;
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("publican_profiles")
    .select("venue_id, venues ( name )")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    captureSupabaseError("portal.venue_profile_by_user", profileError, { user_id: user.id });
  }

  if (!profile || profile.venue_id !== venueId) {
    notFound();
  }

  const links = venueLinksFromPublicanProfile(profile);
  const current = links.find((l) => l.venueId === venueId);
  if (!current) {
    notFound();
  }

  const { data: events, error: eventsError } = await supabase
    .from("quiz_events")
    .select("id, day_of_week, start_time, entry_fee_pence, prize, host_cancelled_at")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (eventsError) {
    captureSupabaseError("portal.venue_events_by_venue", eventsError, { venue_id: venueId });
  }

  const rows = (events ?? []) as VenueQuizEventRow[];
  const scheduled = rows.filter((r) => r.host_cancelled_at == null);
  const cancelled = rows.filter((r) => r.host_cancelled_at != null);

  const interestByEventId = new Map<string, number>();
  const { data: countData, error: countError } = await supabase.rpc("publican_venue_quiz_interest_counts", {
    p_venue_id: venueId,
  });
  if (countError) {
    captureSupabaseError("portal.venue_interest_counts_rpc", countError, { venue_id: venueId });
    const eventIds = rows.map((r) => r.id);
    if (eventIds.length > 0) {
      const { data: interestRows, error: intErr } = await supabase
        .from("quiz_event_interests")
        .select("quiz_event_id")
        .in("quiz_event_id", eventIds);
      if (intErr) {
        captureSupabaseError("portal.venue_interests_fallback", intErr, { venue_id: venueId });
      } else {
        for (const r of interestRows ?? []) {
          const qid = r.quiz_event_id as string;
          interestByEventId.set(qid, (interestByEventId.get(qid) ?? 0) + 1);
        }
      }
    }
  } else {
    for (const row of (countData ?? []) as InterestCountRow[]) {
      if (row?.quiz_event_id) {
        interestByEventId.set(row.quiz_event_id, Number(row.interest_count) || 0);
      }
    }
  }

  return (
    <VenueQuizSchedule
      venueId={venueId}
      venueName={current.venueName}
      scheduled={scheduled}
      cancelled={cancelled}
      interestByEventId={interestByEventId}
    />
  );
}
