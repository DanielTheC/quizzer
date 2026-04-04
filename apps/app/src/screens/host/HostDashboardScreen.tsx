import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { supabase } from "../../lib/supabase";
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayShort(d: number): string {
  return DAY_SHORT[d] ?? String(d);
}

function formatStartTime(t: string): string {
  const s = String(t);
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

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

export default function HostDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const [rows, setRows] = useState<HostDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight} accessibilityLabel="Settings">
          <MaterialCommunityIcons name="cog-outline" size={24} color={semantic.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    const { data, error } = await supabase.rpc("host_quiz_dashboard_rows");
    if (error) {
      setErrorMsg(error.message);
      setRows([]);
      return;
    }
    const list = (data as HostDashboardRow[] | null) ?? [];
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
    },
    []
  );

  const emptyHint = useMemo(
    () =>
      "No rows usually means your email isn’t on the host allowlist, or there are no active quiz listings.",
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

        {loading ? (
          <ActivityIndicator size="large" color={semantic.textPrimary} style={styles.loader} />
        ) : errorMsg && rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Text style={styles.hintBelow}>{emptyHint}</Text>
            <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]} onPress={() => void load()}>
              <Text style={styles.secondaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.bodyText}>{emptyHint}</Text>
          </View>
        ) : (
          <>
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}
            {rows.map((r) => {
              const cancelled = r.host_cancelled_at != null;
              const busy = savingId === r.quiz_event_id;
              return (
                <View key={r.quiz_event_id} style={styles.card}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {r.venue_name}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {dayShort(r.day_of_week)} {formatStartTime(r.start_time)} · {r.interest_count} interested
                  </Text>

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
                </View>
              );
            })}
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
  headerRight: { padding: spacing.sm, marginRight: spacing.sm },
  loader: { marginTop: spacing.xl },
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
  cardMeta: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
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
  bodyText: { ...typography.body, color: semantic.textSecondary },
  hintBelow: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  errorText: { ...typography.body, color: semantic.danger },
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
