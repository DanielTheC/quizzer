import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
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

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) {
      Alert.alert("Sign in failed", error.message);
    }
  }, [email, password, signInWithEmail]);

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
          <Text style={styles.lead}>Welcome back — sign in to sync your saved quizzes.</Text>

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
            placeholder="••••••••"
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
              <Text style={styles.primaryBtnText}>Sign in</Text>
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
            onPress={() => navigation.navigate("SignUp")}
            disabled={busy || googleBusy}
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
