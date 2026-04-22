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

type Props = NativeStackScreenProps<AuthStackParamList, "EmailSignIn">;

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed")
  ) {
    return "Incorrect email or password. Please try again.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "No internet connection. Check your network and try again.";
  }
  return "Sign in failed. Please try again.";
}

export default function EmailSignInScreen({ navigation, route }: Props) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    route.params?.signedUp
      ? "Account created — check your email to confirm, then sign in."
      : null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!successMsg) return;
    const id = setTimeout(() => setSuccessMsg(null), 6000);
    return () => clearTimeout(id);
  }, [successMsg]);

  const onSubmit = useCallback(async () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) {
      setErrorMsg(friendlyAuthError(error.message));
    }
  }, [email, password, signInWithEmail]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.screenTitle}>Sign in with email</Text>

          {successMsg ? (
            <View style={styles.successBanner} accessibilityLiveRegion="polite">
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={semantic.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
            accessibilityLabel="Email address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={semantic.textSecondary}
            secureTextEntry
            editable={!busy}
            accessibilityLabel="Password"
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
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.forgotWrap}
            onPress={() => navigation.navigate("RequestPasswordReset")}
            disabled={busy}
            accessibilityRole="link"
            accessibilityLabel="Forgot password?"
          >
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate("SignUpLanding")}
            disabled={busy}
            accessibilityRole="link"
            accessibilityLabel="Don't have an account? Sign up"
          >
            <Text style={styles.linkLead}>
              Don&apos;t have an account?{" "}
              <Text style={styles.link}>Sign up</Text>
            </Text>
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
    marginBottom: spacing.xxl,
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
  successBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.cream,
    borderWidth: borderWidth.default,
    borderColor: semantic.success,
  },
  successText: { ...typography.caption, color: semantic.success },
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
  primaryBtnText: {
    ...typography.body,
    fontWeight: "800",
    color: semantic.textPrimary,
  },
  btnDisabled: { opacity: 0.6 },
  btnPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  forgotWrap: { marginTop: spacing.lg, alignItems: "center" },
  forgotLink: {
    ...typography.body,
    fontWeight: "700",
    color: semantic.accentBlue,
    textDecorationLine: "underline",
  },
  linkWrap: { marginTop: spacing.lg, alignItems: "center" },
  linkLead: {
    ...typography.body,
    color: semantic.textSecondary,
    fontWeight: "600",
  },
  link: {
    fontWeight: "700",
    color: semantic.accentBlue,
    textDecorationLine: "underline",
  },
});
