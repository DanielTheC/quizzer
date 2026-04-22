import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import { supabase } from "../../lib/supabase";
import { captureSupabaseError } from "../../lib/sentryInit";
import { formatTime24 as formatTime } from "../../lib/formatters";
import {
  borderWidth,
  colors,
  radius,
  shadow,
  spacing,
  typography,
  type SemanticTheme,
} from "../../theme";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(d: number): string {
  return DAY_SHORT[d] ?? String(d);
}

function formatPounds(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(Number(pence))) return "—";
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

function formatClaimDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatOccurrenceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function todayUkIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

type VenueMini = { name: string; postcode: string | null } | null;

type QuizEventEmbed = {
  venue_id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  host_fee_pence: number | null;
  venues: VenueMini;
} | null;

type ClaimRow = {
  id: string;
  status: string;
  claimed_at: string;
  reviewed_at: string | null;
  notes: string | null;
  quiz_event_id: string;
  quiz_events: QuizEventEmbed;
};

type OccurrenceClaimRow = {
  id: string;
  quiz_event_id: string;
  occurrence_date: string;
  claimed_at: string;
  quiz_events: QuizEventEmbed;
};

type Section = { title: string; data: ClaimRow[] };

type UnclaimRpcResponse = {
  ok: boolean;
  code?: string;
};

function normalizeQuizEvent(raw: unknown): QuizEventEmbed {
  if (raw == null) return null;
  const o = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  return o as unknown as QuizEventEmbed;
}

function buildStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgSecondary },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
    loadingText: { marginTop: spacing.md, ...typography.body, color: semantic.textSecondary },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
    sectionHeader: {
      ...typography.label,
      color: semantic.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    upcomingHeader: {
      ...typography.label,
      color: semantic.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.brutal,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.medium,
    },
    statusPill: {
      alignSelf: "flex-start",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      marginBottom: spacing.sm,
    },
    statusPillText: { ...typography.captionStrong, fontSize: 12 },
    occurrencePill: {
      alignSelf: "flex-start",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentYellow,
      marginBottom: spacing.sm,
    },
    occurrencePillText: { ...typography.captionStrong, fontSize: 12, color: semantic.textPrimary },
    venueName: { ...typography.displaySmall, color: semantic.textPrimary },
    metaLine: { marginTop: spacing.xs, ...typography.body, color: semantic.textSecondary },
    feeLine: { marginTop: spacing.sm, ...typography.body, color: semantic.textSecondary },
    payLine: { marginTop: spacing.xs, ...typography.bodyStrong, color: semantic.textPrimary },
    dateLine: { marginTop: spacing.sm, ...typography.caption, color: semantic.textSecondary },
    notesLine: { marginTop: spacing.sm, ...typography.caption, fontStyle: "italic", color: semantic.textSecondary },
    primaryBtn: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: semantic.accentYellow,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.medium,
      ...shadow.small,
    },
    secondaryBtn: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: semantic.bgSecondary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.medium,
      ...shadow.small,
    },
    btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    btnDisabled: { opacity: 0.5 },
    btnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
    secondaryBtnText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary },
    emptyBox: { alignItems: "center", paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.lg },
    emptyTitle: { ...typography.heading, textAlign: "center", color: semantic.textPrimary },
    emptyCta: {
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: semantic.accentYellow,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.medium,
      ...shadow.small,
    },
    emptyCtaText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
    errorBanner: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.medium,
      borderWidth: borderWidth.default,
      borderColor: semantic.danger,
      backgroundColor: semantic.bgPrimary,
    },
    errorText: { ...typography.body, color: semantic.danger },
    upcomingEmpty: {
      padding: spacing.lg,
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.brutal,
      marginBottom: spacing.md,
      ...shadow.small,
    },
    upcomingEmptyText: { ...typography.body, color: semantic.textSecondary },
    tooLateCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.danger,
      ...shadow.medium,
    },
    tooLateTitle: { ...typography.displaySmall, color: colors.white, marginBottom: spacing.sm },
    tooLateBody: { ...typography.body, color: colors.white, marginBottom: spacing.sm },
    tooLateBodyStrong: { ...typography.bodyStrong, color: colors.white },
    tooLateDismiss: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.medium,
    },
    tooLateDismissText: { ...typography.bodyStrong, color: semantic.textPrimary },
  });
}

