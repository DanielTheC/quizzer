import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Keyboard,
  Platform,
  type TextInput as RNTextInput,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import {
  type RunQuizState,
  type RunQuizTeam,
  loadRunQuizState,
  saveRunQuizState,
  clearRunQuizState,
  recordHostCompletedSession,
  createTeam,
  getEmptyScores,
  getTeamDisplayName,
  totalWithBonus,
  halftimeTotalWithBonus,
  getBonusAppliedState,
  DEFAULT_STATE,
} from "../../lib/runQuizStorage";
import { supabase } from "../../lib/supabase";
import { buildRoundLabelsFromPack, getCachedPack } from "../../lib/quizPack";
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

const PODIUM_GOLD = colors.yellow;
const PODIUM_SILVER = "#E2E8F0";
const PODIUM_BRONZE = "#E8A87C";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function phaseProgressStep(phase: RunQuizState["phase"]): number {
  if (phase === "teams") return 0;
  if (phase === "bonus") return 1;
  if (phase === "halftime" || phase === "halftime_leaderboard") return 2;
  if (phase === "second_half") return 3;
  return 4;
}

function PhaseProgressDots({ phase }: { phase: RunQuizState["phase"] }) {
  const step = phaseProgressStep(phase);
  return (
    <View style={styles.phaseDotsRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[styles.phaseDot, { backgroundColor: i === step ? colors.yellow : colors.grey200 }]}
        />
      ))}
    </View>
  );
}

