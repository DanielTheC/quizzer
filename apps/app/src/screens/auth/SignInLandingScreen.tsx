import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useAuth } from "../../context/AuthContext";
import AuthProviderButtons from "../../components/AuthProviderButtons";
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  spacing,
  typography,
} from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "SignInLanding">;

export default function SignInLandingScreen({ navigation, route }: Props) {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(() => {
    if (route.params?.passwordReset) {
      return "Password updated — sign in with your new password.";
    }
    if (route.params?.signedUp) {
      return "Account created — sign in to continue.";
    }
    return null;
  });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  useEffect(() => {
    if (!successMsg) return;
    const id = setTimeout(() => setSuccessMsg(null), 6000);
    return () => clearTimeout(id);
  }, [successMsg]);

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

  const onEmail = useCallback(() => {
    navigation.navigate(
      "EmailSignIn",
      route.params?.signedUp ? { signedUp: true } : undefined,
    );
  }, [navigation, route.params]);

  const anyBusy = googleBusy || appleBusy;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.inner}>
        <Text style={styles.screenTitle}>Welcome back</Text>

        {successMsg ? (
          <View style={styles.successBanner} accessibilityLiveRegion="polite">
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {errorMsg ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <AuthProviderButtons
          onGoogle={onGoogle}
          onApple={onApple}
          onEmail={onEmail}
          googleBusy={googleBusy}
          appleBusy={appleBusy}
          disabled={anyBusy}
        />

        <Pressable
          style={styles.linkWrap}
          onPress={() => navigation.navigate("SignUpLanding")}
          disabled={anyBusy}
          accessibilityRole="link"
          accessibilityLabel="New here? Create an account"
        >
          <Text style={styles.linkLead}>
            New here?{" "}
            <Text style={styles.link}>Create an account</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantic.bgSecondary },
  inner: { flex: 1, padding: spacing.xxl, paddingTop: spacing.lg },
  screenTitle: {
    ...typography.displayMedium,
    fontFamily: fonts.display,
    color: semantic.textPrimary,
    marginBottom: spacing.xxl,
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
  linkWrap: { marginTop: spacing.xxl, alignItems: "center" },
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