function statusPillStyle(
  status: string,
  semantic: SemanticTheme
): { bg: string; border: string; text: string; label: string } {
  switch (status) {
    case "pending":
      return {
        bg: semantic.accentOrange,
        border: semantic.borderPrimary,
        text: semantic.textInverse,
        label: "Pending approval",
      };
    case "confirmed":
      return {
        bg: semantic.accentGreen,
        border: semantic.borderPrimary,
        text: semantic.textInverse,
        label: "Confirmed",
      };
    case "rejected":
      return {
        bg: semantic.danger,
        border: semantic.borderPrimary,
        text: semantic.textInverse,
        label: "Rejected",
      };
    case "cancelled":
    default:
      return {
        bg: colors.grey200,
        border: semantic.borderPrimary,
        text: semantic.textPrimary,
        label: "Cancelled",
      };
  }
}

export default function MyClaimsScreen() {
  const { session } = useAuth();
  const { semantic } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const styles = useMemo(() => buildStyles(semantic), [semantic]);

  const [defaultFeePence, setDefaultFeePence] = useState(0);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [upcomingNights, setUpcomingNights] = useState<OccurrenceClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [unclaimingKey, setUnclaimingKey] = useState<string | null>(null);
  const [tooLateContext, setTooLateContext] = useState<{ occurrenceDate: string; venueName: string } | null>(null);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setErrorMsg("Sign in to see your claims.");
      setClaims([]);
      setUpcomingNights([]);
      return;
    }

    setErrorMsg(null);

    const [allowRes, claimsRes, upcomingRes] = await Promise.all([
      email
        ? supabase.from("host_allowlisted_emails").select("default_fee_pence").eq("email", email).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      supabase
        .from("quiz_claims")
        .select(
          "id, status, claimed_at, reviewed_at, notes, quiz_event_id, quiz_events(venue_id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venues(name, postcode))"
        )
        .eq("host_user_id", userId)
        .order("claimed_at", { ascending: false }),
      supabase
        .from("quiz_occurrence_claims")
        .select(
          "id, quiz_event_id, occurrence_date, claimed_at, quiz_events(venue_id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venues(name, postcode))"
        )
        .eq("host_user_id", userId)
        .is("released_at", null)
        .gte("occurrence_date", todayUkIso())
        .order("occurrence_date", { ascending: true }),
    ]);

    if (allowRes.error) {
      captureSupabaseError("host.claims.allowlisted_by_email", allowRes.error);
      setErrorMsg(allowRes.error.message);
    } else {
      const feeRaw = allowRes.data?.default_fee_pence;
      setDefaultFeePence(feeRaw != null && Number.isFinite(Number(feeRaw)) ? Number(feeRaw) : 0);
    }

    if (claimsRes.error) {
      captureSupabaseError("host.claims.list_by_host", claimsRes.error);
      setErrorMsg(claimsRes.error.message);
      setClaims([]);
    } else {
      const rows = (claimsRes.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        quiz_events: normalizeQuizEvent(r.quiz_events),
      })) as ClaimRow[];
      setClaims(rows);
    }

    if (upcomingRes.error) {
      captureSupabaseError("host.claims.upcoming_occurrence_claims", upcomingRes.error);
      setErrorMsg(upcomingRes.error.message);
      setUpcomingNights([]);
    } else {
      const rows = (upcomingRes.data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as {
          id: string;
          quiz_event_id: string;
          occurrence_date: string;
          claimed_at: string;
        }),
        quiz_events: normalizeQuizEvent(r.quiz_events),
      })) as OccurrenceClaimRow[];
      setUpcomingNights(rows);
    }
  }, [userId, email]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const cancelClaim = useCallback(
    async (claimId: string) => {
      setCancelingId(claimId);
      const { error } = await supabase.from("quiz_claims").update({ status: "cancelled" }).eq("id", claimId);
      setCancelingId(null);
      if (error) {
        captureSupabaseError("host.claims.cancel_update", error, { claim_id: claimId });
        setErrorMsg(error.message);
        return;
      }
      await load();
    },
    [load]
  );

  const unclaimNight = useCallback(
    async (row: OccurrenceClaimRow) => {
      const key = `${row.quiz_event_id}|${row.occurrence_date}`;
      setUnclaimingKey(key);
      setErrorMsg(null);

      const { data, error } = await supabase.rpc("host_unclaim_occurrence", {
        p_quiz_event_id: row.quiz_event_id,
        p_occurrence_date: row.occurrence_date,
      });
      setUnclaimingKey(null);

      if (error) {
        captureSupabaseError("host.claims.unclaim_occurrence_rpc", error, {
          quiz_event_id: row.quiz_event_id,
          occurrence_date: row.occurrence_date,
        });
        setErrorMsg(error.message);
        return;
      }

      const payload = (data ?? {}) as UnclaimRpcResponse;
      if (!payload.ok) {
        if (payload.code === "too_late") {
          const venueName = row.quiz_events?.venues?.name?.trim() || "this quiz";
          setTooLateContext({ occurrenceDate: row.occurrence_date, venueName });
          return;
        }
        setErrorMsg(
          payload.code === "not_claim_holder"
            ? "You no longer hold this claim."
            : "Couldn't unclaim this night."
        );
        await load();
        return;
      }

      setUpcomingNights((prev) => prev.filter((r) => r.id !== row.id));
      await load();
    },
    [load]
  );

  const sections: Section[] = useMemo(() => {
    const active = claims.filter((c) => c.status === "pending" || c.status === "confirmed");
    const past = claims.filter((c) => c.status === "rejected" || c.status === "cancelled");
    const out: Section[] = [];
    if (active.length > 0) out.push({ title: "Active series claims", data: active });
    if (past.length > 0) out.push({ title: "Past", data: past });
    return out;
  }, [claims]);

  const renderUpcomingNight = useCallback(
    (row: OccurrenceClaimRow) => {
      const ev = row.quiz_events;
      const venueName = ev?.venues?.name?.trim() || "Venue TBC";
      const postcode = ev?.venues?.postcode?.trim();
      const dayTime =
        ev != null ? `${dayLabel(ev.day_of_week)} · ${formatTime(ev.start_time)}` : "Schedule TBC";
      const entryPence = ev?.entry_fee_pence;
      const entryLabel =
        entryPence != null && Number.isFinite(Number(entryPence))
          ? `${formatPounds(Number(entryPence))} entry`
          : "Entry TBC";
      const resolvedHost = (ev?.host_fee_pence ?? defaultFeePence) || 0;
      const payLabel = resolvedHost > 0 ? `${formatPounds(resolvedHost)} per session` : "Pay TBC";
      const key = `${row.quiz_event_id}|${row.occurrence_date}`;
      const busy = unclaimingKey === key;

      return (
        <View key={row.id} style={styles.card}>
          <View style={styles.occurrencePill}>
            <Text style={styles.occurrencePillText}>{formatOccurrenceDate(row.occurrence_date)}</Text>
          </View>
          <Text style={styles.venueName}>{venueName}</Text>
          {postcode ? <Text style={styles.metaLine}>{postcode}</Text> : null}
          <Text style={styles.metaLine}>{dayTime}</Text>
          <Text style={styles.feeLine}>{entryLabel}</Text>
          <Text style={styles.payLine}>Your pay: {payLabel}</Text>

          {ev?.venue_id ? (
            <Pressable
              onPress={() => navigation.navigate("RunQuiz", { mode: "new", venueId: ev.venue_id })}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Run quiz"
            >
              <Text style={styles.btnText}>Run Quiz</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void unclaimNight(row)}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && !busy && styles.btnPressed,
              busy && styles.btnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Unclaim ${venueName} on ${formatOccurrenceDate(row.occurrence_date)}`}
          >
            <Text style={styles.secondaryBtnText}>{busy ? "Unclaiming…" : "Unclaim this night"}</Text>
          </Pressable>
        </View>
      );
    },
    [styles, defaultFeePence, navigation, unclaimingKey, unclaimNight]
  );

  const ListHeader = useMemo(() => {
    return (
      <View>
        <Text style={styles.upcomingHeader}>My upcoming nights</Text>
        {upcomingNights.length === 0 ? (
          <View style={styles.upcomingEmpty}>
            <Text style={styles.upcomingEmptyText}>
              No nights claimed yet. Head to Find a quiz to claim an upcoming night.
            </Text>
          </View>
        ) : (
          upcomingNights.map(renderUpcomingNight)
        )}
      </View>
    );
  }, [styles, upcomingNights, renderUpcomingNight]);

  const renderClaim = useCallback(
    ({ item }: { item: ClaimRow }) => {
      const ev = item.quiz_events;
      const venueName = ev?.venues?.name?.trim() || "Venue TBC";
      const postcode = ev?.venues?.postcode?.trim();
      const dayTime =
        ev != null ? `${dayLabel(ev.day_of_week)} · ${formatTime(ev.start_time)}` : "Schedule TBC";
      const entryPence = ev?.entry_fee_pence;
      const entryLabel =
        entryPence != null && Number.isFinite(Number(entryPence))
          ? `${formatPounds(Number(entryPence))} entry`
          : "Entry TBC";
      const resolvedHost = ev != null ? ev.host_fee_pence ?? defaultFeePence : defaultFeePence;
      const payLabel = resolvedHost > 0 ? `${formatPounds(resolvedHost)} per session` : "Pay TBC";

      const pill = statusPillStyle(item.status, semantic);
      const showNotes =
        (item.status === "rejected" || item.status === "cancelled") && (item.notes?.trim() ?? "").length > 0;
      const cancelBusy = cancelingId === item.id;

      return (
        <View style={styles.card}>
          <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
            <Text style={[styles.statusPillText, { color: pill.text }]}>{pill.label}</Text>
          </View>
          <Text style={styles.venueName}>{venueName}</Text>
          {postcode ? <Text style={styles.metaLine}>{postcode}</Text> : null}
          <Text style={styles.metaLine}>{dayTime}</Text>
          <Text style={styles.feeLine}>{entryLabel}</Text>
          <Text style={styles.payLine}>Your pay: {payLabel}</Text>
          <Text style={styles.dateLine}>Claimed {formatClaimDate(item.claimed_at)}</Text>
          {showNotes ? <Text style={styles.notesLine}>{item.notes}</Text> : null}

          {item.status === "pending" ? (
            <Pressable
              onPress={() => void cancelClaim(item.id)}
              disabled={cancelBusy}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && !cancelBusy && styles.btnPressed,
                cancelBusy && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel claim"
            >
              <Text style={styles.secondaryBtnText}>{cancelBusy ? "Cancelling…" : "Cancel claim"}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [styles, semantic, defaultFeePence, cancelingId, cancelClaim]
  );

  if (!userId) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Sign in to see your claims.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={semantic.accentYellow} />
          <Text style={styles.loadingText}>Loading claims…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nothingAtAll = claims.length === 0 && upcomingNights.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {tooLateContext ? (
        <View style={styles.tooLateCard}>
          <Text style={styles.tooLateTitle}>Too late to unclaim</Text>
          <Text style={styles.tooLateBody}>
            We protect venues by locking claims within <Text style={styles.tooLateBodyStrong}>24 hours</Text> of
            the quiz.
          </Text>
          <Text style={styles.tooLateBody}>
            Your attempt to unclaim {tooLateContext.venueName} on{" "}
            <Text style={styles.tooLateBodyStrong}>{formatOccurrenceDate(tooLateContext.occurrenceDate)}</Text>{" "}
            has been logged — the operator has been notified and will reach out if needed.
          </Text>
          <Pressable
            onPress={() => setTooLateContext(null)}
            style={styles.tooLateDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.tooLateDismissText}>Got it</Text>
          </Pressable>
        </View>
      ) : null}

      {nothingAtAll ? (
        <View style={[styles.listContent, styles.emptyBox]}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={56} color={semantic.textSecondary} />
          <Text style={[styles.emptyTitle, { marginTop: spacing.lg }]}>
            No claims yet — find a quiz to get started.
          </Text>
          <Pressable
            onPress={() => navigation.navigate("AvailableQuizzes")}
            style={({ pressed }) => [styles.emptyCta, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Find a quiz"
          >
            <Text style={styles.emptyCtaText}>Find a quiz</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderClaim}
          renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={semantic.textPrimary}
              colors={[semantic.accentYellow, semantic.textPrimary]}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}
