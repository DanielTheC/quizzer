import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  StyleSheet,
} from "react-native";
import { setStoredRole } from "../lib/roleStorage";
import type { QuizzerRole } from "../lib/roleStorage";
import { ScreenTitle } from "../components/ScreenTitle";
import { semantic, spacing, radius, borderWidth, shadow } from "../theme";

type Props = {
  onSelect: (role: QuizzerRole) => void;
};

export default function RoleSelectScreen({ onSelect }: Props) {
  const choose = (role: QuizzerRole) => {
    setStoredRole(role).then(() => onSelect(role));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topStripe} accessibilityRole="none">
        <View style={styles.topStripeBlack} />
        <View style={styles.topStripeYellow} />
      </View>
      <View style={styles.content}>
        <View style={styles.heroTitleWrap}>
          <ScreenTitle variant="hero" subtitle="Pick how you use the app — you can change this anytime.">
            Welcome to Quizzer
          </ScreenTitle>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } }]}
          onPress={() => choose("player")}
        >
          <Text style={styles.primaryButtonText}>I'm a Player</Text>
          <Text style={styles.primaryButtonSubtitle}>Find local pub quizzes</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } }]}
          onPress={() => choose("host")}
        >
          <Text style={styles.secondaryButtonText}>I'm a Host</Text>
          <Text style={styles.secondaryButtonSubtitle}>Run consistent quiz nights</Text>
        </Pressable>

        <Text style={styles.hostHint}>
          New to hosting here? Pick Host, then use <Text style={styles.hostHintEm}>Apply for host access</Text> on the next screen if your account
          isn’t approved yet.
        </Text>

        <Text style={styles.note}>You can change this later in Settings.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  topStripe: { flexDirection: "row", height: 8 },
  topStripeBlack: { flex: 1, backgroundColor: semantic.bgInverse },
  topStripeYellow: { width: 100, backgroundColor: semantic.accentYellow },
  content: { flex: 1, padding: spacing.xxl, justifyContent: "center", alignItems: "stretch" },
  heroTitleWrap: { marginBottom: 40 },
  primaryButton: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    marginBottom: spacing.lg,
    alignItems: "center",
    ...shadow.medium,
  },
  primaryButtonText: { color: semantic.textPrimary, fontSize: 20, fontWeight: "800" },
  primaryButtonSubtitle: { color: semantic.textSecondary, fontSize: 15, marginTop: 6 },
  secondaryButton: {
    backgroundColor: semantic.bgPrimary,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    marginBottom: 32,
    alignItems: "center",
    ...shadow.small,
  },
  secondaryButtonText: { color: semantic.textPrimary, fontSize: 20, fontWeight: "700" },
  secondaryButtonSubtitle: { color: semantic.textSecondary, fontSize: 15, marginTop: 6 },
  hostHint: {
    fontSize: 14,
    fontWeight: "500",
    color: semantic.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  hostHintEm: { fontWeight: "700", color: semantic.textPrimary },
  note: { fontSize: 14, fontWeight: "500", color: semantic.textSecondary, textAlign: "center" },
});
