import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { captureSupabaseError } from "../lib/sentryInit";

const INTERESTED_OCCURRENCES_STORAGE_KEY = "interested_occurrences_v2";
const INTERESTED_OCCURRENCES_QUEUE_KEY = "interested_occurrences_queue_v2";
const INTEREST_NUDGE_SHOWN_KEY = "interest_nudge_shown";
const MAX_QUEUE_ATTEMPTS = 5;
const INTERESTED_PERSIST_DEBOUNCE_MS = 500;

type QueueOp = {
  kind: "upsert" | "delete";
  quizEventId: string;
  occurrenceDate: string;
  attempts: number;
};

type InterestedOccurrencesContextValue = {
  isInterestedOccurrence: (quizEventId: string, occurrenceDate: string) => boolean;
  primeInterestedOccurrences: (quizEventId: string, occurrenceDates: string[]) => Promise<void>;
  toggleInterestedOccurrence: (
    quizEventId: string,
    occurrenceDate: string
  ) => Promise<{ ok: boolean; interested: boolean }>;
  interestSignInSheetVisible: boolean;
  dismissInterestSignInSheet: () => void;
};

const InterestedOccurrencesContext = createContext<InterestedOccurrencesContextValue | null>(null);

function occKey(quizEventId: string, occurrenceDate: string): string {
  return `${quizEventId}|${occurrenceDate}`;
}

function parseInterestedPayload(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as { v?: number; keys?: unknown } | unknown;
    if (!parsed || typeof parsed !== "object") return new Set();
    const keys = (parsed as { keys?: unknown }).keys;
    if (!Array.isArray(keys)) return new Set();
    return new Set(keys.filter((k): k is string => typeof k === "string" && k.includes("|")));
  } catch {
    return new Set();
  }
}

function parseQueuePayload(raw: string | null): QueueOp[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { v?: number; ops?: unknown } | QueueOp[] | unknown;
    const ops = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { ops?: unknown }).ops)
        ? ((parsed as { ops: unknown[] }).ops as unknown[])
        : [];
    return ops
      .map((op) => {
        if (!op || typeof op !== "object") return null;
        const row = op as Record<string, unknown>;
        const kind = row.kind;
        const quizEventId = row.quizEventId;
        const occurrenceDate = row.occurrenceDate;
        const attempts = Number(row.attempts ?? 0);
        if ((kind !== "upsert" && kind !== "delete") || typeof quizEventId !== "string" || typeof occurrenceDate !== "string") {
          return null;
        }
        return {
          kind,
          quizEventId,
          occurrenceDate,
          attempts: Number.isFinite(attempts) && attempts >= 0 ? attempts : 0,
        } as QueueOp;
      })
      .filter((op): op is QueueOp => op != null);
  } catch {
    return [];
  }
}

async function persistQueue(ops: QueueOp[]): Promise<void> {
  await AsyncStorage.setItem(
    INTERESTED_OCCURRENCES_QUEUE_KEY,
    JSON.stringify({ v: 2, ops })
  );
}

