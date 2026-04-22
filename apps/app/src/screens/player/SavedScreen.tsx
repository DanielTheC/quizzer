import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { captureSupabaseError } from "../../lib/sentryInit";
import { prefetchQuizEventDetail } from "../../lib/quizEventDetailCache";
import { setPendingTonightOnNearby } from "../../lib/pendingTonightStorage";
import { hapticLight, hapticMedium, hapticRefreshDone } from "../../lib/playerHaptics";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { useAppTheme } from "../../context/ThemeContext";
import { SavedStackParamList } from "../../navigation/RootNavigator";
import { ScreenTitle } from "../../components/ScreenTitle";
import { QuizCard } from "../../components/QuizCard";
import { QuizListSkeleton } from "../../components/QuizListSkeleton";
import { colors, radius, spacing, shadow, typography, borderWidth, type SemanticTheme } from "../../theme";
import { computeNextOccurrence, formatNextOccurrenceLabel } from "../../lib/nextOccurrence";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Venue = {
  name: string;
  address: string;
  postcode?: string | null;
  city?: string | null;
};

type QuizEvent = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: Venue | null;
};

function buildSavedStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    loadingScreen: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: semantic.bgPrimary,
    },
    flex1: { flex: 1 },
    screen: { flex: 1, padding: spacing.lg, backgroundColor: semantic.bgPrimary },
    emptyBox: {
      marginTop: spacing.lg,
      padding: spacing.xl,
      alignItems: "center",
      backgroundColor: semantic.bgPrimary,
    },
    emptyText: { marginTop: spacing.md, textAlign: "center", ...typography.body, color: semantic.textSecondary },
    emptyCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: semantic.accentYellow,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      ...shadow.small,
    },
    emptyCtaPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    emptyCtaIcon: { marginRight: spacing.sm },
    emptyCtaText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
    emptyInline: { marginTop: spacing.lg, padding: spacing.lg, alignItems: "center" },
    errorBanner: {
      padding: spacing.md,
      borderRadius: radius.brutal,
      backgroundColor: semantic.danger,
      marginTop: spacing.md,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
    },
    errorBannerTitle: { ...typography.bodyStrong, color: semantic.textInverse },
    errorBannerText: { marginTop: spacing.sm, color: semantic.textInverse },
    list: { flex: 1, marginTop: spacing.sm },
    listSeparator: { height: spacing.md },
    emptyListText: { marginTop: spacing.md, textAlign: "center", ...typography.body, color: semantic.textSecondary },
    hintRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.bgPrimary,
    },
    hintIcon: { marginTop: 2, marginRight: spacing.sm },
    hintText: { flex: 1, ...typography.caption, color: semantic.textSecondary, lineHeight: 20 },
    tonightShortcutBanner: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentOrange,
      ...shadow.small,
    },
    tonightShortcutBannerPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    tonightShortcutIcon: { marginRight: spacing.sm },
    tonightShortcutTextCol: { flex: 1, minWidth: 0 },
    tonightShortcutTitle: { ...typography.bodyStrong, fontSize: 15, color: semantic.textInverse },
    tonightShortcutSub: {
      marginTop: 2,
      ...typography.caption,
      fontSize: 13,
      color: semantic.textInverse,
      opacity: 0.92,
    },
    dayFilterRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    dayPill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.bgPrimary,
      ...shadow.small,
    },
    dayPillActive: {
      backgroundColor: colors.black,
      borderColor: colors.black,
    },
    dayPillToday: {
      borderColor: semantic.accentYellow,
      backgroundColor: semantic.accentYellow,
    },
    dayPillPressed: {
      transform: [{ translateY: 2 }],
      shadowOffset: { width: 1, height: 1 },
    },
    dayPillText: {
      ...typography.captionStrong,
      color: semantic.textPrimary,
    },
    dayPillTextActive: {
      color: colors.white,
    },
  });
}

