import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useAppTheme } from "../context/ThemeContext";
import { heartScalePeak, heartSpringIn, heartSpringOut } from "../lib/heartPressAnimation";
import { hapticLight, hapticSavedQuiz } from "../lib/playerHaptics";
import { postcodeOutwardOrArea } from "../lib/venueLocationSnippet";
import { formatPrizePill } from "../lib/formatters";
import {
  colors,
  fonts,
  spacing,
  radius,
  borderWidth,
  shadow,
  typography,
  playerBrutalPill,
  type SemanticTheme,
} from "../theme";

const ICON = 22;

const HeartToggleButton = React.memo(function HeartToggleButton({
  isSaved,
  onToggleSaved,
  semantic,
  disabled,
}: {
  isSaved: boolean;
  onToggleSaved: () => void;
  semantic: SemanticTheme;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPress = useCallback(() => {
    if (disabled) return;
    scale.value = withSequence(
      withSpring(heartScalePeak, heartSpringIn),
      withSpring(1, heartSpringOut)
    );
    if (isSaved) hapticLight();
    else hapticSavedQuiz();
    onToggleSaved();
  }, [disabled, isSaved, onToggleSaved, scale]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={[stylesStatic.heartWrap, disabled && stylesStatic.heartWrapDisabled]}
      accessibilityLabel={isSaved ? "Remove from saved" : "Save quiz"}
      accessibilityState={disabled ? { disabled: true } : undefined}
    >
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons
          name={isSaved ? "heart" : "heart-outline"}
          size={22}
          color={
            disabled
              ? semantic.textSecondary
              : isSaved
                ? semantic.accentRed
                : semantic.textSecondary
          }
        />
      </Animated.View>
    </Pressable>
  );
});

const stylesStatic = StyleSheet.create({
  heartWrap: { padding: spacing.xs },
  heartWrapDisabled: { opacity: 0.45 },
});

function createQuizCardStyles(semantic: SemanticTheme, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? semantic.bgPrimary : colors.white,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      overflow: "hidden",
      ...shadow.medium,
    },
    cardAccentTop: {
      height: 7,
      width: "100%",
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: semantic.borderPrimary,
    },
    cardInner: {
      padding: spacing.lg,
    },
    cardPressed: {
      transform: [{ translateY: 2 }],
      shadowOffset: { width: 1, height: 1 },
    },
    inner: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    rankBadge: {
      marginRight: spacing.md,
      marginTop: 2,
      ...playerBrutalPill,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    rankText: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      color: colors.black,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    row1: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    titleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
    },
    venueIcon: {
      marginRight: spacing.sm,
      marginTop: 1,
    },
    pubNameBlock: {
      flex: 1,
      minWidth: 0,
    },
    pubName: {
      fontSize: 21,
      fontWeight: "400",
      fontFamily: fonts.display,
      letterSpacing: -0.35,
      lineHeight: 26,
      color: semantic.textPrimary,
    },
    pubPostcode: {
      fontSize: 15,
      fontWeight: "600",
      color: semantic.textSecondary,
      letterSpacing: 0.2,
    },
    rightRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: spacing.sm,
    },
    distance: {
      fontSize: 12,
      fontWeight: "600",
      color: semantic.textSecondary,
      marginRight: spacing.sm,
    },
    row2: {
      marginTop: spacing.xs,
    },
    dayTime: {
      fontSize: 13,
      fontWeight: "500",
      color: semantic.textSecondary,
      letterSpacing: 0.15,
    },
    tonightRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    timeEmphasis: {
      fontSize: 16,
      fontWeight: "700",
      color: semantic.textPrimary,
      marginRight: spacing.sm,
    },
    tonightBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      marginRight: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: borderWidth.default,
      borderColor: colors.black,
      backgroundColor: colors.black,
    },
    tonightFire: {
      marginRight: 4,
    },
    tonightBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: colors.yellow,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: spacing.md,
      marginHorizontal: -spacing.xs,
    },
    brutalTag: {
      ...playerBrutalPill,
      marginHorizontal: spacing.xs,
      marginBottom: spacing.sm,
      maxWidth: "100%",
    },
    brutalTagText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      color: colors.black,
    },
    nextOccurrence: {
      fontSize: 13,
      fontWeight: "600",
      color: semantic.textPrimary,
      letterSpacing: 0.15,
    },
    interestPill: {
      alignSelf: "flex-start",
      marginTop: spacing.sm,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.grey200,
      backgroundColor: isDark ? semantic.bgSecondary : colors.grey100,
    },
    interestPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: semantic.textSecondary,
      letterSpacing: 0.15,
    },
    cadencePill: {
      ...playerBrutalPill,
      marginHorizontal: spacing.xs,
      marginBottom: spacing.sm,
      backgroundColor: semantic.accentYellow,
    },
    cadencePillText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.9,
      color: colors.black,
      fontFamily: fonts.display,
    },
    noHostPill: {
      ...playerBrutalPill,
      marginHorizontal: spacing.xs,
      marginBottom: spacing.sm,
      backgroundColor: semantic.bgSecondary,
      borderColor: colors.black,
    },
    noHostPillText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      color: colors.black,
    },
    cancelledRibbon: {
      alignSelf: "stretch",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      backgroundColor: semantic.accentRed,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: semantic.borderPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    cancelledRibbonText: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: colors.white,
      fontFamily: fonts.display,
    },
    cardDimmed: { opacity: 0.7 },
  });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayName(day: number) {
  return DAY_LABELS[day] ?? String(day);
}

