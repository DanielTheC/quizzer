import type { Metadata } from "next";
import { PublicanMessagesList, type PublicanMessageListRow } from "@/components/portal/PublicanMessagesList";
import { PublicanNewMessageForm } from "@/components/portal/PublicanNewMessageForm";
import { mapPublicanVenueRows } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Messages · Portal",
  robots: { index: false, follow: false },
};

export default async function PublicanMessagesPage() {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }

  const { data: msgRows, error: msgError } = await supabase
    .from("publican_messages")
    .select(
      "id, venue_id, quiz_event_id, message_type, body, status, operator_reply, created_at, resolved_at, venues ( name ), quiz_events ( day_of_week, start_time )"
    )
    .order("created_at", { ascending: false });

  if (msgError) {
    console.error("[portal] publican_messages:", msgError.message);
  }

  const messages = (msgRows ?? []) as unknown as PublicanMessageListRow[];

  const { data: pvRows } = await supabase
    .from("publican_venues")
    .select("id, venue_id, venues ( name )")
    .order("created_at", { ascending: true });
  const links = mapPublicanVenueRows(pvRows ?? []);
  const venueOrder = new Map(links.map((l, i) => [l.venueId, i]));

  const byVenue = new Map<string, { venueName: string; messages: PublicanMessageListRow[] }>();
  for (const m of messages) {
    const vid = m.venue_id;
    const vname = m.venues?.name?.trim() || "Venue";
    if (!byVenue.has(vid)) {
      byVenue.set(vid, { venueName: vname, messages: [] });
    }
    byVenue.get(vid)!.messages.push(m);
  }

  const groups = Array.from(byVenue.entries())
    .map(([venueId, g]) => ({ venueId, venueName: g.venueName, messages: g.messages }))
    .sort((a, b) => (venueOrder.get(a.venueId) ?? 999) - (venueOrder.get(b.venueId) ?? 999));

  const venuePicker = links.map((l) => ({ id: l.venueId, name: l.venueName }));
  const contextLabel =
    links.length === 1 ? `Venue · ${links[0]?.venueName ?? "Your venue"}` : "Venue-wide message (choose venue if you manage several)";

  return (
    <div className="px-8 py-10">
      <header className="mb-10 max-w-3xl border-b-[var(--border-thick)] border-quizzer-black pb-6">
        <h1 className="font-heading text-3xl uppercase text-quizzer-black">Messages</h1>
        <p className="mt-2 text-sm text-quizzer-black/75">
          Threads with the Quizzer team, grouped by venue. Replies appear under each message.
        </p>
        {venuePicker.length > 0 ? (
          <div className="mt-6 max-w-2xl rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
            <PublicanNewMessageForm
              venueId={null}
              venuePicker={venuePicker}
              quizEventId={null}
              contextLabel={contextLabel}
            />
          </div>
        ) : null}
      </header>

      <PublicanMessagesList groups={groups} />
    </div>
  );
}
