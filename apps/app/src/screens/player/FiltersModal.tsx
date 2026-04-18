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
import { useAppTheme } from "../../context/ThemeContext";
import {
  colors,
  spacing,
  radius,
  borderWidth,
  shadow,
  typography,
  fonts,
  type SemanticTheme,
} from "../../theme";

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
};

function createStyles(semantic: SemanticTheme, _isDark: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: semantic.bgPrimary,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "85%",
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.grey400,
      alignSelf: "center",
      marginTop: spacing.sm + 2,
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
    headerTitle: {
      ...typography.heading,
      fontFamily: fonts.display,
      color: semantic.textPrimary,
    },
    closeBtn: { padding: spacing.sm },
    closeBtnText: { ...typography.bodyStrong, color: colors.blue },
    chipPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    scroll: { maxHeight: 400 },
    scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
    sectionTitle: {
      ...typography.labelUppercase,
      color: semantic.textSecondary,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.xs },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md - 2,
      borderRadius: radius.pill,
      backgroundColor: colors.grey100,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
    },
    chipActive: { backgroundColor: colors.black },
    chipText: { ...typography.captionStrong, color: semantic.textSecondary },
    chipTextActive: { color: semantic.textInverse },
    sliderRow: { marginBottom: spacing.sm },
    sliderLabel: { ...typography.captionStrong, color: semantic.textSecondary, marginBottom: spacing.xs },
    slider: { width: "100%", height: 32 },
    settingsHint: {
      padding: spacing.sm + 2,
      backgroundColor: colors.cream,
      borderRadius: radius.small,
      marginBottom: spacing.sm,
      borderWidth: borderWidth.default,
      borderColor: semantic.warning,
    },
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
      paddingVertical: spacing.md - 2,
      borderRadius: radius.large,
      backgroundColor: colors.grey100,
      alignItems: "center",
      marginRight: spacing.md,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      ...shadow.small,
    },
    clearBtnText: { ...typography.bodyStrong, color: semantic.textSecondary },
    applyBtn: {
      flex: 1,
      paddingVertical: spacing.md - 2,
      borderRadius: radius.large,
      backgroundColor: colors.black,
      alignItems: "center",
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      ...shadow.small,
    },
    applyBtnText: { ...typography.bodyStrong, color: semantic.textInverse },
  });
}

export function FiltersModal({
  visible,
  onClose,
  initialFilters,
  onApply,
  locationPermission,
}: Props) {
  const { semantic, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(semantic, isDark), [semantic, isDark]);
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
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.chipPressed]}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Day</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.chip,
                  draft.selectedDays.length === 0 && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setDraft((p) => ({ ...p, selectedDays: [] }))}
              >
                <Text style={[styles.chipText, draft.selectedDays.length === 0 && styles.chipTextActive]}>Any</Text>
              </Pressable>
              {DAY_LABELS.map((label, idx) => {
                const active = draft.selectedDays.includes(idx);
                return (
                  <Pressable
                    key={label}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
                    onPress={() => toggleDay(idx)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Prize</Text>
            <View style={styles.chipRow}>
              {PRIZE_OPTIONS.map((p) => {
                const active = draft.prizeFilter === p;
                const label = p === "all" ? "All" : p.replace("_", " ");
                return (
                  <Pressable
                    key={p}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
                    onPress={() => setDraft((p2) => ({ ...p2, prizeFilter: p }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Within (miles)</Text>
            {locationPermission === "denied" && (
              <Pressable
                onPress={() => Linking.openSettings()}
                style={({ pressed }) => [styles.settingsHint, pressed && styles.chipPressed]}
              >
                <Text style={styles.settingsHintText}>Enable location to filter by distance</Text>
              </Pressable>
            )}
            <View style={styles.chipRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.chip,
                  draft.distanceFilterMiles === null && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setDraft((p) => ({ ...p, distanceFilterMiles: null }))}
              >
                <Text style={[styles.chipText, draft.distanceFilterMiles === null && styles.chipTextActive]}>Any</Text>
              </Pressable>
              {DISTANCE_MILES.map((mi) => {
                const active = draft.distanceFilterMiles === mi;
                return (
                  <Pressable
                    key={mi}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
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
                value={
                  draft.maxFeePounds === ""
                    ? 0
                    : Math.min(MAX_FEE_SLIDER_MAX, parseInt(draft.maxFeePounds, 10) || 0)
                }
                onValueChange={(v) =>
                  setDraft((p) => ({ ...p, maxFeePounds: v === 0 ? "" : String(Math.round(v)) }))
                }
                minimumTrackTintColor={semantic.textPrimary}
                maximumTrackTintColor={colors.grey400}
                thumbTintColor={semantic.textPrimary}
              />
            </View>

            <Text style={styles.sectionTitle}>Saved only</Text>
            <Pressable
              style={({ pressed }) => [
                styles.chip,
                draft.savedOnly && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setDraft((p) => ({ ...p, savedOnly: !p.savedOnly }))}
            >
              <Text style={[styles.chipText, draft.savedOnly && styles.chipTextActive]}>
                {draft.savedOnly ? "Yes" : "No"}
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.chipPressed]}
              onPress={clearAll}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.applyBtn, pressed && styles.chipPressed]}
              onPress={handleApply}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
