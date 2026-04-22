import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { captureSupabaseError } from "../lib/sentryInit";
import {
  clearInterestQueue,
  deleteInterestOrQueue,
  deleteInterestsOrQueue,
  flushInterestQueue,
  upsertInterestOrQueue,
  upsertInterestsOrQueue,
} from "../lib/quizInterestSyncQueue";

const STORAGE_KEY = "saved_quiz_ids";
const INTEREST_NUDGE_SHOWN_KEY = "interest_nudge_shown";

type SavedQuizzesContextValue = {
  savedIds: string[];
  isSaved: (id: string) => boolean;
  addSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  toggleSaved: (id: string) => void;
  clearSaved: () => void;
  interestSignInSheetVisible: boolean;
  dismissInterestSignInSheet: () => void;
};

const SavedQuizzesContext = createContext<SavedQuizzesContextValue | null>(null);

export function SavedQuizzesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [interestSignInSheetVisible, setInterestSignInSheetVisible] = useState(false);
  /** Prevents stacking multiple opens on repeated saves while the sheet is up; cleared on dismiss or SIGNED_IN. */
  const interestSignInSheetGateRef = useRef(false);

  const savedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    savedIdsRef.current = savedIds;
  }, [savedIds]);

  const mergedRemoteRef = useRef<string | null>(null);

  const dismissInterestSignInSheet = useCallback(() => {
    interestSignInSheetGateRef.current = false;
    setInterestSignInSheetVisible(false);
    void AsyncStorage.setItem(INTEREST_NUDGE_SHOWN_KEY, "1");
  }, []);

  const runFlush = useCallback(async () => {
    if (!hydrated || !session?.user?.id) return;
    await flushInterestQueue({
      sessionUserId: session.user.id,
      savedIds: new Set(savedIdsRef.current),
    });
  }, [hydrated, session?.user?.id]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as string[];
            if (Array.isArray(parsed)) setSavedIds(parsed.filter((x) => typeof x === "string"));
          } catch {
            setSavedIds([]);
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const uid = session?.user?.id;
    if (prevUserIdRef.current && !uid) {
      mergedRemoteRef.current = null;
      void clearInterestQueue();
    }
    prevUserIdRef.current = uid;
  }, [session?.user?.id]);

  useEffect(() => {
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        interestSignInSheetGateRef.current = false;
        void AsyncStorage.removeItem(INTEREST_NUDGE_SHOWN_KEY);
      }
    });
    return () => authSub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated || !session?.user?.id) return;
    const uid = session.user.id;
    let cancelled = false;
    void (async () => {
      try {
        if (cancelled) return;
        await upsertInterestsOrQueue(savedIdsRef.current, uid);
        if (cancelled) return;
        await flushInterestQueue({
          sessionUserId: uid,
          savedIds: new Set(savedIdsRef.current),
        });
        const { data, error } = await supabase
          .from("quiz_event_interests")
          .select("quiz_event_id")
          .eq("user_id", uid);
        if (cancelled) return;
        if (error) {
          captureSupabaseError("saved.interests_by_user", error);
          if (__DEV__) console.warn("quiz_event_interests fetch:", error.message);
          return;
        }
        const remoteIds = (data ?? []).map((r) => r.quiz_event_id).filter((x): x is string => typeof x === "string");
        const key = `${uid}:${remoteIds.slice().sort().join(",")}`;
        if (mergedRemoteRef.current === key) return;
        mergedRemoteRef.current = key;
        setSavedIds((prev) => {
          const next = new Set(prev);
          for (const id of remoteIds) next.add(id);
          return Array.from(next);
        });
      } finally {
        if (!cancelled) void runFlush();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.user?.id, runFlush]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
  }, [savedIds, hydrated]);

  useEffect(() => {
    const onAppState = (s: AppStateStatus) => {
      if (s === "active") void runFlush();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [runFlush]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void runFlush();
    });
    return () => unsub();
  }, [runFlush]);

  const triggerInterestSignInSheetIfNeeded = useCallback(() => {
    if (session?.user?.id) return;
    if (interestSignInSheetGateRef.current) return;
    interestSignInSheetGateRef.current = true;
    void (async () => {
      try {
        if ((await AsyncStorage.getItem(INTEREST_NUDGE_SHOWN_KEY)) === "1") {
          interestSignInSheetGateRef.current = false;
          return;
        }
      } catch {
        interestSignInSheetGateRef.current = false;
        return;
      }
      setInterestSignInSheetVisible(true);
    })();
  }, [session]);

  const savedIdsSet = useMemo(() => new Set(savedIds), [savedIds]);

  const isSaved = useCallback(
    (id: string) => savedIdsSet.has(id),
    [savedIdsSet]
  );

  const addSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      const uid = session?.user?.id;
      if (uid) void upsertInterestOrQueue(id, uid);
      else if (!uid) triggerInterestSignInSheetIfNeeded();
    },
    [session?.user?.id, triggerInterestSignInSheetIfNeeded]
  );

  const removeSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => prev.filter((x) => x !== id));
      if (session?.user?.id) void deleteInterestOrQueue(id);
    },
    [session?.user?.id]
  );

  const toggleSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => {
        const removing = prev.includes(id);
        const next = removing ? prev.filter((x) => x !== id) : [...prev, id];
        const uid = session?.user?.id;
        if (uid) {
          if (removing) void deleteInterestOrQueue(id);
          else void upsertInterestOrQueue(id, uid);
        } else if (!removing && !uid) {
          triggerInterestSignInSheetIfNeeded();
        }
        return next;
      });
    },
    [session?.user?.id, triggerInterestSignInSheetIfNeeded]
  );

  const clearSaved = useCallback(() => {
    setSavedIds((prev) => {
      if (session?.user?.id && prev.length > 0) void deleteInterestsOrQueue(prev);
      return [];
    });
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, [session?.user?.id]);

  const value = useMemo<SavedQuizzesContextValue>(
    () => ({
      savedIds,
      isSaved,
      addSaved,
      removeSaved,
      toggleSaved,
      clearSaved,
      interestSignInSheetVisible,
      dismissInterestSignInSheet,
    }),
    [
      savedIds,
      isSaved,
      addSaved,
      removeSaved,
      toggleSaved,
      clearSaved,
      interestSignInSheetVisible,
      dismissInterestSignInSheet,
    ]
  );

  return <SavedQuizzesContext.Provider value={value}>{children}</SavedQuizzesContext.Provider>;
}

export function useSavedQuizzes(): SavedQuizzesContextValue {
  const ctx = useContext(SavedQuizzesContext);
  if (ctx == null) {
    throw new Error("useSavedQuizzes must be used within SavedQuizzesProvider");
  }
  return ctx;
}
