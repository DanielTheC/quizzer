import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { venueLinksFromPublicanProfile } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import {
  VenueQuizSchedule,
  type UpcomingOccurrence,
  type VenueQuizEventRow,
} from "@/components/portal/VenueQuizSchedule";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

export const metadata: Metadata = {
  title: "Venue schedule · Portal",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ venueId: string }> };

const OCCURRENCE_LOOKAHEAD = 8;

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
    .select("id, day_of_week, start_time, entry_fee_pence, prize")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (eventsError) {
    captureSupabaseError("portal.venue_events_by_venue", eventsError, { venue_id: venueId });
  }

  const rows = (events ?? []) as VenueQuizEventRow[];

  const occurrencesByEventId = new Map<string, UpcomingOccurrence[]>();
  if (rows.length > 0) {
    const results = await Promise.all(
      rows.map(async (r) => {
        const res = await supabase.rpc("get_upcoming_quiz_occurrences", {
          p_quiz_event_id: r.id,
          p_limit: OCCURRENCE_LOOKAHEAD,
        });
        return { id: r.id, res };
      }),
    );
    for (const { id, res } of results) {
      if (res.error) {
        captureSupabaseError("portal.get_upcoming_quiz_occurrences", res.error, { quiz_event_id: id });
        occurrencesByEventId.set(id, []);
        continue;
      }
      const raw = (res.data ?? []) as Array<{
        occurrence_date?: string | null;
        cancelled?: boolean | null;
        interest_count?: number | string | null;
      }>;
      const normalized: UpcomingOccurrence[] = raw.map((o) => ({
        occurrence_date: String(o.occurrence_date ?? ""),
        cancelled: Boolean(o.cancelled),
        interest_count: Number(o.interest_count ?? 0) || 0,
      }));
      occurrencesByEventId.set(id, normalized);
    }
  }

  return (
    <VenueQuizSchedule
      venueId={venueId}
      venueName={current.venueName}
      events={rows}
      occurrencesByEventId={occurrencesByEventId}
    />
  );
}
