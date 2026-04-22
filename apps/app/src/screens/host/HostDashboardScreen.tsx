import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { supabase } from "../../lib/supabase";
import { captureSupabaseError } from "../../lib/sentryInit";
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";
import { computeNextOccurrence, formatNextOccurrenceLabel } from "../../lib/nextOccurrence";
import { getHostCompletedQuizSessionsCount } from "../../lib/runQuizStorage";

/**
 * Optional local override when `host_applications.quiz_event_id` is not set yet.
 * JSON array of quiz_event UUID strings, e.g. '["uuid-1","uuid-2"]'
 */
const MANUAL_CLAIMED_QUIZ_EVENT_IDS_KEY = "host_dashboard_manual_claimed_quiz_event_ids";

type HostDashboardRow = {
  quiz_event_id: string;
  venue_id: string;
  venue_name: string;
  day_of_week: number;
  start_time: string;
  interest_count: number;
  host_capacity_note: string | null;
};

type DashboardTab = "mine" | "all";

type HostDashboardSummaryRow = {
  total_sessions: number | string;
  total_earnings_pence: number | string;
  total_player_count: number | string;
};

async function loadManualClaimedQuizEventIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MANUAL_CLAIMED_QUIZ_EVENT_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export default function HostDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const [rows, setRows] = useState<HostDashboardRow[]>([]);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("mine");
  const [myClaimedQuizEventIds, setMyClaimedQuizEventIds] = useState<Set<string>>(() => new Set());
  const [claimsLoadError, setClaimsLoadError] = useState<string | null>(null);
  const [hostedSessionsCount, setHostedSessionsCount] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [totalEarningsPence, setTotalEarningsPence] = useState<number | null>(null);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <Pressable
            onPress={() => navigation.navigate("HostProfile")}
            style={styles.headerRight}
            accessibilityLabel="Host profile"
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={semantic.textPrimary} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight} accessibilityLabel="Settings">
            <MaterialCommunityIcons name="cog-outline" size={24} color={semantic.textPrimary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setClaimsLoadError(null);
    setSummaryLoading(true);
    try {
      const [rpcResult, hostedCount, manualIds, summaryResult] = await Promise.all([
        supabase.rpc("host_quiz_dashboard_rows"),
        getHostCompletedQuizSessionsCount(),
        loadManualClaimedQuizEventIds(),
        supabase.rpc("host_dashboard_summary").single(),
      ]);

      setHostedSessionsCount(hostedCount);

      if (summaryResult.error) {
        captureSupabaseError("host.dashboard_summary_rpc", summaryResult.error);
      }
      if (summaryResult.error || !summaryResult.data) {
        setTotalEarningsPence(null);
        setTotalSessions(null);
      } else {
        const s = summaryResult.data as HostDashboardSummaryRow;
        setTotalEarningsPence(Number(s.total_earnings_pence));
        setTotalSessions(Number(s.total_sessions));
      }

      const { data: apps, error: appsError } = await supabase
        .from("host_applications")
        .select("quiz_event_id")
        .eq("status", "approved")
        .not("quiz_event_id", "is", null);

      if (appsError) {
        captureSupabaseError("host.dashboard_approved_applications", appsError);
        setClaimsLoadError(appsError.message);
      }

      const fromApps = (apps ?? [])
        .map((r: { quiz_event_id: string | null }) => r.quiz_event_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      setMyClaimedQuizEventIds(new Set([...fromApps, ...manualIds]));

      if (rpcResult.error) {
        captureSupabaseError("host.dashboard_rows_rpc", rpcResult.error);
        setErrorMsg(rpcResult.error.message);
        setRows([]);
        return;
      }
      const list = (rpcResult.data as HostDashboardRow[] | null) ?? [];
      setRows(list);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (next[r.quiz_event_id] === undefined) {
            next[r.quiz_event_id] = r.host_capacity_note ?? "";
          }
        }
        return next;
      });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const displayRows = useMemo(() => {
    if (dashboardTab === "all") return rows;
    return rows.filter((r) => myClaimedQuizEventIds.has(r.quiz_event_id));
  }, [rows, dashboardTab, myClaimedQuizEventIds]);

  const saveNote = useCallback(
    async (quizEventId: string) => {
      const text = noteDrafts[quizEventId] ?? "";
      setSavingId(quizEventId);
      const { data, error } = await supabase.rpc("host_patch_quiz_event_host_fields", {
        p_quiz_event_id: quizEventId,
        p_capacity_note: text.trim() || null,
      });
      setSavingId(null);
      if (error) {
        captureSupabaseError("host.dashboard_patch_note_rpc", error, { quiz_event_id: quizEventId });
        setErrorMsg(error.message);
        return;
      }
      if (data !== true) {
        setErrorMsg("Couldn’t save (check host allowlist).");
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.quiz_event_id === quizEventId ? { ...r, host_capacity_note: text.trim() || null } : r))
      );
    },
    [noteDrafts]
  );

  const emptyHintAll = useMemo(
    () =>
      "No rows usually means your email isn’t on the host allowlist, or there are no active quiz listings.",
    []
  );

  const emptyHintMine = useMemo(
    () =>
      "No listings linked yet. If your host application was approved, contact us and we'll link your quiz slot to your account.",
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle subtitle="Interest counts from players who save a quiz while signed in.">
          Listings
        </ScreenTitle>

        <View style={styles.promoRow}>
          <Pressable
            onPress={() => navigation.navigate("AvailableQuizzes")}
            style={({ pressed }) => [styles.promoBtnPrimary, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Find a quiz"
          >
            <Text style={styles.promoBtnPrimaryText}>Find a quiz</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("MyClaims")}
            style={({ pressed }) => [styles.promoBtnSecondary, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="My claims"
          >
            <Text style={styles.promoBtnSecondaryText}>My claims</Text>
          </Pressable>
        </View>

        <View style={styles.promoRow}>
          <Pressable
            onPress={() => navigation.navigate("OpenNights")}
            style={({ pressed }) => [styles.promoBtnSecondary, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open nights in series you cover"
          >
            <Text style={styles.promoBtnSecondaryText}>Open nights</Text>
          </Pressable>
        </View>

        <View style={styles.summaryBar}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>
              {totalSessions !== null ? totalSessions : hostedSessionsCount}
            </Text>
            <Text style={styles.summaryLabel}>Quizzes hosted</Text>
            <Text style={styles.summaryHint}>Counted when you end a night from Results</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            {summaryLoading ? (
              <ActivityIndicator size="small" color={semantic.textPrimary} style={styles.summaryValueSpinner} />
            ) : (
              <Text style={styles.summaryValue}>
                {totalEarningsPence != null ? `£${(totalEarningsPence / 100).toFixed(2)}` : "—"}
              </Text>
            )}
            <Text style={styles.summaryLabel}>Total earnings</Text>
            <Text style={styles.summaryHint}>From listing entry fees × players (when set)</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={semantic.textPrimary} style={styles.loader} />
        ) : errorMsg && rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Text style={styles.hintBelow}>{emptyHintAll}</Text>
            <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]} onPress={() => void load()}>
              <Text style={styles.secondaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.bodyText}>{emptyHintAll}</Text>
          </View>
        ) : (
          <>
            {claimsLoadError ? (
              <View style={styles.warnBanner}>
                <Text style={styles.warnBannerText}>
                  Couldn’t load your linked listings ({claimsLoadError}). Pull to refresh or try again later.
                </Text>
              </View>
            ) : null}
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setDashboardTab("mine")}
                style={({ pressed }) => [
                  styles.tabSegment,
                  dashboardTab === "mine" && styles.tabSegmentActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.tabSegmentText, dashboardTab === "mine" && styles.tabSegmentTextActive]}>My upcoming</Text>
              </Pressable>
              <Pressable
                onPress={() => setDashboardTab("all")}
                style={({ pressed }) => [
                  styles.tabSegment,
                  dashboardTab === "all" && styles.tabSegmentActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.tabSegmentText, dashboardTab === "all" && styles.tabSegmentTextActive]}>All available</Text>
              </Pressable>
            </View>

            {displayRows.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.bodyText}>{dashboardTab === "mine" ? emptyHintMine : emptyHintAll}</Text>
              </View>
            ) : (
              displayRows.map((r) => {
                const busy = savingId === r.quiz_event_id;
                const next = computeNextOccurrence(r.day_of_week, r.start_time, new Date());
                const nextSchedule = next ? formatNextOccurrenceLabel(next.at, new Date()) : null;
                const savedNote = (r.host_capacity_note ?? "").trim();
                const draftNote = (noteDrafts[r.quiz_event_id] ?? "").trim();

                return (
                  <View key={r.quiz_event_id} style={styles.card}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {r.venue_name}
                    </Text>
                    {nextSchedule ? <Text style={styles.cardSchedule}>{nextSchedule}</Text> : null}
                    <Text style={styles.cardRsvp}>
                      {r.interest_count} interested (RSVP)
                    </Text>

                    {savedNote ? (
                      <View style={styles.noteReadonlyBox}>
                        <Text style={styles.noteReadonlyLabel}>Host note on listing</Text>
                        <Text style={styles.noteReadonlyBody}>{savedNote}</Text>
                      </View>
                    ) : null}

                    <Text style={styles.fieldLabel}>Capacity / notes (host only)</Text>
                    <TextInput
                      style={styles.noteInput}
                      multiline
                      value={noteDrafts[r.quiz_event_id] ?? ""}
                      onChangeText={(t) => setNoteDrafts((d) => ({ ...d, [r.quiz_event_id]: t }))}
                      placeholder="e.g. Tables tight from 7:30 — first come first served"
                      placeholderTextColor={colors.grey400}
                      editable={!busy}
                    />
                    <Pressable
                      disabled={busy}
                      onPress={() => void saveNote(r.quiz_event_id)}
                      style={({ pressed }) => [styles.primaryBtn, pressed && !busy && styles.btnPressed, busy && styles.btnDisabled]}
                    >
                      <Text style={styles.primaryBtnText}>{busy ? "Saving…" : "Save note"}</Text>
                    </Pressable>
                    {draftNote !== savedNote ? (
                      <Text style={styles.unsavedHint}>Unsaved changes — tap Save note</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  promoRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  promoBtnPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentYellow,
    alignItems: "center",
    ...shadow.small,
  },
  promoBtnPrimaryText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary, textAlign: "center" },
  promoBtnSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  promoBtnSecondaryText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary, textAlign: "center" },
  headerRightRow: { flexDirection: "row", alignItems: "center", marginRight: spacing.xs },
  headerRight: { padding: spacing.sm },
  loader: { marginTop: spacing.xl },
  summaryBar: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  summaryCol: { flex: 1, minWidth: 0 },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: semantic.borderPrimary, marginHorizontal: spacing.md },
  summaryValue: { ...typography.displaySmall, color: semantic.textPrimary },
  summaryValueSpinner: { alignSelf: "flex-start", minHeight: 28, marginBottom: 2 },
  summaryLabel: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
  summaryHint: { ...typography.caption, fontSize: 11, color: semantic.textSecondary, marginTop: spacing.xs, opacity: 0.9 },
  tabRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.medium,
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  tabSegment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.medium - 2,
  },
  tabSegmentActive: { backgroundColor: semantic.accentYellow },
  tabSegmentText: { ...typography.bodyStrong, fontSize: 14, color: semantic.textSecondary },
  tabSegmentTextActive: { color: semantic.textPrimary },
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  cardTitle: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
  cardSchedule: { ...typography.body, color: semantic.textPrimary, marginTop: spacing.sm },
  cardRsvp: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
  noteReadonlyBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
  },
  noteReadonlyLabel: { ...typography.labelUppercase, fontSize: 10, color: semantic.textSecondary, marginBottom: spacing.xs },
  noteReadonlyBody: { ...typography.body, color: semantic.textPrimary },
  fieldLabel: { ...typography.labelUppercase, color: semantic.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  noteInput: {
    minHeight: 72,
    textAlignVertical: "top",
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: colors.grey200,
    backgroundColor: semantic.bgSecondary,
    ...typography.body,
    color: semantic.textPrimary,
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  primaryBtnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  secondaryBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    alignItems: "center",
  },
  secondaryBtnText: { ...typography.bodyStrong, color: semantic.textPrimary },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  btnDisabled: { opacity: 0.5 },
  unsavedHint: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  bodyText: { ...typography.body, color: semantic.textSecondary },
  hintBelow: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  errorText: { ...typography.body, color: semantic.danger },
  warnBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: semantic.accentOrange,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  warnBannerText: { ...typography.caption, color: semantic.textInverse, lineHeight: 18 },
  errorBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: semantic.danger,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  errorBannerText: { ...typography.body, color: colors.white },
});
