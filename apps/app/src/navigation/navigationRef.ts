import { CommonActions, createNavigationContainerRef } from "@react-navigation/native";
import { prefetchQuizEventDetail } from "../lib/quizEventDetailCache";
import type { PlayerTabParamList } from "./RootNavigator";

export const navigationRef = createNavigationContainerRef<PlayerTabParamList>();

const READY_RETRY_MS = 80;
const READY_MAX_ATTEMPTS = 30;

/** Open Saved → Quiz detail. Retries until the container is ready (cold start from notification). */
export function navigateToSavedQuizDetail(quizEventId: string, attempt = 0): void {
  prefetchQuizEventDetail(quizEventId);
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: "Saved",
        params: {
          screen: "QuizDetail",
          params: { quizEventId },
        },
      })
    );
    return;
  }
  if (attempt < READY_MAX_ATTEMPTS) {
    setTimeout(() => navigateToSavedQuizDetail(quizEventId, attempt + 1), READY_RETRY_MS);
  }
}
