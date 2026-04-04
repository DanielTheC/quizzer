import { formatScheduleDay, formatScheduleTime } from "@/lib/portalScheduleFormat";
import { labelForMessageStatus, labelForMessageType } from "./publicanMessageLabels";

export type PublicanMessageListRow = {
  id: string;
  venue_id: string;
  quiz_event_id: string | null;
  message_type: string;
  body: string;
  status: string;
  operator_reply: string | null;
  created_at: string;
  resolved_at: string | null;
  venues: { name: string | null } | null;
  quiz_events: { day_of_week: number; start_time: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const base =
    "inline-flex rounded-md border-2 border-quizzer-black px-2 py-0.5 text-xs font-semibold uppercase";
  if (status === "resolved") {
    return <span className={`${base} bg-quizzer-green/25 text-quizzer-black`}>{labelForMessageStatus(status)}</span>;
  }
  if (status === "in_progress") {
    return <span className={`${base} bg-quizzer-blue/20 text-quizzer-black`}>{labelForMessageStatus(status)}</span>;
  }
  return <span className={`${base} bg-quizzer-yellow text-quizzer-black`}>{labelForMessageStatus(status)}</span>;
}

function MessageCard({ message }: { message: PublicanMessageListRow }) {
  const quizLabel =
    message.quiz_events != null
      ? `${formatScheduleDay(message.quiz_events.day_of_week)} · ${formatScheduleTime(message.quiz_events.start_time)}`
      : "Venue-wide";

  return (
    <article
      className="rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
      aria-label={`Message ${labelForMessageType(message.message_type)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/60">
          {labelForMessageType(message.message_type)}
        </span>
        <StatusBadge status={message.status} />
        <span className="text-xs text-quizzer-black/55">{quizLabel}</span>
        <time className="ml-auto text-xs tabular-nums text-quizzer-black/55" dateTime={message.created_at}>
          {new Date(message.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-quizzer-black">{message.body}</p>
      {message.operator_reply?.trim() ? (
        <div className="mt-4 rounded-md border-2 border-quizzer-black/20 bg-quizzer-cream px-3 py-2">
          <p className="text-xs font-semibold uppercase text-quizzer-black/60">Quizzer reply</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-quizzer-black">{message.operator_reply.trim()}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-quizzer-black/50">No reply yet.</p>
      )}
    </article>
  );
}

type Props = {
  groups: { venueId: string; venueName: string; messages: PublicanMessageListRow[] }[];
};

export function PublicanMessagesList({ groups }: Props) {
  if (groups.length === 0) {
    return <p className="text-quizzer-black/80">You have not sent any messages yet.</p>;
  }

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.venueId} aria-labelledby={`venue-msgs-${g.venueId}`}>
          <h2 id={`venue-msgs-${g.venueId}`} className="mb-4 font-heading text-xl uppercase text-quizzer-black">
            {g.venueName}
          </h2>
          <ul className="space-y-4">
            {g.messages.map((m) => (
              <li key={m.id}>
                <MessageCard message={m} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
