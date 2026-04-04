import {
  formatScheduleDay,
  formatScheduleEntryFeePence,
  formatSchedulePrize,
  formatScheduleTime,
} from "@/lib/portalScheduleFormat";

export type VenueQuizEventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  prize: string | null;
  host_cancelled_at: string | null;
};

type Props = {
  venueName: string;
  scheduled: VenueQuizEventRow[];
  cancelled: VenueQuizEventRow[];
  interestByEventId: Map<string, number>;
};

function Row({
  event,
  interestCount,
  showCancelled,
}: {
  event: VenueQuizEventRow;
  interestCount: number;
  showCancelled: boolean;
}) {
  return (
    <tr className="border-b-2 border-quizzer-black/10 last:border-b-0">
      <td className="py-3 pr-4 align-top font-medium text-quizzer-black">
        <div className="flex flex-wrap items-center gap-2">
          <span>{formatScheduleDay(event.day_of_week)}</span>
          {showCancelled ? (
            <span className="rounded-md border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-semibold uppercase">
              Cancelled
            </span>
          ) : null}
        </div>
      </td>
      <td className="py-3 pr-4 align-top tabular-nums text-quizzer-black">{formatScheduleTime(event.start_time)}</td>
      <td className="py-3 pr-4 align-top text-quizzer-black">{formatScheduleEntryFeePence(event.entry_fee_pence)}</td>
      <td className="py-3 pr-4 align-top text-quizzer-black/90">{formatSchedulePrize(event.prize)}</td>
      <td className="py-3 pr-4 align-top tabular-nums text-quizzer-black">{interestCount}</td>
      <td className="py-3 align-top text-sm text-quizzer-black/80">No host yet</td>
    </tr>
  );
}

export function VenueQuizSchedule({ venueName, scheduled, cancelled, interestByEventId }: Props) {
  const hasRows = scheduled.length > 0 || cancelled.length > 0;

  return (
    <div className="px-8 py-10">
      <header className="mb-8 max-w-4xl border-b-[var(--border-thick)] border-quizzer-black pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/60">Venue</p>
        <h1 className="font-heading text-3xl uppercase text-quizzer-black">{venueName}</h1>
        <p className="mt-2 text-sm text-quizzer-black/75">Active quiz nights and interest from players.</p>
      </header>

      {!hasRows ? (
        <p className="max-w-xl text-quizzer-black/80">No active quiz nights for this venue yet.</p>
      ) : (
        <div className="space-y-10">
          {scheduled.length > 0 ? (
            <section aria-labelledby="scheduled-heading">
              <h2 id="scheduled-heading" className="mb-3 font-heading text-lg uppercase text-quizzer-black">
                Upcoming
              </h2>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white shadow-[var(--shadow-card)]">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-quizzer-black bg-quizzer-cream text-xs font-semibold uppercase tracking-wide text-quizzer-black">
                      <th className="px-4 py-3">Day</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Entry</th>
                      <th className="px-4 py-3">Prize</th>
                      <th className="px-4 py-3">Interest</th>
                      <th className="px-4 py-3">Host</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {scheduled.map((event) => (
                      <Row
                        key={event.id}
                        event={event}
                        interestCount={interestByEventId.get(event.id) ?? 0}
                        showCancelled={false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section aria-labelledby="cancelled-heading">
              <h2 id="cancelled-heading" className="mb-3 font-heading text-lg uppercase text-quizzer-black">
                Cancelled
              </h2>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white shadow-[var(--shadow-card)] opacity-90">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-quizzer-black bg-quizzer-cream text-xs font-semibold uppercase tracking-wide text-quizzer-black">
                      <th className="px-4 py-3">Day</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Entry</th>
                      <th className="px-4 py-3">Prize</th>
                      <th className="px-4 py-3">Interest</th>
                      <th className="px-4 py-3">Host</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelled.map((event) => (
                      <Row
                        key={event.id}
                        event={event}
                        interestCount={interestByEventId.get(event.id) ?? 0}
                        showCancelled
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
