import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  borderWidth,
  colors,
  radius,
  semantic,
  shadow,
  spacing,
  typography,
} from "../theme";

type Props = {
  onGoogle: () => void;
  onApple: () => void;
  onEmail: () => void;
  googleBusy?: boolean;
  appleBusy?: boolean;
  disabled?: boolean;
};

export default function AuthProviderButtons({
  onGoogle,
  onApple,
  onEmail,
  googleBusy = false,
  appleBusy = false,
  disabled = false,
}: Props) {
  const anyBusy = disabled || googleBusy || appleBusy;

  return (
    <View style={styles.stack}>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnLight,
          anyBusy && styles.btnDisabled,
          pressed && styles.btnPressed,
        ]}
        onPress={onGoogle}
        disabled={anyBusy}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: anyBusy }}
      >
        {googleBusy ? (
          <ActivityIndicator color={colors.black} />
        ) : (
          <View style={styles.btnInner}>
            <Ionicons name="logo-google" size={20} color={colors.black} />
            <Text style={styles.btnTextDark}>Continue with Google</Text>
          </View>
        )}
      </Pressable>

      {Platform.OS === "ios" && (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnDark,
            anyBusy && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={onApple}
          disabled={anyBusy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          accessibilityState={{ disabled: anyBusy }}
        >
          {appleBusy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <View style={styles.btnInner}>
              <Ionicons name="logo-apple" size={22} color={colors.white} />
              <Text style={styles.btnTextLight}>Continue with Apple</Text>
            </View>
          )}
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnLight,
          anyBusy && styles.btnDisabled,
          pressed && styles.btnPressed,
        ]}
        onPress={onEmail}
        disabled={anyBusy}
        accessibilityRole="button"
        accessibilityLabel="Continue with email"
        accessibilityState={{ disabled: anyBusy }}
      >
        <View style={styles.btnInner}>
          <Ionicons name="mail-outline" size={20} color={colors.black} />
          <Text style={styles.btnTextDark}>Continue with email</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  btn: {
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.small,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  btnLight: {
    backgroundColor: semantic.bgPrimary,
  },
  btnDark: {
    backgroundColor: colors.black,
  },
  btnTextDark: {
    ...typography.body,
    fontWeight: "800",
    color: semantic.textPrimary,
  },
  btnTextLight: {
    ...typography.body,
    fontWeight: "800",
    color: colors.white,
  },
  btnDisabled: { opacity: 0.6 },
  btnPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
});
