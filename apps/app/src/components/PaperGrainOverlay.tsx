import React from "react";
import { StyleSheet, View } from "react-native";

const LINES = 14;

/** Subtle ruled-paper overlay; keep behind content with `pointerEvents="none"`. */
export function PaperGrainOverlay({ stripeColor }: { stripeColor: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {Array.from({ length: LINES }, (_, i) => (
        <View
          key={i}
          style={[
            styles.vline,
            {
              left: `${(100 / (LINES + 1)) * (i + 1)}%`,
              backgroundColor: stripeColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vline: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    opacity: 0.045,
  },
});
