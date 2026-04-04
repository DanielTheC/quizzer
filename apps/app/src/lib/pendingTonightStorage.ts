import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "quizzer_pending_tonight_nearby";

/** Call before switching to the Nearby tab so list opens in Tonight mode. */
export async function setPendingTonightOnNearby(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}

/** If set, clear the flag and return true (Nearby should turn on Tonight). */
export async function consumePendingTonightOnNearby(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  if (v !== "1") return false;
  await AsyncStorage.removeItem(KEY);
  return true;
}
