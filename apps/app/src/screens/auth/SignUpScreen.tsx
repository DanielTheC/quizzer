import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and a password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords do not match", "Check your password and confirmation.");
      return;
    }
    setBusy(true);
    const { error } = await signUpWithEmail(email, password);
    setBusy(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }
    Alert.alert(
      "Check your email",
      "If email confirmation is enabled in your project, open the link we sent to finish signing up. You can then sign in here.",
      [{ text: "OK", onPress: () => navigation.navigate("Login") }]
    );
  }, [email, password, confirm, signUpWithEmail, navigation]);

  const onGoogle = useCallback(async () => {
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) {
      Alert.alert("Google sign-in failed", error.message);
    }
  }, [signInWithGoogle]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.lead}>Create a Quizzer account with email or Google.</Text>

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
            editable={!busy && !googleBusy}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={semantic.textSecondary}
            secureTextEntry
            editable={!busy && !googleBusy}
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat password"
            placeholderTextColor={semantic.textSecondary}
            secureTextEntry
            editable={!busy && !googleBusy}
          />

          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={busy || googleBusy}
          >
            {busy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.primaryBtnText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={[styles.googleBtn, googleBusy && styles.btnDisabled]}
            onPress={onGoogle}
            disabled={busy || googleBusy}
          >
            {googleBusy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate("Login")}
            disabled={busy || googleBusy}
          >
            <Text style={styles.link}>Already have an account? Sign in</Text>
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
  primaryBtn: {
    backgroundColor: semantic.accentPink,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.small,
  },
  primaryBtnText: { ...typography.body, fontWeight: "800", color: semantic.textInverse },
  btnDisabled: { opacity: 0.6 },
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
  linkWrap: { marginTop: spacing.xxl, alignItems: "center" },
  link: { ...typography.body, fontWeight: "700", color: semantic.accentBlue, textDecorationLine: "underline" },
});
