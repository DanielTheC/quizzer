import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  borderWidth,
  colors,
  fonts,
  spacing,
  typography,
  type SemanticTheme,
} from "../theme";
import { useAppTheme } from "../context/ThemeContext";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { RoleProvider } from "../context/RoleContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { supabase } from "../lib/supabase";
import AuthNavigator from "./AuthNavigator";
import RoleSelectScreen from "../screens/RoleSelectScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NearbyScreen from "../screens/player/NearbyScreen";
import QuizDetailScreen from "../screens/player/QuizDetailScreen";
import SavedScreen from "../screens/player/SavedScreen";
import HostSetupScreen from "../screens/host/HostSetupScreen";
import HostOnboardingScreen from "../screens/host/HostOnboardingScreen";
import HostDashboardScreen from "../screens/host/HostDashboardScreen";
import HostProfileScreen from "../screens/host/HostProfileScreen";
import HostApplyScreen from "../screens/host/HostApplyScreen";
import RunQuizScreen from "../screens/host/RunQuizScreen";
import PackQuestionsScreen from "../screens/host/PackQuestionsScreen";
import { clearStoredRole, getStoredRole } from "../lib/roleStorage";
import { getHostOnboardingComplete } from "../lib/hostSetupStorage";
import { fetchIsAllowlistedHost } from "../lib/hostAccess";
import type { QuizzerRole } from "../lib/roleStorage";
import { hapticLight } from "../lib/playerHaptics";
import { navigationRef } from "./navigationRef";
import { QuizNotificationResponseBridge } from "./QuizNotificationResponseBridge";
import { PlayerQuizNotificationsScheduler } from "./PlayerQuizNotificationsScheduler";
import { InterestSignInSheet } from "../components/InterestSignInSheet";

export type NearbyStackParamList = {
  Nearby: undefined;
  QuizDetail: { quizEventId: string };
};

export type SavedStackParamList = {
  Saved: undefined;
  QuizDetail: { quizEventId: string };
};

export type HostStackParamList = {
  HostOnboarding: { allowBack?: boolean } | undefined;
  HostSetup: undefined;
  HostApply: undefined;
  HostDashboard: undefined;
  HostProfile: undefined;
  RunQuiz: { mode: "new" | "resume"; packId?: string; venueId?: string };
  PackQuestions: { packId: string };
  Settings: undefined;
};

export type RootTabParamList = {
  Nearby: undefined;
  Saved: undefined;
  Host: undefined;
};

export type PlayerTabParamList = {
  Nearby: undefined;
  Saved: undefined;
  Settings: undefined;
};

const NearbyStack = createNativeStackNavigator<NearbyStackParamList>();
const SavedStack = createNativeStackNavigator<SavedStackParamList>();
const HostStack = createNativeStackNavigator<HostStackParamList>();
const PlayerTab = createBottomTabNavigator<PlayerTabParamList>();

function createNavStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
    placeholderText: { ...typography.body, color: semantic.textSecondary },
    loadingGate: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: semantic.bgSecondary },
    loadingText: { marginTop: 12, ...typography.body, color: semantic.textSecondary },
  });
}

/** Hit slop for compact tab row (~62.5% of original bar; slop keeps taps comfortable). */
const TAB_HIT_SLOP = { top: 20, bottom: 20, left: 18, right: 18 } as const;

const TAB_ICON = 18;
const TAB_MIN_H = 35;
const TAB_MIN_W = 33;

function createPlayerTabBarStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    /** Full-width bar behind the tab row (safe area inset applied as padding). */
    strip: {
      backgroundColor: colors.black,
      paddingTop: 5,
    },
    /** Inset tab cluster on black — no border (avoids the thin top/outline line). */
    dock: {
      marginHorizontal: 10,
      marginBottom: 3,
      borderRadius: 14,
      backgroundColor: colors.black,
      padding: 3,
      overflow: "visible",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      overflow: "visible",
    },
    sidePressableBase: {
      flex: 1,
      position: "relative",
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 5,
      minHeight: TAB_MIN_H,
      minWidth: TAB_MIN_W,
    },
    savedPressable: {
      backgroundColor: colors.black,
      borderWidth: 0,
    },
    settingsPressable: {
      backgroundColor: colors.black,
      borderWidth: 0,
    },
    /** Golden yellow CTA — black type. */
    nearbyPressable: {
      flex: 3,
      position: "relative",
      backgroundColor: colors.yellow,
      borderRadius: 14,
      borderWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      minHeight: TAB_MIN_H,
      zIndex: 2,
    },
    nearbyTitle: {
      fontFamily: fonts.display,
      fontSize: 15,
      fontWeight: "400",
      color: colors.black,
      letterSpacing: 0.25,
      flexShrink: 1,
      textAlign: "center",
    },
    tabIconColumn: { alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: 2,
      right: 3,
      minWidth: 15,
      minHeight: 11,
      paddingVertical: 1,
      borderRadius: 6,
      backgroundColor: semantic.accentRed,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
      borderWidth: 1,
      borderColor: colors.black,
      zIndex: 2,
    },
    badgeText: { fontSize: 10, fontWeight: "800" as const, color: colors.white },
    pressedShrink: {
      transform: [{ scale: 0.98 }],
    },
  });
}

type PlayerTabBarOwnProps = { savedTonightBadge?: number };

function PlayerTabBar({ state, descriptors, navigation, savedTonightBadge }: BottomTabBarProps & PlayerTabBarOwnProps) {
  const { semantic } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createPlayerTabBarStyles(semantic), [semantic]);
  const bottomInset = Math.max(insets.bottom, 5);

  return (
    <View style={[styles.strip, { paddingBottom: bottomInset }]}>
      <View style={styles.dock}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];

            const onPress = () => {
              const e = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !e.defaultPrevented) {
                hapticLight();
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: "tabLongPress", target: route.key });
            };

            if (route.name === "Saved") {
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? "Saved quizzes"}
                  accessibilityHint="Opens your saved quizzes list."
                  hitSlop={TAB_HIT_SLOP}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.sidePressableBase,
                    styles.savedPressable,
                    { overflow: "hidden" },
                    pressed && styles.pressedShrink,
                  ]}
                >
                  {savedTonightBadge != null && savedTonightBadge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{savedTonightBadge > 99 ? "99+" : savedTonightBadge}</Text>
                    </View>
                  ) : null}
                  <View style={styles.tabIconColumn}>
                    <MaterialCommunityIcons name="heart" size={TAB_ICON} color={semantic.accentRed} />
                  </View>
                </Pressable>
              );
            }

            if (route.name === "Nearby") {
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? "Find a quiz"}
                  accessibilityHint="Opens the quiz search screen."
                  hitSlop={TAB_HIT_SLOP}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [styles.nearbyPressable, pressed && styles.pressedShrink]}
                >
                  <Text
                    style={styles.nearbyTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    maxFontSizeMultiplier={1.15}
                  >
                    Find a quiz
                  </Text>
                </Pressable>
              );
            }

            if (route.name === "Settings") {
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? "Settings"}
                  accessibilityHint="Opens account and notification settings."
                  hitSlop={TAB_HIT_SLOP}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.sidePressableBase,
                    styles.settingsPressable,
                    { overflow: "hidden" },
                    pressed && styles.pressedShrink,
                  ]}
                >
                  <View style={styles.tabIconColumn}>
                    <MaterialCommunityIcons name="cog-outline" size={TAB_ICON} color={colors.white} />
                  </View>
                </Pressable>
              );
            }

            return null;
          })}
        </View>
      </View>
    </View>
  );
}

function PlaceholderScreen({ name }: { name: string }) {
  const { semantic } = useAppTheme();
  const navStyles = useMemo(() => createNavStyles(semantic), [semantic]);
  return (
    <View style={navStyles.placeholder}>
      <Text style={navStyles.placeholderText}>{name} failed to load</Text>
    </View>
  );
}

const NearbyScreenSafe = typeof NearbyScreen === "function" ? NearbyScreen : () => <PlaceholderScreen name="Nearby" />;
const QuizDetailScreenSafe = typeof QuizDetailScreen === "function" ? QuizDetailScreen : () => <PlaceholderScreen name="QuizDetail" />;
const SavedScreenSafe = typeof SavedScreen === "function" ? SavedScreen : () => <PlaceholderScreen name="Saved" />;
const HostSetupScreenSafe = typeof HostSetupScreen === "function" ? HostSetupScreen : () => <PlaceholderScreen name="HostSetup" />;
const HostOnboardingScreenSafe =
  typeof HostOnboardingScreen === "function" ? HostOnboardingScreen : () => <PlaceholderScreen name="HostOnboarding" />;
