/**
 * Local scheduled quiz reminders. For **operator / publican broadcasts** to interested players, the backend uses
 * `push_tokens` in Supabase (see migration 20260409100000_push_tokens.sql): the app should upsert the Expo push
 * token there when the user enables notifications so `/portal` “notify attendees” can reach devices.
 */
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { getNotificationPreferences } from "./notificationPreferences";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const QUIZZER_CHANNEL_ID = "quizzer-quiz-reminders";
const QUIZZER_IDENTIFIER_PREFIX = "quizzer-quiz-";

/** Payload for handling taps (see `navigateToSavedQuizDetail`). */
export type QuizNotificationData = {
  quizEventId?: string;
};

export type ScheduleOptions = {
  notifyTime: string; // "HH:MM"
  onlyWithinMiles: number | null;
  userLatLng?: { lat: number; lng: number } | null;
};

function formatTime(time: string): string {
  const s = String(time);
  if (s.length >= 5) return s.slice(0, 5);
  if (s.length >= 2) return `${s.slice(0, 2)}:${s.slice(2)}`;
  return s;
}

function prizeLabel(prize: string): string {
  if (!prize) return "—";
  return prize.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Request notification permission. Resolves to true if granted. */
export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Cancel all notifications we scheduled (same identifier prefix). */
export async function cancelAllQuizzerNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((n) => String(n.identifier).startsWith(QUIZZER_IDENTIFIER_PREFIX));
  await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(String(n.identifier))));
}

/** Ensure Android channel exists (call before scheduling). */
async function ensureChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(QUIZZER_CHANNEL_ID, {
      name: "Quiz reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

type QuizRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  host_cancelled_at: string | null;
  venues: { name: string } | null;
};

function androidChannel(): { channelId: string } | undefined {
  return Platform.OS === "android" ? { channelId: QUIZZER_CHANNEL_ID } : undefined;
}

/**
 * Fetch saved quiz events from Supabase, filter to today (local day_of_week),
 * optionally by distance, then schedule up to 3 notifications at notifyTime.
 * Call cancelAllQuizzerNotifications() first to avoid duplicates.
 */
export async function scheduleTodaysQuizNotifications(
  savedQuizIds: string[],
  options: ScheduleOptions
): Promise<void> {
  await cancelAllQuizzerNotifications();
  if (savedQuizIds.length === 0) return;

  const today = new Date().getDay(); // 0 = Sun, 6 = Sat
  const { data, error } = await supabase
    .from("quiz_events")
    .select("id, day_of_week, start_time, entry_fee_pence, prize, host_cancelled_at, venues ( name )")
    .in("id", savedQuizIds)
    .eq("is_active", true)
    .eq("day_of_week", today)
    .is("host_cancelled_at", null);

  if (error || !data?.length) return;

  let events = data as unknown as QuizRow[];

  if (
    options.onlyWithinMiles != null &&
    options.onlyWithinMiles > 0 &&
    options.userLatLng &&
    events.length > 0
  ) {
    const { haversineMiles } = await import("./haversine");
    const { data: withVenues } = await supabase
      .from("quiz_events")
      .select("id, venues ( lat, lng )")
      .in("id", events.map((e) => e.id));
    type VenueRow = { id: string; venues: { lat: number | null; lng: number | null } | null };
    const withCoords = (withVenues ?? []) as unknown as VenueRow[];
    const byId = new Map(withCoords.map((r) => [r.id, r.venues]));
    events = events.filter((e) => {
      const v = byId.get(e.id);
      const lat = v?.lat;
      const lng = v?.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return true;
      const miles = haversineMiles(options.userLatLng!.lat, options.userLatLng!.lng, lat, lng);
      return miles <= options.onlyWithinMiles!;
    });
  }

  if (events.length === 0) return;

  await ensureChannel();

  const [h, m] = options.notifyTime.split(":").map(Number);
  const triggerDate = new Date();
  triggerDate.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) {
    return;
  }

  const android = androidChannel();

  if (events.length === 1) {
    const e = events[0];
    const venue = e.venues?.name ?? "Quiz";
    const fee =
      e.entry_fee_pence == null
        ? "—"
        : e.entry_fee_pence === 0
          ? "Free"
          : `£${(e.entry_fee_pence / 100).toFixed(2)}`;
    const body = `${venue} at ${formatTime(e.start_time)}. Entry ${fee}. Prize: ${prizeLabel(e.prize ?? "")}. Tap to open.`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Saved quiz today",
        body,
        data: { quizEventId: e.id } satisfies QuizNotificationData,
        ...(android ? { android } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      identifier: `${QUIZZER_IDENTIFIER_PREFIX}${e.id}`,
    });
    return;
  }

  const sorted = [...events].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  const toNotify = sorted.slice(0, 3);
  const summaryBody =
    toNotify.length === events.length
      ? `${events.length} saved quizzes today. Tap to pick one from Saved.`
      : `${toNotify.length} saved quizzes today (soonest first). Tap to open Saved.`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Saved quizzes today",
      body: summaryBody,
      data: { quizEventId: sorted[0]?.id } satisfies QuizNotificationData,
      ...(android ? { android } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    identifier: `${QUIZZER_IDENTIFIER_PREFIX}summary`,
  });
}

/**
 * If notifications are enabled, schedule today's quiz reminders; otherwise cancel all.
 * Call on app launch and when saved list or notification settings change.
 */
export async function scheduleQuizNotificationsIfEnabled(savedIds: string[]): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.notifyEnabled) {
    await cancelAllQuizzerNotifications();
    return;
  }
  let userLatLng: { lat: number; lng: number } | null = null;
  if (prefs.onlyWithinMiles != null && prefs.onlyWithinMiles > 0) {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        userLatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
    } catch {
      // ignore
    }
  }
  await scheduleTodaysQuizNotifications(savedIds, {
    notifyTime: prefs.notifyTime,
    onlyWithinMiles: prefs.onlyWithinMiles,
    userLatLng,
  });
  await syncExpoPushTokenIfNeeded();
}

/**
 * Upserts the device Expo push token into `push_tokens` so Edge Functions can reach this user.
 * Safe to call whenever notifications are enabled; no-ops without session or permission.
 */
export async function syncExpoPushTokenIfNeeded(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user?.id) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  try {
    const expoExtra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId =
      expoExtra?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = expoToken.data;
    if (!token || typeof token !== "string") return;

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
    if (error) {
      console.warn("push_tokens upsert:", error.message);
    }
  } catch (e) {
    console.warn("Expo push token:", e);
  }
}
