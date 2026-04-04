import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "quizzer_tonight_mode";

export async function getTonightMode(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === null) return true;
    return v === "true";
  } catch {
    return true;
  }
}

export async function setTonightMode(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, String(on));
}
