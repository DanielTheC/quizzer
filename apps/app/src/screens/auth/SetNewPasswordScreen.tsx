import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useAuth } from "../../context/AuthContext";
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  shadow,
  spacing,
  typography,
} from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "SetNewPassword">;

function friendlyUpdateError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("same password") || lower.includes("new password should be different")) {
    return "New password must be different from your current password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "No internet connection. Check your network and try again.";
  }
  return "Couldn't save new password. Please try again.";
}

export default function SetNewPasswordScreen({ navigation }: Props) {
  const { updatePassword, clearRecoveryMode, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const onSubmit = useCallback(async () => {
    setErrorMsg(null);
    if (!password) {
      setErrorMsg("Enter a new password.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match. Check and try again.");
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    if (error) {
      setBusy(false);
      setErrorMsg(friendlyUpdateError(error.message));
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "SignInLanding", params: { passwordReset: true } }],
    });
    await signOut();
    clearRecoveryMode();
  }, [password, confirm, updatePassword, clearRecoveryMode, signOut, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.screenTitle}>Set a new password</Text>
          <Text style={styles.lead}>
            Pick a new password to finish resetting your account.
          </Text>

          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={semantic.textSecondary}
            secureTextEntry
            editable={!busy}
            accessibilityLabel="New password"
          />

          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
            placeholderTextColor={semantic.textSecondary}
            secureTextEntry
            editable={!busy}
            accessibilityLabel="Confirm new password"
          />

          {errorMsg ? (
            <View style={styles.errorBanner} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              busy && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
            onPress={onSubmit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Save new password"
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.primaryBtnText}>Save new password</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantic.bgSecondary },
  flex: { flex: 1 },
  inner: { flex: 1, padding: spacing.xxl, paddingTop: spacing.lg },
  screenTitle: {
    ...typography.displayMedium,
    fontFamily: fonts.display,
    color: semantic.textPrimary,
    marginBottom: spacing.md,
  },
  lead: {
    ...typography.body,
    color: semantic.textSecondary,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    color: semantic.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.small,
  },
  errorBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.cream,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
  },
  errorText: { ...typography.caption, color: semantic.danger },
  primaryBtn: {
    backgroundColor: semantic.accentYellow,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.small,
  },
  primaryBtnText: { ...typography.body, fontWeight: "800", color: semantic.textPrimary },
  btnDisabled: { opacity: 0.6 },
  btnPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
});
