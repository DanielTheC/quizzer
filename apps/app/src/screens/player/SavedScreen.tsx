import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { SavedStackParamList } from "../../navigation/RootNavigator";
import { QuizCard } from "../../components/QuizCard";
import { semantic, spacing, typography } from "../../theme";

type Venue = {
  name: string;
  address: string;
  postcode?: string | null;
  city?: string | null;
};

type QuizEvent = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: Venue | null;
};

export default function SavedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SavedStackParamList>>();
  const { savedIds, isSaved, toggleSaved } = useSavedQuizzes();
  const [quizzes, setQuizzes] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    if (savedIds.length === 0) {
      setQuizzes([]);
      setLoading(false);
      setErrorMsg(null);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("quiz_events")
      .select(
        `
        id,
        day_of_week,
        start_time,
        entry_fee_pence,
        prize,
        venues (
          name,
          address,
          postcode,
          city
        )
      `
      )
      .in("id", savedIds)
      .eq("is_active", true);

    if (error) {
      setErrorMsg(error.message);
      setQuizzes([]);
    } else {
      setQuizzes((data as unknown as QuizEvent[]) ?? []);
    }
    setLoading(false);
  }, [savedIds]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const sortedQuizzes = useMemo(
    () =>
      [...quizzes].sort(
        (a, b) =>
          a.day_of_week - b.day_of_week ||
          String(a.start_time).localeCompare(String(b.start_time))
      ),
    [quizzes]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={semantic.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Saved quizzes</Text>
      {savedIds.length === 0 ? (
        <Text style={styles.emptyText}>
          No saved quizzes. Tap the heart on a quiz in Nearby to save it.
        </Text>
      ) : errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>Couldn’t load saved quizzes</Text>
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={sortedQuizzes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuizCard
              quiz={item}
              distanceLabel={null}
              isSaved={isSaved(item.id)}
              onToggleSaved={() => toggleSaved(item.id)}
              onPress={() => navigation.navigate("QuizDetail", { quizEventId: item.id })}
              isTonightMode={false}
              showRank={false}
              rank={null}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>
              Saved quizzes could not be loaded.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: semantic.bgSecondary },
  screen: { flex: 1, padding: spacing.lg, backgroundColor: semantic.bgSecondary },
  title: { ...typography.displayMedium, marginBottom: spacing.sm, color: semantic.textPrimary },
  emptyText: { marginTop: spacing.lg, ...typography.body, color: semantic.textSecondary },
  errorBanner: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: semantic.danger,
    marginTop: spacing.md,
    borderWidth: 3,
    borderColor: semantic.borderPrimary,
  },
  errorBannerTitle: { ...typography.bodyStrong, color: semantic.textInverse },
  errorBannerText: { marginTop: spacing.sm, color: semantic.textInverse },
  list: { marginTop: spacing.md },
  emptyListText: { marginTop: spacing.md, ...typography.body, color: semantic.textSecondary },
});
