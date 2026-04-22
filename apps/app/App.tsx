import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFonts, Anton_400Regular } from "@expo-google-fonts/anton";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { AuthProvider } from "./src/context/AuthContext";
import { InterestedOccurrencesProvider } from "./src/context/InterestedOccurrencesContext";
import { SavedQuizzesProvider } from "./src/context/SavedQuizzesContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initSentry } from "./src/lib/sentryInit";
import RootNavigator from "./src/navigation/RootNavigator";
import SplashAnimated from "./src/components/SplashAnimated";

initSentry();

void SplashScreen.preventAutoHideAsync();

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo);
    if (process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()) {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  errorTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  errorText: { fontSize: 14, color: "#666", textAlign: "center" },
});

function AppRoot() {
  const [fontsLoaded] = useFonts({ Anton_400Regular });
  const [splashAnimDone, setSplashAnimDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <SavedQuizzesProvider>
              <InterestedOccurrencesProvider>
                <RootNavigator />
                {!splashAnimDone && (
                  <SplashAnimated onFinished={() => setSplashAnimDone(true)} />
                )}
              </InterestedOccurrencesProvider>
            </SavedQuizzesProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  if (typeof RootNavigator !== "function") {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>RootNavigator is undefined</Text>
        <Text style={styles.errorText}>Check src/navigation/RootNavigator.tsx default export.</Text>
      </View>
    );
  }
  return <AppRoot />;
}
