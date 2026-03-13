import AsyncStorage from "@react-native-async-storage/async-storage";

const QUIZZER_ROLE_KEY = "quizzer_role";

export type QuizzerRole = "player" | "host";

export async function getStoredRole(): Promise<QuizzerRole | null> {
  try {
    const value = await AsyncStorage.getItem(QUIZZER_ROLE_KEY);
    if (value === "player" || value === "host") return value;
    return null;
  } catch {
    return null;
  }
}

export async function setStoredRole(role: QuizzerRole): Promise<void> {
  await AsyncStorage.setItem(QUIZZER_ROLE_KEY, role);
}

export async function clearStoredRole(): Promise<void> {
  await AsyncStorage.removeItem(QUIZZER_ROLE_KEY);
}
