import { useScheduleQuizNotifications } from "../hooks/useScheduleQuizNotifications";

/** Mount under player `NavigationContainer` so reminders reschedule without opening Settings. */
export function PlayerQuizNotificationsScheduler() {
  useScheduleQuizNotifications();
  return null;
}
