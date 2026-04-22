import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  View,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomIn,
} from "react-native-reanimated";
import { PaperGrainOverlay } from "../../components/PaperGrainOverlay";
import { QuizDetailSkeleton } from "../../components/QuizDetailSkeleton";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  fetchQuizEventDetailForScreen,
  prefetchQuizEventDetail,
  type QuizEventDetail,
} from "../../lib/quizEventDetailCache";
import { supabase } from "../../lib/supabase";
import { fetchClosestOtherQuizzes, type ClosestOtherQuizRow } from "../../lib/fetchClosestOtherQuizzes";
import { postcodeOutwardOrArea } from "../../lib/venueLocationSnippet";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { useInterestedOccurrences } from "../../context/InterestedOccurrencesContext";
import { useAppTheme } from "../../context/ThemeContext";
import type { NearbyStackParamList } from "../../navigation/RootNavigator";
import { heartScalePeak, heartSpringIn, heartSpringOut } from "../../lib/heartPressAnimation";
import { hapticLight, hapticMedium, hapticSavedQuiz } from "../../lib/playerHaptics";
import { formatTime24 as formatTime } from "../../lib/formatters";
import {
  colors,
  fonts,
  spacing,
  radius,
  borderWidth,
  shadow,
  typography,
  websiteCta,
  type SemanticTheme,
  type DetailScreenTheme,
} from "../../theme";

type QuizDetailRoute = RouteProp<NearbyStackParamList, "QuizDetail">;
type QuizDetailNavigationParams = { QuizDetail: { quizEventId: string } };
type QuizDetailNavigation = NativeStackNavigationProp<QuizDetailNavigationParams, "QuizDetail">;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayNameShort(day: number) {
  return DAY_SHORT[day] ?? String(day);
}

