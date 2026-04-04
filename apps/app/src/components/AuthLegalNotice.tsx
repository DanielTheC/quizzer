import * as Linking from "expo-linking";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PRIVACY_POLICY_URL, TERMS_AND_CONDITIONS_URL } from "../lib/legalUrls";
import { semantic, spacing, typography } from "../theme";

/**
 * Shown on sign-in / sign-up: links open quizzerapp.co.uk in the browser.
 */
export function AuthLegalNotice() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        By continuing, you agree to Quizzer&apos;s{" "}
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_AND_CONDITIONS_URL)}>
          Terms &amp; Conditions
        </Text>{" "}
        and{" "}
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: semantic.borderPrimary },
  line: { ...typography.caption, color: semantic.textSecondary, lineHeight: 18, textAlign: "center" },
  link: { ...typography.caption, fontWeight: "700", color: semantic.accentBlue, textDecorationLine: "underline" },
});
