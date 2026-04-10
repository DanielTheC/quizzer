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
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";
import { computeNextOccurrence, formatNextOccurrenceLabel } from "../../lib/nextOccurrence";
import { getHostCompletedQuizSessionsCount } from "../../lib/runQuizStorage";

/**
 * Optional local override when `host_applications.quiz_event_id` is not set yet.
 * JSON array of quiz_event UUID strings, e.g. '["uuid-1","uuid-2"]'
 */
const MANUAL_CLAIMED_QUIZ_EVENT_IDS_KEY = "host_dashboard_manual_claimed_quiz_event_ids";

/** Demo only until payments are integrated. */
const PLACEHOLDER_EARNINGS_LABEL = "£128";

type HostDashboardRow = {
  quiz_event_id: string;
  venue_id: string;
  venue_name: string;
  day_of_week: number;
  start_time: string;
  interest_count: number;
  host_capacity_note: string | null;
  host_cancelled_at: string | null;
};

type DashboardTab = "mine" | "all";

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

    const [rpcResult, hostedCount, manualIds] = await Promise.all([
      supabase.rpc("host_quiz_dashboard_rows"),
      getHostCompletedQuizSessionsCount(),
      loadManualClaimedQuizEventIds(),
    ]);

    setHostedSessionsCount(hostedCount);

    const { data: apps, error: appsError } = await supabase
      .from("host_applications")
      .select("quiz_event_id")
      .eq("status", "approved")
      .not("quiz_event_id", "is", null);

    if (appsError) {
      setClaimsLoadError(appsError.message);
    }

    const fromApps = (apps ?? [])
      .map((r: { quiz_event_id: string | null }) => r.quiz_event_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    setMyClaimedQuizEventIds(new Set([...fromApps, ...manualIds]));

    if (rpcResult.error) {
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
        p_update_note: true,
        p_cancelled_at: null,
        p_update_cancellation: false,
      });
      setSavingId(null);
      if (error) {
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

  const setCancelled = useCallback(
    async (quizEventId: string, cancelled: boolean) => {
      setSavingId(quizEventId);
      const { data, error } = await supabase.rpc("host_patch_quiz_event_host_fields", {
        p_quiz_event_id: quizEventId,
        p_capacity_note: null,
        p_update_note: false,
        p_cancelled_at: cancelled ? new Date().toISOString() : null,
        p_update_cancellation: true,
      });
      setSavingId(null);
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      if (data !== true) {
        setErrorMsg("Couldn’t update cancellation (check host allowlist).");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.quiz_event_id === quizEventId
            ? { ...r, host_cancelled_at: cancelled ? new Date().toISOString() : null }
            : r
        )
      );

      if (cancelled) {
        void supabase.functions
          .invoke("notify-quiz-cancelled", { body: { quiz_event_id: quizEventId } })
          .then(({ error: fnError }) => {
            if (fnError) console.warn("notify-quiz-cancelled:", fnError.message);
          });
      }
    },
    []
  );

  const emptyHintAll = useMemo(
    () =>
      "No rows usually means your email isn’t on the host allowlist, or there are no active quiz listings.",
    []
  );

  const emptyHintMine = useMemo(
    () =>
      "No claimed listings yet. When an operator links your approved application to a quiz (host_applications.quiz_event_id), or you add IDs in local manual storage, they appear here.",
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
        <ScreenTitle subtitle="Interest counts from players who save a quiz while signed in. Cancellation shows on the player quiz screen.">
          Listings
        </ScreenTitle>

        <View style={styles.summaryBar}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{hostedSessionsCount}</Text>
            <Text style={styles.summaryLabel}>Quizzes hosted</Text>
            <Text style={styles.summaryHint}>Counted when you end a night from Results</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{PLACEHOLDER_EARNINGS_LABEL}</Text>
            <Text style={styles.summaryLabel}>Earnings (demo)</Text>
            <Text style={styles.summaryHint}>Placeholder — payments later</Text>
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
                  Couldn’t load claimed slots ({claimsLoadError}). Manual IDs in storage still apply.
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
                const cancelled = r.host_cancelled_at != null;
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

                    {cancelled ? (
                      <View style={styles.cancellationBanner}>
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={18}
                          color={semantic.danger}
                          style={styles.cancellationBannerIcon}
                        />
                        <Text style={styles.cancellationBannerText}>
                          Cancelled for players — players see a cancellation notice on the quiz screen.
                        </Text>
                      </View>
                    ) : null}

                    {savedNote ? (
                      <View style={styles.noteReadonlyBox}>
                        <Text style={styles.noteReadonlyLabel}>Host note on listing</Text>
                        <Text style={styles.noteReadonlyBody}>{savedNote}</Text>
                      </View>
                    ) : null}

                    <View style={styles.cancelRow}>
                      <Text style={styles.fieldLabel}>Last-minute cancellation</Text>
                      <Pressable
                        disabled={busy}
                        onPress={() => void setCancelled(r.quiz_event_id, !cancelled)}
                        style={({ pressed }) => [
                          cancelled ? styles.cancelOnBtn : styles.cancelOffBtn,
                          pressed && styles.btnPressed,
                          busy && styles.btnDisabled,
                        ]}
                      >
                        <Text style={cancelled ? styles.cancelOnBtnText : styles.cancelOffBtnText}>
                          {cancelled ? "Cancelled (tap to clear)" : "Mark cancelled"}
                        </Text>
                      </Pressable>
                    </View>

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
  summaryValue: { ...typography.bodyStrong, fontSize: 22, color: semantic.textPrimary },
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
  cancellationBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
    backgroundColor: semantic.bgSecondary,
  },
  cancellationBannerIcon: { marginRight: spacing.sm, marginTop: 1 },
  cancellationBannerText: { flex: 1, ...typography.caption, color: semantic.textPrimary, lineHeight: 20 },
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
  cancelRow: { marginTop: spacing.sm },
  cancelOffBtn: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
    alignItems: "center",
  },
  cancelOffBtnText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary },
  cancelOnBtn: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
    backgroundColor: semantic.bgSecondary,
    alignItems: "center",
  },
  cancelOnBtnText: { ...typography.bodyStrong, fontSize: 15, color: semantic.danger },
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
