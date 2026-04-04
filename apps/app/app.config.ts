import "dotenv/config";
import type { ExpoConfig } from "expo/config";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  userInterfaceStyle: "light",
  plugins: [
    ...(config.plugins ?? []),
    "expo-web-browser",
    [
      "expo-notifications",
      {
        defaultChannel: "quizzer-quiz-reminders",
      },
    ],
  ],
  scheme: "quizzer",
  ios: {
    ...config.ios,
    bundleIdentifier: "uk.co.quizzerapp",
    infoPlist: {
      ...(config.ios as { infoPlist?: Record<string, string> })?.infoPlist,
      NSLocationWhenInUseUsageDescription:
        "Used to show distance to quiz venues and filter by radius.",
    },
  },
  android: {
    ...config.android,
    /** Application ID / manifest package — use this in Google Cloud “Android” OAuth or Play Console. */
    package: "uk.co.quizzerapp",
    config: {
      ...(config.android as { config?: Record<string, unknown> })?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? "",
      },
    },
    permissions: [
      ...((config.android as { permissions?: string[] })?.permissions ?? []),
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
    ],
  },
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
