import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getHostSessionHistory, type HostCompletedSessionRecord } from "../../lib/runQuizStorage";
import { ScreenTitle } from "../../components/ScreenTitle";
import { semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

function displayHostName(user: User | null): string {
  if (!user) return "Host";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = meta?.full_name ?? meta?.name ?? meta?.display_name;
  if (typeof full === "string" && full.trim()) return full.trim();
  if (user.email) {
    const local = user.email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "Host";
}

function formatSessionWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

type SessionRowVM = HostCompletedSessionRecord & {
  venueName: string;
  packName: string;
};

export default function HostProfileScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRowVM[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const history = await getHostSessionHistory();
    const venueIds = [...new Set(history.map((h) => h.venueId).filter((id): id is string => id != null && id.length > 0))];
    const packIds = [...new Set(history.map((h) => h.packId).filter((id): id is string => id != null && id.length > 0))];

    const [venuesRes, packsRes] = await Promise.all([
      venueIds.length
        ? supabase.from("venues").select("id,name").in("id", venueIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      packIds.length
        ? supabase.from("quiz_packs").select("id,name").in("id", packIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    ]);

    const venueById = new Map((venuesRes.data ?? []).map((r) => [r.id, r.name?.trim() || ""]));
    const packById = new Map((packsRes.data ?? []).map((r) => [r.id, r.name?.trim() || ""]));

    const rows: SessionRowVM[] = history.map((h) => ({
      ...h,
      venueName: h.venueId ? venueById.get(h.venueId) || "Unknown venue" : "—",
      packName: h.packId ? packById.get(h.packId) || "Unknown pack" : "—",
    }));

    setSessions(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const email = user?.email ?? null;
  const runCount = sessions.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenTitle subtitle="Local run history from this device.">{displayHostName(user)}</ScreenTitle>
        {email ? <Text style={styles.email}>{email}</Text> : null}

        <Pressable style={styles.editBtn} disabled accessibilityState={{ disabled: true }}>
          <Text style={styles.editBtnText}>Edit profile</Text>
          <Text style={styles.editBtnHint}>Coming soon</Text>
        </Pressable>

        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Quizzes run</Text>
          <Text style={styles.statsValue}>{loading ? "…" : runCount}</Text>
          <Text style={styles.statsHint}>Counted when you end a night from Results</Text>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <Text style={styles.earningsMain}>£0.00 — payment coming soon</Text>
        </View>

        <Text style={styles.historyHeading}>Past sessions</Text>
        {loading ? (
          <ActivityIndicator size="large" color={semantic.textPrimary} style={styles.spinner} />
        ) : sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No completed sessions yet. Finish a quiz from the results screen to build your history here.
            </Text>
          </View>
        ) : (
          sessions.map((s, i) => (
            <View key={`${s.completedAt}-${i}`} style={styles.sessionCard}>
              <Text style={styles.sessionVenue} numberOfLines={2}>
                {s.venueName}
              </Text>
              <Text style={styles.sessionMeta}>{s.packName}</Text>
              <Text style={styles.sessionWhen}>{formatSessionWhen(s.completedAt)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  scroll: { padding: spacing.xxl, paddingBottom: 48 },
  email: { ...typography.body, color: semantic.textSecondary, marginTop: spacing.xs },
  editBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    opacity: 0.55,
    ...shadow.small,
  },
  editBtnText: { ...typography.bodyStrong, color: semantic.textSecondary },
  editBtnHint: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
  statsCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  statsLabel: { ...typography.labelUppercase, color: semantic.textSecondary },
  statsValue: { ...typography.bodyStrong, fontSize: 28, color: semantic.textPrimary, marginTop: spacing.sm },
  statsHint: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  earningsCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  sectionTitle: { ...typography.labelUppercase, color: semantic.textSecondary, marginBottom: spacing.sm },
  earningsMain: { ...typography.body, color: semantic.textPrimary },
  historyHeading: {
    ...typography.labelUppercase,
    color: semantic.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  spinner: { marginTop: spacing.lg },
  emptyCard: {
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  emptyText: { ...typography.body, color: semantic.textSecondary, lineHeight: 22 },
  sessionCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  sessionVenue: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  sessionMeta: { ...typography.body, color: semantic.textPrimary, marginTop: spacing.xs },
  sessionWhen: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
});
