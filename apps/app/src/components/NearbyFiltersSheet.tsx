import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useAppTheme } from "../context/ThemeContext";
import { colors, spacing, radius, borderWidth, shadow, typography, websiteCta, type SemanticTheme } from "../theme";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIZE_OPTIONS = ["all", "cash", "bar_tab", "drinks", "voucher", "other"] as const;
const DISTANCE_MILES = [1, 3, 5, 10] as const;
type DistanceFilter = (typeof DISTANCE_MILES)[number] | null;
const MAX_FEE_SLIDER_MIN = 0;
const MAX_FEE_SLIDER_MAX = 10;

export type FiltersState = {
  selectedDays: number[];
  prizeFilter: string;
  distanceFilterMiles: DistanceFilter;
  maxFeePounds: string;
  savedOnly: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  initialFilters: FiltersState;
  onApply: (filters: FiltersState) => void;
  locationPermission: "granted" | "denied" | "undetermined";
  isTonightMode?: boolean;
};

function buildFiltersSheetStyles(semantic: SemanticTheme, isDark: boolean) {
  const handleColor = isDark ? "rgba(168,162,158,0.45)" : colors.grey400;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: semantic.bgPrimary,
      borderTopLeftRadius: radius.brutal,
      borderTopRightRadius: radius.brutal,
      borderTopWidth: borderWidth.default,
      borderLeftWidth: borderWidth.default,
      borderRightWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      maxHeight: "85%",
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: handleColor,
      alignSelf: "center",
      marginTop: spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: borderWidth.default,
      borderBottomColor: semantic.borderPrimary,
    },
    headerTitle: { ...typography.heading, color: semantic.textPrimary },
    closeBtn: { padding: spacing.sm },
    closeBtnText: { ...typography.bodyStrong, color: semantic.accentBlue },
    scroll: { maxHeight: 400 },
    scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
    tonightHint: {
      padding: spacing.md,
      backgroundColor: semantic.accentYellow,
      borderRadius: radius.medium,
      borderWidth: borderWidth.thin,
      borderColor: semantic.borderPrimary,
      marginBottom: spacing.sm,
    },
    tonightHintText: { ...typography.caption, color: semantic.textPrimary },
    sectionTitle: { ...typography.labelUppercase, color: semantic.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
    chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.xs },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.small,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.bgPrimary,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    chipActive: { backgroundColor: semantic.bgInverse },
    chipText: { ...typography.captionStrong, color: semantic.textPrimary },
    chipTextActive: { color: semantic.textInverse },
    sliderRow: { marginBottom: spacing.sm },
    sliderLabel: { ...typography.captionStrong, color: semantic.textPrimary, marginBottom: spacing.xs },
    slider: { width: "100%", height: 32 },
    settingsHint: { padding: spacing.md, backgroundColor: semantic.accentYellow, borderRadius: radius.small, borderWidth: borderWidth.thin, borderColor: semantic.borderPrimary, marginBottom: spacing.sm },
    settingsHintText: { ...typography.caption, color: semantic.textPrimary },
    footer: {
      flexDirection: "row",
      padding: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: borderWidth.default,
      borderTopColor: semantic.borderPrimary,
    },
    clearBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      marginRight: spacing.md,
      ...websiteCta.yellow,
    },
    clearBtnText: { ...typography.bodyStrong, color: colors.black },
    applyBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      ...websiteCta.pink,
    },
    applyBtnText: { ...typography.bodyStrong, color: colors.white },
  });
}