export default function SavedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SavedStackParamList>>();
  const { savedIds, isSaved, toggleSaved } = useSavedQuizzes();
  const { semantic, isDark } = useAppTheme();
  const styles = useMemo(() => buildSavedStyles(semantic), [semantic]);

  const [quizzes, setQuizzes] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const toggleDayFilter = useCallback((day: number) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  }, []);

  const fetchSavedData = useCallback(async () => {
    setErrorMsg(null);
    if (savedIds.length === 0) {
      setQuizzes([]);
      return;
    }
    const { data, error } = await supabase
      .from("quiz_events")
      .select(
        `
        id,
        day_of_week,
        start_time,
        entry_fee_pence,
        prize,
        venues (
          name,
          address,
          postcode,
          city
        )
      `
      )
      .in("id", savedIds)
      .eq("is_active", true);

    if (error) {
      captureSupabaseError("player.saved_events_list", error);
      setErrorMsg(error.message);
      setQuizzes([]);
      setMissingCount(0);
    } else {
      const list = (data as unknown as QuizEvent[]) ?? [];
      setQuizzes(list);
      const fetchedIds = new Set(list.map((q) => q.id));
      setMissingCount(savedIds.filter((id) => !fetchedIds.has(id)).length);
    }
  }, [savedIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (savedIds.length === 0) {
        setQuizzes([]);
        setErrorMsg(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchSavedData();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedIds, fetchSavedData]);

  const onRefresh = useCallback(async () => {
    if (savedIds.length === 0) {
      setRefreshing(false);
      hapticRefreshDone();
      return;
    }
    setRefreshing(true);
    await fetchSavedData();
    setRefreshing(false);
    hapticRefreshDone();
  }, [savedIds.length, fetchSavedData]);

  const goNearby = useCallback(() => {
    hapticLight();
    const tab = navigation.getParent();
    if (tab && "navigate" in tab && typeof (tab as { navigate: (n: string) => void }).navigate === "function") {
      (tab as { navigate: (n: string) => void }).navigate("Nearby");
    }
  }, [navigation]);

  const goNearbyWithTonight = useCallback(() => {
    hapticMedium();
    void (async () => {
      await setPendingTonightOnNearby();
      const tab = navigation.getParent();
      if (tab && "navigate" in tab && typeof (tab as { navigate: (n: string) => void }).navigate === "function") {
        (tab as { navigate: (n: string) => void }).navigate("Nearby");
      }
    })();
  }, [navigation]);

  const hasSavedTonight = useMemo(() => {
    if (quizzes.length === 0) return false;
    const dow = new Date().getDay();
    return quizzes.some((q) => q.day_of_week === dow);
  }, [quizzes]);

  const sortedQuizzesWithNext = useMemo(() => {
    const now = new Date();
    const rows = quizzes.map((q) => {
      const next = computeNextOccurrence(q.day_of_week, q.start_time, now);
      const label = next ? formatNextOccurrenceLabel(next.at, now) : null;
      const sortKey = next?.millisFromNow ?? Number.POSITIVE_INFINITY;
      return { quiz: q, nextLabel: label, sortKey };
    });
    rows.sort((a, b) => a.sortKey - b.sortKey);
    return rows;
  }, [quizzes]);

  const availableDays = useMemo(() => {
    const days = new Set(quizzes.map((q) => q.day_of_week));
    return [0, 1, 2, 3, 4, 5, 6].filter((d) => days.has(d));
  }, [quizzes]);

  const displayedQuizzes = useMemo(
    () =>
      selectedDay === null
        ? sortedQuizzesWithNext
        : sortedQuizzesWithNext.filter((r) => r.quiz.day_of_week === selectedDay),
    [sortedQuizzesWithNext, selectedDay]
  );

  const renderTonightListHeader = useCallback(() => {
    if (!hasSavedTonight) return null;
    return (
      <Pressable
        onPress={goNearbyWithTonight}
        style={({ pressed }) => [styles.tonightShortcutBanner, pressed && styles.tonightShortcutBannerPressed]}
        accessibilityRole="button"
        accessibilityLabel="Open Nearby with tonight’s quizzes filter on"
      >
        <MaterialCommunityIcons name="fire" size={24} color={semantic.textInverse} style={styles.tonightShortcutIcon} />
        <View style={styles.tonightShortcutTextCol}>
          <Text style={styles.tonightShortcutTitle}>Tonight in your shortlist</Text>
          <Text style={styles.tonightShortcutSub}>Jump to Nearby — we’ll turn on Tonight for you</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={semantic.textInverse} />
      </Pressable>
    );
  }, [hasSavedTonight, goNearbyWithTonight, styles, semantic.textInverse]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.flex1}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
            <ScreenTitle variant="playerBanner">Saved quizzes</ScreenTitle>
            <QuizListSkeleton count={5} />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={styles.flex1}>
        <ScreenTitle variant="playerBanner">Saved quizzes</ScreenTitle>
        {savedIds.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="heart-multiple-outline" size={44} color={semantic.accentPink} />
            <Text style={styles.emptyText}>
              Nothing saved yet — tap the heart on any quiz to add it here. Your next local pub quiz is one tab away.
            </Text>
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="bell-outline" size={20} color={semantic.textSecondary} style={styles.hintIcon} />
              <Text style={styles.hintText}>
                Turn on quiz-day reminders in Settings and we’ll nudge you when a saved quiz is on tonight.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
              onPress={goNearby}
              accessibilityRole="button"
              accessibilityLabel="Find a quiz near you"
            >
              <MaterialCommunityIcons name="map-search" size={20} color={semantic.textPrimary} style={styles.emptyCtaIcon} />
              <Text style={styles.emptyCtaText}>Find a quiz near you</Text>
            </Pressable>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTitle}>Couldn’t load saved quizzes</Text>
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : (
          <>
            {availableDays.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayFilterRow}
              >
                {availableDays.map((day) => {
                  const isToday = day === new Date().getDay();
                  const active = selectedDay === day;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => {
                        hapticLight();
                        toggleDayFilter(day);
                      }}
                      style={({ pressed }) => [
                        styles.dayPill,
                        active && styles.dayPillActive,
                        isToday && !active && styles.dayPillToday,
                        pressed && styles.dayPillPressed,
                      ]}
                    >
                      <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                        {DAY_LABELS[day]}
                        {isToday ? " · Today" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <FlatList
              style={styles.list}
              data={displayedQuizzes}
              keyExtractor={(item) => item.quiz.id}
              ListHeaderComponent={renderTonightListHeader}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={semantic.textPrimary}
                  colors={[semantic.accentYellow, semantic.textPrimary]}
                />
              }
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(Math.min(index * 42, 400)).duration(340)}>
                  <QuizCard
                    quiz={item.quiz}
                    distanceLabel={null}
                    isSaved={isSaved(item.quiz.id)}
                    onToggleSaved={() => toggleSaved(item.quiz.id)}
                    onPressIn={() => prefetchQuizEventDetail(item.quiz.id)}
                    onPress={() => navigation.navigate("QuizDetail", { quizEventId: item.quiz.id })}
                    isTonightMode={false}
                    showRank={false}
                    rank={null}
                    nextOccurrenceLabel={item.nextLabel}
                  />
                </Animated.View>
              )}
              ListFooterComponent={
                missingCount > 0 ? (
                  <Text style={styles.emptyListText}>
                    {missingCount} saved {missingCount === 1 ? "quiz" : "quizzes"} no longer available
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyListText}>Those quizzes may have moved — pull down to refresh.</Text>
                  <Pressable
                    style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
                    onPress={goNearby}
                    accessibilityRole="button"
                    accessibilityLabel="Find more quizzes nearby"
                  >
                    <Text style={styles.emptyCtaText}>Find more nearby</Text>
                  </Pressable>
                </View>
              }
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
