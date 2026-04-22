import {
  formatScheduleDay,
  formatScheduleEntryFeePence,
  formatSchedulePrize,
  formatScheduleTime,
} from "@/lib/portalScheduleFormat";
import { PublicanNewMessageForm } from "./PublicanNewMessageForm";
import { PublicanNotifyAttendeesPanel } from "./PublicanNotifyAttendeesPanel";
import { CancelOccurrenceButton } from "./CancelOccurrenceButton";

export type VenueQuizEventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  prize: string | null;
};

export type UpcomingOccurrence = {
  occurrence_date: string;
  cancelled: boolean;
  interest_count: number;
};

type Props = {
  venueId: string;
  venueName: string;
  events: VenueQuizEventRow[];
  occurrencesByEventId: Map<string, UpcomingOccurrence[]>;
};

function formatOccurrenceDate(iso: string): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function EventCard({
  venueId,
  venueName,
  event,
  occurrences,
}: {
  venueId: string;
  venueName: string;
  event: VenueQuizEventRow;
  occurrences: UpcomingOccurrence[];
}) {
  const contextLabel = `${formatScheduleDay(event.day_of_week)} · ${formatScheduleTime(event.start_time)}`;
  const rangeLabel = `${formatScheduleDay(event.day_of_week)}s at ${formatScheduleTime(event.start_time)}`;

  return (
    <article className="rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white shadow-[var(--shadow-card)]">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">When</p>
          <p className="mt-1 font-medium text-quizzer-black">{formatScheduleDay(event.day_of_week)}</p>
          <p className="mt-0.5 tabular-nums text-sm text-quizzer-black">{formatScheduleTime(event.start_time)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Entry</p>
          <p className="mt-1 text-sm font-medium text-quizzer-black">
            {formatScheduleEntryFeePence(event.entry_fee_pence)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Prize</p>
          <p className="mt-1 text-sm text-quizzer-black/90">{formatSchedulePrize(event.prize)}</p>
        </div>
      </div>

      <div className="border-t-2 border-quizzer-black/10 px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Upcoming dates</p>
          <p className="text-[11px] text-quizzer-black/55">{rangeLabel}</p>
        </div>
        {occurrences.length === 0 ? (
          <p className="mt-2 text-sm text-quizzer-black/70">No upcoming dates scheduled.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {occurrences.map((o) => {
              const dateLabel = formatOccurrenceDate(o.occurrence_date);
              const countLabel = `${o.interest_count} interested`;
              return (
                <li
                  key={`${event.id}-${o.occurrence_date}`}
                  className={`rounded-[var(--radius-button)] border-2 border-quizzer-black/20 bg-quizzer-cream/40 px-3 py-2 ${
                    o.cancelled ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-quizzer-black">{dateLabel}</span>
                      <span className="tabular-nums text-xs text-quizzer-black/70">· {countLabel}</span>
                      {o.cancelled ? (
                        <span className="rounded-md border-2 border-quizzer-red bg-quizzer-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-quizzer-red">
                          Cancelled
                        </span>
                      ) : null}
                    </div>
                    {!o.cancelled ? (
                      <CancelOccurrenceButton
                        quizEventId={event.id}
                        occurrenceDate={o.occurrence_date}
                        dateLabel={dateLabel}
                        venueLabel={venueName}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t-2 border-quizzer-black/10 px-4 pb-4">
        <PublicanNotifyAttendeesPanel
          venueName={venueName}
          quizEventId={event.id}
          interestedCount={occurrences.reduce((sum, o) => sum + (o.cancelled ? 0 : o.interest_count), 0)}
        />
        <PublicanNewMessageForm
          venueId={venueId}
          quizEventId={event.id}
          contextLabel={contextLabel}
          compact
        />
      </div>
    </article>
  );
}

export function VenueQuizSchedule({ venueId, venueName, events, occurrencesByEventId }: Props) {
  const venueContext = `Venue · ${venueName}`;
  const hasRows = events.length > 0;

  return (
    <div className="px-8 py-10">
      <header className="mb-8 max-w-4xl border-b-[var(--border-thick)] border-quizzer-black pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/60">Venue</p>
        <h1 className="font-heading text-3xl uppercase text-quizzer-black">{venueName}</h1>
        <p className="mt-2 text-sm text-quizzer-black/75">Active quiz nights and interest from players.</p>
        <div className="mt-6 max-w-2xl rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
          <PublicanNewMessageForm venueId={venueId} quizEventId={null} contextLabel={venueContext} />
        </div>
      </header>

      {!hasRows ? (
        <p className="max-w-xl text-quizzer-black/80">No active quiz nights for this venue yet.</p>
      ) : (
        <section aria-labelledby="scheduled-heading" className="space-y-4">
          <h2 id="scheduled-heading" className="mb-4 font-heading text-lg uppercase text-quizzer-black">
            Scheduled
          </h2>
          <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-1">
            {events.map((event) => (
              <EventCard
                key={event.id}
                venueId={venueId}
                venueName={venueName}
                event={event}
                occurrences={occurrencesByEventId.get(event.id) ?? []}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