export function NearbyFiltersSheet({
  visible,
  onClose,
  initialFilters,
  onApply,
  locationPermission,
  isTonightMode = false,
}: Props) {
  const { semantic, isDark } = useAppTheme();
  const styles = useMemo(() => buildFiltersSheetStyles(semantic, isDark), [semantic, isDark]);
  const [draft, setDraft] = useState<FiltersState>(initialFilters);

  useEffect(() => {
    if (visible) setDraft(initialFilters);
  }, [visible, initialFilters]);

  const toggleDay = (day: number) => {
    setDraft((p) => ({
      ...p,
      selectedDays: p.selectedDays.includes(day)
        ? p.selectedDays.filter((d) => d !== day)
        : [...p.selectedDays, day].sort((a, b) => a - b),
    }));
  };

  const clearAll = () => {
    setDraft({
      selectedDays: [],
      prizeFilter: "all",
      distanceFilterMiles: null,
      maxFeePounds: "",
      savedOnly: false,
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {isTonightMode ? (
              <View style={styles.tonightHint}>
                <Text style={styles.tonightHintText}>
                  Tonight only lists today’s quizzes. Use the filters below for prize, distance, fee, and saved —
                  or turn off Tonight on the list to pick days of the week.
                </Text>
              </View>
            ) : null}

            {!isTonightMode ? (
              <>
                <Text style={styles.sectionTitle}>Day</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, draft.selectedDays.length === 0 && styles.chipActive]}
                    onPress={() => setDraft((p) => ({ ...p, selectedDays: [] }))}
                  >
                    <Text style={[styles.chipText, draft.selectedDays.length === 0 && styles.chipTextActive]}>Any</Text>
                  </Pressable>
                  {DAY_LABELS.map((label, idx) => {
                    const active = draft.selectedDays.includes(idx);
                    return (
                      <Pressable
                        key={label}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleDay(idx)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Prize</Text>
            <View style={styles.chipRow}>
              {PRIZE_OPTIONS.map((p) => {
                const active = draft.prizeFilter === p;
                const label = p === "all" ? "All" : p.replace("_", " ");
                return (
                  <Pressable
                    key={p}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft((p2) => ({ ...p2, prizeFilter: p }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Within (miles)</Text>
            {locationPermission === "denied" && (
              <Pressable onPress={() => Linking.openSettings()} style={styles.settingsHint}>
                <Text style={styles.settingsHintText}>Enable location to filter by distance</Text>
              </Pressable>
            )}
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, draft.distanceFilterMiles === null && styles.chipActive]}
                onPress={() => setDraft((p) => ({ ...p, distanceFilterMiles: null }))}
              >
                <Text style={[styles.chipText, draft.distanceFilterMiles === null && styles.chipTextActive]}>Any</Text>
              </Pressable>
              {DISTANCE_MILES.map((mi) => {
                const active = draft.distanceFilterMiles === mi;
                return (
                  <Pressable
                    key={mi}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft((p) => ({ ...p, distanceFilterMiles: mi }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{mi} mi</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Max entry fee (£)</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>
                {draft.maxFeePounds === "" ? "Any" : `£${draft.maxFeePounds}`}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={MAX_FEE_SLIDER_MIN}
                maximumValue={MAX_FEE_SLIDER_MAX}
                step={1}
                value={draft.maxFeePounds === "" ? 0 : Math.min(MAX_FEE_SLIDER_MAX, parseInt(draft.maxFeePounds, 10) || 0)}
                onValueChange={(v) =>
                  setDraft((p) => ({ ...p, maxFeePounds: v === 0 ? "" : String(Math.round(v)) }))
                }
                minimumTrackTintColor={semantic.borderPrimary}
                maximumTrackTintColor={isDark ? "rgba(168,162,158,0.35)" : colors.grey200}
                thumbTintColor={semantic.accentYellow}
              />
            </View>

            <Text style={styles.sectionTitle}>Saved only</Text>
            <Pressable
              style={[styles.chip, draft.savedOnly && styles.chipActive]}
              onPress={() => setDraft((p) => ({ ...p, savedOnly: !p.savedOnly }))}
            >
              <Text style={[styles.chipText, draft.savedOnly && styles.chipTextActive]}>
                {draft.savedOnly ? "Yes" : "No"}
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply filters</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
