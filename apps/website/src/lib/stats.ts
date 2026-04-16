import { getSupabaseSafe } from "./supabase";
import { getCities } from "./quizzes";

export type SiteStats = {
  quizCount: number;
  cityCount: number;
  teamCount: number;
  venueCount: number;
};

/**
 * Format a raw count into a marketing-friendly display string.
 * 0       → "—"
 * 1–99    → "47+"
 * 100–999 → "230+"   (rounded down to nearest 10)
 * 1000+   → "1.5k+"  (rounded down to nearest 100)
 */
function formatStat(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}+`;
}

/**
 * Fetch live counts from Supabase.
 * Returns null on any error so callers can fall back to defaults.
 */
export async function fetchSiteStats(): Promise<SiteStats | null> {
  const supabase = getSupabaseSafe();
  if (!supabase) return null;

  try {
    const [quizRes, venueRes, teamsRes, cities] = await Promise.all([
      // Active quiz events
      supabase
        .from("quiz_events")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      // Venues that have at least one active quiz
      supabase
        .from("quiz_events")
        .select("venue_id", { count: "exact", head: true })
        .eq("is_active", true)
        .not("venue_id", "is", null),

      // Total teams recorded across all host sessions
      supabase.from("host_quiz_sessions").select("team_count"),

      // Cities derived from the same venue logic used elsewhere
      getCities().catch(() => []),
    ]);

    if (quizRes.error || venueRes.error || teamsRes.error) return null;

    const quizCount = quizRes.count ?? 0;

    // venue_id is not DISTINCT in the count above — get unique count from data
    // Use a separate query for distinct venue count
    const distinctVenueRes = await supabase
      .from("quiz_events")
      .select("venue_id")
      .eq("is_active", true)
      .not("venue_id", "is", null);

    const venueCount = distinctVenueRes.data
      ? new Set(distinctVenueRes.data.map((r: { venue_id: string }) => r.venue_id)).size
      : 0;

    const teamCount = (teamsRes.data ?? []).reduce(
      (sum: number, row: { team_count: number | null }) => sum + (row.team_count ?? 0),
      0
    );

    const cityCount = cities.length;

    return { quizCount, cityCount, teamCount, venueCount };
  } catch {
    return null;
  }
}

/**
 * Returns stat items in the same shape as DEFAULT_STATS / Sanity statItems.
 * Falls back to the provided defaults if live data is unavailable or all zeros.
 */
export async function buildStatItems(
  defaults: Array<{ value: string; label: string }>
): Promise<Array<{ value: string; label: string }>> {
  const stats = await fetchSiteStats();

  // If fetch failed or all counts are zero (pre-launch), use defaults
  if (!stats || (stats.quizCount === 0 && stats.venueCount === 0)) {
    return defaults;
  }

  return [
    { value: formatStat(stats.quizCount), label: "Quizzes listed" },
    { value: stats.cityCount > 0 ? String(stats.cityCount) : defaults[1]?.value ?? "—", label: "Cities live" },
    { value: stats.teamCount > 0 ? formatStat(stats.teamCount) : defaults[2]?.value ?? "—", label: "Teams playing" },
    { value: formatStat(stats.venueCount), label: "Pubs partnered" },
  ];
}
