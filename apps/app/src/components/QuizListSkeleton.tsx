import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { colors, spacing, radius, borderWidth, shadow, type SemanticTheme } from "../theme";

type Props = { count?: number };

function buildStyles(semantic: SemanticTheme, isDark: boolean) {
  const block = isDark ? "rgba(168,162,158,0.32)" : colors.grey200;
  const blockBorder = isDark ? "rgba(231,223,208,0.35)" : colors.grey400;
  return StyleSheet.create({
    card: {
      backgroundColor: semantic.bgPrimary,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      padding: spacing.lg,
      ...shadow.medium,
    },
    cardSpacing: {
      marginBottom: spacing.md,
    },
    blockTitle: {
      height: 18,
      width: "72%",
      borderRadius: radius.small,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
    blockMeta: {
      marginTop: spacing.md,
      height: 14,
      width: "45%",
      borderRadius: radius.small,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: blockBorder,
      opacity: 0.85,
    },
    blockMetaShort: {
      marginTop: spacing.sm,
      height: 14,
      width: "55%",
      borderRadius: radius.small,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: blockBorder,
      opacity: 0.85,
    },
  });
}

/** Placeholder rows while the quiz list loads — matches card / neubrutalist chrome. */
export function QuizListSkeleton({ count = 5 }: Props) {
  const { semantic, isDark } = useAppTheme();
  const styles = useMemo(() => buildStyles(semantic, isDark), [semantic, isDark]);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, i < count - 1 && styles.cardSpacing]} accessible={false}>
          <View style={styles.blockTitle} />
          <View style={styles.blockMeta} />
          <View style={styles.blockMetaShort} />
        </View>
      ))}
    </>
  );
}
