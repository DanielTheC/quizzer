import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { captureSupabaseError } from "../lib/sentryInit";

type InterestedOccurrencesContextValue = {
  isInterestedOccurrence: (quizEventId: string, occurrenceDate: string) => boolean;
  primeInterestedOccurrences: (quizEventId: string, occurrenceDates: string[]) => Promise<void>;
  toggleInterestedOccurrence: (
    quizEventId: string,
    occurrenceDate: string
  ) => Promise<{ ok: boolean; interested: boolean }>;
};

const InterestedOccurrencesContext = createContext<InterestedOccurrencesContextValue | null>(null);

function occKey(quizEventId: string, occurrenceDate: string): string {
  return `${quizEventId}|${occurrenceDate}`;
}

export function InterestedOccurrencesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [interestedKeys, setInterestedKeys] = useState<Set<string>>(new Set());

  const isInterestedOccurrence = useCallback(
    (quizEventId: string, occurrenceDate: string) => interestedKeys.has(occKey(quizEventId, occurrenceDate)),
    [interestedKeys]
  );

  const primeInterestedOccurrences = useCallback(
    async (quizEventId: string, occurrenceDates: string[]) => {
      const userId = session?.user?.id;
      if (!userId || !quizEventId || occurrenceDates.length === 0) return;
      const uniqueDates = Array.from(
        new Set(occurrenceDates.filter((d): d is string => typeof d === "string" && d.length > 0))
      );
      if (uniqueDates.length === 0) return;
      const { data, error } = await supabase
        .from("quiz_event_interests")
        .select("occurrence_date")
        .eq("quiz_event_id", quizEventId)
        .eq("user_id", userId)
        .in("occurrence_date", uniqueDates);
      if (error) {
        captureSupabaseError("player.prime_occurrence_interests", error, { quiz_event_id: quizEventId });
        return;
      }
      const nextKeys = new Set(uniqueDates.map((d) => occKey(quizEventId, d)));
      const interested = new Set(
        (data ?? [])
          .map((r) => r.occurrence_date)
          .filter((d): d is string => typeof d === "string")
          .map((d) => occKey(quizEventId, d))
      );
      setInterestedKeys((prev) => {
        const merged = new Set(prev);
        for (const k of nextKeys) merged.delete(k);
        for (const k of interested) merged.add(k);
        return merged;
      });
    },
    [session?.user?.id]
  );

  const toggleInterestedOccurrence = useCallback(
    async (quizEventId: string, occurrenceDate: string) => {
      const userId = session?.user?.id;
      const key = occKey(quizEventId, occurrenceDate);
      if (!userId) return { ok: false, interested: false };
      const currentlyInterested = interestedKeys.has(key);
      if (currentlyInterested) {
        const { error } = await supabase
          .from("quiz_event_interests")
          .delete()
          .eq("quiz_event_id", quizEventId)
          .eq("occurrence_date", occurrenceDate)
          .eq("user_id", userId);
        if (error) {
          captureSupabaseError("player.occurrence_interest.delete", error, {
            quiz_event_id: quizEventId,
            occurrence_date: occurrenceDate,
          });
          return { ok: false, interested: true };
        }
        setInterestedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return { ok: true, interested: false };
      }
      const { error } = await supabase.from("quiz_event_interests").upsert(
        {
          quiz_event_id: quizEventId,
          occurrence_date: occurrenceDate,
          user_id: userId,
        },
        { onConflict: "quiz_event_id,user_id,occurrence_date" }
      );
      if (error) {
        captureSupabaseError("player.occurrence_interest.upsert", error, {
          quiz_event_id: quizEventId,
          occurrence_date: occurrenceDate,
        });
        return { ok: false, interested: false };
      }
      setInterestedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      return { ok: true, interested: true };
    },
    [interestedKeys, session?.user?.id]
  );

  const value = useMemo<InterestedOccurrencesContextValue>(
    () => ({
      isInterestedOccurrence,
      primeInterestedOccurrences,
      toggleInterestedOccurrence,
    }),
    [isInterestedOccurrence, primeInterestedOccurrences, toggleInterestedOccurrence]
  );

  return <InterestedOccurrencesContext.Provider value={value}>{children}</InterestedOccurrencesContext.Provider>;
}

export function useInterestedOccurrences(): InterestedOccurrencesContextValue {
  const ctx = useContext(InterestedOccurrencesContext);
  if (!ctx) {
    throw new Error("useInterestedOccurrences must be used within InterestedOccurrencesProvider");
  }
  return ctx;
}
