import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthProvider } from "./src/context/AuthContext";
import { SavedQuizzesProvider } from "./src/context/SavedQuizzesContext";
import RootNavigator from "./src/navigation/RootNavigator";

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo);
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

export default function App() {
  if (typeof RootNavigator !== "function") {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>RootNavigator is undefined</Text>
        <Text style={styles.errorText}>Check src/navigation/RootNavigator.tsx default export.</Text>
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SavedQuizzesProvider>
          <RootNavigator />
        </SavedQuizzesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
