import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
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

export default function HostHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const [hasResumable, setHasResumable] = useState<boolean | null>(null);
  const [latestPackId, setLatestPackId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight}>
          <Text style={styles.headerRightText}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    loadRunQuizState().then((state) => {
      if (!cancelled) setHasResumable(state != null && state.teams.length > 0);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLatestPack().then((pack) => {
      if (!cancelled && pack) setLatestPackId(pack.id);
    });
    return () => { cancelled = true; };
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
            <Pressable style={styles.primaryButton} onPress={startNew}>
              <Text style={styles.primaryButtonText}>Start new quiz</Text>
            </Pressable>
            {hasResumable && (
              <Pressable style={styles.secondaryButton} onPress={resume}>
                <Text style={styles.secondaryButtonText}>Resume quiz</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  headerRight: { padding: 8, marginRight: 8 },
  headerRightText: { fontSize: 16, color: "#2563eb", fontWeight: "500" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8, color: "#111" },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 32 },
  spinner: { marginTop: 24 },
  actions: { marginTop: 16 },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  secondaryButtonText: { color: "#334155", fontSize: 18, fontWeight: "600", textAlign: "center" },
});
