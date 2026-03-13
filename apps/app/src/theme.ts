/**
 * Quizzer app design tokens — arcade / poster / scoreboard aesthetic.
 * Use these instead of hardcoded colours and spacing.
 */

// ——— Palette ———
export const colors = {
  yellow: "#FFD400",
  black: "#000000",
  white: "#FFFFFF",
  pink: "#FF4F93",
  green: "#00D26A",
  orange: "#FF8A00",
  blue: "#3B82F6",
  red: "#FF4D4D",
  cream: "#FFF8D6",
  grey100: "#F5F5F5",
  grey200: "#EAEAEA",
  grey400: "#BDBDBD",
  grey700: "#4F4F4F",
} as const;

// ——— Semantic ———
export const semantic = {
  bgPrimary: colors.white,
  bgSecondary: colors.cream,
  bgAccent: colors.yellow,
  bgInverse: colors.black,
  textPrimary: colors.black,
  textSecondary: colors.grey700,
  textInverse: colors.white,
  borderPrimary: colors.black,
  accentYellow: colors.yellow,
  accentPink: colors.pink,
  accentGreen: colors.green,
  accentOrange: colors.orange,
  accentBlue: colors.blue,
  accentRed: colors.red,
  success: colors.green,
  warning: colors.orange,
  danger: colors.red,
} as const;

// ——— Spacing (px) ———
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// ——— Border ———
export const borderWidth = {
  default: 3,
  thin: 1,
} as const;

export const radius = {
  small: 6,
  medium: 10,
  large: 14,
  xl: 18,
} as const;

// ——— Shadows (hard offset). iOS: shadow*; Android: elevation approximates. ———
export const shadow = {
  small: {
    shadowColor: colors.black,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  medium: {
    shadowColor: colors.black,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  large: {
    shadowColor: colors.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
} as const;

// ——— Typography ———
// Display/headings: Anton-like = bold, uppercase-friendly. Use fontFamily when Anton is loaded; fallback system bold.
export const typography = {
  displayLarge: { fontSize: 28, fontWeight: "800" as const },
  displayMedium: { fontSize: 24, fontWeight: "800" as const },
  displaySmall: { fontSize: 20, fontWeight: "700" as const },
  heading: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const },
  caption: { fontSize: 14, fontWeight: "500" as const },
  captionStrong: { fontSize: 14, fontWeight: "700" as const },
  label: { fontSize: 12, fontWeight: "600" as const },
  labelUppercase: { fontSize: 12, fontWeight: "700" as const, textTransform: "uppercase" as const },
} as const;

// ——— Component-style helpers (use with StyleSheet or inline) ———
export const cardStyle = {
  backgroundColor: semantic.bgPrimary,
  borderWidth: borderWidth.default,
  borderColor: semantic.borderPrimary,
  borderRadius: radius.large,
  ...shadow.small,
};

export const buttonPrimaryStyle = {
  backgroundColor: semantic.accentYellow,
  borderWidth: borderWidth.default,
  borderColor: semantic.borderPrimary,
  borderRadius: radius.medium,
  ...shadow.small,
};

export const buttonSecondaryStyle = {
  backgroundColor: semantic.bgPrimary,
  borderWidth: borderWidth.default,
  borderColor: semantic.borderPrimary,
  borderRadius: radius.medium,
  ...shadow.small,
};

export const chipBaseStyle = {
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  borderRadius: radius.small,
  borderWidth: borderWidth.default,
  borderColor: semantic.borderPrimary,
};

export const badgeStyle = {
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.sm,
  borderRadius: radius.small,
  borderWidth: borderWidth.thin,
  borderColor: semantic.borderPrimary,
};
