import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import {
  type RunQuizState,
  type RunQuizTeam,
  type RunQuizPhase,
  loadRunQuizState,
  saveRunQuizState,
  clearRunQuizState,
  createTeam,
  getEmptyScores,
  totalWithBonus,
  DEFAULT_STATE,
} from "../../lib/runQuizStorage";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function RunQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const route = useRoute<RouteProp<HostStackParamList, "RunQuiz">>();
  const mode = route.params?.mode ?? "new";
  const paramPackId = route.params?.packId ?? null;
  const paramVenueId = route.params?.venueId ?? null;

  const [state, setState] = useState<RunQuizState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (mode !== "resume") {
      setState({ ...DEFAULT_STATE, packId: paramPackId, venueId: paramVenueId });
      setHydrated(true);
      clearRunQuizState().catch(() => {}); // so Resume won’t show a previous run
      return;
    }
    let cancelled = false;
    loadRunQuizState().then((loaded) => {
      if (!cancelled) {
        if (loaded) setState(loaded);
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, [mode, paramPackId, paramVenueId]);

  const persist = useCallback((next: RunQuizState) => {
    setState(next);
    saveRunQuizState(next).catch(() => {});
  }, []);

  const addTeam = useCallback(() => {
    const name = "Team " + (state.teams.length + 1);
    const team = createTeam(generateId(), name, "");
    persist({ ...state, teams: [...state.teams, team] });
  }, [state, persist]);

  const updateTeam = useCallback(
    (id: string, patch: Partial<Pick<RunQuizTeam, "name" | "tableNumber" | "bonusRound" | "scores">>) => {
      const teams = state.teams.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      );
      persist({ ...state, teams });
    },
    [state, persist]
  );

  const setTeamScore = useCallback(
    (teamId: string, index: number, value: number) => {
      const teams = state.teams.map((t) => {
        if (t.id !== teamId) return t;
        const scores = [...t.scores];
        scores[index] = value;
        return { ...t, scores };
      });
      persist({ ...state, teams });
    },
    [state, persist]
  );

  const removeTeam = useCallback(
    (id: string) => {
      persist({ ...state, teams: state.teams.filter((t) => t.id !== id) });
    },
    [state, persist]
  );

  const goToBonus = useCallback(() => {
    if (state.teams.length === 0) return;
    persist({ ...state, phase: "bonus" });
  }, [state, persist]);

  const goToHalftime = useCallback(() => {
    persist({ ...state, phase: "halftime", bonusLocked: true });
  }, [state, persist]);

  const goToSecondHalf = useCallback(() => {
    persist({ ...state, phase: "second_half" });
  }, [state, persist]);

  const goToResults = useCallback(() => {
    persist({ ...state, phase: "results" });
  }, [state, persist]);

  const finishAndClear = useCallback(() => {
    Alert.alert("End quiz", "Clear saved state and return to Host setup?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End quiz",
        style: "destructive",
        onPress: async () => {
          await clearRunQuizState();
          navigation.navigate("HostSetup");
        },
      },
    ]);
  }, [navigation]);

  const resetNight = useCallback(() => {
    Alert.alert("Reset night", "Clear all quiz state and return to setup? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset night",
        style: "destructive",
        onPress: async () => {
          await clearRunQuizState();
          navigation.navigate("HostSetup");
        },
      },
    ]);
  }, [navigation]);

  const packId = state.packId;
  const openPackQuestions = useCallback(() => {
    if (packId) navigation.navigate("PackQuestions", { packId });
  }, [navigation, packId]);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const phase = state.phase;
  const teams = state.teams;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {packId ? (
          <Pressable style={styles.viewQuestionsBtn} onPress={openPackQuestions}>
            <Text style={styles.viewQuestionsBtnText}>View questions</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.resetNightBtn} onPress={resetNight}>
          <Text style={styles.resetNightBtnText}>Reset night</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {phase === "teams" && (
          <TeamsPhase
            teams={teams}
            onAddTeam={addTeam}
            onUpdateTeam={updateTeam}
            onRemoveTeam={removeTeam}
            onStartQuiz={goToBonus}
          />
        )}
        {phase === "bonus" && (
          <BonusPhase
            teams={teams}
            bonusLocked={state.bonusLocked}
            onUpdateTeam={updateTeam}
            onContinue={goToHalftime}
          />
        )}
        {phase === "halftime" && (
          <HalftimePhase teams={teams} onSetScore={setTeamScore} onContinue={goToSecondHalf} />
        )}
        {phase === "second_half" && (
          <SecondHalfPhase teams={teams} onSetScore={setTeamScore} onShowResults={goToResults} />
        )}
        {phase === "results" && (
          <ResultsPhase teams={teams} onFinish={finishAndClear} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TeamsPhase({
  teams,
  onAddTeam,
  onUpdateTeam,
  onRemoveTeam,
  onStartQuiz,
}: {
  teams: RunQuizTeam[];
  onAddTeam: () => void;
  onUpdateTeam: (id: string, patch: Partial<RunQuizTeam>) => void;
  onRemoveTeam: (id: string) => void;
  onStartQuiz: () => void;
}) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Teams</Text>
      <Text style={styles.phaseSubtitle}>Add teams, then set bonus round (1–8) for each team before starting.</Text>
      {teams.map((t) => (
        <View key={t.id} style={styles.teamCard}>
          <TextInput
            style={styles.teamNameInput}
            value={t.name}
            onChangeText={(name) => onUpdateTeam(t.id, { name })}
            placeholder="Team name"
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={styles.tableInput}
            value={t.tableNumber}
            onChangeText={(tableNumber) => onUpdateTeam(t.id, { tableNumber })}
            placeholder="Table #"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
          />
          <Pressable style={styles.removeBtn} onPress={() => onRemoveTeam(t.id)}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addTeamBtn} onPress={onAddTeam}>
        <Text style={styles.addTeamBtnText}>+ Add team</Text>
      </Pressable>
      <Pressable
        style={[styles.primaryButton, teams.length === 0 && styles.primaryButtonDisabled]}
        onPress={onStartQuiz}
        disabled={teams.length === 0}
      >
        <Text style={styles.primaryButtonText}>Set bonus rounds →</Text>
      </Pressable>
    </View>
  );
}

function HalftimePhase({
  teams,
  onSetScore,
  onContinue,
}: {
  teams: RunQuizTeam[];
  onSetScore: (teamId: string, index: number, value: number) => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Halftime – Rounds 1–4</Text>
      <Text style={styles.phaseSubtitle}>Enter each team’s total for rounds 1–4.</Text>
      {teams.map((t) => (
        <View key={t.id} style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardName}>{t.name}</Text>
            {t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8 ? (
              <Text style={styles.teamBonusBadge}>Doubles R{t.bonusRound}</Text>
            ) : null}
          </View>
          <View style={styles.scoreRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.scoreInputWrap}>
                <Text style={styles.scoreLabel}>{"R" + (i + 1)}</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={String((t.scores[i] ?? 0) || "")}
                  onChangeText={(v) => onSetScore(t.id, i, parseInt(v, 10) || 0)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>Continue → Second half</Text>
      </Pressable>
    </View>
  );
}

function BonusPhase({
  teams,
  bonusLocked,
  onUpdateTeam,
  onContinue,
}: {
  teams: RunQuizTeam[];
  bonusLocked: boolean;
  onUpdateTeam: (id: string, patch: Partial<RunQuizTeam>) => void;
  onContinue: () => void;
}) {
  const allSet = teams.every((t) => t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8);
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Bonus round (before quiz)</Text>
      <Text style={styles.phaseSubtitle}>
        Each team picks exactly one round (1–8) to double. Round 9 (picture) cannot be doubled. Selection must be complete before starting the quiz.
        {bonusLocked ? " Selection is locked." : " Locks when you continue."}
      </Text>
      {teams.map((t) => (
        <View key={t.id} style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardName}>{t.name}</Text>
            {t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8 ? (
              <Text style={styles.teamBonusBadge}>Doubles R{t.bonusRound}</Text>
            ) : null}
          </View>
          <View style={styles.bonusRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.bonusChip,
                  t.bonusRound === r && styles.bonusChipSelected,
                  bonusLocked && styles.bonusChipLocked,
                ]}
                onPress={bonusLocked ? undefined : () => onUpdateTeam(t.id, { bonusRound: r })}
                disabled={bonusLocked}
              >
                <Text
                  style={[
                    styles.bonusChipText,
                    t.bonusRound === r && styles.bonusChipTextSelected,
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Pressable
        style={[styles.primaryButton, !allSet && styles.primaryButtonDisabled]}
        onPress={onContinue}
        disabled={!allSet}
      >
        <Text style={styles.primaryButtonText}>Continue → Halftime</Text>
      </Pressable>
    </View>
  );
}

function SecondHalfPhase({
  teams,
  onSetScore,
  onShowResults,
}: {
  teams: RunQuizTeam[];
  onSetScore: (teamId: string, index: number, value: number) => void;
  onShowResults: () => void;
}) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Second half – Rounds 5–8 + Picture</Text>
      <Text style={styles.phaseSubtitle}>Enter scores for rounds 5–8 and the picture round.</Text>
      {teams.map((t) => (
        <View key={t.id} style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardName}>{t.name}</Text>
            {t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8 ? (
              <Text style={styles.teamBonusBadge}>Doubles R{t.bonusRound}</Text>
            ) : null}
          </View>
          <View style={styles.scoreRow}>
            {[4, 5, 6, 7, 8].map((i) => (
              <View key={i} style={styles.scoreInputWrap}>
                <Text style={styles.scoreLabel}>
                  {i < 8 ? `R${i + 1}` : "Pic"}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  value={String((t.scores[i] ?? 0) || "")}
                  onChangeText={(v) => onSetScore(t.id, i, parseInt(v, 10) || 0)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={onShowResults}>
        <Text style={styles.primaryButtonText}>Show results</Text>
      </Pressable>
    </View>
  );
}

function ResultsPhase({
  teams,
  onFinish,
}: {
  teams: RunQuizTeam[];
  onFinish: () => void;
}) {
  const ranked = [...teams]
    .map((t) => ({ team: t, total: totalWithBonus(t) }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Leaderboard</Text>
      <Text style={styles.phaseSubtitle}>Final scores (bonus round applied).</Text>
      {ranked.map(({ team, total }, index) => (
        <View key={team.id} style={styles.leaderRow}>
          <Text style={styles.leaderRank}>#{index + 1}</Text>
          <View style={styles.leaderInfo}>
            <Text style={styles.leaderName}>{team.name}</Text>
            {team.tableNumber ? (
              <Text style={styles.leaderTable}>Table {team.tableNumber}</Text>
            ) : null}
            <Text style={styles.leaderBonus}>
              {team.bonusRound != null && team.bonusRound >= 1 && team.bonusRound <= 8
                ? `Doubled round ${team.bonusRound}`
                : "No bonus round"}
            </Text>
          </View>
          <Text style={styles.leaderTotal}>{total}</Text>
        </View>
      ))}
      <Pressable style={styles.endButton} onPress={onFinish}>
        <Text style={styles.endButtonText}>End quiz</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  viewQuestionsBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 8 },
  viewQuestionsBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  resetNightBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  resetNightBtnText: { color: "#64748b", fontSize: 14, fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  phase: {},
  phaseTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8, color: "#111" },
  phaseSubtitle: { fontSize: 15, color: "#64748b", marginBottom: 20 },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  teamNameInput: { flex: 1, fontSize: 16, padding: 10, color: "#111" },
  tableInput: { width: 72, fontSize: 16, padding: 10, marginLeft: 8, color: "#111" },
  removeBtn: { padding: 8 },
  removeBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  addTeamBtn: {
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  addTeamBtnText: { color: "#64748b", fontSize: 16, fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: "#94a3b8", opacity: 0.8 },
  primaryButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  scoreCard: {
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  scoreCardHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 12 },
  scoreCardName: { fontSize: 17, fontWeight: "600", color: "#111", marginRight: 8 },
  teamBonusBadge: { fontSize: 13, fontWeight: "600", color: "#2563eb", backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  scoreInputWrap: { width: "20%", padding: 6, minWidth: 56 },
  scoreLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  scoreInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#111",
  },
  bonusRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  bonusChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
  },
  bonusChipSelected: { backgroundColor: "#2563eb" },
  bonusChipLocked: { opacity: 0.8 },
  bonusChipText: { fontSize: 16, fontWeight: "600", color: "#334155" },
  bonusChipTextSelected: { color: "#fff" },
  leaderBonus: { fontSize: 13, color: "#2563eb", marginTop: 2, fontWeight: "500" },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  leaderRank: { fontSize: 18, fontWeight: "700", color: "#64748b", width: 36 },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 17, fontWeight: "600", color: "#111" },
  leaderTable: { fontSize: 13, color: "#64748b", marginTop: 2 },
  leaderTotal: { fontSize: 20, fontWeight: "700", color: "#111" },
  endButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  endButtonText: { color: "#334155", fontSize: 18, fontWeight: "600" },
});
