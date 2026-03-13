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
import { useRole } from "../context/RoleContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { setStoredRole, clearStoredRole } from "../lib/roleStorage";
import type { QuizzerRole } from "../lib/roleStorage";
import {
  getNotificationPreferences,
  setNotificationPreferences,
  type NotificationPreferences,
} from "../lib/notificationPreferences";
import {
  requestPermissions,
  cancelAllQuizzerNotifications,
  scheduleQuizNotificationsIfEnabled,
} from "../lib/notifications";
import { useScheduleQuizNotifications } from "../hooks/useScheduleQuizNotifications";

const TIME_PRESETS = ["10:00", "12:00", "14:00"] as const;
const MILES_OPTIONS = [3, 5, 10] as const;

export default function SettingsScreen() {
  const { role, setRole } = useRole();
  const { clearSaved, savedIds } = useSavedQuizzes();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useScheduleQuizNotifications();

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
            "To get reminders for quizzes near you, enable notifications in your device Settings → Quizzer → Notifications.",
            [{ text: "OK" }]
          );
          return;
        }
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <Text style={styles.currentRole}>Current: {role === "player" ? "Player" : "Host"}</Text>
        <Pressable
          style={styles.switchButton}
          onPress={() => switchRole(role === "player" ? "host" : "player")}
        >
          <Text style={styles.switchButtonText}>
            Switch to {role === "player" ? "Host" : "Player"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.sectionDesc}>Quizzes near you tonight</Text>
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
                  style={[styles.presetChip, prefs.notifyTime === t && styles.presetChipActive]}
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
                    style={[styles.presetChip, prefs.onlyWithinMiles === m && styles.presetChipActive]}
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
          <Pressable style={styles.resetButton} onPress={resetApp}>
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
  section: { marginBottom: 32 },
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
  resetButton: {
    backgroundColor: semantic.bgPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.danger,
    alignSelf: "flex-start",
  },
  resetButtonText: { color: semantic.danger, ...typography.bodyStrong },
  devNote: { ...typography.label, color: semantic.textSecondary, marginTop: spacing.sm },
});
