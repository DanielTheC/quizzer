import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mapPublicanVenueRows } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { VenueQuizSchedule, type VenueQuizEventRow } from "@/components/portal/VenueQuizSchedule";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

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

  const { data: pvRows } = await supabase
    .from("publican_venues")
    .select("id, venue_id, venues ( name )")
    .order("created_at", { ascending: true });
  const links = mapPublicanVenueRows(pvRows ?? []);
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
    console.error("[portal] quiz_events:", eventsError.message);
  }

  const rows = (events ?? []) as VenueQuizEventRow[];
  const scheduled = rows.filter((r) => r.host_cancelled_at == null);
  const cancelled = rows.filter((r) => r.host_cancelled_at != null);

  const { data: countData, error: countError } = await supabase.rpc("publican_venue_quiz_interest_counts", {
    p_venue_id: venueId,
  });
  if (countError) {
    console.error("[portal] publican_venue_quiz_interest_counts:", countError.message);
  }

  const interestByEventId = new Map<string, number>();
  for (const row of (countData ?? []) as InterestCountRow[]) {
    if (row?.quiz_event_id) {
      interestByEventId.set(row.quiz_event_id, Number(row.interest_count) || 0);
    }
  }

  return (
    <VenueQuizSchedule
      venueName={current.venueName}
      scheduled={scheduled}
      cancelled={cancelled}
      interestByEventId={interestByEventId}
    />
  );
}
