import * as Linking from "expo-linking";
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
import { borderWidth, colors, radius, semantic, shadow, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials") || lower.includes("email not confirmed")) {
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

export default function LoginScreen({ navigation, route }: Props) {
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    route.params?.signedUp ? "Account created — check your email to confirm, then sign in." : null
  );
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  useEffect(() => {
    if (!successMsg) return;
    const id = setTimeout(() => setSuccessMsg(null), 6000);
    return () => clearTimeout(id);
  }, [successMsg]);

  /** In Expo Go, copy this URL from the Metro terminal into Supabase → Auth → Redirect URLs. */
  useEffect(() => {
    if (__DEV__) {
      console.log(
        "[Quizzer] Add this to Supabase Redirect URLs (Expo Go):",
        Linking.createURL("auth/callback")
      );
    }
  }, []);

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

  const onGoogle = useCallback(async () => {
    setErrorMsg(null);
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) {
      setErrorMsg("Google sign-in failed. Please try again.");
    }
  }, [signInWithGoogle]);

  const onApple = useCallback(async () => {
    setErrorMsg(null);
    setAppleBusy(true);
    const { error } = await signInWithApple();
    setAppleBusy(false);
    if (error) {
      setErrorMsg("Apple sign-in failed. Please try again.");
    }
  }, [signInWithApple]);

  const anyBusy = busy || googleBusy || appleBusy;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.lead}>
            Welcome back — sign in with email, Google, Apple, or phone to sync your saved quizzes.
          </Text>

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
            editable={!anyBusy}
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
            editable={!anyBusy}
            accessibilityLabel="Password"
          />

          {errorMsg ? (
            <View style={styles.errorBanner} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, anyBusy && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={onSubmit}
            disabled={anyBusy}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: anyBusy }}
          >
            {busy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.googleBtn, anyBusy && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={onGoogle}
            disabled={anyBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: anyBusy }}
          >
            {googleBusy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.appleBtn, anyBusy && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={onApple}
            disabled={anyBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            accessibilityState={{ disabled: anyBusy }}
          >
            {appleBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.phoneBtn, anyBusy && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={() => navigation.navigate("PhoneSignIn")}
            disabled={anyBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue with phone number"
            accessibilityState={{ disabled: anyBusy }}
          >
            <Text style={styles.phoneBtnText}>Continue with phone number</Text>
          </Pressable>

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate("SignUp")}
            disabled={anyBusy}
            accessibilityRole="link"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.link}>Create an account</Text>
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
  successBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: "rgba(0, 210, 106, 0.12)",
    borderWidth: borderWidth.default,
    borderColor: semantic.success,
  },
  successText: { ...typography.body, color: semantic.success, fontSize: 14 },
  errorBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
  },
  errorText: { ...typography.body, color: semantic.danger, fontSize: 14 },
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
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xxl,
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: borderWidth.thin, backgroundColor: semantic.borderPrimary },
  dividerText: { ...typography.caption, color: semantic.textSecondary, fontWeight: "600" },
  googleBtn: {
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadow.small,
  },
  googleBtnText: { ...typography.body, fontWeight: "800", color: semantic.textPrimary },
  appleBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.black,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadow.small,
  },
  appleBtnText: { ...typography.body, fontWeight: "800", color: colors.white },
  phoneBtn: {
    marginTop: spacing.md,
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadow.small,
  },
  phoneBtnText: { ...typography.body, fontWeight: "800", color: semantic.textPrimary },
  linkWrap: { marginTop: spacing.xxl, alignItems: "center" },
  link: { ...typography.body, fontWeight: "700", color: semantic.accentBlue, textDecorationLine: "underline" },
});
