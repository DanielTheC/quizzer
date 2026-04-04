import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export const INTEREST_SYNC_QUEUE_KEY = "quiz_interest_sync_queue";

export type InterestQueueOp =
  | { kind: "upsert"; quizEventId: string; userId: string }
  | { kind: "delete"; quizEventId: string };

type StoredQueue = { v: 1; ops: InterestQueueOp[] };

function parseQueue(raw: string | null): InterestQueueOp[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredQueue | InterestQueueOp[] | unknown;
    if (Array.isArray(parsed)) return parsed.filter(isOp);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as StoredQueue).ops)) {
      return ((parsed as StoredQueue).ops as unknown[]).filter(isOp);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function isOp(x: unknown): x is InterestQueueOp {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.kind === "upsert" && typeof o.quizEventId === "string" && typeof o.userId === "string") return true;
  if (o.kind === "delete" && typeof o.quizEventId === "string") return true;
  return false;
}

export async function loadInterestQueue(): Promise<InterestQueueOp[]> {
  const raw = await AsyncStorage.getItem(INTEREST_SYNC_QUEUE_KEY);
  return parseQueue(raw);
}

export async function saveInterestQueue(ops: InterestQueueOp[]): Promise<void> {
  const payload: StoredQueue = { v: 1, ops };
  await AsyncStorage.setItem(INTEREST_SYNC_QUEUE_KEY, JSON.stringify(payload));
}

export async function appendInterestQueue(op: InterestQueueOp): Promise<void> {
  const ops = await loadInterestQueue();
  ops.push(op);
  await saveInterestQueue(ops);
}

async function runUpsert(quizEventId: string, userId: string): Promise<Error | null> {
  const { error } = await supabase.from("quiz_event_interests").upsert(
    { quiz_event_id: quizEventId, user_id: userId },
    { onConflict: "quiz_event_id,user_id" }
  );
  return error ?? null;
}

async function runDelete(quizEventId: string): Promise<Error | null> {
  const { error } = await supabase.from("quiz_event_interests").delete().eq("quiz_event_id", quizEventId);
  return error ?? null;
}

/**
 * Drain queued interest ops. Skips ops that no longer match local saved state.
 * Stops at first failure and persists the remaining tail (including the failed op).
 */
export async function flushInterestQueue(opts: {
  sessionUserId: string;
  savedIds: Set<string>;
}): Promise<void> {
  const ops = await loadInterestQueue();
  if (ops.length === 0) return;

  let i = 0;
  for (; i < ops.length; i++) {
    const op = ops[i];
    if (op.kind === "upsert") {
      if (op.userId !== opts.sessionUserId) continue;
      if (!opts.savedIds.has(op.quizEventId)) continue;
      const err = await runUpsert(op.quizEventId, op.userId);
      if (err) {
        await saveInterestQueue(ops.slice(i));
        return;
      }
    } else {
      if (opts.savedIds.has(op.quizEventId)) continue;
      const err = await runDelete(op.quizEventId);
      if (err) {
        await saveInterestQueue(ops.slice(i));
        return;
      }
    }
  }
  await saveInterestQueue([]);
}

/** Immediate remote upsert; on failure appends to queue (caller verifies session). */
export async function upsertInterestOrQueue(quizEventId: string, userId: string): Promise<void> {
  const err = await runUpsert(quizEventId, userId);
  if (err) {
    console.warn("quiz_event_interests upsert (queued):", err.message);
    await appendInterestQueue({ kind: "upsert", quizEventId, userId });
  }
}

/** Immediate remote delete; on failure appends to queue. */
export async function deleteInterestOrQueue(quizEventId: string): Promise<void> {
  const err = await runDelete(quizEventId);
  if (err) {
    console.warn("quiz_event_interests delete (queued):", err.message);
    await appendInterestQueue({ kind: "delete", quizEventId });
  }
}

/** Bulk delete; on failure enqueue per-id deletes (idempotent if some already removed). */
export async function deleteInterestsOrQueue(quizEventIds: string[]): Promise<void> {
  if (quizEventIds.length === 0) return;
  const { error } = await supabase.from("quiz_event_interests").delete().in("quiz_event_id", quizEventIds);
  if (error) {
    console.warn("quiz_event_interests bulk delete (queued):", error.message);
    for (const quizEventId of quizEventIds) {
      await appendInterestQueue({ kind: "delete", quizEventId });
    }
  }
}

export async function clearInterestQueue(): Promise<void> {
  await AsyncStorage.removeItem(INTEREST_SYNC_QUEUE_KEY);
}
