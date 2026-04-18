import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import type { QuizPack, QuizQuestion, QuizRound } from "../../lib/quizPack";
import { getCachedPack, fetchLatestPack } from "../../lib/quizPack";
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

export default function PackQuestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const route = useRoute<RouteProp<HostStackParamList, "PackQuestions">>();
  const packId = route.params.packId;

  const [pack, setPack] = useState<QuizPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const loadPack = useCallback(async () => {
    setLoading(true);
    let p = await getCachedPack(packId);
    if (!p) p = await fetchLatestPack();
    setPack(p && p.id === packId ? p : null);
    setLoading(false);
  }, [packId]);

  useEffect(() => {
    loadPack();
  }, [loadPack]);

  useEffect(() => {
    if (pack?.name) {
      navigation.setOptions({ headerTitle: pack.name });
    }
  }, [navigation, pack?.name]);

  const toggleReveal = useCallback((questionId: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={semantic.accentYellow} />
          <Text style={styles.loadingText}>Loading pack…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pack) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Pack not found. Try again online.</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
            onPress={loadPack}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenTitle subtitle="Tap “Reveal answer” when you’re ready to show the answer.">Questions</ScreenTitle>
        {pack.rounds.map((round) => (
          <RoundBlock key={round.id} round={round} revealed={revealed} onToggleReveal={toggleReveal} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundBlock({
  round,
  revealed,
  onToggleReveal,
}: {
  round: QuizRound;
  revealed: Set<string>;
  onToggleReveal: (id: string) => void;
}) {
  return (
    <View style={styles.roundBlock}>
      <Text style={styles.roundTitle}>{round.title}</Text>
      {round.questions.map((q) => (
        <QuestionRow
          key={q.id}
          question={q}
          isRevealed={revealed.has(q.id)}
          onReveal={() => onToggleReveal(q.id)}
        />
      ))}
    </View>
  );
}

function QuestionRow({
  question,
  isRevealed,
  onReveal,
}: {
  question: QuizQuestion;
  isRevealed: boolean;
  onReveal: () => void;
}) {
  return (
    <View style={styles.questionRow}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionNum}>Q{question.question_number}</Text>
        <Pressable
          style={({ pressed }) => [styles.revealBtn, pressed && styles.btnPressed]}
          onPress={onReveal}
        >
          <Text style={styles.revealBtnText}>{isRevealed ? "Hide answer" : "Reveal answer"}</Text>
        </Pressable>
      </View>
      <Text style={styles.questionText}>{question.question_text}</Text>
      {question.host_notes ? <Text style={styles.hostNotes}>Note: {question.host_notes}</Text> : null}
      {isRevealed ? (
        <View style={styles.answerBlock}>
          <Text style={styles.answerLabel}>Answer</Text>
          {question.answer.trim() ? (
            <Text style={styles.answerText}>{question.answer}</Text>
          ) : (
            <Text style={styles.answerUnavailable}>
              No answer loaded. Use an account whose email is on the host allowlist, then reopen the pack.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  loadingText: { marginTop: spacing.md, ...typography.body, color: semantic.textSecondary },
  errorText: { ...typography.body, color: semantic.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  retryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: semantic.accentYellow,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  retryBtnText: { ...typography.bodyStrong, color: semantic.textPrimary },
  roundBlock: {
    marginBottom: spacing.xxl,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.large,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    ...shadow.small,
  },
  roundTitle: { ...typography.heading, marginBottom: spacing.md, color: semantic.textPrimary },
  questionRow: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.grey200,
  },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  questionNum: { ...typography.captionStrong, color: semantic.textSecondary },
  revealBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: semantic.accentBlue,
    borderRadius: radius.small,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  revealBtnText: { color: semantic.textInverse, fontSize: 13, fontWeight: "700" },
  questionText: { ...typography.body, color: semantic.textPrimary, marginBottom: spacing.xs },
  hostNotes: { fontSize: 13, color: semantic.textSecondary, fontStyle: "italic", marginBottom: spacing.sm },
  answerBlock: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: semantic.bgSecondary,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderLeftColor: semantic.accentGreen,
  },
  answerLabel: { ...typography.labelUppercase, fontSize: 11, color: semantic.accentGreen, marginBottom: spacing.xs },
  answerText: { ...typography.bodyStrong, color: semantic.textPrimary },
  answerUnavailable: { ...typography.body, fontSize: 14, color: semantic.textSecondary, lineHeight: 20 },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
});
