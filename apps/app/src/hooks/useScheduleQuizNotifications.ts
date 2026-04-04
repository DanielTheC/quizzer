import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { scheduleQuizNotificationsIfEnabled } from "../lib/notifications";

/**
 * Schedules “saved quiz today” local notifications when enabled in Settings.
 * Runs when saved IDs change, on mount, and whenever the app returns to the foreground
 * (so a new calendar day picks up the correct quiz without opening Settings).
 */
export function useScheduleQuizNotifications(): void {
  const { savedIds } = useSavedQuizzes();
  const appState = useRef(AppState.currentState);

  const reschedule = useCallback(() => {
    void scheduleQuizNotificationsIfEnabled(savedIds);
  }, [savedIds]);

  useEffect(() => {
    reschedule();
  }, [reschedule]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        reschedule();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [reschedule]);
}
