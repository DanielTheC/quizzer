import { Platform } from "react-native";

type HapticsMod = typeof import("expo-haptics");

let cached: HapticsMod | null | undefined;
function getHaptics(): HapticsMod | null {
  if (Platform.OS === "web") return null;
  if (cached === undefined) {
    try {
      cached = require("expo-haptics") as HapticsMod;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function hapticLight(): void {
  const H = getHaptics();
  if (H) void H.impactAsync(H.ImpactFeedbackStyle.Light);
}

export function hapticMedium(): void {
  const H = getHaptics();
  if (H) void H.impactAsync(H.ImpactFeedbackStyle.Medium);
}

export function hapticSavedQuiz(): void {
  const H = getHaptics();
  if (H) void H.notificationAsync(H.NotificationFeedbackType.Success);
}

export function hapticRefreshDone(): void {
  hapticLight();
}
