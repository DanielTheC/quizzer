import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
  const n = Number(pence);
  return `£${(n / 100).toFixed(2)}`;
}

/** yyyy-mm-dd for "today" in Europe/London. Matches the server-side guard in host_claim_occurrence. */
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

function formatOccurrenceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

type VenueEmbed = {
  name: string;
  postcode: string | null;
  address: string | null;
} | null;

type QuizEventEmbed = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  host_fee_pence: number | null;
  venue_id: string | null;
  venues: VenueEmbed;
} | null;

type OccurrenceRow = {
  id: string;
  quiz_event_id: string;
  occurrence_date: string;
  quiz_events: QuizEventEmbed;
};

type ClaimRpcResponse = {
  ok: boolean;
  code?: string;
};

const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  series_cap_reached: "You already have 4 upcoming nights of this quiz.",
  same_day_conflict: "You've claimed another quiz on that date.",
  not_allowlisted: "You're not on the host allowlist for this venue.",
  already_claimed: "Another host got there first.",
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
    bannerSuccess: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.medium,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentYellow,
    },
    bannerSuccessText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary },
    bannerError: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.medium,
      borderWidth: borderWidth.default,
      borderColor: semantic.danger,
      backgroundColor: semantic.bgPrimary,
    },
    bannerErrorText: { ...typography.body, color: semantic.danger },
    listContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    card: {
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.brutal,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.medium,
    },
    dateBadge: {
      alignSelf: "flex-start",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentYellow,
      marginBottom: spacing.sm,
    },
    dateBadgeText: { ...typography.captionStrong, fontSize: 12, color: semantic.textPrimary },
    venueName: { ...typography.displaySmall, color: semantic.textPrimary },
    addressLine: { marginTop: spacing.xs, ...typography.body, color: semantic.textSecondary },
    dayTime: { marginTop: spacing.sm, ...typography.bodyStrong, color: semantic.textPrimary },
    feeLine: { marginTop: spacing.xs, ...typography.body, color: semantic.textSecondary },
    payLine: { marginTop: spacing.xs, ...typography.bodyStrong, color: semantic.textPrimary },
    claimBtn: {
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
    claimBtnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    claimBtnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
    claimBtnDisabled: { opacity: 0.5 },
    emptyBox: { alignItems: "center", paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.lg },
    emptyTitle: { marginTop: spacing.lg, ...typography.heading, textAlign: "center", color: semantic.textPrimary },
    emptySub: { marginTop: spacing.sm, ...typography.body, textAlign: "center", color: semantic.textSecondary },
  });
}

