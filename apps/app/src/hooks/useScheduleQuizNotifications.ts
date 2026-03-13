import { useEffect, useRef } from "react";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { scheduleQuizNotificationsIfEnabled } from "../lib/notifications";

/**
 * Schedules "quiz tonight" notifications when enabled and saved quizzes exist for today.
 * Runs on mount and whenever savedIds change. Only Quizzer notifications are rescheduled (previous ones cancelled first).
 */
export function useScheduleQuizNotifications(): void {
  const { savedIds } = useSavedQuizzes();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    scheduleQuizNotificationsIfEnabled(savedIds).catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [savedIds]);
}
