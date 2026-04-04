import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const CACHE_KEY_PREFIX = "quiz_pack:";
const LATEST_PACK_ID_KEY = "quiz_pack_latest_id";

export type QuizQuestion = {
  id: string;
  quiz_round_id: string;
  question_number: number;
  question_text: string;
  host_notes: string | null;
  answer: string;
};

export type QuizRound = {
  id: string;
  quiz_pack_id: string;
  round_number: number;
  title: string;
  questions: QuizQuestion[];
};

export type QuizPack = {
  id: string;
  name: string;
  created_at: string;
  rounds: QuizRound[];
};

type QuestionRow = {
  id: string;
  quiz_round_id: string;
  question_number: number;
  question_text: string;
  host_notes: string | null;
  quiz_answers: { answer: string } | { answer: string }[] | null;
};

function answerFromEmbed(rel: QuestionRow["quiz_answers"]): string {
  if (rel == null) return "";
  if (Array.isArray(rel)) return rel[0]?.answer ?? "";
  return rel.answer ?? "";
}

/** Labels for score indices 0–7 (rounds 1–8) and 8 (picture / round 9). Uses pack titles when present. */
export function buildRoundLabelsFromPack(pack: QuizPack | null | undefined): string[] {
  const rounds = pack?.rounds ?? [];
  const byNum = new Map(rounds.map((r) => [r.round_number, String(r.title ?? "").trim()]));
  const labels: string[] = [];
  for (let i = 0; i < 8; i++) {
    const n = i + 1;
    const t = byNum.get(n);
    labels.push(t && t.length > 0 ? t : `Round ${n}`);
  }
  const pic = byNum.get(9);
  labels.push(pic && pic.length > 0 ? pic : "Picture round");
  return labels;
}

export async function fetchLatestPack(): Promise<QuizPack | null> {
  const { data: packs, error } = await supabase
    .from("quiz_packs")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !packs?.length) return null;
  const packMeta = packs[0] as { id: string; name: string; created_at: string };

  const { data: roundsData, error: roundsError } = await supabase
    .from("quiz_rounds")
    .select("id, quiz_pack_id, round_number, title")
    .eq("quiz_pack_id", packMeta.id)
    .order("round_number", { ascending: true });

  if (roundsError || !roundsData?.length) {
    return { ...packMeta, rounds: [] };
  }

  const roundIds = (roundsData as { id: string }[]).map((r) => r.id);
  const { data: questionsData, error: questionsError } = await supabase
    .from("quiz_questions")
    .select("id, quiz_round_id, question_number, question_text, host_notes, quiz_answers(answer)")
    .in("quiz_round_id", roundIds)
    .order("question_number", { ascending: true });

  const raw = (questionsError ? [] : (questionsData ?? [])) as QuestionRow[];
  const questions: QuizQuestion[] = raw.map((row) => ({
    id: row.id,
    quiz_round_id: row.quiz_round_id,
    question_number: row.question_number,
    question_text: row.question_text,
    host_notes: row.host_notes,
    answer: answerFromEmbed(row.quiz_answers),
  }));
  const rounds: QuizRound[] = (roundsData as QuizRound[]).map((r) => ({
    ...r,
    questions: questions.filter((q) => q.quiz_round_id === r.id),
  }));

  const pack: QuizPack = { ...packMeta, rounds };
  await setCachedPack(pack);
  await AsyncStorage.setItem(LATEST_PACK_ID_KEY, pack.id);
  return pack;
}

export async function getCachedPack(packId: string): Promise<QuizPack | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + packId);
    if (!raw) return null;
    return JSON.parse(raw) as QuizPack;
  } catch {
    return null;
  }
}

export async function setCachedPack(pack: QuizPack): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY_PREFIX + pack.id, JSON.stringify(pack));
}

/** Clears cached pack JSON (e.g. on sign-out so answers are not left on device). */
export async function clearPackCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const packKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX) || k === LATEST_PACK_ID_KEY);
  if (packKeys.length > 0) {
    await AsyncStorage.multiRemove(packKeys);
  }
}

/** Get latest pack: from cache if id matches, else fetch and cache. */
export async function getLatestPack(): Promise<QuizPack | null> {
  const cachedId = await AsyncStorage.getItem(LATEST_PACK_ID_KEY);
  if (cachedId) {
    const cached = await getCachedPack(cachedId);
    if (cached) return cached;
  }
  return fetchLatestPack();
}

/** Hardcoded fallback pack when Supabase has no packs (MVP / offline). */
const FALLBACK_PACK: QuizPack = {
  id: "local-fallback",
  name: "Sample Quiz (local)",
  created_at: new Date().toISOString(),
  rounds: [
    {
      id: "r1",
      quiz_pack_id: "local-fallback",
      round_number: 1,
      title: "Round 1",
      questions: [
        { id: "q1", quiz_round_id: "r1", question_number: 1, question_text: "Sample Q1?", host_notes: null, answer: "Answer 1" },
        { id: "q2", quiz_round_id: "r1", question_number: 2, question_text: "Sample Q2?", host_notes: null, answer: "Answer 2" },
        { id: "q3", quiz_round_id: "r1", question_number: 3, question_text: "Sample Q3?", host_notes: null, answer: "Answer 3" },
        { id: "q4", quiz_round_id: "r1", question_number: 4, question_text: "Sample Q4?", host_notes: null, answer: "Answer 4" },
        { id: "q5", quiz_round_id: "r1", question_number: 5, question_text: "Sample Q5?", host_notes: null, answer: "Answer 5" },
      ],
    },
  ],
};

/** Latest pack from Supabase, or local fallback if none. */
export async function getLatestPackOrFallback(): Promise<QuizPack> {
  const pack = await getLatestPack();
  if (pack) return pack;
  await setCachedPack(FALLBACK_PACK);
  await AsyncStorage.setItem(LATEST_PACK_ID_KEY, FALLBACK_PACK.id);
  return FALLBACK_PACK;
}
