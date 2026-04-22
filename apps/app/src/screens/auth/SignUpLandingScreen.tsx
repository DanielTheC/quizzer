import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type Props = NativeStackScreenProps<AuthStackParamList, "SignUpLanding">;

export default function SignUpLandingScreen({ navigation }: Props) {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  const onGoogle = useCallback(async () => {
    setErrorMsg(null);
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) {
      setErrorMsg("Google sign-up failed. Please try again.");
    }
  }, [signInWithGoogle]);

  const onApple = useCallback(async () => {
    setErrorMsg(null);
    setAppleBusy(true);
    const { error } = await signInWithApple();
    setAppleBusy(false);
    if (error) {
      setErrorMsg("Apple sign-up failed. Please try again.");
    }
  }, [signInWithApple]);

  const onEmail = useCallback(() => {
    navigation.navigate("EmailSignUp");
  }, [navigation]);

  const anyBusy = googleBusy || appleBusy;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.inner}>
        <Text style={styles.screenTitle}>Create your account</Text>

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
          onPress={() => navigation.navigate("SignInLanding")}
          disabled={anyBusy}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Sign in"
        >
          <Text style={styles.linkLead}>
            Already have an account?{" "}
            <Text style={styles.link}>Sign in</Text>
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
