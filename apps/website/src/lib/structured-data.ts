import type { Quiz, QuizDetail } from "@/data/types";

const SITE_URL = "https://quizzerapp.co.uk";

const DAY_SCHEMA: Record<number, string> = {
  0: "https://schema.org/Sunday",
  1: "https://schema.org/Monday",
  2: "https://schema.org/Tuesday",
  3: "https://schema.org/Wednesday",
  4: "https://schema.org/Thursday",
  5: "https://schema.org/Friday",
  6: "https://schema.org/Saturday",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Returns the ISO datetime string for the next occurrence of a given
 * day-of-week + time (e.g. day=3, time="20:00:00" → next Wednesday at 20:00).
 * If today is that day but the quiz hasn't started yet, returns today.
 * Otherwise returns the next calendar occurrence.
 */
function nextOccurrenceISO(dayOfWeek: number, startTime: string): string {
  const now = new Date();
  const [hStr, mStr] = startTime.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);

  const candidate = new Date(now);
  const currentDay = candidate.getDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;

  if (daysUntil === 0) {
    // Today — check if still upcoming
    const quizToday = new Date(candidate);
    quizToday.setHours(h, m, 0, 0);
    if (quizToday <= now) daysUntil = 7; // already passed, use next week
  }

  candidate.setDate(candidate.getDate() + daysUntil);
  candidate.setHours(h, m, 0, 0);

  // ISO local string without timezone offset (search engines use page timezone signals)
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}` +
    `T${pad(h)}:${pad(m)}:00`
  );
}

function entryFeePounds(entryFee: string): string | null {
  // entryFee is already formatted: "Free", "£2.00", etc.
  if (!entryFee || entryFee === "Free") return "0";
  const match = entryFee.match(/[\d.]+/);
  return match ? match[0] : null;
}

export function buildQuizEventJsonLd(quiz: QuizDetail | Quiz, quizEventId: string): object {
  // Only QuizDetail has the raw day_of_week integer — Quiz has the string name.
  // We need day_of_week for schema and next occurrence; fall back via DAY_NAMES lookup.
  // Since Quiz.day is a formatted string like "Monday", map it back.
  const dayOfWeek: number =
    "day_of_week" in quiz
      ? (quiz as unknown as { day_of_week: number }).day_of_week
      : DAY_NAMES.indexOf(quiz.day);

  const startTime =
    "start_time" in quiz
      ? (quiz as unknown as { start_time: string }).start_time
      : quiz.time; // fallback to formatted time string

  const pageUrl = `${SITE_URL}/find-a-quiz/quiz/${quizEventId}`;
  const nextStart = nextOccurrenceISO(dayOfWeek >= 0 ? dayOfWeek : 0, startTime);

  // Approximate end time: assume 2 hours
  const endDate = new Date(nextStart);
  endDate.setHours(endDate.getHours() + 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextEnd =
    `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}` +
    `T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

  const address: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: "GB",
  };
  if (quiz.address) address.streetAddress = quiz.address;
  if (quiz.postcode) address.postalCode = quiz.postcode;

  const location: Record<string, unknown> = {
    "@type": "Place",
    name: quiz.venueName,
    address,
  };
  if (quiz.lat != null && quiz.lng != null) {
    location.geo = {
      "@type": "GeoCoordinates",
      latitude: quiz.lat,
      longitude: quiz.lng,
    };
  }

  const pricePounds = entryFeePounds(quiz.entryFee);
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    url: pageUrl,
    availability: "https://schema.org/InStock",
    priceCurrency: "GBP",
    price: pricePounds ?? "0",
  };

  const description = `Weekly pub quiz at ${quiz.venueName}${quiz.area ? ` in ${quiz.area}` : ""}. ${quiz.day} at ${quiz.time}. Entry ${quiz.entryFee}. Prize: ${quiz.prize}.`;

  const eventSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `Quiz Night at ${quiz.venueName}`,
    description,
    url: pageUrl,
    startDate: nextStart,
    endDate: nextEnd,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: quiz.entryFee === "Free",
    location,
    offers,
    organizer: {
      "@type": "Organization",
      name: "Quizzer",
      url: SITE_URL,
    },
    // Recurring schedule signal
    eventSchedule: {
      "@type": "Schedule",
      byDay: DAY_SCHEMA[dayOfWeek] ?? "https://schema.org/Monday",
      startTime: startTime.slice(0, 5), // "HH:MM"
      repeatFrequency: "P1W",
    },
  };

  return eventSchema;
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
