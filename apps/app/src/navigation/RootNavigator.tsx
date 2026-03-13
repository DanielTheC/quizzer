import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { semantic, typography } from "../theme";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RoleProvider } from "../context/RoleContext";
import RoleSelectScreen from "../screens/RoleSelectScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NearbyScreen from "../screens/player/NearbyScreen";
import QuizDetailScreen from "../screens/player/QuizDetailScreen";
import SavedScreen from "../screens/player/SavedScreen";
import HostSetupScreen from "../screens/host/HostSetupScreen";
import RunQuizScreen from "../screens/host/RunQuizScreen";
import PackQuestionsScreen from "../screens/host/PackQuestionsScreen";
import { getStoredRole } from "../lib/roleStorage";
import type { QuizzerRole } from "../lib/roleStorage";

export type NearbyStackParamList = {
  Nearby: undefined;
  QuizDetail: { quizEventId: string };
};

export type SavedStackParamList = {
  Saved: undefined;
  QuizDetail: { quizEventId: string };
};

export type HostStackParamList = {
  HostSetup: undefined;
  RunQuiz: { mode: "new" | "resume"; packId?: string; venueId?: string };
  PackQuestions: { packId: string };
  Settings: undefined;
};

export type RootTabParamList = {
  Nearby: undefined;
  Saved: undefined;
  Host: undefined;
};

/** Player-only tabs (no Host tab). */
export type PlayerTabParamList = {
  Nearby: undefined;
  Saved: undefined;
  Settings: undefined;
};

const NearbyStack = createNativeStackNavigator<NearbyStackParamList>();
const SavedStack = createNativeStackNavigator<SavedStackParamList>();
const HostStack = createNativeStackNavigator<HostStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const PlayerTab = createBottomTabNavigator<PlayerTabParamList>();

function PlaceholderScreen({ name }: { name: string }) {
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
const RunQuizScreenSafe = typeof RunQuizScreen === "function" ? RunQuizScreen : () => <PlaceholderScreen name="RunQuiz" />;
const PackQuestionsScreenSafe = typeof PackQuestionsScreen === "function" ? PackQuestionsScreen : () => <PlaceholderScreen name="PackQuestions" />;
const SettingsScreenSafe = typeof SettingsScreen === "function" ? SettingsScreen : () => <PlaceholderScreen name="Settings" />;

function NearbyStackScreen() {
  return (
    <NearbyStack.Navigator>
      <NearbyStack.Screen name="Nearby" component={NearbyScreenSafe} options={{ title: "Nearby Quizzes" }} />
      <NearbyStack.Screen name="QuizDetail" component={QuizDetailScreenSafe} options={{ title: "Quiz Details" }} />
    </NearbyStack.Navigator>
  );
}

function SavedStackScreen() {
  return (
    <SavedStack.Navigator>
      <SavedStack.Screen name="Saved" component={SavedScreenSafe} options={{ title: "Saved Quizzes" }} />
      <SavedStack.Screen name="QuizDetail" component={QuizDetailScreenSafe} options={{ title: "Quiz Details" }} />
    </SavedStack.Navigator>
  );
}

function HostStackScreen() {
  return (
    <HostStack.Navigator>
      <HostStack.Screen name="HostSetup" component={HostSetupScreenSafe} options={{ title: "Host setup" }} />
      <HostStack.Screen name="RunQuiz" component={RunQuizScreenSafe} options={{ title: "Run Quiz" }} />
      <HostStack.Screen name="PackQuestions" component={PackQuestionsScreenSafe} options={{ title: "Quiz questions" }} />
      <HostStack.Screen name="Settings" component={SettingsScreenSafe} options={{ title: "Settings" }} />
    </HostStack.Navigator>
  );
}

/** Player flow: Nearby + Saved + Settings tabs (QuizDetail inside each stack). */
function PlayerTabScreen() {
  return (
    <PlayerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: navStyles.tabBar,
        tabBarActiveTintColor: semantic.textPrimary,
        tabBarInactiveTintColor: semantic.textSecondary,
        tabBarLabelStyle: navStyles.tabBarLabel,
      }}
    >
      <PlayerTab.Screen name="Nearby" component={NearbyStackScreen} options={{ tabBarLabel: "Nearby" }} />
      <PlayerTab.Screen name="Saved" component={SavedStackScreen} options={{ tabBarLabel: "Saved" }} />
      <PlayerTab.Screen name="Settings" component={SettingsScreenSafe} options={{ tabBarLabel: "Settings" }} />
    </PlayerTab.Navigator>
  );
}

function LoadingGate() {
  return (
    <View style={navStyles.loadingGate}>
      <ActivityIndicator size="large" color={semantic.textPrimary} />
      <Text style={navStyles.loadingText}>Loading…</Text>
    </View>
  );
}

const navStyles = StyleSheet.create({
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholderText: { ...typography.body, color: semantic.textSecondary },
  loadingGate: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: semantic.bgSecondary },
  loadingText: { marginTop: 12, ...typography.body, color: semantic.textSecondary },
  tabBar: { backgroundColor: semantic.bgPrimary, borderTopWidth: 3, borderTopColor: semantic.borderPrimary },
  tabBarLabel: { fontSize: 14, fontWeight: "600" },
});

export default function RootNavigator() {
  const [role, setRole] = useState<QuizzerRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getStoredRole().then((stored) => {
      if (!cancelled) {
        setRole(stored);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleRoleSelect = useCallback((selected: QuizzerRole) => {
    setRole(selected);
  }, []);

  if (loading) {
    return (
      <NavigationContainer>
        <LoadingGate />
      </NavigationContainer>
    );
  }

  if (role === null) {
    return (
      <NavigationContainer>
        <RoleSelectScreen onSelect={handleRoleSelect} />
      </NavigationContainer>
    );
  }

  if (role === "host") {
    return (
      <NavigationContainer>
        <RoleProvider role={role} setRole={setRole}>
          <HostStackScreen />
        </RoleProvider>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <RoleProvider role={role} setRole={setRole}>
        <PlayerTabScreen />
      </RoleProvider>
    </NavigationContainer>
  );
}
