import React from "react";
import { Pressable, SafeAreaView, Text, View, StyleSheet } from "react-native";
import * as Sentry from "@sentry/react-native";
import { semantic, spacing, typography, radius, borderWidth } from "../theme";

interface State {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (__DEV__) {
      console.warn("[ErrorBoundary] App crash:", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <View style={styles.messageWrap}>
            <Text style={styles.message}>
              Quizzer ran into an unexpected error. Tap below to try again, or restart the app if the issue persists.
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
          {__DEV__ && this.state.message ? (
            <View style={styles.devDetail}>
              <Text style={styles.devDetailText}>{this.state.message}</Text>
            </View>
          ) : null}
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: semantic.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { ...typography.displaySmall, color: semantic.textPrimary, textAlign: "center" },
  messageWrap: { marginTop: spacing.md, marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  message: { ...typography.body, color: semantic.textSecondary, textAlign: "center", lineHeight: 22 },
  retryBtn: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    minWidth: 160,
  },
  retryBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  retryBtnText: { ...typography.body, fontWeight: "800", color: semantic.textPrimary },
  devDetail: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: radius.medium,
    maxWidth: "90%",
  },
  devDetailText: { ...typography.caption, color: semantic.danger, fontFamily: "monospace" },
});

export default ErrorBoundary;
