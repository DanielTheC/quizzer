import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_ENABLED = "quizzer_notify_enabled";
const KEY_TIME = "quizzer_notify_time";
const KEY_ONLY_WITHIN_MILES = "quizzer_notify_only_within_miles";

export type NotificationPreferences = {
  notifyEnabled: boolean;
  notifyTime: string; // "HH:MM" e.g. "12:00"
  onlyWithinMiles: number | null; // null = no distance filter
};

const DEFAULT_PREFS: NotificationPreferences = {
  notifyEnabled: false,
  notifyTime: "12:00",
  onlyWithinMiles: null,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const [enabled, time, miles] = await Promise.all([
      AsyncStorage.getItem(KEY_ENABLED),
      AsyncStorage.getItem(KEY_TIME),
      AsyncStorage.getItem(KEY_ONLY_WITHIN_MILES),
    ]);
    return {
      notifyEnabled: enabled === "true",
      notifyTime: time && /^\d{1,2}:\d{2}$/.test(time) ? time : DEFAULT_PREFS.notifyTime,
      onlyWithinMiles:
        miles != null && miles !== ""
          ? (() => {
              const n = Number(miles);
              return Number.isFinite(n) && n >= 0 ? n : null;
            })()
          : null,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function setNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const current = await getNotificationPreferences();
  const next = { ...current, ...prefs };
  await Promise.all([
    AsyncStorage.setItem(KEY_ENABLED, String(next.notifyEnabled)),
    AsyncStorage.setItem(KEY_TIME, next.notifyTime),
    AsyncStorage.setItem(
      KEY_ONLY_WITHIN_MILES,
      next.onlyWithinMiles != null ? String(next.onlyWithinMiles) : ""
    ),
  ]);
}
