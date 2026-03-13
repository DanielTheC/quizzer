import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { NearbyStackParamList } from "../../navigation/RootNavigator";
import { semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

type QuizDetailRoute = RouteProp<NearbyStackParamList, "QuizDetail">;

type QuizEventDetail = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  fee_basis: string;
  prize: string;
  turn_up_guidance: string | null;
  venues: {
    name: string;
    address: string;
    postcode: string | null;
    city: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayNameShort(day: number) {
  return DAY_SHORT[day] ?? String(day);
}

function formatTime(time: string): string {
  const s = String(time);
  if (s.length >= 5) return s.slice(0, 5);
  if (s.length >= 2) return `${s.slice(0, 2)}:${s.slice(2)}`;
  return s;
}

function prizeLabel(prize: string): string {
  if (!prize) return "—";
  return prize.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Address line for share: full address, or area/postcode if full would be long. */
function shareAddressLine(venue: QuizEventDetail["venues"]): string {
  if (!venue) return "";
  const full = [venue.address, venue.postcode, venue.city].filter(Boolean).join(", ");
  if (!full) return "";
  if (full.length <= 55) return full;
  const short = [venue.postcode, venue.city].filter(Boolean).join(", ");
  return short || venue.address || full;
}

/** Build share message: hook + venue, address, day/time, fee, prize, CTA. Missing fields handled. */
function buildShareMessage(quiz: QuizEventDetail): string {
  const venue = quiz.venues;
  const venueName = venue?.name?.trim() || "Quiz night";
  const address = shareAddressLine(venue);
  const dayTime = `${dayNameShort(quiz.day_of_week)} ${formatTime(quiz.start_time)}`;
  const feePence = quiz.entry_fee_pence;
  const feeStr =
    feePence == null || typeof feePence !== "number"
      ? "—"
      : feePence === 0
        ? "Free"
        : `£${(feePence / 100).toFixed(2)}`;
  const prize = prizeLabel(quiz.prize ?? "");

  const lines: string[] = [
    "Pub quiz near you on Quizzer:",
    "",
    venueName,
    address ? `📍 ${address}` : "",
    dayTime,
    `Entry: ${feeStr} • Prize: ${prize}`,
    "",
    "Find it on Quizzer",
  ];
  return lines.filter(Boolean).join("\n");
}

export default function QuizDetailScreen() {
  const route = useRoute<QuizDetailRoute>();
  const quizEventId = route.params?.quizEventId ?? null;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizEventDetail | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { isSaved, toggleSaved } = useSavedQuizzes();

  useEffect(() => {
    if (!quizEventId) {
      setLoading(false);
      setErrorMsg("Missing quiz.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      const { data, error } = await supabase
        .from("quiz_events")
        .select(
          `
          id,
          day_of_week,
          start_time,
          entry_fee_pence,
          fee_basis,
          prize,
          turn_up_guidance,
          venues (
            name,
            address,
            postcode,
            city,
            lat,
            lng
          )
        `
        )
        .eq("id", quizEventId)
        .single();

      if (cancelled) return;
      if (error) {
        setErrorMsg(error.message);
        setQuiz(null);
      } else {
        setQuiz(data as QuizEventDetail);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [quizEventId, retryCount]);

  const openInMaps = useCallback(() => {
    if (!quiz) return;
    const venue = quiz.venues;
    const venueName = venue?.name ?? "Venue";
    const fullAddress = [venue?.address, venue?.postcode, venue?.city].filter(Boolean).join(", ");
    const lat = venue?.lat;
    const lng = venue?.lng;
    const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
    const query = hasCoords ? `${lat},${lng}` : (fullAddress ? `${venueName}, ${fullAddress}` : venueName);
    const encoded = encodeURIComponent(query);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch(() => {});
  }, [quiz]);

  const shareQuiz = useCallback(() => {
    if (!quiz) return;
    const venueName = quiz.venues?.name?.trim() ?? "Quiz night";
    const message = buildShareMessage(quiz);
    Share.share({
      title: `Quiz: ${venueName}`,
      message,
    }).catch(() => {});
  }, [quiz]);

  const venue = quiz?.venues;
  const venueName = venue?.name ?? "Venue";
  const fee = quiz ? `£${(quiz.entry_fee_pence / 100).toFixed(2)}` : "";
  const basis = quiz ? (quiz.fee_basis === "per_team" ? "per team" : "per person") : "";
  const fullAddress =
    venue != null
      ? [venue.address, venue.postcode, venue.city].filter(Boolean).join(", ")
      : "";
  const prize = quiz ? prizeLabel(quiz.prize) : "";
  const timeStr = quiz ? formatTime(quiz.start_time) : "";

  return (
    <SafeAreaView style={styles.screen}>
      {!quizEventId ? (
        <View style={styles.centerBox}>
          <Text style={styles.heading}>Missing quiz</Text>
          <Text style={styles.mutedText}>No quiz was selected. Go back and tap a quiz from the list.</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={semantic.textPrimary} />
        </View>
      ) : errorMsg || !quiz ? (
        <View style={styles.centerBox}>
          <Text style={styles.heading}>Couldn’t load quiz</Text>
          <Text style={styles.mutedText}>{errorMsg ?? "Unknown error"}</Text>
          <Pressable
            onPress={() => setRetryCount((c) => c + 1)}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnPrimaryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Text style={styles.venueTitle}>{venueName}</Text>
            <Pressable onPress={() => quizEventId && toggleSaved(quizEventId)} hitSlop={12} style={styles.heartWrap}>
              <Text style={[styles.heart, quizEventId && isSaved(quizEventId) && styles.heartSaved]}>
                {quizEventId && isSaved(quizEventId) ? "♥" : "♡"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.metaLine}>{dayNameShort(quiz.day_of_week)} • {timeStr}</Text>
          <Text style={styles.metaLine}>Entry: {fee} {basis}</Text>
          <Text style={styles.metaLine}>Prize: {prize}</Text>

          {fullAddress ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <Text style={styles.sectionBody}>{fullAddress}</Text>
            </View>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={openInMaps}
              style={({ pressed }) => [styles.btnPrimary, styles.btnFlex, pressed && styles.btnPressed]}
            >
              <Text style={styles.btnPrimaryText}>Open in Maps</Text>
            </Pressable>
            <Pressable
              onPress={shareQuiz}
              style={({ pressed }) => [styles.btnSecondary, styles.btnFlex, pressed && styles.btnPressed]}
            >
              <Text style={styles.btnSecondaryText}>Share this quiz</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to expect</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• 8 rounds, 5 questions each, plus a picture round</Text>
              <Text style={styles.bullet}>• Answers written on paper, host enters totals halfway and at the end</Text>
              <Text style={styles.bullet}>• One round can be chosen as a Bonus Round (double points), rounds 1–8 only</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Turn up guidance</Text>
            <Text style={styles.sectionBody}>
              {quiz.turn_up_guidance ?? "Arrive 10–15 minutes early to bag a table."}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bgSecondary },
  centerBox: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { ...typography.heading, fontSize: 18, color: semantic.textPrimary },
  mutedText: { marginTop: spacing.sm, ...typography.body, color: semantic.textSecondary },
  btnPrimary: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgInverse,
    alignSelf: "flex-start",
    alignItems: "center",
    ...shadow.small,
  },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  btnPrimaryText: { color: semantic.textInverse, ...typography.bodyStrong, fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  venueTitle: { fontSize: 26, fontWeight: "800", flex: 1, color: semantic.textPrimary },
  heartWrap: { padding: spacing.xs },
  heart: { fontSize: 28, color: semantic.textSecondary },
  heartSaved: { color: semantic.accentRed },
  metaLine: { marginTop: spacing.sm, ...typography.body, color: semantic.textPrimary },
  section: { marginTop: spacing.lg },
  sectionTitle: { ...typography.heading, color: semantic.textPrimary },
  sectionBody: { marginTop: spacing.sm, fontSize: 15, lineHeight: 22, color: semantic.textSecondary },
  buttonRow: { marginTop: spacing.xl, flexDirection: "row", marginRight: -spacing.sm },
  btnFlex: { flex: 1, marginRight: spacing.sm, alignItems: "center" },
  btnSecondary: {
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentBlue,
    alignItems: "center",
    ...shadow.small,
  },
  btnSecondaryText: { color: semantic.textInverse, ...typography.bodyStrong },
  bulletList: { marginTop: spacing.sm },
  bullet: { fontSize: 15, lineHeight: 22, color: semantic.textSecondary, marginBottom: spacing.sm },
});
