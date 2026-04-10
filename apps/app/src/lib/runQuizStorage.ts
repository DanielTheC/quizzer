import AsyncStorage from "@react-native-async-storage/async-storage";

const RUN_QUIZ_KEY = "run_quiz_state";
/** @deprecated Legacy tally; superseded by {@link HOST_SESSION_HISTORY_KEY}. Migrated on first read. */
const HOST_COMPLETED_QUIZ_SESSIONS_COUNT_KEY = "host_completed_quiz_sessions_count";
const HOST_SESSION_HISTORY_KEY = "host_completed_session_history";
const MAX_HOST_SESSION_HISTORY = 200;

/** One finished quiz night (persisted when the host ends from Results). */
export type HostCompletedSessionRecord = {
  completedAt: number;
  venueId: string | null;
  packId: string | null;
};

/** Persisted state: phase (round flow), teams, scores (halftime + second half), bonus selections, packId, venueId. Restored on Resume so host can continue after app reopen. */
export type RunQuizPhase =
  | "teams"
  | "bonus"
  | "halftime"
  | "halftime_leaderboard"
  | "second_half"
  | "results";

export type RunQuizTeam = {
  id: string;
  name: string;
  /** Head count at the table (digits only in UI). */
  playerCount: string;
  bonusRound: number | null; // 1-8, null until set
  scores: number[]; // [r1..r8, picture] length 9
};

export type RunQuizState = {
  phase: RunQuizPhase;
  teams: RunQuizTeam[];
  createdAt: number;
  /** true after host continues from bonus to second half; bonus round cannot be changed after that */
  bonusLocked: boolean;
  /** id of quiz pack for this run (for viewing questions/answers) */
  packId: string | null;
  /** id of venue for this run (from Host Setup) */
  venueId: string | null;
};

export const DEFAULT_STATE: RunQuizState = {
  phase: "teams",
  teams: [],
  createdAt: Date.now(),
  bonusLocked: false,
  packId: null,
  venueId: null,
};

export function getEmptyScores(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 8 rounds + picture
}

export function createTeam(id: string, name: string, playerCount: string = ""): RunQuizTeam {
  return {
    id,
    name,
    playerCount,
    bonusRound: null,
    scores: getEmptyScores(),
  };
}

/** Shown in lists when the host has not typed a name yet (input uses placeholder only). */
export function getTeamDisplayName(team: RunQuizTeam, indexZeroBased: number): string {
  const n = team.name?.trim();
  if (n) return n;
  return `Team ${indexZeroBased + 1}`;
}

/** Round 9 = picture round; never doubled. Only rounds 1–8 can be bonus. */
export function totalWithBonus(team: RunQuizTeam): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const roundNum = i < 8 ? i + 1 : 9; // 1–8 = rounds, 9 = picture (no bonus)
    const value = team.scores[i] ?? 0;
    sum += team.bonusRound === roundNum ? value * 2 : value;
  }
  return sum;
}

/** Halftime total: rounds 1–4 only, with bonus doubling if their double is R1–R4. */
export function halftimeTotalWithBonus(team: RunQuizTeam): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const roundNum = i + 1;
    const value = team.scores[i] ?? 0;
    sum += team.bonusRound === roundNum ? value * 2 : value;
  }
  return sum;
}

export type BonusAppliedContext = "halftime" | "final";

/** For leaderboard copy: has the double affected the current total yet? */
export function getBonusAppliedState(
  team: RunQuizTeam,
  context: BonusAppliedContext,
  roundTitle?: (round1to8: number) => string | null
): { applied: boolean; headline: string; detail: string } {
  const br = team.bonusRound;
  if (br == null || br < 1 || br > 8) {
    return {
      applied: false,
      headline: "No double",
      detail: "No bonus round chosen.",
    };
  }
  const label = roundTitle?.(br)?.trim();
  const roundBit = label ? `R${br} · ${label}` : `R${br}`;
  if (context === "halftime") {
    if (br <= 4) {
      return {
        applied: true,
        headline: "Double applied",
        detail: `${roundBit} is doubled in this halftime total.`,
      };
    }
    return {
      applied: false,
      headline: "Double pending",
      detail: `${roundBit} doubles in the second half — not in this total yet.`,
    };
  }
  return {
    applied: true,
    headline: "Double applied",
    detail: `${roundBit} was doubled in the final total.`,
  };
}