export default function RunQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const route = useRoute<RouteProp<HostStackParamList, "RunQuiz">>();
  const mode = route.params?.mode ?? "new";
  const paramPackId = route.params?.packId ?? null;
  const paramVenueId = route.params?.venueId ?? null;

  const [state, setState] = useState<RunQuizState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [roundLabels, setRoundLabels] = useState<string[]>(() => buildRoundLabelsFromPack(null));
  const [prize1st, setPrize1st] = useState<string | null>(null);
  const [prize2nd, setPrize2nd] = useState<string | null>(null);
  const [prize3rd, setPrize3rd] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const pid = state.packId;
    if (!pid) {
      setRoundLabels(buildRoundLabelsFromPack(null));
      return;
    }
    getCachedPack(pid).then((p) => {
      if (cancelled) return;
      const pack = p?.id === pid ? p : null;
      setRoundLabels(buildRoundLabelsFromPack(pack));
    });
    return () => {
      cancelled = true;
    };
  }, [state.packId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!state.venueId) {
        if (!cancelled) {
          setPrize1st(null);
          setPrize2nd(null);
          setPrize3rd(null);
        }
        return;
      }
      const { data, error } = await supabase
        .from("quiz_events")
        .select("prize_1st, prize_2nd, prize_3rd")
        .eq("venue_id", state.venueId)
        .eq("is_active", true)
        .limit(1)
        .single();
      if (cancelled) return;
      if (error) {
        setPrize1st(null);
        setPrize2nd(null);
        setPrize3rd(null);
        return;
      }
      setPrize1st(data.prize_1st ?? null);
      setPrize2nd(data.prize_2nd ?? null);
      setPrize3rd(data.prize_3rd ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.venueId]);

  const persist = useCallback((next: RunQuizState) => {
    setState(next);
    saveRunQuizState(next).catch(() => {});
  }, []);

  const addTeam = useCallback(() => {
    const team = createTeam(generateId(), "", "");
    persist({ ...state, teams: [...state.teams, team] });
  }, [state, persist]);

  const updateTeam = useCallback(
    (id: string, patch: Partial<Pick<RunQuizTeam, "name" | "playerCount" | "bonusRound" | "scores">>) => {
      const teams = state.teams.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      );
      persist({ ...state, teams });
    },
    [state, persist]
  );

  const setTeamScore = useCallback((teamId: string, index: number, value: number) => {
    setState((prev) => {
      const teams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const base =
          Array.isArray(t.scores) && t.scores.length >= 9 ? t.scores : getEmptyScores();
        const scores = [...base];
        scores[index] = value;
        return { ...t, scores };
      });
      const next = { ...prev, teams };
      saveRunQuizState(next).catch(() => {});
      return next;
    });
  }, []);

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

  const goToHalftimeLeaderboard = useCallback(() => {
    persist({ ...state, phase: "halftime_leaderboard" });
  }, [state, persist]);

  const backToHalftimeScores = useCallback(() => {
    persist({ ...state, phase: "halftime" });
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
          if (state.phase === "results") {
            const totalPlayerCount = state.teams.reduce(
              (sum, t) => sum + (parseInt(t.playerCount, 10) || 0),
              0
            );
            const teamCount = state.teams.length;
            await recordHostCompletedSession({
              venueId: state.venueId,
              packId: state.packId,
            }).catch(() => {});
            void supabase
              .rpc("record_host_quiz_session", {
                p_venue_id: state.venueId,
                p_pack_id: state.packId,
                p_team_count: teamCount,
                p_total_player_count: totalPlayerCount,
              })
              .then(() => {})
              .catch(() => {});
          }
          await clearRunQuizState();
          navigation.navigate("HostSetup");
        },
      },
    ]);
  }, [navigation, state.phase, state.venueId, state.packId, state.teams]);

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

  const openRunQuizOverflowMenu = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Reset night"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) resetNight();
        }
      );
    } else {
      Alert.alert("", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Reset night", style: "destructive", onPress: () => resetNight() },
      ]);
    }
  }, [resetNight]);

  const packId = state.packId;
  const openPackQuestions = useCallback(() => {
    if (packId) navigation.navigate("PackQuestions", { packId });
  }, [navigation, packId]);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading…</Text>
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
        ) : (
          <View style={styles.topBarSpacer} />
        )}
        <Pressable
          style={styles.overflowMenuBtn}
          onPress={openRunQuizOverflowMenu}
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="dots-vertical" size={26} color={semantic.textPrimary} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PhaseProgressDots phase={phase} />
        <ScreenTitle subtitle="Teams, scores, bonus rounds, and leaderboard.">Run quiz</ScreenTitle>
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
            roundLabels={roundLabels}
            bonusLocked={state.bonusLocked}
            onUpdateTeam={updateTeam}
            onContinue={goToHalftime}
          />
        )}
        {phase === "halftime" && (
          <HalftimePhase
            teams={teams}
            roundLabels={roundLabels}
            onSetScore={setTeamScore}
            onViewLeaderboard={goToHalftimeLeaderboard}
            onContinue={goToSecondHalf}
          />
        )}
        {phase === "halftime_leaderboard" && (
          <LeaderboardPhase
            mode="halftime"
            teams={teams}
            roundLabels={roundLabels}
            prize1st={prize1st}
            prize2nd={prize2nd}
            prize3rd={prize3rd}
            onBackToScores={backToHalftimeScores}
            onContinue={goToSecondHalf}
          />
        )}
        {phase === "second_half" && (
          <SecondHalfPhase
            teams={teams}
            roundLabels={roundLabels}
            onSetScore={setTeamScore}
            onShowResults={goToResults}
          />
        )}
        {phase === "results" && (
          <LeaderboardPhase
            mode="final"
            teams={teams}
            roundLabels={roundLabels}
            prize1st={prize1st}
            prize2nd={prize2nd}
            prize3rd={prize3rd}
            onFinish={finishAndClear}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Scores for rounds 1–8: single digit 1–9 only; advances to next field after one digit. */
function Digit1To9Input({
  inputRef,
  nextRef,
  value,
  onValue,
}: {
  inputRef: React.RefObject<RNTextInput | null>;
  nextRef?: React.RefObject<RNTextInput | null>;
  value: number;
  onValue: (v: number) => void;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={styles.scoreInput}
      value={value > 0 ? String(value) : ""}
      onChangeText={(text) => {
        if (text === "") {
          onValue(0);
          return;
        }
        const d = text.replace(/[^1-9]/g, "").charAt(0);
        if (!d) {
          return;
        }
        const n = parseInt(d, 10);
        onValue(n);
        // Defer focus so React Native commits the digit on the current field first
        // (rAF/immediate focus can drop the keystroke on Android/iOS).
        if (nextRef?.current) {
          setTimeout(() => nextRef.current?.focus(), 80);
        }
      }}
      keyboardType="number-pad"
      placeholder="–"
      placeholderTextColor={colors.grey400}
    />
  );
}

function PictureRoundScoreInput({
  value,
  onValue,
  isLastTeam,
}: {
  value: number;
  onValue: (v: number) => void;
  isLastTeam: boolean;
}) {
  return (
    <TextInput
      style={styles.scoreInput}
      value={value > 0 ? String(value) : ""}
      onChangeText={(text) => {
        if (text === "") {
          onValue(0);
          if (isLastTeam) Keyboard.dismiss();
          return;
        }
        const digits = text.replace(/[^0-9]/g, "");
        if (!digits) return;
        const n = parseInt(digits.slice(0, 3), 10);
        if (!Number.isFinite(n)) return;
        onValue(Math.min(n, 999));
        if (isLastTeam) Keyboard.dismiss();
      }}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={colors.grey400}
    />
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
  const nameRefs = useRef<(RNTextInput | null)[]>([]);
  const playerRefs = useRef<(RNTextInput | null)[]>([]);

  useEffect(() => {
    nameRefs.current = nameRefs.current.slice(0, teams.length);
    playerRefs.current = playerRefs.current.slice(0, teams.length);
  }, [teams.length]);

  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Teams</Text>
      <Text style={styles.phaseSubtitle}>
        Add teams (names are optional—suggestions show as placeholders). Enter how many players per team. Bonus rounds are
        chosen on the next screen.
      </Text>
      {teams.map((t, index) => (
        <View key={t.id} style={styles.teamCard}>
          <TextInput
            ref={(el) => {
              nameRefs.current[index] = el;
            }}
            style={styles.teamNameInput}
            value={t.name}
            onChangeText={(name) => onUpdateTeam(t.id, { name })}
            placeholder={`Team ${index + 1}`}
            placeholderTextColor={colors.grey400}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => {
              setTimeout(() => playerRefs.current[index]?.focus(), 0);
            }}
          />
          <TextInput
            ref={(el) => {
              playerRefs.current[index] = el;
            }}
            style={styles.playerCountInput}
            value={t.playerCount}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, "");
              onUpdateTeam(t.id, { playerCount: digits.slice(0, 3) });
            }}
            placeholder="Players"
            placeholderTextColor={colors.grey400}
            keyboardType="numeric"
            returnKeyType={index < teams.length - 1 ? "next" : "done"}
            submitBehavior="submit"
            onSubmitEditing={() => {
              const nextIndex = index + 1;
              if (nextIndex >= teams.length) return;
              setTimeout(() => nameRefs.current[nextIndex]?.focus(), 0);
            }}
          />
          <Pressable
            style={styles.removeBtn}
            onPress={() =>
              Alert.alert("Remove team", "Remove this team?", [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => onRemoveTeam(t.id) },
              ])
            }
          >
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

function HalftimeTeamScores({
  team,
  teamIndex,
  roundLabels,
  onSetScore,
}: {
  team: RunQuizTeam;
  teamIndex: number;
  roundLabels: string[];
  onSetScore: (teamId: string, index: number, value: number) => void;
}) {
  const r0 = useRef<RNTextInput>(null);
  const r1 = useRef<RNTextInput>(null);
  const r2 = useRef<RNTextInput>(null);
  const r3 = useRef<RNTextInput>(null);
  const refs = [r0, r1, r2, r3];

  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreCardHeader}>
        <Text style={styles.scoreCardName}>{getTeamDisplayName(team, teamIndex)}</Text>
        {team.bonusRound != null && team.bonusRound >= 1 && team.bonusRound <= 8 ? (
          <View style={styles.teamBonusBadgeCol}>
            <Text style={styles.teamBonusBadgeLabel}>Doubles</Text>
            <Text style={styles.teamBonusBadgeRound} numberOfLines={2}>
              R{team.bonusRound} · {roundLabels[team.bonusRound - 1] ?? `Round ${team.bonusRound}`}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.scoreRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.scoreInputWrapWide}>
            <View style={styles.scoreLabelBlock}>
              <Text style={styles.scoreLabelNum}>R{i + 1}</Text>
              <Text style={styles.scoreLabelTitle} numberOfLines={2}>
                {roundLabels[i] ?? `Round ${i + 1}`}
              </Text>
            </View>
            <Digit1To9Input
              inputRef={refs[i]}
              nextRef={i < 3 ? refs[i + 1] : undefined}
              value={team.scores[i] ?? 0}
              onValue={(v) => onSetScore(team.id, i, v)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function HalftimePhase({
  teams,
  roundLabels,
  onSetScore,
  onViewLeaderboard,
  onContinue,
}: {
  teams: RunQuizTeam[];
  roundLabels: string[];
  onSetScore: (teamId: string, index: number, value: number) => void;
  onViewLeaderboard: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Halftime – Rounds 1–4</Text>
      <Text style={styles.phaseSubtitle}>
        Enter points for each round (1–9 only). One digit jumps to the next round.
      </Text>
      {teams.map((t, teamIndex) => (
        <HalftimeTeamScores
          key={t.id}
          team={t}
          teamIndex={teamIndex}
          roundLabels={roundLabels}
          onSetScore={onSetScore}
        />
      ))}
      <Pressable style={styles.secondaryButton} onPress={onViewLeaderboard}>
        <Text style={styles.secondaryButtonText}>View halftime leaderboard</Text>
      </Pressable>
      <Pressable style={[styles.primaryButton, styles.primaryButtonAfterSecondary]} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>Continue → Second half</Text>
      </Pressable>
    </View>
  );
}

function LeaderboardPhase({
  mode,
  teams,
  roundLabels,
  prize1st,
  prize2nd,
  prize3rd,
  onBackToScores,
  onContinue,
  onFinish,
}: {
  mode: "halftime" | "final";
  teams: RunQuizTeam[];
  roundLabels: string[];
  prize1st: string | null;
  prize2nd: string | null;
  prize3rd: string | null;
  onBackToScores?: () => void;
  onContinue?: () => void;
  onFinish?: () => void;
}) {
  const totalFn = mode === "halftime" ? halftimeTotalWithBonus : totalWithBonus;
  const context = mode === "halftime" ? "halftime" : "final";
  const roundTitle = (r: number) => roundLabels[r - 1] ?? null;

  const ranked = teams
    .map((team, origIndex) => ({ team, origIndex, total: totalFn(team) }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>
        {mode === "halftime" ? "Halftime leaderboard" : "Final leaderboard"}
      </Text>
      <Text style={styles.phaseSubtitle}>
        {mode === "halftime"
          ? "Running totals after round 4. “Double applied” means their bonus was in R1–R4. “Double pending” means their bonus is R5–R8 (second half)."
          : "Full quiz totals with every round and doubles applied."}
      </Text>

      {ranked.map(({ team, origIndex, total }, index) => {
        const place = index + 1;
        const bonus = getBonusAppliedState(team, context, roundTitle);
        const podiumStyle =
          place === 1 ? styles.podiumRow1 : place === 2 ? styles.podiumRow2 : place === 3 ? styles.podiumRow3 : null;
        const rankStyle =
          place === 1
            ? styles.podiumRank1
            : place === 2
              ? styles.podiumRank2
              : place === 3
                ? styles.podiumRank3
                : styles.podiumRankOther;

        const prizeTextForPlace =
          place === 1 ? prize1st : place === 2 ? prize2nd : place === 3 ? prize3rd : null;
        const showPrizeText =
          prizeTextForPlace != null && prizeTextForPlace.trim() !== "";

        return (
          <View key={team.id} style={[styles.leaderCard, podiumStyle]}>
            <View style={styles.leaderCardTop}>
              <View style={[styles.podiumRankBadge, rankStyle]}>
                <Text style={[styles.podiumRankText, place <= 3 ? styles.podiumRankTextStrong : undefined]}>
                  {place}
                </Text>
              </View>
              <View style={styles.leaderCardMain}>
                <Text style={styles.leaderCardName}>{getTeamDisplayName(team, origIndex)}</Text>
                {team.playerCount ? (
                  <Text style={styles.leaderTableSmall}>
                    {team.playerCount} {team.playerCount === "1" ? "player" : "players"}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bonusStatusBox,
                    bonus.applied ? styles.bonusStatusApplied : styles.bonusStatusPending,
                  ]}
                >
                  <Text style={styles.bonusStatusHeadline}>{bonus.headline}</Text>
                  <Text style={styles.bonusStatusDetail}>{bonus.detail}</Text>
                </View>
                {place <= 3 ? (
                  <View style={styles.prizeBox}>
                    <Text style={styles.prizeBadge}>
                      {place === 1 ? "1st place" : place === 2 ? "2nd place" : "3rd place"}
                    </Text>
                    {showPrizeText ? <Text style={styles.prizeText}>{prizeTextForPlace}</Text> : null}
                  </View>
                ) : (
                  <Text style={styles.prizeOther}>Outside the prizes — thanks for playing!</Text>
                )}
              </View>
              <Text style={styles.leaderCardScore}>{total}</Text>
            </View>
          </View>
        );
      })}

      {mode === "halftime" ? (
        <View style={styles.leaderboardActions}>
          {onBackToScores ? (
            <Pressable style={styles.secondaryButton} onPress={onBackToScores}>
              <Text style={styles.secondaryButtonText}>← Back to scores</Text>
            </Pressable>
          ) : null}
          {onContinue ? (
            <Pressable
              style={[styles.primaryButton, onBackToScores ? styles.primaryButtonAfterSecondary : null]}
              onPress={onContinue}
            >
              <Text style={styles.primaryButtonText}>Continue → Second half</Text>
            </Pressable>
          ) : null}
        </View>
      ) : onFinish ? (
        <Pressable style={styles.endButton} onPress={onFinish}>
          <Text style={styles.endButtonText}>End quiz</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function BonusPhase({
  teams,
  roundLabels,
  bonusLocked,
  onUpdateTeam,
  onContinue,
}: {
  teams: RunQuizTeam[];
  roundLabels: string[];
  bonusLocked: boolean;
  onUpdateTeam: (id: string, patch: Partial<RunQuizTeam>) => void;
  onContinue: () => void;
}) {
  const allSet = teams.every((t) => t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8);
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Bonus round (before quiz)</Text>
      <Text style={styles.phaseSubtitle}>
        Each team picks one round (1–8) to double by name. The picture round cannot be doubled. Finish every team before continuing.
        {bonusLocked ? " Selection is locked." : " Locks when you continue."}
      </Text>
      {teams.map((t, teamIndex) => (
        <View key={t.id} style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardName}>{getTeamDisplayName(t, teamIndex)}</Text>
            {t.bonusRound != null && t.bonusRound >= 1 && t.bonusRound <= 8 ? (
              <View style={styles.teamBonusBadgeCol}>
                <Text style={styles.teamBonusBadgeLabel}>Doubles</Text>
                <Text style={styles.teamBonusBadgeRound} numberOfLines={2}>
                  R{t.bonusRound} · {roundLabels[t.bonusRound - 1] ?? `Round ${t.bonusRound}`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bonusRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => {
              const label = roundLabels[r - 1] ?? `Round ${r}`;
              return (
                <Pressable
                  key={r}
                  style={[
                    styles.bonusChipNamed,
                    t.bonusRound === r && styles.bonusChipSelected,
                    bonusLocked && styles.bonusChipLocked,
                  ]}
                  onPress={bonusLocked ? undefined : () => onUpdateTeam(t.id, { bonusRound: r })}
                  disabled={bonusLocked}
                >
                  <Text
                    style={[
                      styles.bonusChipRoundNum,
                      t.bonusRound === r && styles.bonusChipTextSelected,
                    ]}
                  >
                    R{r}
                  </Text>
                  <Text
                    style={[
                      styles.bonusChipRoundTitle,
                      t.bonusRound === r && styles.bonusChipRoundTitleSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
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

function SecondHalfTeamScores({
  team,
  teamIndex,
  roundLabels,
  onSetScore,
  isLastTeam,
}: {
  team: RunQuizTeam;
  teamIndex: number;
  roundLabels: string[];
  onSetScore: (teamId: string, index: number, value: number) => void;
  isLastTeam: boolean;
}) {
  const r4 = useRef<RNTextInput>(null);
  const r5 = useRef<RNTextInput>(null);
  const r6 = useRef<RNTextInput>(null);
  const r7 = useRef<RNTextInput>(null);
  const digitRefs = [r4, r5, r6, r7];
  const scoreIndices = [4, 5, 6, 7] as const;

  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreCardHeader}>
        <Text style={styles.scoreCardName}>{getTeamDisplayName(team, teamIndex)}</Text>
        {team.bonusRound != null && team.bonusRound >= 1 && team.bonusRound <= 8 ? (
          <View style={styles.teamBonusBadgeCol}>
            <Text style={styles.teamBonusBadgeLabel}>Doubles</Text>
            <Text style={styles.teamBonusBadgeRound} numberOfLines={2}>
              R{team.bonusRound} · {roundLabels[team.bonusRound - 1] ?? `Round ${team.bonusRound}`}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.scoreRow}>
        {scoreIndices.map((i, localI) => (
          <View key={i} style={styles.scoreInputWrapWide}>
            <View style={styles.scoreLabelBlock}>
              <Text style={styles.scoreLabelNum}>R{i + 1}</Text>
              <Text style={styles.scoreLabelTitle} numberOfLines={2}>
                {roundLabels[i] ?? `Round ${i + 1}`}
              </Text>
            </View>
            <Digit1To9Input
              inputRef={digitRefs[localI]}
              nextRef={localI < digitRefs.length - 1 ? digitRefs[localI + 1] : undefined}
              value={team.scores[i] ?? 0}
              onValue={(v) => onSetScore(team.id, i, v)}
            />
          </View>
        ))}
        <View key="pic" style={styles.scoreInputWrapWide}>
          <View style={styles.scoreLabelBlock}>
            <Text style={styles.scoreLabelNum}>R9</Text>
            <Text style={styles.scoreLabelTitle} numberOfLines={2}>
              {roundLabels[8] ?? "Picture round"}
            </Text>
          </View>
          <PictureRoundScoreInput
            value={team.scores[8] ?? 0}
            onValue={(v) => onSetScore(team.id, 8, v)}
            isLastTeam={isLastTeam}
          />
        </View>
      </View>
    </View>
  );
}

function SecondHalfPhase({
  teams,
  roundLabels,
  onSetScore,
  onShowResults,
}: {
  teams: RunQuizTeam[];
  roundLabels: string[];
  onSetScore: (teamId: string, index: number, value: number) => void;
  onShowResults: () => void;
}) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Second half – Rounds 5–8 + Picture</Text>
      <Text style={styles.phaseSubtitle}>
        Rounds 5–8: one digit (1–9), then focus moves on. Picture round: any score up to 999.
      </Text>
      {teams.map((t, teamIndex) => (
        <SecondHalfTeamScores
          key={t.id}
          team={t}
          teamIndex={teamIndex}
          roundLabels={roundLabels}
          onSetScore={onSetScore}
          isLastTeam={teamIndex === teams.length - 1}
        />
      ))}
      <Pressable style={styles.primaryButton} onPress={onShowResults}>
        <Text style={styles.primaryButtonText}>Show results</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: semantic.accentYellow,
    borderBottomWidth: borderWidth.default,
    borderBottomColor: semantic.borderPrimary,
  },
  viewQuestionsBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: semantic.bgInverse,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  viewQuestionsBtnText: { color: semantic.textInverse, ...typography.bodyStrong, fontSize: 15 },
  topBarSpacer: { flex: 1 },
  overflowMenuBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.md,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { ...typography.body, color: semantic.textSecondary },
  phase: {},
  phaseTitle: { ...typography.displaySmall, marginBottom: spacing.sm, color: semantic.textPrimary },
  phaseSubtitle: { ...typography.body, color: semantic.textSecondary, marginBottom: spacing.lg },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.large,
    padding: spacing.md,
    backgroundColor: semantic.bgPrimary,
    ...shadow.small,
  },
  teamNameInput: { flex: 1, fontSize: 16, padding: spacing.sm + 2, color: semantic.textPrimary },
  playerCountInput: {
    width: 88,
    fontSize: 16,
    padding: spacing.sm + 2,
    marginLeft: spacing.sm,
    color: semantic.textPrimary,
    textAlign: "center",
  },
  removeBtn: { padding: spacing.sm },
  removeBtnText: { color: semantic.danger, ...typography.captionStrong },
  addTeamBtn: {
    borderStyle: "dashed",
    borderWidth: borderWidth.default,
    borderColor: colors.grey400,
    borderRadius: radius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
    backgroundColor: semantic.bgPrimary,
  },
  addTeamBtnText: { color: semantic.textSecondary, ...typography.bodyStrong },
  primaryButton: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonAfterSecondary: { marginTop: spacing.md },
  primaryButtonText: { color: semantic.textPrimary, ...typography.bodyStrong, fontSize: 18 },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  secondaryButtonText: { color: semantic.textPrimary, ...typography.bodyStrong, fontSize: 17 },
  scoreCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.large,
    backgroundColor: semantic.bgPrimary,
    ...shadow.small,
  },
  scoreCardHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: spacing.md },
  scoreCardName: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary, marginRight: spacing.sm },
  teamBonusBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: semantic.textInverse,
    backgroundColor: semantic.accentBlue,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
  },
  teamBonusBadgeCol: {
    backgroundColor: semantic.accentBlue,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
    maxWidth: "55%",
  },
  teamBonusBadgeLabel: { fontSize: 10, fontWeight: "800", color: semantic.textInverse, letterSpacing: 0.5 },
  teamBonusBadgeRound: { fontSize: 11, fontWeight: "700", color: semantic.textInverse, marginTop: 2 },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  scoreInputWrap: { width: "20%", padding: spacing.xs, minWidth: 56 },
  scoreInputWrapWide: { width: "31%", padding: spacing.xs, minWidth: 100, maxWidth: 140 },
  scoreLabelBlock: { marginBottom: spacing.xs, minHeight: 40 },
  scoreLabelNum: { ...typography.label, fontWeight: "800", color: semantic.textPrimary },
  scoreLabelTitle: { fontSize: 11, fontWeight: "600", color: semantic.textSecondary, marginTop: 2, lineHeight: 14 },
  scoreLabel: { ...typography.label, color: semantic.textSecondary, marginBottom: spacing.xs },
  scoreInput: {
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.small,
    padding: spacing.sm + 2,
    fontSize: 16,
    color: semantic.textPrimary,
    backgroundColor: semantic.bgSecondary,
  },
  bonusRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  bonusChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: semantic.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
    margin: spacing.xs,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  bonusChipNamed: {
    minWidth: 104,
    maxWidth: 160,
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: semantic.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
    margin: spacing.xs,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  bonusChipSelected: { backgroundColor: semantic.accentBlue },
  bonusChipLocked: { opacity: 0.65 },
  bonusChipText: { fontSize: 16, fontWeight: "700", color: semantic.textPrimary },
  bonusChipTextSelected: { color: semantic.textInverse },
  bonusChipRoundNum: { fontSize: 14, fontWeight: "800", color: semantic.textPrimary },
  bonusChipRoundTitle: { fontSize: 11, fontWeight: "600", color: semantic.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 14 },
  bonusChipRoundTitleSelected: { color: semantic.textInverse },
  leaderCard: {
    marginBottom: spacing.md,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    overflow: "hidden",
    ...shadow.small,
  },
  podiumRow1: {
    backgroundColor: PODIUM_GOLD,
    borderLeftWidth: 6,
    borderLeftColor: colors.black,
  },
  podiumRow2: {
    backgroundColor: PODIUM_SILVER,
    borderLeftWidth: 6,
    borderLeftColor: colors.grey400,
  },
  podiumRow3: {
    backgroundColor: PODIUM_BRONZE,
    borderLeftWidth: 6,
    borderLeftColor: colors.grey700,
  },
  leaderCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
  },
  podiumRankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    backgroundColor: semantic.bgSecondary,
  },
  podiumRank1: { backgroundColor: PODIUM_GOLD },
  podiumRank2: { backgroundColor: PODIUM_SILVER },
  podiumRank3: { backgroundColor: PODIUM_BRONZE },
  podiumRankOther: { backgroundColor: semantic.bgSecondary },
  podiumRankText: { ...typography.bodyStrong, fontSize: 18, color: semantic.textPrimary },
  podiumRankTextStrong: { fontSize: 20, fontWeight: "900" },
  leaderCardMain: { flex: 1, minWidth: 0 },
  leaderCardName: { ...typography.bodyStrong, fontSize: 18, color: semantic.textPrimary },
  leaderTableSmall: { ...typography.caption, color: semantic.textSecondary, marginTop: 2 },
  bonusStatusBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
  },
  bonusStatusApplied: { backgroundColor: "rgba(59, 130, 246, 0.12)" },
  bonusStatusPending: { backgroundColor: "rgba(255, 138, 0, 0.15)" },
  bonusStatusHeadline: { fontSize: 12, fontWeight: "800", color: semantic.textPrimary, textTransform: "uppercase" },
  bonusStatusDetail: { fontSize: 12, color: semantic.textSecondary, marginTop: 4, lineHeight: 17 },
  prizeBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.grey200,
  },
  prizeBadge: { fontSize: 11, fontWeight: "800", color: semantic.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },
  prizeText: { fontSize: 14, fontWeight: "700", color: semantic.textPrimary, marginTop: 4 },
  prizeOther: { fontSize: 12, fontStyle: "italic", color: semantic.textSecondary, marginTop: spacing.sm },
  leaderCardScore: {
    fontSize: 26,
    fontWeight: "900",
    color: semantic.textPrimary,
    marginLeft: spacing.sm,
    minWidth: 44,
    textAlign: "right",
  },
  leaderboardActions: { marginTop: spacing.lg },
  endButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    alignItems: "center",
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  endButtonText: { color: semantic.textPrimary, ...typography.bodyStrong, fontSize: 18 },
});
