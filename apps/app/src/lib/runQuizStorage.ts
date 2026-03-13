import AsyncStorage from "@react-native-async-storage/async-storage";

const RUN_QUIZ_KEY = "run_quiz_state";

/** Persisted state: phase (round flow), teams, scores (halftime + second half), bonus selections, packId, venueId. Restored on Resume so host can continue after app reopen. */
export type RunQuizPhase = "teams" | "halftime" | "bonus" | "second_half" | "results";

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

export async function loadRunQuizState(): Promise<RunQuizState | null> {
  try {
    const raw = await AsyncStorage.getItem(RUN_QUIZ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunQuizState;
    if (!parsed.teams || !Array.isArray(parsed.teams)) return null;
    if (!["teams", "halftime", "bonus", "second_half", "results"].includes(parsed.phase))
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
