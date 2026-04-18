import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
} from "react-native";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { setStoredRole, clearStoredRole } from "../lib/roleStorage";
import type { QuizzerRole } from "../lib/roleStorage";
import {
  getNotificationPreferences,
  setNotificationPreferences,
  type NotificationPreferences,
} from "../lib/notificationPreferences";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScreenTitle } from "../components/ScreenTitle";
import { HostStackParamList } from "../navigation/RootNavigator";
import {
  requestPermissions,
  cancelAllQuizzerNotifications,
  scheduleQuizNotificationsIfEnabled,
  syncExpoPushTokenIfNeeded,
} from "../lib/notifications";
const TIME_PRESETS = ["10:00", "12:00", "14:00"] as const;
const MILES_OPTIONS = [3, 5, 10] as const;

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { role, setRole } = useRole();
  const { clearSaved, savedIds } = useSavedQuizzes();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      setPrefs((p) => (p ? { ...p, ...patch } : null));
      setNotificationPreferences(patch).then(() => {
        scheduleQuizNotificationsIfEnabled(savedIds).catch(() => {});
      });
    },
    [savedIds]
  );

  const switchRole = useCallback(
    (newRole: QuizzerRole) => {
      setStoredRole(newRole).then(() => setRole(newRole));
    },
    [setRole]
  );

  const onSignOut = useCallback(() => {
    Alert.alert("Sign out", "You'll need to sign in again to use Quizzer.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  const resetApp = useCallback(() => {
    Alert.alert(
      "Reset app",
      "Clear saved quizzes and role? You will see the role picker again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            clearSaved();
            await clearStoredRole();
            setRole(null);
          },
        },
      ]
    );
  }, [clearSaved, setRole]);

  const onNotifyToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert(
            "Notifications disabled",
            "To get saved-quiz-day reminders, enable notifications in your device Settings → Quizzer → Notifications.",
            [{ text: "OK" }]
          );
          return;
        }
        await syncExpoPushTokenIfNeeded();
      } else {
        await cancelAllQuizzerNotifications();
      }
      updatePrefs({ notifyEnabled: value });
    },
    [updatePrefs]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <ScreenTitle subtitle="Account, role, and reminders.">Settings</ScreenTitle>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user?.email ? (
          <Text style={styles.currentRole}>{user.email}</Text>
        ) : (
          <Text style={styles.currentRole}>Signed in</Text>
        )}
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.btnPressed]}
          onPress={onSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <Text style={styles.currentRole}>Current: {role === "player" ? "Player" : "Host"}</Text>
        <Pressable
          style={({ pressed }) => [styles.switchButton, pressed && styles.btnPressed]}
          onPress={() => switchRole(role === "player" ? "host" : "player")}
        >
          <Text style={styles.switchButtonText}>
            Switch to {role === "player" ? "Host" : "Player"}
          </Text>
        </Pressable>
      </View>

      {role === "host" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host</Text>
          <Text style={styles.sectionDesc}>Replay the short introduction any time.</Text>
          <Pressable
            style={({ pressed }) => [styles.guideLink, pressed && styles.btnPressed]}
            onPress={() =>
              (navigation as unknown as NativeStackNavigationProp<HostStackParamList>).navigate("HostOnboarding", {
                allowBack: true,
              })
            }
          >
            <Text style={styles.guideLinkText}>View host guide</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.sectionDesc}>
          On days you have a saved quiz, we’ll ping at the time below. Tap the notification to open that quiz.
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Notify me about saved quizzes</Text>
          <Switch
            value={prefs?.notifyEnabled ?? false}
            onValueChange={onNotifyToggle}
            trackColor={{ false: colors.grey200, true: semantic.accentBlue }}
            thumbColor={colors.white}
          />
        </View>
        {prefs && (
          <>
            <Text style={styles.settingLabel}>Send at</Text>
            <View style={styles.presetRow}>
              {TIME_PRESETS.map((t) => (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.presetChip,
                    prefs.notifyTime === t && styles.presetChipActive,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => updatePrefs({ notifyTime: t })}
                >
                  <Text style={[styles.presetChipText, prefs.notifyTime === t && styles.presetChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Only if within X miles</Text>
              <Switch
                value={prefs.onlyWithinMiles != null}
                onValueChange={(on) =>
                  updatePrefs({ onlyWithinMiles: on ? 5 : null })
                }
                trackColor={{ false: colors.grey200, true: semantic.accentBlue }}
                thumbColor={colors.white}
              />
            </View>
            {prefs.onlyWithinMiles != null && (
              <View style={styles.presetRow}>
                {MILES_OPTIONS.map((m) => (
                  <Pressable
                    key={m}
                    style={({ pressed }) => [
                      styles.presetChip,
                      prefs.onlyWithinMiles === m && styles.presetChipActive,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => updatePrefs({ onlyWithinMiles: m })}
                  >
                    <Text style={[styles.presetChipText, prefs.onlyWithinMiles === m && styles.presetChipTextActive]}>{m} mi</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Pressable
            style={({ pressed }) => [styles.resetButton, pressed && styles.btnPressed]}
            onPress={resetApp}
          >
            <Text style={styles.resetButtonText}>Reset app</Text>
          </Pressable>
          <Text style={styles.devNote}>Clears saved quizzes + role. Dev only.</Text>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  section: {
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  sectionTitle: { ...typography.labelUppercase, color: semantic.textSecondary, marginBottom: spacing.sm },
  sectionDesc: { ...typography.caption, color: semantic.textSecondary, marginBottom: spacing.md },
  currentRole: { ...typography.body, color: semantic.textPrimary, marginBottom: spacing.md },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  switchLabel: { ...typography.body, color: semantic.textPrimary, flex: 1 },
  settingLabel: { ...typography.caption, color: semantic.textSecondary, marginBottom: spacing.sm },
  presetRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
  presetChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.small,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
    ...shadow.small,
  },
  presetChipActive: { backgroundColor: semantic.accentBlue },
  presetChipText: { ...typography.captionStrong, color: semantic.textPrimary },
  presetChipTextActive: { color: semantic.textInverse },
  switchButton: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignSelf: "flex-start",
    ...shadow.small,
  },
  switchButtonText: { color: semantic.textPrimary, ...typography.bodyStrong },
  guideLink: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  guideLinkText: { ...typography.bodyStrong, color: semantic.textPrimary, textDecorationLine: "underline" },
  signOutButton: {
    backgroundColor: semantic.bgPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    ...shadow.small,
  },
  signOutButtonText: { color: semantic.textPrimary, ...typography.bodyStrong },
  resetButton: {
    backgroundColor: semantic.bgPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
    alignSelf: "flex-start",
    ...shadow.small,
  },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  resetButtonText: { color: semantic.danger, ...typography.bodyStrong },
  devNote: { ...typography.label, color: semantic.textSecondary, marginTop: spacing.sm },
});
