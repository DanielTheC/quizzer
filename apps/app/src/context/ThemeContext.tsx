import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  semantic,
  semanticDark,
  detailScreen,
  detailScreenDark,
  type SemanticTheme,
  type DetailScreenTheme,
} from "../theme";

/** Follow system appearance (dark/light mode). */
const FORCE_LIGHT_MODE = false;

export type AppTheme = {
  semantic: SemanticTheme;
  detail: DetailScreenTheme;
  isDark: boolean;
};

const ThemeContext = createContext<AppTheme>({
  semantic,
  detail: detailScreen,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = FORCE_LIGHT_MODE ? false : scheme === "dark";
  const value = useMemo<AppTheme>(
    () => ({
      semantic: isDark ? semanticDark : semantic,
      detail: isDark ? detailScreenDark : detailScreen,
      isDark,
    }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
