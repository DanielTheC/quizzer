import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  authEmailForHost,
  fetchLatestHostApplication,
  invalidateHostAllowlistCache,
  type HostApplicationRow,
} from "../../lib/hostAccess";
import { ScreenTitle } from "../../components/ScreenTitle";
import { borderWidth, colors, radius, semantic, shadow, spacing, typography } from "../../theme";

export default function HostApplyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const { session } = useAuth();
  const email = authEmailForHost(session);

  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<HostApplicationRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** True after successful insert until refocus refresh. */
  const [justSubmitted, setJustSubmitted] = useState(false);

  const loadLatestApplication = useCallback(async () => {
    if (!email) {
      setLatest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const row = await fetchLatestHostApplication(email);
    setLatest(row);
    if (row) setJustSubmitted(false);
    setLoading(false);
  }, [email]);

  useFocusEffect(
    useCallback(() => {
      void loadLatestApplication();
    }, [loadLatestApplication])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Host access",
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight} accessibilityLabel="Settings">
          <MaterialCommunityIcons name="cog-outline" size={24} color={semantic.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const onSubmit = useCallback(async () => {
    if (!email) return;
    const name = fullName.trim();
    const phoneTrim = phone.trim();
    const noteTrim = notes.trim();
    if (name.length < 2) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (phoneTrim.length < 3) {
      setErrorMsg("Please enter a phone number we can reach you on.");
      return;
    }
    if (noteTrim.length < 10) {
      setErrorMsg("Add a short note about your hosting experience (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    const { error } = await supabase.from("host_applications").insert({
      email,
      full_name: name,
      phone: phoneTrim,
      experience_notes: noteTrim,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505" || error.message?.toLowerCase().includes("unique")) {
        setErrorMsg("You already have a pending application.");
        await loadLatestApplication();
        return;
      }
      setErrorMsg("Could not submit your application. Please try again.");
      return;
    }
    setJustSubmitted(true);
    setFullName("");
    setPhone("");
    setNotes("");
    await loadLatestApplication();
  }, [email, fullName, phone, notes, loadLatestApplication]);

  const showPendingCard = latest?.status === "pending" || (justSubmitted && !latest);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenTitle subtitle="We review requests manually. You’ll get access when your email is added to the host list.">
            Request host access
          </ScreenTitle>

          {!email ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                Your account doesn’t have an email on file. Sign out and use email sign-in or Google so we can match your
                application.
              </Text>
            </View>
          ) : loading ? (
            <ActivityIndicator size="large" color={semantic.textPrimary} style={styles.loader} />
          ) : latest?.status === "approved" ? (
            <View style={styles.card}>
              <MaterialCommunityIcons name="check-decagram" size={40} color={semantic.success} style={styles.heroIcon} />
              <Text style={styles.cardTitle}>Application approved</Text>
              <Text style={styles.body}>
                Your request for <Text style={styles.mono}>{email}</Text> was approved. You can use host setup, packs, listings, and
                the run-quiz flow.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  invalidateHostAllowlistCache();
                  navigation.replace("HostSetup");
                }}
                accessibilityLabel="Open host setup"
              >
                <Text style={styles.primaryBtnText}>Continue to host setup</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                onPress={() => void loadLatestApplication()}
              >
                <Text style={styles.secondaryBtnText}>Refresh status</Text>
              </Pressable>
            </View>
          ) : showPendingCard ? (
            <View style={styles.card}>
              <MaterialCommunityIcons name="clock-outline" size={40} color={semantic.textPrimary} style={styles.heroIcon} />
              <Text style={styles.cardTitle}>Application pending</Text>
              <Text style={styles.body}>
                Thanks — we’ve got your request for <Text style={styles.mono}>{email}</Text>
                {latest ? ` submitted ${formatDate(latest.created_at)}.` : "."} We’ll review it and enable host tools on your account
                when approved.
              </Text>
              <Text style={styles.muted}>
                We’ll keep your place in the queue. Open host setup if you think you’ve already been approved — it will refresh access.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                onPress={() => navigation.navigate("HostSetup")}
              >
                <Text style={styles.secondaryBtnText}>Open host setup</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.applySecondary, pressed && styles.btnPressed]}
                onPress={() => void loadLatestApplication()}
              >
                <Text style={styles.applySecondaryText}>Refresh status</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {latest?.status === "rejected" ? (
                <View style={[styles.card, styles.rejectedCard]}>
                  <MaterialCommunityIcons name="close-circle-outline" size={40} color={semantic.danger} style={styles.heroIcon} />
                  <Text style={styles.cardTitle}>Application not approved</Text>
                  <Text style={styles.body}>
                    Your latest request ({formatDate(latest.created_at)}) was not approved for host access.
                    {latest.rejection_reason?.trim() ? (
                      <>
                        {"\n\n"}
                        <Text style={styles.rejectionReason}>{latest.rejection_reason.trim()}</Text>
                      </>
                    ) : null}
                  </Text>
                  <Text style={styles.muted}>You can submit a new application below if something has changed.</Text>
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.label}>Email (from your account)</Text>
                <Text style={styles.emailReadonly}>{email}</Text>

                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  placeholderTextColor={colors.grey400}
                  autoCapitalize="words"
                  editable={!submitting}
                  maxLength={100}
                  accessibilityLabel="Full name"
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile or venue line"
                  placeholderTextColor={colors.grey400}
                  keyboardType="phone-pad"
                  editable={!submitting}
                  maxLength={20}
                  accessibilityLabel="Phone number"
                />

                <Text style={styles.label}>Hosting experience</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Weekly quiz at The Red Lion for 2 years, familiar with Quizzer format."
                  placeholderTextColor={colors.grey400}
                  multiline
                  textAlignVertical="top"
                  editable={!submitting}
                  maxLength={1000}
                  accessibilityLabel="Hosting experience notes"
                />

                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    submitting && styles.btnDisabled,
                    pressed && !submitting && styles.btnPressed,
                  ]}
                  onPress={() => void onSubmit()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.black} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Submit application</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantic.bgSecondary },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  headerRight: { padding: spacing.sm, marginRight: spacing.sm },
  loader: { marginTop: spacing.xl },
  card: {
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  heroIcon: { alignSelf: "center", marginBottom: spacing.md },
  cardTitle: { ...typography.displaySmall, color: semantic.textPrimary, textAlign: "center", marginBottom: spacing.sm },
  body: { ...typography.body, color: semantic.textPrimary, lineHeight: 22 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 14 },
  muted: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.md, lineHeight: 20 },
  label: { ...typography.labelUppercase, color: semantic.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  emailReadonly: {
    ...typography.body,
    color: semantic.textSecondary,
    paddingVertical: spacing.sm,
  },
  input: {
    borderWidth: borderWidth.default,
    borderColor: colors.grey200,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    fontSize: 16,
    color: semantic.textPrimary,
    backgroundColor: semantic.bgSecondary,
  },
  inputMultiline: { minHeight: 100, paddingTop: spacing.md },
  errorBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.cream,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
  },
  errorText: { ...typography.caption, color: semantic.danger },
  primaryBtn: {
    marginTop: spacing.xl,
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  primaryBtnText: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
  secondaryBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
    alignItems: "center",
  },
  secondaryBtnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  btnDisabled: { opacity: 0.5 },
  rejectedCard: { borderColor: semantic.danger },
  rejectionReason: { ...typography.body, fontStyle: "italic", color: semantic.textSecondary },
  applySecondary: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
    alignItems: "center",
  },
  applySecondaryText: { ...typography.bodyStrong, fontSize: 15, color: semantic.textPrimary },
});
