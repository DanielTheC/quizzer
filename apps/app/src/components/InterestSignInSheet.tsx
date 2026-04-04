import React, { useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { borderWidth, radius, semantic, shadow, spacing, typography } from "../theme";

/**
 * One gentle nudge per "unsigned save period" (see interest_nudge_shown in SavedQuizzesContext).
 * Sign in: sign out so RootNavigator shows Auth (local saves stay in AsyncStorage + provider state).
 */
export function InterestSignInSheet() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { interestSignInSheetVisible, dismissInterestSignInSheet } = useSavedQuizzes();

  const onMaybeLater = useCallback(() => {
    dismissInterestSignInSheet();
  }, [dismissInterestSignInSheet]);

  const onSignIn = useCallback(() => {
    dismissInterestSignInSheet();
    void signOut();
  }, [dismissInterestSignInSheet, signOut]);

  return (
    <Modal
      visible={interestSignInSheetVisible}
      animationType="slide"
      transparent
      onRequestClose={onMaybeLater}
      statusBarTranslucent
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onMaybeLater}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <View style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.grabberShell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.grabber} />
        </View>
        <Text style={styles.title}>Sign in to register your interest</Text>
        <Text style={styles.body}>
          Hosts can see who's coming when your saves are linked to an account. Your quizzes stay saved on this device
          either way.
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={onMaybeLater}
            accessibilityLabel="Maybe later"
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Maybe later</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onSignIn}
            accessibilityLabel="Sign in"
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: semantic.bgPrimary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: borderWidth.default,
    borderLeftWidth: borderWidth.default,
    borderRightWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    ...shadow.large,
  },
  grabberShell: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: semantic.textSecondary,
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: semantic.textPrimary,
    marginTop: spacing.xs,
  },
  body: {
    ...typography.body,
    color: semantic.textSecondary,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  primaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.medium,
    backgroundColor: semantic.accentYellow,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  primaryBtnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  secondaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
  },
  secondaryBtnText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  pressed: { opacity: 0.88 },
});
