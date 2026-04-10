import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { setHostOnboardingComplete } from "../../lib/hostSetupStorage";
import { useAuth } from "../../context/AuthContext";
import { fetchIsAllowlistedHost } from "../../lib/hostAccess";
import { ScreenTitle } from "../../components/ScreenTitle";
import { semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

const STEP_COUNT = 3;

type StepSpec = {
  title: string;
  body: React.ReactNode;
};

function IllustrationPlaceholder({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return (
    <View style={styles.illusBox} accessibilityRole="image" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={56} color={semantic.textSecondary} />
      <Text style={styles.illusLabel}>{label}</Text>
    </View>
  );
}

export default function HostOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const route = useRoute<RouteProp<HostStackParamList, "HostOnboarding">>();
  const { session } = useAuth();
  const allowBack = route.params?.allowBack === true;
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const finishFlow = useCallback(async () => {
    if (allowBack) {
      navigation.goBack();
      return;
    }
    await setHostOnboardingComplete();
    const allowlisted = await fetchIsAllowlistedHost(session);
    navigation.replace(allowlisted === true ? "HostSetup" : "HostApply");
  }, [allowBack, navigation, session]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: allowBack,
      headerLeft: allowBack ? undefined : () => null,
      headerRight: allowBack
        ? undefined
        : () => (
            <Pressable onPress={() => void finishFlow()} style={styles.headerSkip} hitSlop={12} accessibilityLabel="Skip introduction">
              <Text style={styles.headerSkipText}>Skip</Text>
            </Pressable>
          ),
    });
  }, [navigation, allowBack, finishFlow]);

  const goToPage = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(STEP_COUNT - 1, i));
      scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true });
      setPage(clamped);
    },
    [pageWidth]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      setPage(Math.round(x / Math.max(pageWidth, 1)));
    },
    [pageWidth]
  );

  const steps: StepSpec[] = [
    {
      title: "What a quiz night looks like",
      body: (
        <>
          <Text style={styles.body}>
            A typical Quizzer night is eight quick-fire rounds plus a picture round. You read questions, teams jot answers, you score tables,
            take a halftime pause, then crown a winner on a final leaderboard.
          </Text>
          <Text style={styles.body}>
            Players use the app to discover your pub quiz and tap interested — you'll see those counts later on your Listings dashboard.
          </Text>
          <IllustrationPlaceholder icon="trophy-outline" label="Illustration placeholder" />
        </>
      ),
    },
    {
      title: "Claiming & running",
      body: (
        <>
          <Text style={styles.body}>Here's the usual flow:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Request host access and get approved for your venue.</Text>
            <Text style={styles.bullet}>• In Host setup, choose your venue and quiz pack for the night.</Text>
            <Text style={styles.bullet}>• Run teams, rounds, halftime, and results — progress is saved if you leave the app mid-quiz.</Text>
            <Text style={styles.bullet}>• Open Listings anytime to see RSVP-style interest, host notes, and last-minute cancellations for players.</Text>
          </View>
          <IllustrationPlaceholder icon="clipboard-list-outline" label="Illustration placeholder" />
        </>
      ),
    },
    {
      title: "How payment works",
      body: (
        <>
          <Text style={styles.body}>
            We're finalising how host payments and venue payouts will work in the app. For now, run your nights on whatever terms you agree
            with the pub — a proper earnings view and payouts will plug in here soon.
          </Text>
          <Text style={styles.bodyMuted}>Placeholder copy — you'll get clearer fee and payout steps before billing goes live.</Text>
          <IllustrationPlaceholder icon="wallet-outline" label="Illustration placeholder" />
        </>
      ),
    },
  ];

  const isLast = page >= STEP_COUNT - 1;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Host introduction steps"
      >
        {steps.map((step, i) => (
          <View key={step.title} style={[styles.page, { width: pageWidth }]}>
            <ScrollView contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
              <ScreenTitle subtitle={i === 0 ? "Quick tour before setup." : undefined}>{step.title}</ScreenTitle>
              {step.body}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => goToPage(i)}
              style={[styles.dot, i === page && styles.dotActive]}
              accessibilityLabel={`Step ${i + 1} of ${STEP_COUNT}`}
              accessibilityState={{ selected: i === page }}
            />
          ))}
        </View>

        {!isLast ? (
          <Pressable
            onPress={() => goToPage(page + 1)}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
            accessibilityLabel="Next step"
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={semantic.textPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void finishFlow()}
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
            accessibilityLabel={allowBack ? "Done" : "Get started"}
          >
            <Text style={styles.ctaBtnText}>{allowBack ? "Done" : "Get started"}</Text>
          </Pressable>
        )}

        {!allowBack ? (
          <Pressable onPress={() => void finishFlow()} style={styles.skipTextBtn} accessibilityLabel="Skip introduction">
            <Text style={styles.skipTextBtnLabel}>Skip for now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bgSecondary },
  page: { flexGrow: 0 },
  pageScrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  body: { ...typography.body, color: semantic.textPrimary, marginBottom: spacing.md, lineHeight: 22 },
  bodyMuted: { ...typography.caption, color: semantic.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  bulletList: { marginBottom: spacing.md },
  bullet: { ...typography.body, color: semantic.textPrimary, marginBottom: spacing.sm, lineHeight: 22, paddingLeft: spacing.xs },
  illusBox: {
    marginTop: spacing.lg,
    minHeight: 160,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.small,
  },
  illusLabel: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.md },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.thin,
    borderTopColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
  },
  dots: { flexDirection: "row", justifyContent: "center", marginBottom: spacing.md },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: semantic.textSecondary,
    opacity: 0.35,
  },
  dotActive: { opacity: 1, backgroundColor: semantic.textPrimary, transform: [{ scale: 1.15 }] },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  nextBtnPressed: { opacity: 0.75 },
  nextBtnText: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary, marginRight: spacing.xs },
  ctaBtn: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  ctaBtnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  ctaBtnText: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
  skipTextBtn: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  skipTextBtnLabel: { ...typography.caption, color: semantic.textSecondary },
  headerSkip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.xs },
  headerSkipText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
});