const HostDashboardScreenSafe =
  typeof HostDashboardScreen === "function" ? HostDashboardScreen : () => <PlaceholderScreen name="HostDashboard" />;
const HostProfileScreenSafe =
  typeof HostProfileScreen === "function" ? HostProfileScreen : () => <PlaceholderScreen name="HostProfile" />;
const HostApplyScreenSafe =
  typeof HostApplyScreen === "function" ? HostApplyScreen : () => <PlaceholderScreen name="HostApply" />;
const RunQuizScreenSafe = typeof RunQuizScreen === "function" ? RunQuizScreen : () => <PlaceholderScreen name="RunQuiz" />;
const PackQuestionsScreenSafe = typeof PackQuestionsScreen === "function" ? PackQuestionsScreen : () => <PlaceholderScreen name="PackQuestions" />;
const SettingsScreenSafe = typeof SettingsScreen === "function" ? SettingsScreen : () => <PlaceholderScreen name="Settings" />;

function NearbyStackScreen() {
  return (
    <NearbyStack.Navigator>
      <NearbyStack.Screen name="Nearby" component={NearbyScreenSafe} options={{ headerShown: false }} />
      <NearbyStack.Screen
        name="QuizDetail"
        component={QuizDetailScreenSafe}
        options={{ headerTitle: "", headerBackTitle: "" }}
      />
    </NearbyStack.Navigator>
  );
}

function SavedStackScreen() {
  return (
    <SavedStack.Navigator>
      <SavedStack.Screen name="Saved" component={SavedScreenSafe} options={{ headerShown: false }} />
      <SavedStack.Screen
        name="QuizDetail"
        component={QuizDetailScreenSafe}
        options={{ headerTitle: "", headerBackTitle: "" }}
      />
    </SavedStack.Navigator>
  );
}