export async function loadRunQuizState(): Promise<RunQuizState | null> {
  try {
    const raw = await AsyncStorage.getItem(RUN_QUIZ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunQuizState;
    if (!parsed.teams || !Array.isArray(parsed.teams)) return null;
    if (
      ![
        "teams",
        "bonus",
        "halftime",
        "halftime_leaderboard",
        "second_half",
        "results",
      ].includes(parsed.phase)
    )
      return null;
    parsed.teams = parsed.teams.map((t) => {
      const row = t as RunQuizTeam & { tableNumber?: string };
      const playerCount =
        typeof row.playerCount === "string" && row.playerCount.length > 0
          ? row.playerCount
          : typeof row.tableNumber === "string"
            ? row.tableNumber
            : "";
      return {
        id: row.id,
        name: typeof row.name === "string" ? row.name : "",
        playerCount,
        bonusRound: row.bonusRound != null && row.bonusRound >= 1 && row.bonusRound <= 8 ? row.bonusRound : null,
        scores: Array.isArray(row.scores) && row.scores.length >= 9 ? row.scores.slice(0, 9) : getEmptyScores(),
      };
    });
    if (typeof parsed.bonusLocked !== "boolean") parsed.bonusLocked = false;
    if (parsed.packId !== undefined && typeof parsed.packId !== "string") parsed.packId = null;
    if (parsed.packId === undefined) parsed.packId = null;
    if (parsed.venueId !== undefined && typeof parsed.venueId !== "string") parsed.venueId = null;
    if (parsed.venueId === undefined) parsed.venueId = null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRunQuizState(state: RunQuizState): Promise<void> {
  await AsyncStorage.setItem(RUN_QUIZ_KEY, JSON.stringify(state));
}

export async function clearRunQuizState(): Promise<void> {
  await AsyncStorage.removeItem(RUN_QUIZ_KEY);
}

async function readLegacyCompletedCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(HOST_COMPLETED_QUIZ_SESSIONS_COUNT_KEY);
    if (raw == null || raw === "") return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function normalizeHistoryPayload(raw: string): HostCompletedSessionRecord[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: HostCompletedSessionRecord[] = [];
    for (const row of parsed) {
      if (row == null || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const completedAt = typeof o.completedAt === "number" ? o.completedAt : Number(o.completedAt);
      if (!Number.isFinite(completedAt)) continue;
      out.push({
        completedAt,
        venueId: typeof o.venueId === "string" ? o.venueId : null,
        packId: typeof o.packId === "string" ? o.packId : null,
      });
    }
    return out.sort((a, b) => b.completedAt - a.completedAt);
  } catch {
    return [];
  }
}

/**
 * Completed quiz nights (newest first). Migrates legacy numeric count into stub rows once if needed.
 */
export async function getHostSessionHistory(): Promise<HostCompletedSessionRecord[]> {
  try {
    let raw = await AsyncStorage.getItem(HOST_SESSION_HISTORY_KEY);
    if (!raw) {
      const legacy = await readLegacyCompletedCount();
      if (legacy > 0) {
        const stub: HostCompletedSessionRecord[] = Array.from({ length: legacy }, (_, i) => ({
          completedAt: Date.now() - (legacy - i) * 3_600_000,
          venueId: null,
          packId: null,
        }));
        await AsyncStorage.setItem(HOST_SESSION_HISTORY_KEY, JSON.stringify(stub));
        await AsyncStorage.removeItem(HOST_COMPLETED_QUIZ_SESSIONS_COUNT_KEY);
        raw = JSON.stringify(stub);
      } else {
        return [];
      }
    }
    return normalizeHistoryPayload(raw);
  } catch {
    return [];
  }
}

/** Total completed sessions (same length as {@link getHostSessionHistory} after migration). */
export async function getHostCompletedQuizSessionsCount(): Promise<number> {
  const history = await getHostSessionHistory();
  return history.length;
}

/** Call when a hosted quiz night is completed (e.g. cleared from Results). */
export async function recordHostCompletedSession(args: {
  venueId: string | null;
  packId: string | null;
  completedAt?: number;
}): Promise<void> {
  const existing = await getHostSessionHistory();
  const entry: HostCompletedSessionRecord = {
    completedAt: args.completedAt ?? Date.now(),
    venueId: args.venueId,
    packId: args.packId,
  };
  const next = [entry, ...existing].slice(0, MAX_HOST_SESSION_HISTORY);
  await AsyncStorage.setItem(HOST_SESSION_HISTORY_KEY, JSON.stringify(next));
  await AsyncStorage.removeItem(HOST_COMPLETED_QUIZ_SESSIONS_COUNT_KEY);
}
