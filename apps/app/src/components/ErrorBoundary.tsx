import React from "react";
import { SafeAreaView, Text, View, StyleSheet } from "react-native";
import { semantic, spacing, typography } from "../theme";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: error?.message ?? String(error) };
  }

  componentDidCatch(error: any) {
    console.log("App crash:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Quizzer crashed</Text>
          <View style={styles.messageWrap}>
            <Text style={styles.message}>{this.state.message}</Text>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: semantic.bgSecondary },
  title: { ...typography.displaySmall, color: semantic.textPrimary },
  messageWrap: { marginTop: spacing.md },
  message: { ...typography.body, color: semantic.textSecondary },
});

export default ErrorBoundary;
