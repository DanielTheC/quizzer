import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../theme";

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
  venues: { name?: string | null } | null;
};

type QuizCardProps = {
  quiz: QuizCardQuiz;
  distanceLabel: string | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  onPress: () => void;
  isTonightMode: boolean;
  showRank: boolean;
  rank: number | null;
  labelNextUp?: boolean;
};

export function QuizCard({
  quiz,
  distanceLabel,
  isSaved,
  onToggleSaved,
  onPress,
  isTonightMode,
  showRank,
  rank,
  labelNextUp = false,
}: QuizCardProps) {
  const timeStr = String(quiz.start_time).trim().slice(0, 5);
  const dayTimeStr = `${dayName(quiz.day_of_week)} • ${timeStr}`;
  const entryStr = `£${(quiz.entry_fee_pence / 100).toFixed(2)}`;
  const pubName = quiz.venues?.name ?? "Unknown venue";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.inner}>
        {showRank && rank != null ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        ) : null}
        <View style={styles.content}>
          {/* Row 1: icon + pub name (left) | distance (muted) + heart (right) */}
          <View style={styles.row1}>
            <View style={styles.titleRow}>
              <Text style={styles.venueIcon}>🍺</Text>
              <Text style={styles.pubName} numberOfLines={1}>
                {pubName}
              </Text>
            </View>
            <View style={styles.rightRow}>
              {distanceLabel != null ? (
                <Text style={styles.distance} numberOfLines={1}>
                  {distanceLabel}
                </Text>
              ) : null}
              <Pressable onPress={onToggleSaved} hitSlop={12} style={styles.heartWrap}>
                <Text style={[styles.heart, isSaved && styles.heartSaved]}>
                  {isSaved ? "♥" : "♡"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Row 2: Day • Time (or Tonight emphasis + badge) */}
          <View style={styles.row2}>
            {isTonightMode ? (
              <View style={styles.tonightRow}>
                <Text style={styles.timeEmphasis}>{timeStr}</Text>
                <View style={styles.tonightBadge}>
                  <Text style={styles.tonightBadgeText}>🔥 Tonight</Text>
                </View>
                {labelNextUp ? (
                  <View style={styles.nextUpBadge}>
                    <Text style={styles.nextUpText}>Next up</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.dayTime}>{dayTimeStr}</Text>
            )}
          </View>

          {/* Row 3: £Entry • Prize */}
          <Text style={styles.entryPrize}>
            {entryStr} • {quiz.prize}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.small,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.small,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentYellow,
  },
  rankText: {
    ...typography.labelUppercase,
    color: semantic.textPrimary,
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
    fontSize: 16,
    marginRight: spacing.sm,
  },
  pubName: {
    flex: 1,
    ...typography.bodyStrong,
    fontSize: 17,
    color: semantic.textPrimary,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  distance: {
    ...typography.caption,
    color: semantic.textSecondary,
    marginRight: spacing.sm,
  },
  heartWrap: {
    padding: spacing.xs,
  },
  heart: {
    fontSize: 20,
    color: colors.grey400,
  },
  heartSaved: {
    color: semantic.accentRed,
  },
  row2: {
    marginTop: spacing.sm,
  },
  dayTime: {
    ...typography.caption,
    color: semantic.textSecondary,
  },
  tonightRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  timeEmphasis: {
    ...typography.displaySmall,
    fontSize: 17,
    color: semantic.textPrimary,
    marginRight: spacing.sm,
  },
  tonightBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentOrange,
  },
  tonightBadgeText: {
    ...typography.labelUppercase,
    color: semantic.textInverse,
  },
  nextUpBadge: {
    marginLeft: spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: radius.small,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentBlue,
  },
  nextUpText: {
    fontSize: 11,
    fontWeight: "700",
    color: semantic.textInverse,
  },
  entryPrize: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: semantic.textSecondary,
  },
});