export default function OpenNightsScreen() {
  const { session } = useAuth();
  const { semantic } = useAppTheme();
  const styles = useMemo(() => buildStyles(semantic), [semantic]);

  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [claimErrorBanner, setClaimErrorBanner] = useState<string | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const user = session?.user ?? null;

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoadError("You need a signed-in account to view open nights.");
      setRows([]);
      return;
    }

    setLoadError(null);
    setClaimErrorBanner(null);

    const fromIso = todayUkIso();

    const interestsRes = await supabase
      .from("host_series_interests")
      .select("quiz_event_id")
      .eq("host_user_id", user.id);

    if (interestsRes.error) {
      captureSupabaseError("host.open_nights.series_interests", interestsRes.error);
      setLoadError(interestsRes.error.message);
      setRows([]);
      return;
    }

    const seriesIds = (interestsRes.data ?? [])
      .map((r: { quiz_event_id?: string | null }) => r.quiz_event_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (seriesIds.length === 0) {
      setRows([]);
      return;
    }

    const [occRes, claimsRes] = await Promise.all([
      supabase
        .from("quiz_event_occurrences")
        .select(
          "id, quiz_event_id, occurrence_date, quiz_events!inner(id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venue_id, venues(name, postcode, address))"
        )
        .in("quiz_event_id", seriesIds)
        .is("cancelled_at", null)
        .gte("occurrence_date", fromIso)
        .order("occurrence_date", { ascending: true }),
      supabase
        .from("quiz_occurrence_claims")
        .select("quiz_event_id, occurrence_date")
        .in("quiz_event_id", seriesIds)
        .is("released_at", null)
        .gte("occurrence_date", fromIso),
    ]);

    if (occRes.error) {
      captureSupabaseError("host.open_nights.occurrences", occRes.error);
      setLoadError(occRes.error.message);
      setRows([]);
      return;
    }

    if (claimsRes.error) {
      captureSupabaseError("host.open_nights.active_claims", claimsRes.error);
      setLoadError(claimsRes.error.message);
      setRows([]);
      return;
    }

    const claimedKeys = new Set(
      (claimsRes.data ?? []).map(
        (r: { quiz_event_id: string; occurrence_date: string }) =>
          `${r.quiz_event_id}|${r.occurrence_date}`
      )
    );

    const normalized: OccurrenceRow[] = (occRes.data ?? [])
      .map((r: Record<string, unknown>) => ({
        ...(r as { id: string; quiz_event_id: string; occurrence_date: string }),
        quiz_events: normalizeQuizEvent(r.quiz_events),
      }))
      .filter((r) => !claimedKeys.has(`${r.quiz_event_id}|${r.occurrence_date}`));

    setRows(normalized);
  }, [user?.id]);

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

  const onClaim = useCallback(
    async (quizEventId: string, occurrenceDate: string) => {
      if (!user?.id) return;
      const key = `${quizEventId}|${occurrenceDate}`;
      setClaimErrorBanner(null);
      setSuccessBanner(null);
      setClaimingKey(key);

      const { data, error } = await supabase.rpc("host_claim_occurrence", {
        p_quiz_event_id: quizEventId,
        p_occurrence_date: occurrenceDate,
      });
      setClaimingKey(null);

      if (error) {
        captureSupabaseError("host.open_nights.claim_occurrence_rpc", error, {
          quiz_event_id: quizEventId,
          occurrence_date: occurrenceDate,
        });
        setClaimErrorBanner(error.message);
        return;
      }

      const payload = (data ?? {}) as ClaimRpcResponse;
      if (!payload.ok) {
        const code = payload.code ?? "unknown";
        const msg = CLAIM_ERROR_MESSAGES[code] ?? "Couldn't claim this night. Try again.";
        setClaimErrorBanner(msg);
        if (code === "already_claimed" || code === "same_day_conflict") {
          await load();
        }
        return;
      }

      setRows((prev) =>
        prev.filter((r) => !(r.quiz_event_id === quizEventId && r.occurrence_date === occurrenceDate))
      );
      setSuccessBanner(`Claimed ${formatOccurrenceDate(occurrenceDate)} — see My upcoming nights.`);
      await load();
    },
    [user?.id, load]
  );

  const renderItem = useCallback(
    ({ item }: { item: OccurrenceRow }) => {
      const ev = item.quiz_events;
      const venue = ev?.venues;
      const venueName = venue?.name?.trim() || "Venue TBC";
      const addrParts = [venue?.address?.trim(), venue?.postcode?.trim()].filter(Boolean);
      const addressLine = addrParts.length > 0 ? addrParts.join(", ") : null;
      const entryPence = ev?.entry_fee_pence;
      const entryLabel =
        entryPence != null && Number.isFinite(Number(entryPence))
          ? `${formatPounds(Number(entryPence))} entry`
          : "Entry TBC";
      const resolvedHostPence = ev?.host_fee_pence ?? 0;
      const payLabel =
        resolvedHostPence > 0 ? `${formatPounds(resolvedHostPence)} per session` : "Pay TBC";
      const dayTime =
        ev != null ? `${dayLabel(ev.day_of_week)} · ${formatTime(ev.start_time)}` : "Schedule TBC";
      const key = `${item.quiz_event_id}|${item.occurrence_date}`;
      const busy = claimingKey === key;

      return (
        <View style={styles.card}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{formatOccurrenceDate(item.occurrence_date)}</Text>
          </View>
          <Text style={styles.venueName}>{venueName}</Text>
          {addressLine ? <Text style={styles.addressLine}>{addressLine}</Text> : null}
          <Text style={styles.dayTime}>{dayTime}</Text>
          <Text style={styles.feeLine}>{entryLabel}</Text>
          <Text style={styles.payLine}>Your pay: {payLabel}</Text>
          <Pressable
            onPress={() => void onClaim(item.quiz_event_id, item.occurrence_date)}
            disabled={busy}
            style={({ pressed }) => [
              styles.claimBtn,
              pressed && styles.claimBtnPressed,
              busy && styles.claimBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Claim quiz at ${venueName} on ${formatOccurrenceDate(item.occurrence_date)}`}
          >
            <Text style={styles.claimBtnText}>{busy ? "Claiming…" : "Claim"}</Text>
          </Pressable>
        </View>
      );
    },
    [styles, claimingKey, onClaim]
  );

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-alert-outline" size={48} color={colors.grey700} />
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySub}>Sign in to see nights from series you cover.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={semantic.accentYellow} />
          <Text style={styles.loadingText}>Loading open nights…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      {successBanner ? (
        <View style={styles.bannerSuccess}>
          <Text style={styles.bannerSuccessText}>{successBanner}</Text>
        </View>
      ) : null}
      {claimErrorBanner ? (
        <View style={styles.bannerError}>
          <Text style={styles.bannerErrorText}>{claimErrorBanner}</Text>
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.bannerError}>
          <Text style={styles.bannerErrorText}>{loadError}</Text>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={semantic.textPrimary}
            colors={[semantic.accentYellow, semantic.textPrimary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="flag-outline" size={56} color={semantic.textSecondary} />
            <Text style={styles.emptyTitle}>No open nights.</Text>
            <Text style={styles.emptySub}>
              Flag a series with "Cover this quiz" on Available Quizzes to see its open nights here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
