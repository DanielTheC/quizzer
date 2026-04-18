import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "../../context/AuthContext";
import { authEmailForHost } from "../../lib/hostAccess";
import { supabase } from "../../lib/supabase";
import { getHostSessionHistory, type HostCompletedSessionRecord } from "../../lib/runQuizStorage";
import { ScreenTitle } from "../../components/ScreenTitle";
import { HostStackParamList } from "../../navigation/RootNavigator";
import {
  colors,
  playerBrutalCard,
  semantic,
  spacing,
  radius,
  borderWidth,
  shadow,
  typography,
} from "../../theme";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(d: number): string {
  return DAY_SHORT[d] ?? String(d);
}

function formatTime(t: string): string {
  const s = String(t).trim();
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

function formatClaimDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatPoundsFromPence(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(Number(pence))) return "£0.00";
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

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

type HostAllowRow = {
  first_name: string | null;
  last_name: string | null;
  default_fee_pence: number | null;
};

type VenueMini = { name: string | null } | null;

type QuizEventEmbed = {
  venue_id: string;
  day_of_week: number;
  start_time: string;
  venues: VenueMini;
} | null;

type ClaimRow = {
  id: string;
  status: string;
  claimed_at: string;
  reviewed_at: string | null;
  quiz_event_id: string;
  quiz_events: QuizEventEmbed;
};

function normalizeQuizEvent(raw: unknown): QuizEventEmbed {
  if (raw == null) return null;
  const o = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  return o as unknown as QuizEventEmbed;
}

function displayNameFromAllowlist(row: HostAllowRow | null, user: User | null): string {
  if (row) {
    const fn = row.first_name?.trim() || "";
    const ln = row.last_name?.trim() || "";
    const combined = [fn, ln].filter(Boolean).join(" ");
    if (combined) return combined;
  }
  return displayHostName(user);
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

function statusPillStyle(
  status: string
): { bg: string; border: string; text: string; label: string } {
  switch (status) {
    case "pending":
      return {
        bg: semantic.accentOrange,
        border: semantic.borderPrimary,
        text: semantic.textInverse,
        label: "Pending",
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

export default function HostProfileScreen() {
  const { session, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();

  const [hostAllow, setHostAllow] = useState<HostAllowRow | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [sessions, setSessions] = useState<SessionRowVM[]>([]);
  const [isAllowlisted, setIsAllowlisted] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [nameSaveBusy, setNameSaveBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    const u = session?.user;
    const email = authEmailForHost(session);
    if (!u?.id || !email) {
      setHostAllow(null);
      setClaims([]);
      setSessions([]);
      setIsAllowlisted(null);
      setFirstNameDraft("");
      setLastNameDraft("");
      setLoading(false);
      return;
    }

    setLoading(true);
    const [allowRes, claimsRes, history, hostRpc] = await Promise.all([
      supabase
        .from("host_allowlisted_emails")
        .select("first_name, last_name, default_fee_pence")
        .eq("email", email)
        .maybeSingle(),
      supabase
        .from("quiz_claims")
        .select(
          "id, status, claimed_at, reviewed_at, quiz_event_id, quiz_events(venue_id, day_of_week, start_time, venues(name))"
        )
        .eq("host_user_id", u.id)
        .order("claimed_at", { ascending: false }),
      getHostSessionHistory(),
      supabase.rpc("is_allowlisted_host"),
    ]);

    if (allowRes.error) {
      if (__DEV__) console.warn("host_allowlisted_emails:", allowRes.error.message);
      setHostAllow(null);
      setFirstNameDraft("");
      setLastNameDraft("");
    } else {
      const row = allowRes.data as HostAllowRow | null;
      setHostAllow(row);
      setFirstNameDraft(row?.first_name?.trim() ?? "");
      setLastNameDraft(row?.last_name?.trim() ?? "");
    }

    if (claimsRes.error) {
      if (__DEV__) console.warn("quiz_claims profile:", claimsRes.error.message);
      setClaims([]);
    } else {
      const rows = (claimsRes.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        quiz_events: normalizeQuizEvent(r.quiz_events),
      })) as ClaimRow[];
      setClaims(rows);
    }

    const venueIds = [
      ...new Set(history.map((h) => h.venueId).filter((id): id is string => id != null && id.length > 0)),
    ];
    const packIds = [
      ...new Set(history.map((h) => h.packId).filter((id): id is string => id != null && id.length > 0)),
    ];

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

    const sessionRows: SessionRowVM[] = history.map((h) => ({
      ...h,
      venueName: h.venueId ? venueById.get(h.venueId) || "Unknown venue" : "—",
      packName: h.packId ? packById.get(h.packId) || "Unknown pack" : "—",
    }));
    setSessions(sessionRows);

    setIsAllowlisted(hostRpc.error ? null : hostRpc.data === true);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const saveNames = useCallback(async () => {
    const email = authEmailForHost(session);
    if (!email) return;
    setNameSaveBusy(true);
    const { error } = await supabase
      .from("host_allowlisted_emails")
      .update({
        first_name: firstNameDraft.trim() || null,
        last_name: lastNameDraft.trim() || null,
      })
      .eq("email", email);
    setNameSaveBusy(false);
    if (error) {
      if (__DEV__) console.warn("host_allowlisted_emails update:", error.message);
      return;
    }
    setHostAllow((prev) =>
      prev
        ? {
            ...prev,
            first_name: firstNameDraft.trim() || null,
            last_name: lastNameDraft.trim() || null,
          }
        : prev
    );
    setSavedFlash(true);
  }, [session, firstNameDraft, lastNameDraft]);

  const email = user?.email ?? null;
  const runCount = sessions.length;
  const claimsTotal = claims.length;
  const confirmedCount = claims.filter((c) => c.status === "confirmed").length;

  if (!session?.user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScreenTitle subtitle="Sign in to manage your host profile and claims.">Host profile</ScreenTitle>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScreenTitle subtitle="Your host profile, sessions, and claims.">
            {displayNameFromAllowlist(hostAllow, user)}
          </ScreenTitle>
          {email ? <Text style={styles.email}>{email}</Text> : null}

          <View style={styles.nameForm}>
            <Text style={styles.fieldLabel}>Your name</Text>
            <TextInput
              style={styles.input}
              value={firstNameDraft}
              onChangeText={setFirstNameDraft}
              placeholder="First name"
              placeholderTextColor={semantic.textSecondary}
              editable={!nameSaveBusy && !!hostAllow}
              accessibilityLabel="First name"
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              value={lastNameDraft}
              onChangeText={setLastNameDraft}
              placeholder="Last name"
              placeholderTextColor={semantic.textSecondary}
              editable={!nameSaveBusy && !!hostAllow}
              accessibilityLabel="Last name"
            />
            {!hostAllow && !loading ? (
              <Text style={styles.allowHint}>No allowlist entry found for this account.</Text>
            ) : null}
            <Pressable
              onPress={() => void saveNames()}
              disabled={nameSaveBusy || !hostAllow}
              style={({ pressed }) => [
                styles.saveNameBtn,
                (nameSaveBusy || !hostAllow) && styles.btnDisabled,
                pressed && !nameSaveBusy && hostAllow && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save name"
            >
              <Text style={styles.saveNameBtnText}>{nameSaveBusy ? "Saving…" : "Save"}</Text>
            </Pressable>
            {savedFlash ? (
              <Text style={styles.savedText} accessibilityLiveRegion="polite">
                Saved
              </Text>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Quizzes run</Text>
              <Text style={styles.statChipValue}>{loading ? "…" : runCount}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Claims</Text>
              <Text style={styles.statChipValue}>{loading ? "…" : claimsTotal}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Confirmed</Text>
              <Text style={styles.statChipValue}>{loading ? "…" : confirmedCount}</Text>
            </View>
          </View>

          <View style={styles.earningsCard}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            {isAllowlisted === true && hostAllow ? (
              <Text style={styles.earningsMain}>
                Your rate: {formatPoundsFromPence(hostAllow.default_fee_pence)} per session
              </Text>
            ) : isAllowlisted === false ? (
              <Text style={styles.earningsMuted}>Rates appear once you’re an approved host.</Text>
            ) : loading ? (
              <Text style={styles.earningsMuted}>…</Text>
            ) : (
              <Text style={styles.earningsMuted}>Couldn’t load host status.</Text>
            )}
            <Text style={styles.earningsSub}>Full earnings history coming soon</Text>
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

          <Text style={[styles.historyHeading, styles.claimsHeading]}>My claims</Text>
          {loading ? (
            <ActivityIndicator size="small" color={semantic.textPrimary} style={styles.spinnerSmall} />
          ) : claims.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No claims yet. Claim a quiz from Available quizzes.</Text>
            </View>
          ) : (
            claims.map((item) => {
              const ev = item.quiz_events;
              const venueName = ev?.venues?.name?.trim() || "Venue TBC";
              const dayTime =
                ev != null ? `${dayLabel(ev.day_of_week)} · ${formatTime(ev.start_time)}` : "Schedule TBC";
              const pill = statusPillStyle(item.status);
              return (
                <View key={item.id} style={styles.claimCard}>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                    <Text style={[styles.statusPillText, { color: pill.text }]}>{pill.label}</Text>
                  </View>
                  <Text style={styles.claimVenue}>{venueName}</Text>
                  <Text style={styles.claimMeta}>{dayTime}</Text>
                  <Text style={styles.claimDate}>Claimed {formatClaimDate(item.claimed_at)}</Text>
                  {item.status === "confirmed" && ev?.venue_id ? (
                    <Pressable
                      onPress={() => navigation.navigate("RunQuiz", { mode: "new", venueId: ev.venue_id })}
                      accessibilityRole="link"
                      accessibilityLabel="Run quiz"
                      style={({ pressed }) => [pressed && styles.btnPressed]}
                    >
                      <Text style={styles.runQuizLink}>Run Quiz</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  flex: { flex: 1 },
  scroll: { padding: spacing.xxl, paddingBottom: 48 },
  email: { ...typography.body, color: semantic.textSecondary, marginTop: spacing.xs },
  nameForm: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...playerBrutalCard,
  },
  fieldLabel: { ...typography.labelUppercase, color: semantic.textSecondary },
  input: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
    ...typography.body,
    color: semantic.textPrimary,
  },
  inputSpaced: { marginTop: spacing.sm },
  allowHint: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  saveNameBtn: {
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
  saveNameBtnText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary },
  savedText: { ...typography.caption, color: semantic.accentGreen, marginTop: spacing.sm, fontWeight: "600" },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  btnDisabled: { opacity: 0.55 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    ...playerBrutalCard,
  },
  statChipLabel: { ...typography.caption, color: semantic.textSecondary, textAlign: "center" },
  statChipValue: {
    ...typography.bodyStrong,
    fontSize: 20,
    color: semantic.textPrimary,
    marginTop: spacing.xs,
  },
  earningsCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...playerBrutalCard,
  },
  sectionTitle: { ...typography.labelUppercase, color: semantic.textSecondary, marginBottom: spacing.sm },
  earningsMain: { ...typography.body, color: semantic.textPrimary },
  earningsMuted: { ...typography.body, color: semantic.textSecondary },
  earningsSub: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  historyHeading: {
    ...typography.labelUppercase,
    color: semantic.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  claimsHeading: { marginTop: spacing.xl },
  spinner: { marginTop: spacing.lg },
  spinnerSmall: { marginTop: spacing.md, alignSelf: "flex-start" },
  emptyCard: {
    padding: spacing.lg,
    ...playerBrutalCard,
  },
  emptyText: { ...typography.body, color: semantic.textSecondary, lineHeight: 22 },
  sessionCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...playerBrutalCard,
  },
  sessionVenue: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  sessionMeta: { ...typography.body, color: semantic.textPrimary, marginTop: spacing.xs },
  sessionWhen: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.sm },
  claimCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...playerBrutalCard,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth.default,
    marginBottom: spacing.sm,
  },
  statusPillText: { ...typography.captionStrong, fontSize: 12 },
  claimVenue: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  claimMeta: { marginTop: spacing.xs, ...typography.body, color: semantic.textSecondary },
  claimDate: { marginTop: spacing.sm, ...typography.caption, color: semantic.textSecondary },
  runQuizLink: {
    marginTop: spacing.sm,
    ...typography.captionStrong,
    fontSize: 14,
    color: semantic.accentBlue,
    textDecorationLine: "underline",
  },
});