export type QuizCardQuiz = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: {
    name?: string | null;
    postcode?: string | null;
    borough?: string | null;
    city?: string | null;
  } | null;
};

type ListAccent = "default" | "tonight" | "distance";

type QuizCardProps = {
  quiz: QuizCardQuiz;
  distanceLabel: string | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  onPress: () => void;
  /** e.g. prefetch detail on press-in for snappier navigation */
  onPressIn?: () => void;
  isTonightMode: boolean;
  showRank: boolean;
  rank: number | null;
  /** Left stripe: warm (default), Tonight (orange), or distance sort (blue). */
  listAccent?: ListAccent;
  /** When set (e.g. Saved list), replaces the usual day/time line with next-run copy. */
  nextOccurrenceLabel?: string | null;
  /** Optional popularity line (e.g. from Nearby embed); omit when empty. */
  interestPillLabel?: string | null;
  /** When true, top corners are square (e.g. flush with a header above the first list row). */
  squareTopEdge?: boolean;
  /** "WEEKLY" / "MONTHLY" / etc. Renders neo-brutalist yellow pill when set. */
  cadenceLabel?: string | null;
  /** When true, show "No host yet" pill alongside prize pill. */
  noHost?: boolean;
  /** When true, render full-width red CANCELLED ribbon and dim the card. */
  cancelled?: boolean;
};

const QuizCard = React.memo(function QuizCard({
  quiz,
  distanceLabel,
  isSaved,
  onToggleSaved,
  onPress,
  onPressIn,
  isTonightMode,
  showRank,
  rank,
  listAccent: listAccentProp,
  nextOccurrenceLabel = null,
  interestPillLabel = null,
  squareTopEdge = false,
  cadenceLabel = null,
  noHost = false,
  cancelled = false,
}: QuizCardProps) {
  const { semantic, isDark } = useAppTheme();
  const styles = useMemo(() => createQuizCardStyles(semantic, isDark), [semantic, isDark]);

  const listAccent: ListAccent =
    listAccentProp ??
    (isTonightMode ? "tonight" : showRank ? "distance" : "default");

  const leftStripeColor =
    listAccent === "tonight"
      ? semantic.accentOrange
      : listAccent === "distance"
        ? semantic.accentBlue
        : semantic.accentYellow;

  const timeStr = String(quiz.start_time).trim().slice(0, 5);
  const dayTimeStr = `${dayName(quiz.day_of_week)} • ${timeStr}`;
  const pubName = quiz.venues?.name ?? "Unknown venue";
  const locationSnippet = postcodeOutwardOrArea(quiz.venues ?? null);
  const prizePill = formatPrizePill(quiz.prize ?? "");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        squareTopEdge && { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
        pressed && styles.cardPressed,
        cancelled && styles.cardDimmed,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
    >
      <View style={[styles.cardAccentTop, { backgroundColor: leftStripeColor }]} />
      {cancelled ? (
        <View style={styles.cancelledRibbon}>
          <Text style={styles.cancelledRibbonText}>Cancelled</Text>
        </View>
      ) : null}
      <View style={styles.cardInner}>
        <View style={styles.inner}>
          {showRank && rank != null ? (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{rank}</Text>
            </View>
          ) : null}
          <View style={styles.content}>
            <View style={styles.row1}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="glass-mug-variant" size={ICON} color={semantic.textPrimary} style={styles.venueIcon} />
                <Text style={styles.pubNameBlock} numberOfLines={2}>
                  <Text style={styles.pubName}>{pubName}</Text>
                  {locationSnippet ? (
                    <Text style={styles.pubPostcode}>{` · ${locationSnippet}`}</Text>
                  ) : null}
                </Text>
              </View>
              <View style={styles.rightRow}>
                {distanceLabel != null ? (
                  <Text style={styles.distance} numberOfLines={1}>
                    {distanceLabel}
                  </Text>
                ) : null}
                <HeartToggleButton
                  isSaved={isSaved}
                  onToggleSaved={onToggleSaved}
                  semantic={semantic}
                  disabled={cancelled}
                />
              </View>
            </View>

            <View style={styles.row2}>
              {nextOccurrenceLabel ? (
                <Text style={styles.nextOccurrence}>{nextOccurrenceLabel}</Text>
              ) : isTonightMode ? (
                <View style={styles.tonightRow}>
                  <Text style={styles.timeEmphasis}>{timeStr}</Text>
                  <View style={styles.tonightBadge}>
                    <MaterialCommunityIcons name="fire" size={14} color={colors.yellow} style={styles.tonightFire} />
                    <Text style={styles.tonightBadgeText}>Tonight</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.dayTime}>{dayTimeStr}</Text>
              )}
            </View>

            {interestPillLabel ? (
              <View style={styles.interestPill}>
                <Text style={styles.interestPillText} numberOfLines={1}>
                  {interestPillLabel}
                </Text>
              </View>
            ) : null}

            <View style={styles.tagRow}>
              <View style={styles.brutalTag}>
                <Text style={styles.brutalTagText} numberOfLines={2}>
                  {prizePill}
                </Text>
              </View>
              {cadenceLabel ? (
                <View style={styles.cadencePill}>
                  <Text style={styles.cadencePillText} numberOfLines={1}>
                    {cadenceLabel}
                  </Text>
                </View>
              ) : null}
              {noHost ? (
                <View style={styles.noHostPill}>
                  <Text style={styles.noHostPillText} numberOfLines={1}>
                    No host yet
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export { QuizCard };
