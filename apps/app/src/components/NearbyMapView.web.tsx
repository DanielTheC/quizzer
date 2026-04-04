import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, semantic, spacing, radius, borderWidth, typography } from "../theme";
import type { MapQuizPin } from "./NearbyMapView.types";

export type { MapQuizPin } from "./NearbyMapView.types";

type Props = {
  quizzes: MapQuizPin[];
  userLocation: { lat: number; lng: number } | null;
  onSelectQuiz: (quizEventId: string) => void;
};

/** Web: `react-native-maps` is native-only; avoid importing it so the bundle loads. */
export function NearbyMapView(_props: Props) {
  return (
    <View style={styles.webFallback}>
      <MaterialCommunityIcons name="map-outline" size={48} color={semantic.textSecondary} />
      <Text style={styles.webFallbackTitle}>Map on mobile</Text>
      <Text style={styles.webFallbackText}>Open Quizzer on iOS or Android to see pubs on a map.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.grey100,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  webFallbackTitle: { marginTop: spacing.md, ...typography.heading },
  webFallbackText: { marginTop: spacing.sm, textAlign: "center", color: semantic.textSecondary, ...typography.body },
});