function prizeLabel(prize: string): string {
  if (!prize) return "—";
  return prize.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function shareAddressLine(venue: QuizEventDetail["venues"]): string {
  if (!venue) return "";
  const full = [venue.address, venue.postcode, venue.city].filter(Boolean).join(", ");
  if (!full) return "";
  if (full.length <= 55) return full;
  const short = [venue.postcode, venue.city].filter(Boolean).join(", ");
  return short || venue.address || full;
}

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

const DEFAULT_WHAT_TO_EXPECT = [
  "8 rounds, 5 questions each, plus a picture round.",
  "Answers on paper; host enters totals halfway and at the end.",
  "Bonus round (double points) for one of rounds 1–8 only.",
] as const;

function fullVenueAddress(venue: QuizEventDetail["venues"] | null | undefined): string {
  if (!venue) return "";
  return [venue.address, venue.postcode, venue.city].filter(Boolean).join(", ").trim();
}

/** Venue copy only (default bullets if empty). Shown after turn-up inside “What to expect”. */
function whatToExpectVenueLines(quiz: QuizEventDetail): string[] {
  const raw = quiz.venues?.what_to_expect?.trim();
  if (!raw) return [...DEFAULT_WHAT_TO_EXPECT];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [...DEFAULT_WHAT_TO_EXPECT];
}

/** Turn-up line plus venue “what to expect” (or defaults). Entry / prize / address sit above this section. */
function buildWhatToExpectLines(quiz: QuizEventDetail): string[] {
  const turnUp = quiz.turn_up_guidance?.trim() || "Arrive 10–15 minutes early to bag a table.";
  return [turnUp, ...whatToExpectVenueLines(quiz)];
}

type UpcomingOccurrenceChip = {
  occurrence_date: string;
  cancelled: boolean;
  interest_count: number;
};

function formatOccurrenceChipTitle(occurrenceDate: string, startTime: string): string {
  const [y, m, d] = occurrenceDate.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return `${occurrenceDate} · ${formatTime(startTime)}`;
  }
  const dt = new Date(Date.UTC(y as number, (m as number) - 1, d as number));
  const weekday = dayNameShort(dt.getUTCDay());
  const day = dt.getUTCDate();
  const month = dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month} · ${formatTime(startTime)}`;
}

function interestCountLabel(count: number): string {
  if (count === 1) return "1 going";
  return `${count} going`;
}

function venueImagePublicUrl(storagePath: string): string {
  return supabase.storage.from("venue-images").getPublicUrl(storagePath).data.publicUrl;
}

function QuizDetailHeartAction({
  saved,
  quizEventId,
  onToggleSaved,
  btnStyle,
  btnPressedStyle,
  labelStyle,
  iconRingStyle,
  heartOutlineColor,
  iconSize = 18,
}: {
  saved: boolean;
  quizEventId: string;
  onToggleSaved: (id: string) => void;
  btnStyle: ViewStyle;
  btnPressedStyle: ViewStyle;
  labelStyle: TextStyle;
  iconRingStyle: ViewStyle;
  heartOutlineColor: string;
  iconSize?: number;
}) {
  const { semantic } = useAppTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPress = useCallback(() => {
    scale.value = withSequence(
      withSpring(heartScalePeak, heartSpringIn),
      withSpring(1, heartSpringOut)
    );
    if (saved) hapticLight();
    else hapticSavedQuiz();
    onToggleSaved(quizEventId);
  }, [saved, quizEventId, onToggleSaved, scale]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [btnStyle, pressed && btnPressedStyle]}
      accessibilityLabel={saved ? "Remove from saved" : "Save quiz"}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
    >
      <View style={iconRingStyle}>
        <Animated.View style={animatedStyle}>
          <MaterialCommunityIcons
            name={saved ? "heart" : "heart-outline"}
            size={iconSize}
            color={saved ? semantic.accentRed : heartOutlineColor}
          />
        </Animated.View>
      </View>
      <Text style={labelStyle}>{saved ? "Saved" : "Save"}</Text>
    </Pressable>
  );
}

function createQuizDetailStyles(semantic: SemanticTheme, detail: DetailScreenTheme, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bgSecondary },
    centerBox: { flex: 1, padding: spacing.lg, justifyContent: "center" },
    heading: { ...typography.heading, fontSize: 18, color: semantic.textPrimary },
    mutedText: { marginTop: spacing.sm, ...typography.body, color: semantic.textSecondary },
    btnPrimary: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.brutal,
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
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    ticketCard: {
      backgroundColor: semantic.bgPrimary,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      overflow: "hidden",
      marginBottom: spacing.lg,
      ...shadow.large,
    },
    ticketStripe: {
      height: 10,
      backgroundColor: semantic.bgPrimary,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    },
    ticketBody: { padding: spacing.lg },
    ticketHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    ticketHeaderMug: {
      marginRight: spacing.sm,
      alignSelf: "flex-start",
      marginTop: 3,
    },
    ticketHeaderLeft: {
      flex: 1,
      minWidth: 0,
      marginRight: spacing.sm,
    },
    ticketHeaderInline: {
      lineHeight: 26,
    },
    ticketHeaderVenue: {
      fontSize: 22,
      fontWeight: "400",
      fontFamily: fonts.display,
      letterSpacing: -0.45,
      color: detail.ticketInkPrimary,
    },
    /** Match QuizCard `pubPostcode` (Find a quiz list). */
    ticketHeaderPostcode: {
      fontSize: 15,
      fontWeight: "600",
      color: semantic.textSecondary,
      letterSpacing: 0.2,
    },
    ticketHeaderPills: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: spacing.xs,
      maxWidth: "42%",
    },
    ticketHeaderTimePill: {
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: colors.yellow,
    },
    ticketHeaderTimePillText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.black,
      fontVariant: ["tabular-nums"],
    },
    ticketHeaderDayPill: {
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: colors.black,
      minWidth: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    ticketHeaderDayPillText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.2,
      color: colors.yellow,
      textAlign: "center",
    },
    ticketHeaderCadencePill: {
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentYellow,
    },
    ticketHeaderCadencePillText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.85,
      color: colors.black,
      textTransform: "uppercase",
      fontFamily: fonts.display,
    },
    ticketActionsFooter: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: borderWidth.thin,
      borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
      gap: spacing.sm,
    },
    ticketActionSavePrimary: {
      flexDirection: "row",
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      ...websiteCta.yellow,
      borderRadius: radius.brutal,
      gap: spacing.sm,
    },
    ticketActionSavePrimaryText: {
      ...typography.bodyStrong,
      fontSize: 16,
      color: colors.black,
    },
    ticketActionsSecondaryRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.sm,
    },
    ticketActionShare: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm,
      ...websiteCta.blue,
      borderRadius: radius.brutal,
      gap: spacing.xs,
    },
    ticketActionMaps: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm,
      ...websiteCta.pink,
      borderRadius: radius.brutal,
      gap: spacing.xs,
    },
    ticketActionBtnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    ticketActionLabelInverse: {
      ...typography.captionStrong,
      color: colors.white,
      fontSize: 13,
    },
    actionIconRing: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: detail.ticketIconRingBg,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
    actionIconRingPrimary: {
      backgroundColor: "rgba(255,255,255,0.22)",
      borderColor: "rgba(0,0,0,0.12)",
    },
    actionIconRingTransparent: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    ticketHairline: {
      height: borderWidth.default,
      backgroundColor: semantic.borderPrimary,
      marginTop: spacing.md,
      opacity: 0.85,
    },
    factRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
    },
    factIcon: { marginRight: spacing.sm },
    factText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: detail.ticketInkSecondary,
      lineHeight: 22,
    },
    galleryScroll: {
      marginTop: spacing.md,
      marginHorizontal: -spacing.lg,
    },
    galleryContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    galleryImage: {
      width: 220,
      height: 140,
      borderRadius: radius.large,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
    },
    ticketAddressBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: borderWidth.thin,
      borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    },
    ticketAddressText: {
      fontSize: 14,
      lineHeight: 22,
      color: semantic.textSecondary,
    },
    upcomingSection: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: borderWidth.thin,
      borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    },
    upcomingHeader: {
      ...typography.labelUppercase,
      marginBottom: spacing.sm,
      color: semantic.textPrimary,
    },
    upcomingRow: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    upcomingChip: {
      minWidth: 118,
      flexGrow: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.medium,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.bgPrimary,
      ...shadow.small,
    },
    upcomingChipPressed: {
      transform: [{ translateY: 2 }],
      shadowOffset: { width: 1, height: 1 },
    },
    upcomingChipTitle: {
      ...typography.captionStrong,
      fontSize: 12,
      color: detail.ticketInkPrimary,
      lineHeight: 16,
    },
    upcomingChipCount: {
      marginTop: spacing.xs,
      ...typography.caption,
      fontSize: 12,
      color: semantic.textSecondary,
    },
    upcomingChipInterested: {
      backgroundColor: semantic.accentGreen,
    },
    upcomingChipInterestedTitle: {
      color: colors.black,
    },
    upcomingChipInterestedCount: {
      color: colors.black,
      fontWeight: "700",
    },
    upcomingChipCancelled: {
      opacity: 0.68,
      backgroundColor: isDark ? semantic.bgSecondary : "#f5f5f5",
    },
    upcomingChipCancelledText: {
      marginTop: spacing.xs,
      ...typography.captionStrong,
      fontSize: 11,
      color: semantic.danger,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bulletList: { marginTop: spacing.xs },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
    },
    ticketInsetSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: borderWidth.thin,
      borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    },
    ticketEyebrow: {
      ...typography.labelUppercase,
      marginBottom: spacing.sm,
      color: semantic.textPrimary,
    },
    ticketBulletDot: {
      width: 8,
      height: 8,
      marginTop: 7,
      marginRight: spacing.sm,
      borderRadius: 2,
      backgroundColor: semantic.textPrimary,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
    ticketBulletText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 22,
      color: semantic.textSecondary,
    },
    nearbySection: {
      marginTop: spacing.lg,
    },
    nearbyEyebrow: {
      ...typography.labelUppercase,
      marginBottom: spacing.sm,
      color: semantic.textPrimary,
    },
    nearbyCard: {
      backgroundColor: isDark ? semantic.bgPrimary : colors.white,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      overflow: "hidden",
      ...shadow.small,
    },
    nearbyRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    nearbyRowBorder: {
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    },
    nearbyRowPressed: { opacity: 0.92 },
    nearbyRowBody: { flex: 1, minWidth: 0 },
    nearbyRowTitle: {
      fontSize: 16,
      fontWeight: "700",
      fontFamily: fonts.display,
      color: detail.ticketInkPrimary,
    },
    nearbyRowMeta: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: "600",
      color: semantic.textSecondary,
    },
  });
}

export default function QuizDetailScreen() {
  const { semantic, detail, isDark } = useAppTheme();
  const styles = useMemo(() => createQuizDetailStyles(semantic, detail, isDark), [semantic, detail, isDark]);

  const navigation = useNavigation<QuizDetailNavigation>();
  const route = useRoute<QuizDetailRoute>();
  const quizEventId = route.params?.quizEventId ?? null;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizEventDetail | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [upcomingOccurrences, setUpcomingOccurrences] = useState<UpcomingOccurrenceChip[]>([]);
  const [chipBusyKey, setChipBusyKey] = useState<string | null>(null);
  const [otherNearby, setOtherNearby] = useState<ClosestOtherQuizRow[] | null>(null);
  const { isSaved, toggleSaved } = useSavedQuizzes();
  const { isInterestedOccurrence, primeInterestedOccurrences, toggleInterestedOccurrence } = useInterestedOccurrences();

  const saved = quizEventId != null && isSaved(quizEventId);

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
      const { data, error } = await fetchQuizEventDetailForScreen(quizEventId);
      if (cancelled) return;
      if (error) {
        setErrorMsg(error);
        setQuiz(null);
      } else {
        setQuiz(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quizEventId, retryCount]);

  useEffect(() => {
    if (!quizEventId || !quiz) {
      setUpcomingOccurrences([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_upcoming_quiz_occurrences", {
        p_quiz_event_id: quizEventId,
        p_limit: 3,
      });
      if (cancelled) return;
      if (error) {
        setUpcomingOccurrences([]);
        return;
      }
      const rows = ((data ?? []) as Array<{
        occurrence_date?: string | null;
        cancelled?: boolean | null;
        interest_count?: number | string | null;
      }>)
        .map((r) => ({
          occurrence_date: String(r.occurrence_date ?? ""),
          cancelled: Boolean(r.cancelled),
          interest_count: Number(r.interest_count ?? 0) || 0,
        }))
        .filter((r) => r.occurrence_date.length > 0);
      setUpcomingOccurrences(rows);
      await primeInterestedOccurrences(
        quizEventId,
        rows.map((r) => r.occurrence_date)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [quizEventId, quiz?.id, retryCount, primeInterestedOccurrences]);

  useEffect(() => {
    if (!quizEventId || !quiz || quiz.id !== quizEventId) {
      setOtherNearby(null);
      return;
    }
    const lat = quiz.venues?.lat;
    const lng = quiz.venues?.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setOtherNearby([]);
      return;
    }
    let cancelled = false;
    void fetchClosestOtherQuizzes(quiz.id, lat, lng, 2).then((rows) => {
      if (!cancelled) setOtherNearby(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [quizEventId, quiz?.id, quiz?.venues?.lat, quiz?.venues?.lng]);

  const openOtherNearbyQuiz = useCallback(
    (id: string) => {
      if (!id || id === quizEventId) return;
      hapticLight();
      navigation.push("QuizDetail", { quizEventId: id });
    },
    [navigation, quizEventId]
  );

  const onToggleOccurrenceChip = useCallback(
    async (occurrenceDate: string) => {
      if (!quizEventId) return;
      const key = `${quizEventId}|${occurrenceDate}`;
      if (chipBusyKey === key) return;
      const currentlyInterested = isInterestedOccurrence(quizEventId, occurrenceDate);
      setChipBusyKey(key);
      setUpcomingOccurrences((prev) =>
        prev.map((row) =>
          row.occurrence_date === occurrenceDate
            ? { ...row, interest_count: Math.max(0, row.interest_count + (currentlyInterested ? -1 : 1)) }
            : row
        )
      );
      const result = await toggleInterestedOccurrence(quizEventId, occurrenceDate);
      if (!result.ok) {
        setUpcomingOccurrences((prev) =>
          prev.map((row) =>
            row.occurrence_date === occurrenceDate
              ? { ...row, interest_count: Math.max(0, row.interest_count + (currentlyInterested ? 1 : -1)) }
              : row
          )
        );
      } else {
        hapticLight();
      }
      setChipBusyKey(null);
    },
    [quizEventId, chipBusyKey, isInterestedOccurrence, toggleInterestedOccurrence]
  );

  const openInMaps = useCallback(() => {
    if (!quiz) return;
    hapticMedium();
    const venue = quiz.venues;
    const venueName = venue?.name ?? "Venue";
    const fullAddress = fullVenueAddress(venue);
    const lat = venue?.lat;
    const lng = venue?.lng;
    const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
    const query = hasCoords ? `${lat},${lng}` : (fullAddress ? `${venueName}, ${fullAddress}` : venueName);
    const encoded = encodeURIComponent(query);
    const url = Platform.OS === "ios" ? `maps://?q=${encoded}` : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`).catch(() => {});
    });
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

  useLayoutEffect(() => {
    const headerTitleText =
      quiz?.venues?.name?.trim() ||
      (quizEventId && loading ? "Loading…" : errorMsg ? "Quiz" : "Quiz");
    navigation.setOptions({
      headerTitle: headerTitleText,
      headerBackTitle: "",
      headerStyle: { backgroundColor: semantic.accentYellow },
      headerTintColor: semantic.textPrimary,
      headerTitleStyle: {
        fontFamily: fonts.display,
        fontWeight: "400",
        fontSize: 17,
        color: semantic.textPrimary,
      },
      headerShadowVisible: false,
      headerRight: undefined,
    });
  }, [navigation, quiz, quizEventId, loading, errorMsg, semantic]);

  const venue = quiz?.venues;
  const venueName = venue?.name ?? "Venue";
  const fee = quiz ? `£${(quiz.entry_fee_pence / 100).toFixed(2)}` : "";
  const basis = quiz ? (quiz.fee_basis === "per_team" ? "per team" : "per person") : "";
  const prize = quiz ? prizeLabel(quiz.prize) : "";
  const timeStr = quiz ? formatTime(quiz.start_time) : "";
  const locationSnippet = venue ? postcodeOutwardOrArea(venue) : "";
  const dayLabelTop =
    quiz && quiz.day_of_week === new Date().getDay()
      ? "Today"
      : quiz
        ? dayNameShort(quiz.day_of_week)
        : "";

  const statusBarStyle: "light" | "dark" = isDark ? "light" : "dark";

  return (
    <SafeAreaView style={styles.screen}>
      <PaperGrainOverlay stripeColor={semantic.textPrimary} />
      {!quizEventId ? (
        <View style={styles.centerBox}>
          <Text style={styles.heading}>Missing quiz</Text>
          <Text style={styles.mutedText}>No quiz was selected. Go back and tap a quiz from the list.</Text>
        </View>
      ) : loading ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <StatusBar style={statusBarStyle} />
          <QuizDetailSkeleton />
        </ScrollView>
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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <StatusBar style={statusBarStyle} />

          <Animated.View entering={ZoomIn.springify().damping(16).mass(0.8)} style={styles.ticketCard}>
            <View style={styles.ticketStripe} />
            <View style={styles.ticketBody}>
              <View style={styles.ticketHeaderRow}>
                <MaterialCommunityIcons
                  name="glass-mug-variant"
                  size={24}
                  color={detail.ticketInkPrimary}
                  style={styles.ticketHeaderMug}
                />
                <View style={styles.ticketHeaderLeft}>
                  <Text style={styles.ticketHeaderInline} numberOfLines={2}>
                    <Text style={styles.ticketHeaderVenue}>{venueName}</Text>
                    {locationSnippet ? (
                      <Text style={styles.ticketHeaderPostcode}>{` · ${locationSnippet}`}</Text>
                    ) : null}
                  </Text>
                  {quiz.cadence_pill_label ? (
                    <View style={styles.ticketHeaderCadencePill}>
                      <Text style={styles.ticketHeaderCadencePillText}>{quiz.cadence_pill_label}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.ticketHeaderPills}>
                  <View style={styles.ticketHeaderTimePill}>
                    <Text style={styles.ticketHeaderTimePillText}>{timeStr}</Text>
                  </View>
                  <View style={styles.ticketHeaderDayPill}>
                    <Text style={styles.ticketHeaderDayPillText} numberOfLines={1}>
                      {dayLabelTop}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.ticketHairline} />
              <View style={styles.factRow}>
                <MaterialCommunityIcons name="cash" size={20} color={detail.ticketInkPrimary} style={styles.factIcon} />
                <Text style={styles.factText}>
                  Entry · {fee} {basis}
                </Text>
              </View>
              <View style={styles.factRow}>
                <MaterialCommunityIcons name="trophy-outline" size={20} color={detail.ticketInkPrimary} style={styles.factIcon} />
                <Text style={styles.factText}>Prize · {prize}</Text>
              </View>
              {upcomingOccurrences.length > 0 ? (
                <View style={styles.upcomingSection}>
                  <Text style={styles.upcomingHeader}>Upcoming dates</Text>
                  <View style={styles.upcomingRow}>
                    {upcomingOccurrences.map((occ) => {
                      const key = `${quizEventId}|${occ.occurrence_date}`;
                      const interested = quizEventId ? isInterestedOccurrence(quizEventId, occ.occurrence_date) : false;
                      const disabled = occ.cancelled || chipBusyKey === key || !quizEventId;
                      return (
                        <Pressable
                          key={occ.occurrence_date}
                          onPress={() => void onToggleOccurrenceChip(occ.occurrence_date)}
                          disabled={disabled}
                          style={({ pressed }) => [
                            styles.upcomingChip,
                            interested && !occ.cancelled ? styles.upcomingChipInterested : null,
                            occ.cancelled ? styles.upcomingChipCancelled : null,
                            pressed && !disabled ? styles.upcomingChipPressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${formatOccurrenceChipTitle(occ.occurrence_date, quiz.start_time)} ${interestCountLabel(
                            occ.interest_count
                          )}${occ.cancelled ? ", cancelled" : interested ? ", interested" : ""}`}
                          accessibilityState={{ disabled, selected: interested }}
                        >
                          <Text
                            style={[
                              styles.upcomingChipTitle,
                              interested && !occ.cancelled ? styles.upcomingChipInterestedTitle : null,
                            ]}
                            numberOfLines={2}
                          >
                            {formatOccurrenceChipTitle(occ.occurrence_date, quiz.start_time)}
                          </Text>
                          <Text
                            style={[
                              styles.upcomingChipCount,
                              interested && !occ.cancelled ? styles.upcomingChipInterestedCount : null,
                            ]}
                          >
                            {interestCountLabel(occ.interest_count)}
                          </Text>
                          {occ.cancelled ? (
                            <Text style={styles.upcomingChipCancelledText}>Cancelled</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {quiz.venues?.venue_images && quiz.venues.venue_images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.galleryScroll}
                  contentContainerStyle={styles.galleryContent}
                >
                  {[...quiz.venues.venue_images]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((img, i) => (
                      <Image
                        key={img.storage_path}
                        source={{ uri: venueImagePublicUrl(img.storage_path) }}
                        style={styles.galleryImage}
                        accessibilityLabel={img.alt_text ?? `Venue photo ${i + 1}`}
                        resizeMode="cover"
                      />
                    ))}
                </ScrollView>
              ) : null}
              {fullVenueAddress(venue) ? (
                <View style={styles.ticketAddressBlock}>
                  <Text style={styles.ticketAddressText}>{fullVenueAddress(venue)}</Text>
                </View>
              ) : null}

              <View style={styles.ticketInsetSection}>
                <Text style={styles.ticketEyebrow}>What to expect</Text>
                <View style={styles.bulletList}>
                  {buildWhatToExpectLines(quiz).map((line, i) => (
                    <View key={`wte-${i}`} style={styles.bulletRow}>
                      <View style={styles.ticketBulletDot} />
                      <Text style={styles.ticketBulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {quizEventId ? (
                <View style={styles.ticketActionsFooter}>
                  <QuizDetailHeartAction
                    saved={saved}
                    quizEventId={quizEventId}
                    onToggleSaved={toggleSaved}
                    btnStyle={styles.ticketActionSavePrimary}
                    btnPressedStyle={styles.ticketActionBtnPressed}
                    labelStyle={styles.ticketActionSavePrimaryText}
                    iconRingStyle={styles.actionIconRingTransparent}
                    heartOutlineColor={semantic.accentRed}
                    iconSize={22}
                  />
                  <View style={styles.ticketActionsSecondaryRow}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        shareQuiz();
                      }}
                      style={({ pressed }) => [styles.ticketActionShare, pressed && styles.ticketActionBtnPressed]}
                      accessibilityLabel="Share this quiz"
                      accessibilityRole="button"
                    >
                      <View style={[styles.actionIconRing, styles.actionIconRingPrimary]}>
                        <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.white} />
                      </View>
                      <Text style={styles.ticketActionLabelInverse}>Share</Text>
                    </Pressable>
                    <Pressable
                      onPress={openInMaps}
                      style={({ pressed }) => [styles.ticketActionMaps, pressed && styles.ticketActionBtnPressed]}
                      accessibilityLabel="Open in maps"
                      accessibilityRole="button"
                    >
                      <View style={[styles.actionIconRing, styles.actionIconRingPrimary]}>
                        <MaterialCommunityIcons name="map-outline" size={16} color={colors.white} />
                      </View>
                      <Text style={styles.ticketActionLabelInverse}>Maps</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </Animated.View>

          {otherNearby && otherNearby.length > 0 ? (
            <View style={styles.nearbySection} accessibilityLabel="Other quizzes nearby">
              <Text style={styles.nearbyEyebrow}>Other quizzes nearby</Text>
              <View style={styles.nearbyCard}>
                {otherNearby.map((row, i) => {
                  const dayLine = dayNameShort(row.day_of_week);
                  const metaLine = `${dayLine} · ${formatTime(row.start_time)} · ${row.miles.toFixed(1)} mi`;
                  const cityPart = row.city ? ` · ${row.city}` : "";
                  return (
                    <Pressable
                      key={row.id}
                      onPressIn={() => prefetchQuizEventDetail(row.id)}
                      onPress={() => openOtherNearbyQuiz(row.id)}
                      style={({ pressed }) => [
                        styles.nearbyRow,
                        i === 0 && otherNearby.length > 1 ? styles.nearbyRowBorder : null,
                        pressed && styles.nearbyRowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${row.venueName}, ${metaLine}`}
                    >
                      <View style={styles.nearbyRowBody}>
                        <Text style={styles.nearbyRowTitle} numberOfLines={2}>
                          {row.venueName}
                        </Text>
                        <Text style={styles.nearbyRowMeta} numberOfLines={2}>
                          {metaLine}
                          {cityPart}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color={semantic.textSecondary} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