export function InterestedOccurrencesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [interestedKeys, setInterestedKeys] = useState<Set<string>>(new Set());
  const [queueOps, setQueueOps] = useState<QueueOp[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [interestSignInSheetVisible, setInterestSignInSheetVisible] = useState(false);
  const signInSheetGateRef = useRef(false);
  const drainingRef = useRef(false);

  const dismissInterestSignInSheet = useCallback(() => {
    signInSheetGateRef.current = false;
    setInterestSignInSheetVisible(false);
    void AsyncStorage.setItem(INTEREST_NUDGE_SHOWN_KEY, "1");
  }, []);

  const enqueueOp = useCallback((op: Omit<QueueOp, "attempts">) => {
    setQueueOps((prev) => [...prev, { ...op, attempts: 0 }]);
  }, []);

  useEffect(() => {
    void (async () => {
      const [keysRaw, queueRaw] = await Promise.all([
        AsyncStorage.getItem(INTERESTED_OCCURRENCES_STORAGE_KEY),
        AsyncStorage.getItem(INTERESTED_OCCURRENCES_QUEUE_KEY),
      ]);
      setInterestedKeys(parseInterestedPayload(keysRaw));
      setQueueOps(parseQueuePayload(queueRaw));
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      void AsyncStorage.setItem(
        INTERESTED_OCCURRENCES_STORAGE_KEY,
        JSON.stringify({ v: 2, keys: Array.from(interestedKeys) })
      );
    }, INTERESTED_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [interestedKeys, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void persistQueue(queueOps);
  }, [queueOps, hydrated]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => unsub();
  }, []);

  const runSingleOp = useCallback(
    async (op: QueueOp): Promise<{ ok: boolean }> => {
      const userId = session?.user?.id;
      if (!userId) return { ok: false };
      if (op.kind === "upsert") {
        const { error } = await supabase.from("quiz_event_interests").upsert(
          {
            quiz_event_id: op.quizEventId,
            occurrence_date: op.occurrenceDate,
            user_id: userId,
          },
          { onConflict: "quiz_event_id,user_id,occurrence_date" }
        );
        if (error) {
          captureSupabaseError("player.occurrence_interest.queue_upsert", error, {
            quiz_event_id: op.quizEventId,
            occurrence_date: op.occurrenceDate,
            attempts: op.attempts,
          });
          return { ok: false };
        }
        return { ok: true };
      }
      const { error } = await supabase
        .from("quiz_event_interests")
        .delete()
        .eq("quiz_event_id", op.quizEventId)
        .eq("occurrence_date", op.occurrenceDate)
        .eq("user_id", userId);
      if (error) {
        captureSupabaseError("player.occurrence_interest.queue_delete", error, {
          quiz_event_id: op.quizEventId,
          occurrence_date: op.occurrenceDate,
          attempts: op.attempts,
        });
        return { ok: false };
      }
      return { ok: true };
    },
    [session?.user?.id]
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    if (!hydrated || !isOnline || !session?.user?.id) return;
    if (queueOps.length === 0) return;
    drainingRef.current = true;
    try {
      let next = [...queueOps];
      for (let i = 0; i < next.length; i++) {
        const op = next[i];
        const result = await runSingleOp(op);
        if (result.ok) {
          next.splice(i, 1);
          i -= 1;
          continue;
        }
        const bumped = { ...op, attempts: op.attempts + 1 };
        if (bumped.attempts >= MAX_QUEUE_ATTEMPTS) {
          next.splice(i, 1);
          i -= 1;
          continue;
        }
        next[i] = bumped;
      }
      setQueueOps(next);
    } finally {
      drainingRef.current = false;
    }
  }, [hydrated, isOnline, session?.user?.id, queueOps, runSingleOp]);

  useEffect(() => {
    if (!hydrated) return;
    void drainQueue();
  }, [hydrated, isOnline, session?.user?.id, queueOps.length, drainQueue]);

  useEffect(() => {
    const onAppState = (s: AppStateStatus) => {
      if (s === "active") void drainQueue();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [drainQueue]);

  useEffect(() => {
    if (session?.user?.id && interestSignInSheetVisible) {
      signInSheetGateRef.current = false;
      setInterestSignInSheetVisible(false);
    }
  }, [session?.user?.id, interestSignInSheetVisible]);

  const maybeShowInterestSignInSheet = useCallback(async () => {
    if (session?.user?.id) return;
    if (signInSheetGateRef.current) return;
    signInSheetGateRef.current = true;
    const shown = await AsyncStorage.getItem(INTEREST_NUDGE_SHOWN_KEY);
    if (shown === "1") {
      signInSheetGateRef.current = false;
      return;
    }
    setInterestSignInSheetVisible(true);
  }, [session?.user?.id]);

  const isInterestedOccurrence = useCallback(
    (quizEventId: string, occurrenceDate: string) =>
      interestedKeys.has(occKey(quizEventId, occurrenceDate)),
    [interestedKeys]
  );

  const primeInterestedOccurrences = useCallback(
    async (quizEventId: string, occurrenceDates: string[]) => {
      const userId = session?.user?.id;
      if (!userId || !quizEventId || occurrenceDates.length === 0) return;
      const uniqueDates = Array.from(
        new Set(
          occurrenceDates.filter(
            (d): d is string => typeof d === "string" && d.length > 0
          )
        )
      );
      if (uniqueDates.length === 0) return;
      const { data, error } = await supabase
        .from("quiz_event_interests")
        .select("occurrence_date")
        .eq("quiz_event_id", quizEventId)
        .eq("user_id", userId)
        .in("occurrence_date", uniqueDates);
      if (error) {
        captureSupabaseError("player.prime_occurrence_interests", error, {
          quiz_event_id: quizEventId,
        });
        return;
      }
      const targetKeys = new Set(uniqueDates.map((d) => occKey(quizEventId, d)));
      const interested = new Set(
        (data ?? [])
          .map((r) => r.occurrence_date)
          .filter((d): d is string => typeof d === "string")
          .map((d) => occKey(quizEventId, d))
      );
      setInterestedKeys((prev) => {
        const next = new Set(prev);
        for (const key of targetKeys) next.delete(key);
        for (const key of interested) next.add(key);
        return next;
      });
    },
    [session?.user?.id]
  );

  const toggleInterestedOccurrence = useCallback(
    async (quizEventId: string, occurrenceDate: string) => {
      const key = occKey(quizEventId, occurrenceDate);
      const currentlyInterested = interestedKeys.has(key);
      const interested = !currentlyInterested;

      setInterestedKeys((prev) => {
        const next = new Set(prev);
        if (interested) next.add(key);
        else next.delete(key);
        return next;
      });

      const userId = session?.user?.id;
      const writeKind: QueueOp["kind"] = interested ? "upsert" : "delete";
      const enqueue = () => enqueueOp({ kind: writeKind, quizEventId, occurrenceDate });

      if (!userId || !isOnline) {
        enqueue();
        if (!userId) void maybeShowInterestSignInSheet();
        return { ok: true, interested };
      }

      const write = interested
        ? supabase.from("quiz_event_interests").upsert(
            {
              quiz_event_id: quizEventId,
              occurrence_date: occurrenceDate,
              user_id: userId,
            },
            { onConflict: "quiz_event_id,user_id,occurrence_date" }
          )
        : supabase
            .from("quiz_event_interests")
            .delete()
            .eq("quiz_event_id", quizEventId)
            .eq("occurrence_date", occurrenceDate)
            .eq("user_id", userId);

      const { error } = await write;
      if (error) {
        captureSupabaseError("player.occurrence_interest.toggle", error, {
          quiz_event_id: quizEventId,
          occurrence_date: occurrenceDate,
          kind: writeKind,
        });
        enqueue();
        return { ok: false, interested };
      }
      return { ok: true, interested };
    },
    [interestedKeys, session?.user?.id, isOnline, enqueueOp, maybeShowInterestSignInSheet]
  );

  const value = useMemo<InterestedOccurrencesContextValue>(
    () => ({
      isInterestedOccurrence,
      primeInterestedOccurrences,
      toggleInterestedOccurrence,
      interestSignInSheetVisible,
      dismissInterestSignInSheet,
    }),
    [
      isInterestedOccurrence,
      primeInterestedOccurrences,
      toggleInterestedOccurrence,
      interestSignInSheetVisible,
      dismissInterestSignInSheet,
    ]
  );

  return (
    <InterestedOccurrencesContext.Provider value={value}>
      {children}
    </InterestedOccurrencesContext.Provider>
  );
}

export function useInterestedOccurrences(): InterestedOccurrencesContextValue {
  const ctx = useContext(InterestedOccurrencesContext);
  if (!ctx) {
    throw new Error(
      "useInterestedOccurrences must be used within InterestedOccurrencesProvider"
    );
  }
  return ctx;
}
