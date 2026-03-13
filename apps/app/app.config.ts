import "dotenv/config";
import type { ExpoConfig } from "expo/config";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      "expo-notifications",
      {
        defaultChannel: "quizzer-quiz-reminders",
      },
    ],
  ],
  ios: {
    ...config.ios,
    infoPlist: {
      ...(config.ios as { infoPlist?: Record<string, string> })?.infoPlist,
      NSLocationWhenInUseUsageDescription:
        "Used to show distance to quiz venues and filter by radius.",
    },
  },
  android: {
    ...config.android,
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
