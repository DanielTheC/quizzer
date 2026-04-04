/**
 * Quizzer app design tokens — arcade / poster / scoreboard aesthetic.
 * Use these instead of hardcoded colours and spacing.
 */

// ——— Palette ———
export const colors = {
  yellow: "#FFD400",
  /** Bottom tab “Find a quiz” — golden yellow (design swatch ~#FDCA01). */
  findQuizTabYellow: "#FDCA01",
  black: "#000000",
  white: "#FFFFFF",
  pink: "#FF4F93",
  green: "#00D26A",
  orange: "#FF8A00",
  /** Filters / accent CTA on Nearby toolbar */
  purple: "#7C3AED",
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

/** Theme shape shared by light (`semantic`) and dark (`semanticDark`) palettes. */
export type SemanticTheme = { [K in keyof typeof semantic]: string };

/** Dark palette — same keys as `semantic` (follows system appearance via ThemeContext). */
export const semanticDark: SemanticTheme = {
  bgPrimary: "#1c1b19",
  bgSecondary: "#121110",
  bgAccent: colors.yellow,
  bgInverse: "#FFF8D6",
  textPrimary: "#F4F1EA",
  textSecondary: "#A8A29E",
  textInverse: "#0C0A09",
  borderPrimary: "#E7DFD0",
  accentYellow: colors.yellow,
  accentPink: "#FF6BA8",
  accentGreen: "#4ADE80",
  accentOrange: "#FB923C",
  accentBlue: "#60A5FA",
  accentRed: "#F87171",
  success: "#4ADE80",
  warning: "#FB923C",
  danger: "#F87171",
};

/** Quiz detail screen — coloured card fields and accent rails (information hierarchy). */
export const detailScreen = {
  /** Hero “ticket”: when, where, money — warm gold field */
  heroBackground: "#FFE8B3",
  /** Address / maps — cool “go here” */
  locationBackground: "#CFE6FF",
  locationRail: colors.blue,
  locationEyebrow: "#1E40AF",
  /** Rules & expectations — magenta tint */
  infoBackground: "#FFDCEE",
  infoRail: colors.pink,
  infoEyebrow: "#9D174D",
  /** Turn-up guidance — calm mint */
  turnUpBackground: "#C5F0DC",
  turnUpRail: colors.green,
  turnUpEyebrow: "#047857",
  /** Typography / chips on the hero ticket (always dark ink on warm fields). */
  ticketInkPrimary: colors.black,
  ticketInkSecondary: colors.grey700,
  ticketChipBg: colors.white,
  ticketIconRingBg: colors.grey100,
} as const;

export type DetailScreenTheme = { [K in keyof typeof detailScreen]: string };

/** Dark system UI, but quiz detail keeps the same poster / pastel “ticket” look. */
export const detailScreenDark: DetailScreenTheme = {
  heroBackground: "#FFE8B3",
  locationBackground: "#CFE6FF",
  locationRail: colors.blue,
  locationEyebrow: "#1E40AF",
  infoBackground: "#FFDCEE",
  infoRail: colors.pink,
  infoEyebrow: "#9D174D",
  turnUpBackground: "#C5F0DC",
  turnUpRail: colors.green,
  turnUpEyebrow: "#047857",
  ticketInkPrimary: colors.black,
  ticketInkSecondary: colors.grey700,
  ticketChipBg: colors.white,
  ticketIconRingBg: colors.grey100,
};

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
  /** Neo-brutalist player cards (thick border + offset shadow) */
  brutal: 22,
  /** Capsule tags */
  pill: 100,
} as const;

/** Soft grey drop shadow (matches list postcode / secondary text tone). */
const BUTTON_SHADOW_COLOR = colors.grey700;

// ——— Shadows (hard offset). iOS: shadow*; Android: elevation approximates. ———
export const shadow = {
  small: {
    shadowColor: BUTTON_SHADOW_COLOR,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  medium: {
    shadowColor: BUTTON_SHADOW_COLOR,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  large: {
    shadowColor: BUTTON_SHADOW_COLOR,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
} as const;

// ——— Typography ———
/** Loaded in `App.tsx` via `useFonts` (`Anton_400Regular`). */
export const fonts = {
  display: "Anton_400Regular",
} as const;

export const typography = {
  displayLarge: { fontSize: 29, fontWeight: "400" as const, fontFamily: fonts.display },
  displayMedium: { fontSize: 25, fontWeight: "400" as const, fontFamily: fonts.display },
  displaySmall: { fontSize: 21, fontWeight: "400" as const, fontFamily: fonts.display },
  heading: { fontSize: 19, fontWeight: "400" as const, fontFamily: fonts.display },
  body: { fontSize: 17, fontWeight: "400" as const, maxFontSizeMultiplier: 1.4 },
  bodyStrong: { fontSize: 17, fontWeight: "600" as const, maxFontSizeMultiplier: 1.4 },
  caption: { fontSize: 15, fontWeight: "500" as const, maxFontSizeMultiplier: 1.45 },
  captionStrong: { fontSize: 15, fontWeight: "700" as const, maxFontSizeMultiplier: 1.45 },
  label: { fontSize: 13, fontWeight: "600" as const, maxFontSizeMultiplier: 1.4 },
  labelUppercase: {
    fontSize: 13,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    maxFontSizeMultiplier: 1.35,
  },
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

/** Yellow capsule tag — black type (use on light + dark shells). */
export const playerBrutalPill = {
  paddingVertical: 6,
  paddingHorizontal: spacing.md,
  borderRadius: radius.pill,
  borderWidth: borderWidth.default,
  borderColor: colors.black,
  backgroundColor: colors.yellow,
} as const;

export const playerBrutalCard = {
  backgroundColor: semantic.bgPrimary,
  borderWidth: borderWidth.default,
  borderColor: semantic.borderPrimary,
  borderRadius: radius.brutal,
  ...shadow.medium,
} as const;

/** Matches website quiz CTAs: pink (primary action) and yellow (secondary). */
export const websiteCta = {
  pink: {
    backgroundColor: colors.pink,
    borderWidth: borderWidth.default,
    borderColor: colors.black,
    borderRadius: radius.medium,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadow.medium,
  },
  yellow: {
    backgroundColor: colors.yellow,
    borderWidth: borderWidth.default,
    borderColor: colors.black,
    borderRadius: radius.medium,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadow.medium,
  },
  blue: {
    backgroundColor: colors.blue,
    borderWidth: borderWidth.default,
    borderColor: colors.black,
    borderRadius: radius.medium,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadow.medium,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: borderWidth.default,
    borderColor: colors.black,
    borderRadius: radius.medium,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadow.medium,
  },
} as const;

export const badgeStyle = {
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.sm,
  borderRadius: radius.small,
  borderWidth: borderWidth.thin,
  borderColor: semantic.borderPrimary,
};
