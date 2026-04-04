import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { colors, spacing, typography, radius, borderWidth, shadow, type SemanticTheme } from "../theme";

const BAR_HEIGHT = 5;

function createScreenTitleStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    wrap: {
      marginBottom: spacing.lg,
    },
    wrapHero: {
      alignItems: "center",
      marginBottom: 0,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "stretch",
      height: BAR_HEIGHT,
      marginBottom: spacing.md,
      borderRadius: 2,
      overflow: "hidden",
      maxWidth: 120,
      borderWidth: 1,
      borderColor: semantic.borderPrimary,
    },
    barRowHero: {
      alignSelf: "center",
    },
    barBlack: {
      flex: 1,
      backgroundColor: semantic.bgInverse,
    },
    barYellow: {
      width: 36,
      backgroundColor: semantic.accentYellow,
    },
    titleScreen: {
      ...typography.displayMedium,
      color: semantic.textPrimary,
      letterSpacing: -0.6,
    },
    titleHero: {
      ...typography.displayLarge,
      color: semantic.textPrimary,
      letterSpacing: -0.75,
      textAlign: "center",
    },
    subtitle: {
      ...typography.caption,
      color: semantic.textSecondary,
      marginTop: spacing.xs,
    },
    subtitleHero: {
      textAlign: "center",
      paddingHorizontal: spacing.md,
      lineHeight: 22,
    },
    playerBanner: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: semantic.accentYellow,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: radius.brutal,
      borderBottomRightRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      marginBottom: spacing.md,
      ...shadow.medium,
    },
    titlePlayerBanner: {
      ...typography.displayMedium,
      color: colors.black,
      letterSpacing: -0.5,
    },
    subtitlePlayerBanner: {
      ...typography.body,
      color: colors.grey700,
      marginTop: spacing.sm,
      lineHeight: 22,
      fontWeight: "500",
    },
  });
}

type ScreenTitleProps = {
  children: string;
  subtitle?: string;
  variant?: "screen" | "hero" | "playerBanner";
};

export function ScreenTitle({ children, subtitle, variant = "screen" }: ScreenTitleProps) {
  const { semantic } = useAppTheme();
  const styles = useMemo(() => createScreenTitleStyles(semantic), [semantic]);
  const isHero = variant === "hero";
  const isPlayerBanner = variant === "playerBanner";

  if (isPlayerBanner) {
    return (
      <View style={styles.playerBanner} accessibilityRole="header">
        <Text style={styles.titlePlayerBanner}>{children}</Text>
        {subtitle ? <Text style={styles.subtitlePlayerBanner}>{subtitle}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, isHero && styles.wrapHero]}>
      <View
        style={[styles.barRow, isHero && styles.barRowHero]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.barBlack} />
        <View style={styles.barYellow} />
      </View>
      <Text style={isHero ? styles.titleHero : styles.titleScreen}>{children}</Text>
      {subtitle ? <Text style={[styles.subtitle, isHero && styles.subtitleHero]}>{subtitle}</Text> : null}
    </View>
  );
}
