import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import {
  colors,
  spacing,
  radius,
  borderWidth,
  shadow,
  type SemanticTheme,
} from "../theme";

function buildStyles(semantic: SemanticTheme) {
  const block = "rgba(0,0,0,0.08)";
  const blockBorder = "rgba(0,0,0,0.12)";

  return StyleSheet.create({
    ticketCard: {
      backgroundColor: colors.white,
      borderRadius: radius.brutal,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      overflow: "hidden",
      marginBottom: spacing.lg,
      ...shadow.large,
    },
    ticketStripe: {
      height: 10,
      backgroundColor: colors.white,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: "rgba(0,0,0,0.12)",
    },
    ticketBody: { padding: spacing.lg },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    headerMug: {
      width: 24,
      height: 24,
      marginRight: spacing.sm,
      marginTop: 3,
      borderRadius: 4,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: blockBorder,
    },
    headerLeft: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    titleLine: {
      height: 22,
      borderRadius: 4,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: blockBorder,
    },
    titleLineShort: {
      marginTop: spacing.xs,
      height: 18,
      width: "72%",
      borderRadius: 4,
      backgroundColor: block,
    },
    headerPills: {
      flexShrink: 0,
      flexDirection: "row",
      gap: spacing.xs,
      alignItems: "center",
    },
    pillSkel: {
      width: 52,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
    pillSkelWide: {
      width: 44,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
    hairline: {
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
    factIcon: {
      width: 20,
      height: 20,
      marginRight: spacing.sm,
      borderRadius: 3,
      backgroundColor: block,
    },
    factLine: {
      flex: 1,
      height: 16,
      borderRadius: 4,
      backgroundColor: block,
      maxWidth: "88%",
    },
    addressBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: borderWidth.thin,
      borderTopColor: "rgba(0,0,0,0.12)",
    },
    addressLine: {
      height: 14,
      width: "100%",
      borderRadius: 4,
      backgroundColor: block,
    },
    addressLineShort: {
      marginTop: spacing.xs,
      height: 14,
      width: "62%",
      borderRadius: 4,
      backgroundColor: block,
    },
    inset: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: borderWidth.thin,
      borderTopColor: "rgba(0,0,0,0.12)",
    },
    eyebrow: {
      height: 12,
      width: 108,
      marginBottom: spacing.sm,
      borderRadius: 3,
      backgroundColor: block,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
    },
    bulletDot: {
      width: 8,
      height: 8,
      marginTop: 7,
      marginRight: spacing.sm,
      borderRadius: 2,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: blockBorder,
    },
    bulletLine: {
      flex: 1,
      height: 14,
      borderRadius: 4,
      backgroundColor: block,
    },
    bulletLineTall: {
      flex: 1,
      height: 36,
      borderRadius: 4,
      backgroundColor: block,
    },
    actionsFooter: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: borderWidth.thin,
      borderTopColor: "rgba(0,0,0,0.12)",
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "stretch",
      marginHorizontal: -spacing.xs,
    },
    actionSkel: {
      flex: 1,
      marginHorizontal: spacing.xs,
      minHeight: 56,
      borderRadius: radius.brutal,
      backgroundColor: block,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
    },
  });
}

/** Single white ticket: header, hairline, combined “What to expect” bullets, actions. */
export function QuizDetailSkeleton() {
  const { semantic } = useAppTheme();
  const styles = useMemo(() => buildStyles(semantic), [semantic]);

  return (
    <View accessible={false}>
      <View style={styles.ticketCard}>
        <View style={styles.ticketStripe} />
        <View style={styles.ticketBody}>
          <View style={styles.headerRow}>
            <View style={styles.headerMug} />
            <View style={styles.headerLeft}>
              <View style={styles.titleLine} />
              <View style={styles.titleLineShort} />
            </View>
            <View style={styles.headerPills}>
              <View style={styles.pillSkel} />
              <View style={styles.pillSkelWide} />
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.factRow}>
            <View style={styles.factIcon} />
            <View style={styles.factLine} />
          </View>
          <View style={styles.factRow}>
            <View style={styles.factIcon} />
            <View style={[styles.factLine, { maxWidth: "70%" }]} />
          </View>
          <View style={styles.addressBlock}>
            <View style={styles.addressLine} />
            <View style={styles.addressLineShort} />
          </View>
          <View style={styles.inset}>
            <View style={styles.eyebrow} />
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletLine} />
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={[styles.bulletLine, { maxWidth: "78%" }]} />
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletLineTall} />
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletLine} />
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletLineTall} />
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={[styles.bulletLine, { marginBottom: 0 }]} />
            </View>
          </View>
          <View style={styles.actionsFooter}>
            <View style={styles.actionsRow}>
              <View style={styles.actionSkel} />
              <View style={styles.actionSkel} />
              <View style={styles.actionSkel} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
