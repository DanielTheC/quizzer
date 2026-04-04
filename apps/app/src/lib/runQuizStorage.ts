import AsyncStorage from "@react-native-async-storage/async-storage";

const RUN_QUIZ_KEY = "run_quiz_state";

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
  tableNumber: string;
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

export function createTeam(id: string, name: string, tableNumber: string = ""): RunQuizTeam {
  return {
    id,
    name,
    tableNumber,
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
    parsed.teams = parsed.teams.map((t) => ({
      ...t,
      scores: Array.isArray(t.scores) && t.scores.length >= 9 ? t.scores.slice(0, 9) : getEmptyScores(),
      bonusRound: t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8 ? t.bonusRound : null,
    }));
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
