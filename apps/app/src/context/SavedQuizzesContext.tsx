import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "saved_quiz_ids";

type SavedQuizzesContextValue = {
  savedIds: string[];
  isSaved: (id: string) => boolean;
  addSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  toggleSaved: (id: string) => void;
  clearSaved: () => void;
};

const SavedQuizzesContext = createContext<SavedQuizzesContextValue | null>(null);

export function SavedQuizzesProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
  }, [savedIds, hydrated]);

  const savedIdsSet = useMemo(() => new Set(savedIds), [savedIds]);

  const isSaved = useCallback(
    (id: string) => savedIdsSet.has(id),
    [savedIdsSet]
  );

  const addSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    []
  );

  const removeSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => prev.filter((x) => x !== id));
    },
    []
  );

  const toggleSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => {
        const removing = prev.includes(id);
        return removing ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    []
  );

  const clearSaved = useCallback(() => {
    setSavedIds([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<SavedQuizzesContextValue>(
    () => ({
      savedIds,
      isSaved,
      addSaved,
      removeSaved,
      toggleSaved,
      clearSaved,
    }),
    [
      savedIds,
      isSaved,
      addSaved,
      removeSaved,
      toggleSaved,
      clearSaved,
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
