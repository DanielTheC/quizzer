import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "quizzer_sort_mode";

export type SortMode = "soonest" | "distance" | "entry_fee";

const VALID: SortMode[] = ["soonest", "distance", "entry_fee"];

export async function getSortMode(): Promise<SortMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v && VALID.includes(v as SortMode)) return v as SortMode;
  } catch {}
  return "distance";
}

export async function setSortMode(mode: SortMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
