import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

export type SplashLockup = "mark" | "wordmark" | "combined";

type Props = {
  lockup?: SplashLockup;
  onFinished?: () => void;
};

const MARK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#FFD400"/><g transform="translate(160,160) scale(29.333333333333332)">
        <circle cx="11.5" cy="11" r="10" fill="#000"/>
        <circle cx="11.5" cy="11" r="5" fill="#FFD400"/>
        <path d="M 15.8 15 L 22 22 L 14.5 20.5 Z" fill="#000"/></g></svg>`;

const EASE_SWIFT = Easing.bezier(0.77, 0, 0.175, 1);
const EASE_MARK = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE_LETTER = Easing.bezier(0.34, 1.4, 0.5, 1);

const LETTERS = ["Q", "U", "I", "Z", "Z", "E", "R"] as const;

const MARK_SIZE = 132;
const MARK_OFFSET = 6;
const SWEEP_DURATION = 560;
const MARK_DURATION = 720;
const UNDERLINE_START = 820;
const UNDERLINE_DURATION = 380;
const WORDMARK_START = 1180;
const LETTER_DURATION = 520;
const LETTER_STAGGER = 55;
const ACCESSORIES_START = 2000;
const ACCESSORIES_DURATION = 400;
const TOTAL_DURATION = ACCESSORIES_START + ACCESSORIES_DURATION;

const DOT_CYCLE = 1100;
const DOT_PEAK_FRAC = 0.3;

export default function SplashAnimated({
  lockup = "mark",
  onFinished,
}: Props) {
  const showMark = lockup === "mark" || lockup === "combined";
  const showWordmark = lockup === "wordmark" || lockup === "combined";
  const wordmarkFontSize = lockup === "wordmark" ? 92 : 78;
  const underlineWidth = lockup === "wordmark" ? 280 : 240;

  const sweepTY = useSharedValue(0);
  const markTY = useSharedValue(-(MARK_SIZE * 1.4));
  const markRot = useSharedValue(-8);
  const markOpacity = useSharedValue(0);
  const underlineSX = useSharedValue(0);
  const accessoriesOpacity = useSharedValue(0);

  useEffect(() => {
    sweepTY.value = withTiming(-101, {
      duration: SWEEP_DURATION,
      easing: EASE_SWIFT,
    });

    if (showMark) {
      markTY.value = withTiming(0, {
        duration: MARK_DURATION,
        easing: EASE_MARK,
      });
      markRot.value = withTiming(0, {
        duration: MARK_DURATION,
        easing: EASE_MARK,
      });
      markOpacity.value = withTiming(1, {
        duration: MARK_DURATION / 2,
        easing: Easing.linear,
      });
    } else {
      markOpacity.value = 0;
    }

    if (showWordmark) {
      underlineSX.value = withDelay(
        UNDERLINE_START,
        withTiming(1, {
          duration: UNDERLINE_DURATION,
          easing: EASE_SWIFT,
        }),
      );
    }

    accessoriesOpacity.value = withDelay(
      ACCESSORIES_START,
      withTiming(1, {
        duration: ACCESSORIES_DURATION,
        easing: Easing.linear,
      }),
    );

    const finishTimer = setTimeout(() => {
      if (onFinished) {
        onFinished();
      }
    }, TOTAL_DURATION);

    return () => clearTimeout(finishTimer);
  }, [
    showMark,
    showWordmark,
    sweepTY,
    markTY,
    markRot,
    markOpacity,
    underlineSX,
    accessoriesOpacity,
    onFinished,
  ]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: `${sweepTY.value}%`,
      },
    ],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [
      { translateY: markTY.value },
      { rotate: `${markRot.value}deg` },
    ],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: underlineSX.value }],
  }));

  const accessoriesStyle = useAnimatedStyle(() => ({
    opacity: accessoriesOpacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.lockup}>
        {showMark ? (
          <Animated.View style={[styles.markWrap, markStyle]}>
            <View style={styles.markShadow} />
            <View style={styles.markForeground}>
              <SvgXml xml={MARK_SVG} width="100%" height="100%" />
            </View>
          </Animated.View>
        ) : null}

        {showWordmark ? (
          <View style={styles.wordmark}>
            <View style={styles.wordmarkLetters}>
              {LETTERS.map((char, index) => (
                <Letter
                  key={`${char}-${index}`}
                  char={char}
                  fontSize={wordmarkFontSize}
                  delay={WORDMARK_START + index * LETTER_STAGGER}
                />
              ))}
            </View>
            <Animated.View
              style={[
                styles.underline,
                { width: underlineWidth },
                underlineStyle,
              ]}
            />
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.cornerTopLeft, accessoriesStyle]} />
      <Animated.View style={[styles.cornerBottomRight, accessoriesStyle]} />

      <Animated.View style={[styles.loader, accessoriesStyle]}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </Animated.View>

      <Animated.View style={[styles.sweep, sweepStyle]} />
    </View>
  );
}

function Letter({
  char,
  fontSize,
  delay,
}: {
  char: string;
  fontSize: number;
  delay: number;
}) {
  const ty = useSharedValue(-60);
  const rot = useSharedValue(-4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withTiming(0, { duration: LETTER_DURATION, easing: EASE_LETTER }),
    );
    rot.value = withDelay(
      delay,
      withTiming(0, { duration: LETTER_DURATION, easing: EASE_LETTER }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: LETTER_DURATION, easing: EASE_LETTER }),
    );
  }, [delay, ty, rot, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.letter,
        { fontSize, lineHeight: Math.round(fontSize * 0.9) },
        style,
      ]}
      allowFontScaling={false}
    >
      {char}
    </Animated.Text>
  );
}

function Dot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.65);
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    const peakDuration = Math.round(DOT_CYCLE * DOT_PEAK_FRAC);
    const restDuration = DOT_CYCLE - peakDuration;

    scale.value = withDelay(
      ACCESSORIES_START + delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: peakDuration,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.65, {
            duration: restDuration,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );

    opacity.value = withDelay(
      ACCESSORIES_START + delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: peakDuration,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.35, {
            duration: restDuration,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFD400",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    alignItems: "center",
    gap: 22,
  },
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    position: "relative",
  },
  markShadow: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
    top: MARK_OFFSET,
    left: MARK_OFFSET,
    backgroundColor: "#000",
  },
  markForeground: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
    top: 0,
    left: 0,
  },
  wordmark: {
    alignItems: "center",
    gap: 6,
  },
  wordmarkLetters: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  letter: {
    fontFamily: "Anton_400Regular",
    color: "#000",
    letterSpacing: -2,
    includeFontPadding: false,
  },
  underline: {
    height: 10,
    backgroundColor: "#FF4F93",
    alignSelf: "flex-start",
    transform: [{ scaleX: 0 }],
  },
  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 54,
    height: 6,
    backgroundColor: "#000",
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 54,
    height: 6,
    backgroundColor: "#000",
  },
  loader: {
    position: "absolute",
    bottom: 92,
    alignSelf: "center",
    flexDirection: "row",
    gap: 9,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 11 / 2,
    backgroundColor: "#000",
  },
  sweep: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
});

// silence unused-import warning for runOnJS — kept available for future
// animation-driven onFinished hand-offs (currently we use setTimeout).
void runOnJS;