function HostStackScreen() {
  const { session } = useAuth();
  const { semantic } = useAppTheme();
  const navStyles = useMemo(() => createNavStyles(semantic), [semantic]);
  const hostStackScreenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: semantic.accentYellow },
      headerTintColor: semantic.textPrimary,
      headerTitleStyle: {
        fontFamily: fonts.display,
        fontWeight: "400" as const,
        fontSize: 17,
        color: semantic.textPrimary,
      },
      headerShadowVisible: false,
      headerBackTitle: "",
    }),
    [semantic]
  );

  const [hostInitialRoute, setHostInitialRoute] = useState<"HostOnboarding" | "HostSetup" | "HostApply" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getHostOnboardingComplete(), fetchIsAllowlistedHost(session)]).then(([onboardingDone, allowlisted]) => {
      if (cancelled) return;
      if (!onboardingDone) {
        setHostInitialRoute("HostOnboarding");
        return;
      }
      if (allowlisted === true) {
        setHostInitialRoute("HostSetup");
        return;
      }
      setHostInitialRoute("HostApply");
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (hostInitialRoute === null) {
    return (
      <View style={navStyles.loadingGate}>
        <ActivityIndicator size="large" color={semantic.accentYellow} />
        <Text style={navStyles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <HostStack.Navigator initialRouteName={hostInitialRoute} screenOptions={hostStackScreenOptions}>
      <HostStack.Screen name="HostOnboarding" component={HostOnboardingScreenSafe} options={{ headerTitle: "" }} />
      <HostStack.Screen name="HostSetup" component={HostSetupScreenSafe} options={{ headerTitle: "" }} />
      <HostStack.Screen name="HostApply" component={HostApplyScreenSafe} options={{ headerTitle: "Host access" }} />
      <HostStack.Screen name="HostDashboard" component={HostDashboardScreenSafe} options={{ headerTitle: "Listings" }} />
      <HostStack.Screen name="HostProfile" component={HostProfileScreenSafe} options={{ headerTitle: "Profile" }} />
      <HostStack.Screen name="RunQuiz" component={RunQuizScreenSafe} options={{ headerTitle: "" }} />
      <HostStack.Screen name="PackQuestions" component={PackQuestionsScreenSafe} options={{ headerTitle: "" }} />
      <HostStack.Screen name="Settings" component={SettingsScreenSafe} options={{ headerShown: false }} />
    </HostStack.Navigator>
  );
}

function PlayerTabScreen() {
  const { savedIds } = useSavedQuizzes();
  const [savedTonightCount, setSavedTonightCount] = useState(0);

  useEffect(() => {
    if (savedIds.length === 0) {
      setSavedTonightCount(0);
      return;
    }
    const todayDow = new Date().getDay();
    let cancelled = false;
    void supabase
      .from("quiz_events")
      .select("id")
      .in("id", savedIds)
      .eq("is_active", true)
      .eq("day_of_week", todayDow)
      .then(({ data }) => {
        if (!cancelled) setSavedTonightCount(data?.length ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [savedIds]);

  return (
    <View style={{ flex: 1 }}>
      <PlayerTab.Navigator
        tabBar={(props) => (
          <PlayerTabBar
            {...props}
            savedTonightBadge={savedTonightCount > 0 ? savedTonightCount : undefined}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        <PlayerTab.Screen name="Saved" component={SavedStackScreen} />
        <PlayerTab.Screen name="Nearby" component={NearbyStackScreen} />
        <PlayerTab.Screen name="Settings" component={SettingsScreenSafe} />
      </PlayerTab.Navigator>
      <InterestSignInSheet />
    </View>
  );
}

function LoadingGate() {
  const { semantic } = useAppTheme();
  const navStyles = useMemo(() => createNavStyles(semantic), [semantic]);
  return (
    <View style={navStyles.loadingGate}>
      <ActivityIndicator size="large" color={semantic.accentYellow} />
      <Text style={navStyles.loadingText}>Loading…</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { session, initializing: authInitializing } = useAuth();
  const [role, setRoleState] = useState<QuizzerRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  /** Bumps whenever we intentionally set role (sign-out, reset, role picker). Stale getStoredRole() callbacks must not overwrite. */
  const roleIntentEpochRef = useRef(0);

  const setRole = useCallback((next: QuizzerRole | null) => {
    roleIntentEpochRef.current += 1;
    setRoleState(next);
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        void clearStoredRole().then(() => setRole(null));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [setRole]);

  useEffect(() => {
    if (authInitializing) return;

    if (!session) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    const intentAtFetch = roleIntentEpochRef.current;
    setRoleLoading(true);
    getStoredRole().then((stored) => {
      if (cancelled) return;
      if (roleIntentEpochRef.current !== intentAtFetch) {
        setRoleLoading(false);
        return;
      }
      setRoleState(stored);
      setRoleLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authInitializing, session, setRole]);

  const handleRoleSelect = useCallback((selected: QuizzerRole) => {
    setRole(selected);
  }, [setRole]);

  if (authInitializing) {
    return (
      <NavigationContainer>
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(180)}>
          <LoadingGate />
        </Animated.View>
      </NavigationContainer>
    );
  }

  if (!session) {
    return (
      <NavigationContainer>
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(200)}>
          <AuthNavigator />
        </Animated.View>
      </NavigationContainer>
    );
  }

  if (roleLoading) {
    return (
      <NavigationContainer>
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(180)}>
          <LoadingGate />
        </Animated.View>
      </NavigationContainer>
    );
  }

  if (role === null) {
    return (
      <NavigationContainer>
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(220)}>
          <RoleSelectScreen onSelect={handleRoleSelect} />
        </Animated.View>
      </NavigationContainer>
    );
  }

  if (role === "host") {
    return (
      <NavigationContainer>
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(220)}>
          <RoleProvider role={role} setRole={setRole}>
            <HostStackScreen />
          </RoleProvider>
        </Animated.View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(220)}>
        <RoleProvider role={role} setRole={setRole}>
          <PlayerQuizNotificationsScheduler />
          <QuizNotificationResponseBridge />
          <PlayerTabScreen />
        </RoleProvider>
      </Animated.View>
    </NavigationContainer>
  );
}
