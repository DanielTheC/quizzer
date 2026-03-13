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

export default function PackQuestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const route = useRoute<RouteProp<HostStackParamList, "PackQuestions">>();
  const packId = route.params.packId;

  const [pack, setPack] = useState<QuizPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // question ids

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
          <ActivityIndicator size="large" />
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
          <Pressable style={styles.retryBtn} onPress={loadPack}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.packTitle}>{pack.name}</Text>
        <Text style={styles.packSubtitle}>Host only: tap “Reveal answer” to show answer.</Text>
        {pack.rounds.map((round) => (
          <RoundBlock
            key={round.id}
            round={round}
            revealed={revealed}
            onToggleReveal={toggleReveal}
          />
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
        <Pressable style={styles.revealBtn} onPress={onReveal}>
          <Text style={styles.revealBtnText}>{isRevealed ? "Hide answer" : "Reveal answer"}</Text>
        </Pressable>
      </View>
      <Text style={styles.questionText}>{question.question_text}</Text>
      {question.host_notes ? (
        <Text style={styles.hostNotes}>Note: {question.host_notes}</Text>
      ) : null}
      {isRevealed && (
        <View style={styles.answerBlock}>
          <Text style={styles.answerLabel}>Answer</Text>
          <Text style={styles.answerText}>{question.answer}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#64748b" },
  errorText: { color: "#64748b", textAlign: "center", marginBottom: 16 },
  retryBtn: { padding: 12, backgroundColor: "#e2e8f0", borderRadius: 8 },
  retryBtnText: { fontWeight: "600", color: "#334155" },
  packTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#111" },
  packSubtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  roundBlock: { marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 16 },
  roundTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12, color: "#1e293b" },
  questionRow: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  questionNum: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  revealBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#2563eb", borderRadius: 8 },
  revealBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  questionText: { fontSize: 16, color: "#111", marginBottom: 4 },
  hostNotes: { fontSize: 13, color: "#64748b", fontStyle: "italic", marginBottom: 6 },
  answerBlock: { marginTop: 8, padding: 12, backgroundColor: "#f0fdf4", borderRadius: 8, borderLeftWidth: 4, borderLeftColor: "#22c55e" },
  answerLabel: { fontSize: 12, fontWeight: "600", color: "#166534", marginBottom: 4 },
  answerText: { fontSize: 16, fontWeight: "600", color: "#166534" },
});
