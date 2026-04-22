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

type VenueEmbed = {
  name: string;
  postcode: string | null;
  address: string | null;
} | null;

type QuizEventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  host_fee_pence: number | null;
  venues: VenueEmbed;
};

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique") || m.includes("23505");
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

export default function AvailableQuizzesScreen() {
  const { session } = useAuth();
  const { semantic } = useAppTheme();
  const styles = useMemo(() => buildStyles(semantic), [semantic]);

  const [defaultFeePence, setDefaultFeePence] = useState<number>(0);
  const [quizzes, setQuizzes] = useState<QuizEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [claimErrorBanner, setClaimErrorBanner] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const user = session?.user ?? null;
  const email = user?.email ?? null;

  const load = useCallback(async () => {
    if (!email || !user?.id) {
      setLoadError("You need a signed-in account with an email to view available quizzes.");
      setQuizzes([]);
      setDefaultFeePence(0);
      return;
    }

    setLoadError(null);
    setClaimErrorBanner(null);

    const [allowRes, eventsRes, claimsRes] = await Promise.all([
      supabase.from("host_allowlisted_emails").select("default_fee_pence").eq("email", email).maybeSingle(),
      supabase
        .from("quiz_events")
        .select("id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venues(name, postcode, address)")
        .eq("is_active", true),
      supabase.from("quiz_claims").select("quiz_event_id").in("status", ["pending", "confirmed"]),
    ]);

    if (allowRes.error) {
      captureSupabaseError("host.available.allowlisted_by_email", allowRes.error);
      setLoadError(allowRes.error.message);
      setQuizzes([]);
      return;
    }

    const feeRaw = allowRes.data?.default_fee_pence;
    setDefaultFeePence(feeRaw != null && Number.isFinite(Number(feeRaw)) ? Number(feeRaw) : 0);

    if (eventsRes.error) {
      captureSupabaseError("host.available.active_events_list", eventsRes.error);
      setLoadError(eventsRes.error.message);
      setQuizzes([]);
      return;
    }

    if (claimsRes.error) {
      captureSupabaseError("host.available.active_claims_list", claimsRes.error);
      setLoadError(claimsRes.error.message);
      setQuizzes([]);
      return;
    }

    const claimedIds = new Set(
      (claimsRes.data ?? []).map((r: { quiz_event_id: string }) => r.quiz_event_id).filter(Boolean)
    );
    const rows = (eventsRes.data ?? []) as QuizEventRow[];
    setQuizzes(rows.filter((q) => !claimedIds.has(q.id)));
  }, [email, user?.id]);

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
    async (quizEventId: string) => {
      if (!user?.id || !email) return;
      setClaimErrorBanner(null);
      setSuccessBanner(null);
      setClaimingId(quizEventId);
      const { error } = await supabase.from("quiz_claims").insert({
        quiz_event_id: quizEventId,
        host_user_id: user.id,
        host_email: email,
      });
      setClaimingId(null);

      if (error) {
        if (isUniqueViolation(error)) {
          setClaimErrorBanner("Someone else just claimed this quiz. The list has been refreshed.");
          await load();
          return;
        }
        captureSupabaseError("host.available.claim_insert", error, { quiz_event_id: quizEventId });
        setClaimErrorBanner(error.message);
        return;
      }

      setSuccessBanner("Claim submitted — awaiting operator confirmation.");
      await load();
    },
    [email, user?.id, load]
  );

  const renderItem = useCallback(
    ({ item }: { item: QuizEventRow }) => {
      const venue = item.venues;
      const venueName = venue?.name?.trim() || "Venue TBC";
      const addrParts = [venue?.address?.trim(), venue?.postcode?.trim()].filter(Boolean);
      const addressLine = addrParts.length > 0 ? addrParts.join(", ") : null;
      const entryPence = item.entry_fee_pence;
      const entryLabel =
        entryPence != null && Number.isFinite(Number(entryPence))
          ? `${formatPounds(Number(entryPence))} entry`
          : "Entry TBC";
      const resolvedHostPence = item.host_fee_pence ?? defaultFeePence;
      const payLabel =
        resolvedHostPence > 0 ? `${formatPounds(resolvedHostPence)} per session` : "Pay TBC";
      const busy = claimingId === item.id;

      return (
        <View style={styles.card}>
          <Text style={styles.venueName}>{venueName}</Text>
          {addressLine ? <Text style={styles.addressLine}>{addressLine}</Text> : null}
          <Text style={styles.dayTime}>
            {dayLabel(item.day_of_week)} · {formatTime(item.start_time)}
          </Text>
          <Text style={styles.feeLine}>{entryLabel}</Text>
          <Text style={styles.payLine}>Your pay: {payLabel}</Text>
          <Pressable
            onPress={() => onClaim(item.id)}
            disabled={busy}
            style={({ pressed }) => [styles.claimBtn, pressed && styles.claimBtnPressed, busy && styles.claimBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={`Claim quiz at ${venueName}`}
          >
            <Text style={styles.claimBtnText}>{busy ? "Claiming…" : "Claim"}</Text>
          </Pressable>
        </View>
      );
    },
    [styles, defaultFeePence, claimingId, onClaim]
  );

  if (!email) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="email-alert-outline" size={48} color={colors.grey700} />
          <Text style={styles.emptyTitle}>Email required</Text>
          <Text style={styles.emptySub}>Available quizzes use your account email. Sign in with an email-based method.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={semantic.accentYellow} />
          <Text style={styles.loadingText}>Loading quizzes…</Text>
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
        data={quizzes}
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
            <MaterialCommunityIcons name="calendar-remove-outline" size={56} color={semantic.textSecondary} />
            <Text style={styles.emptyTitle}>No quizzes available to claim right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
