import {
  formatScheduleDay,
  formatScheduleEntryFeePence,
  formatSchedulePrize,
  formatScheduleTime,
} from "@/lib/portalScheduleFormat";
import { PublicanNewMessageForm } from "./PublicanNewMessageForm";
import { PublicanNotifyAttendeesPanel } from "./PublicanNotifyAttendeesPanel";

export type VenueQuizEventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  prize: string | null;
  host_cancelled_at: string | null;
};

type Props = {
  venueId: string;
  venueName: string;
  scheduled: VenueQuizEventRow[];
  cancelled: VenueQuizEventRow[];
  interestByEventId: Map<string, number>;
};

function EventCard({
  venueId,
  venueName,
  event,
  interestCount,
  showCancelled,
}: {
  venueId: string;
  venueName: string;
  event: VenueQuizEventRow;
  interestCount: number;
  showCancelled: boolean;
}) {
  const contextLabel = `${formatScheduleDay(event.day_of_week)} · ${formatScheduleTime(event.start_time)}${
    showCancelled ? " · Cancelled slot" : ""
  }`;

  return (
    <article className="rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white shadow-[var(--shadow-card)]">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">When</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-medium text-quizzer-black">{formatScheduleDay(event.day_of_week)}</span>
            {showCancelled ? (
              <span className="rounded-md border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-semibold uppercase">
                Cancelled
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 tabular-nums text-sm text-quizzer-black">{formatScheduleTime(event.start_time)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Entry</p>
          <p className="mt-1 text-sm font-medium text-quizzer-black">{formatScheduleEntryFeePence(event.entry_fee_pence)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Prize</p>
          <p className="mt-1 text-sm text-quizzer-black/90">{formatSchedulePrize(event.prize)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Interest</p>
          <p className="mt-1 tabular-nums text-sm font-medium text-quizzer-black">{interestCount}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Host</p>
          <p className="mt-1 text-sm text-quizzer-black/80">No host yet</p>
        </div>
      </div>
      <div className="border-t-2 border-quizzer-black/10 px-4 pb-4">
        <PublicanNotifyAttendeesPanel
          venueName={venueName}
          quizEventId={event.id}
          interestedCount={interestCount}
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

export function VenueQuizSchedule({ venueId, venueName, scheduled, cancelled, interestByEventId }: Props) {
  const hasRows = scheduled.length > 0 || cancelled.length > 0;
  const venueContext = `Venue · ${venueName}`;

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
        <div className="space-y-10">
          {scheduled.length > 0 ? (
            <section aria-labelledby="scheduled-heading">
              <h2 id="scheduled-heading" className="mb-4 font-heading text-lg uppercase text-quizzer-black">
                Upcoming
              </h2>
              <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-1">
                {scheduled.map((event) => (
                  <EventCard
                    key={event.id}
                    venueId={venueId}
                    venueName={venueName}
                    event={event}
                    interestCount={interestByEventId.get(event.id) ?? 0}
                    showCancelled={false}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section aria-labelledby="cancelled-heading">
              <h2 id="cancelled-heading" className="mb-4 font-heading text-lg uppercase text-quizzer-black">
                Cancelled
              </h2>
              <div className="space-y-4 opacity-95">
                {cancelled.map((event) => (
                  <EventCard
                    key={event.id}
                    venueId={venueId}
                    venueName={venueName}
                    event={event}
                    interestCount={interestByEventId.get(event.id) ?? 0}
                    showCancelled
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
