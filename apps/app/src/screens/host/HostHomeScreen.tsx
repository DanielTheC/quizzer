import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { loadRunQuizState } from "../../lib/runQuizStorage";
import { getLatestPack } from "../../lib/quizPack";
import { useAppTheme } from "../../context/ThemeContext";
import {
  colors,
  spacing,
  radius,
  borderWidth,
  shadow,
  typography,
  fonts,
  type SemanticTheme,
} from "../../theme";

function createStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgPrimary },
    content: { flex: 1, padding: spacing.xxl, justifyContent: "center" },
    headerRight: { padding: spacing.sm, marginRight: spacing.sm },
    headerRightText: { ...typography.bodyStrong, color: colors.blue },
    title: {
      ...typography.displayLarge,
      fontFamily: fonts.display,
      marginBottom: spacing.sm,
      color: semantic.textPrimary,
    },
    subtitle: { ...typography.body, color: semantic.textSecondary, marginBottom: spacing.xxl + spacing.sm },
    spinner: { marginTop: spacing.xxl },
    actions: { marginTop: spacing.lg },
    primaryButton: {
      backgroundColor: colors.yellow,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.large,
      marginBottom: spacing.md,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      alignItems: "center",
      ...shadow.small,
    },
    primaryButtonText: { ...typography.bodyStrong, fontSize: 18, color: semantic.textPrimary, textAlign: "center" },
    secondaryButton: {
      backgroundColor: colors.grey100,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.large,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      alignItems: "center",
      ...shadow.small,
    },
    secondaryButtonText: { ...typography.bodyStrong, fontSize: 18, color: semantic.textPrimary, textAlign: "center" },
    btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  });
}

export default function HostHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const { semantic } = useAppTheme();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [hasResumable, setHasResumable] = useState<boolean | null>(null);
  const [latestPackId, setLatestPackId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          style={({ pressed }) => [styles.headerRight, pressed && styles.btnPressed]}
        >
          <Text style={styles.headerRightText}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation, styles.headerRight, styles.headerRightText, styles.btnPressed]);

  useEffect(() => {
    let cancelled = false;
    loadRunQuizState().then((state) => {
      if (!cancelled) setHasResumable(state != null && state.teams.length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLatestPack().then((pack) => {
      if (!cancelled && pack) setLatestPackId(pack.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startNew = useCallback(() => {
    navigation.navigate("RunQuiz", { mode: "new", packId: latestPackId ?? undefined });
  }, [navigation, latestPackId]);

  const resume = useCallback(() => {
    navigation.navigate("RunQuiz", { mode: "resume" });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Run Quiz</Text>
        <Text style={styles.subtitle}>Host a quiz night (8 rounds + picture round)</Text>

        {hasResumable === null ? (
          <ActivityIndicator size="large" style={styles.spinner} />
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.btnPressed]}
              onPress={startNew}
            >
              <Text style={styles.primaryButtonText}>Start new quiz</Text>
            </Pressable>
            {hasResumable && (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.btnPressed]}
                onPress={resume}
              >
                <Text style={styles.secondaryButtonText}>Resume quiz</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
