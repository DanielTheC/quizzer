import React, { useCallback, useRef, useState } from "react";
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
import { borderWidth, colors, fonts, radius, semantic, shadow, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneSignIn">;

const OTP_LENGTH = 6;

function OtpInput({
  digits,
  onDigitChange,
  onKeyPress,
  inputRefs,
  disabled,
}: {
  digits: string[];
  onDigitChange: (idx: number, val: string) => void;
  onKeyPress: (idx: number, key: string) => void;
  inputRefs: React.MutableRefObject<(TextInput | null)[]>;
  disabled: boolean;
}) {
  return (
    <View style={otpStyles.row} accessibilityLabel="One-time code input">
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          style={[otpStyles.cell, digit ? otpStyles.cellFilled : null]}
          value={digit}
          onChangeText={(val) => onDigitChange(i, val)}
          onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={2}
          autoComplete={i === 0 ? "sms-otp" : "off"}
          textContentType={i === 0 ? "oneTimeCode" : "none"}
          selectTextOnFocus
          editable={!disabled}
          accessibilityLabel={`Digit ${i + 1} of ${OTP_LENGTH}`}
          caretHidden
        />
      ))}
    </View>
  );
}

const otpStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: semantic.textPrimary,
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.brutal,
    ...shadow.small,
  },
  cellFilled: {
    backgroundColor: colors.yellow,
    borderColor: colors.black,
  },
});

function friendlyPhoneError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid") && lower.includes("phone")) return "Enter a valid mobile number (e.g. 07123456789).";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Please wait a moment.";
  if (lower.includes("network") || lower.includes("fetch")) return "No internet connection. Check your network.";
  return "Could not send code. Please try again.";
}

function friendlyOtpError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid") || lower.includes("expired") || lower.includes("incorrect")) {
    return "Incorrect or expired code. Check your texts and try again.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Please wait a moment.";
  return "Verification failed. Please try again.";
}

export default function PhoneSignInScreen({ navigation }: Props) {
  const { requestPhoneOtp, verifyPhoneOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  const code = digits.join("");

  const onDigitChange = useCallback((idx: number, val: string) => {
    const chars = val.replace(/\D/g, "");
    if (chars.length > 1) {
      // Handle paste / OTP autofill — spread across cells
      const spread = chars.slice(0, OTP_LENGTH).split("");
      const next = [...digits];
      spread.forEach((c, i) => {
        if (idx + i < OTP_LENGTH) next[idx + i] = c;
      });
      setDigits(next);
      const lastFilled = Math.min(idx + spread.length, OTP_LENGTH - 1);
      inputRefs.current[lastFilled]?.focus();
      return;
    }
    const char = chars.slice(0, 1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  }, [digits]);

  const onKeyPress = useCallback((idx: number, key: string) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = "";
      setDigits(next);
      inputRefs.current[idx - 1]?.focus();
    }
  }, [digits]);

  const onSendCode = useCallback(async () => {
    setErrorMsg(null);
    if (!phone.trim()) {
      setErrorMsg("Enter your mobile number.");
      return;
    }
    setBusy(true);
    const { error } = await requestPhoneOtp(phone);
    setBusy(false);
    if (error) {
      setErrorMsg(friendlyPhoneError(error.message));
      return;
    }
    setStep("code");
    setDigits(Array(OTP_LENGTH).fill(""));
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [phone, requestPhoneOtp]);

  const onVerify = useCallback(async () => {
    setErrorMsg(null);
    const t = code.trim();
    if (t.length < OTP_LENGTH) {
      setErrorMsg(`Enter all ${OTP_LENGTH} digits of your code.`);
      return;
    }
    setBusy(true);
    const { error } = await verifyPhoneOtp(phone, t);
    setBusy(false);
    if (error) {
      setErrorMsg(friendlyOtpError(error.message));
    }
  }, [phone, code, verifyPhoneOtp]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.screenTitle}>Phone sign in</Text>
          <Text style={styles.lead}>
            {step === "phone"
              ? "We'll text you a one-time code. UK numbers can start with 0; we'll add +44."
              : `Code sent to ${phone.trim()}. Tap each box to enter your ${OTP_LENGTH}-digit code.`}
          </Text>

          {step === "phone" ? (
            <>
              <Text style={styles.label}>Mobile number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 07123456789 or +447123456789"
                placeholderTextColor={semantic.textSecondary}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                editable={!busy}
                accessibilityLabel="Mobile number"
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>6-digit code</Text>
              <OtpInput
                digits={digits}
                onDigitChange={onDigitChange}
                onKeyPress={onKeyPress}
                inputRefs={inputRefs}
                disabled={busy}
              />
            </>
          )}

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
            onPress={step === "phone" ? onSendCode : onVerify}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={step === "phone" ? "Send code" : "Verify and sign in"}
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === "phone" ? "Send code" : "Verify & sign in"}
              </Text>
            )}
          </Pressable>

          {step === "code" ? (
            <Pressable
              style={styles.secondaryLink}
              onPress={() => {
                setStep("phone");
                setDigits(Array(OTP_LENGTH).fill(""));
                setErrorMsg(null);
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Use a different number"
            >
              <Text style={styles.secondaryLinkText}>Use a different number</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate("Login")}
            disabled={busy}
            accessibilityRole="link"
            accessibilityLabel="Back to sign in"
          >
            <Text style={styles.link}>Back to sign in</Text>
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
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  secondaryLink: { marginTop: spacing.lg, alignItems: "center" },
  secondaryLinkText: { ...typography.body, fontWeight: "600", color: semantic.accentBlue },
  linkWrap: { marginTop: spacing.xxl, alignItems: "center" },
  link: { ...typography.body, fontWeight: "700", color: semantic.accentBlue, textDecorationLine: "underline" },
});
