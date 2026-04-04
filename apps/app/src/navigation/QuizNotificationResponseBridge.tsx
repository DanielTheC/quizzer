import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import type { QuizNotificationData } from "../lib/notifications";
import { navigateToSavedQuizDetail } from "./navigationRef";

function quizIdFromResponse(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as QuizNotificationData | undefined;
  const id = data?.quizEventId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Opens Saved → Quiz detail when the user taps a scheduled quiz notification.
 */
export function QuizNotificationResponseBridge() {
  const consumedLaunchNotification = useRef(false);

  useEffect(() => {
    const navigateIfQuiz = (response: Notifications.NotificationResponse) => {
      const id = quizIdFromResponse(response);
      if (id) navigateToSavedQuizDetail(id);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(navigateIfQuiz);

    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last && !consumedLaunchNotification.current) {
        consumedLaunchNotification.current = true;
        navigateIfQuiz(last);
      }
    });

    return () => sub.remove();
  }, []);

  return null;
}
