import React, { useEffect, useState } from "react";
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

export function FiltersModal({
  visible,
  onClose,
  initialFilters,
  onApply,
  locationPermission,
}: Props) {
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
            {/* Day */}
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

            {/* Prize */}
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

            {/* Distance */}
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

            {/* Max entry fee (slider) */}
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
                minimumTrackTintColor="#111"
                maximumTrackTintColor="#cbd5e1"
                thumbTintColor="#111"
              />
            </View>

            {/* Saved only */}
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
              <Text style={styles.clearBtnText}>Clear All</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  scroll: { maxHeight: 400 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#64748b", textTransform: "uppercase", marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: "#111" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  chipTextActive: { color: "#fff" },
  sliderRow: { marginBottom: 8 },
  sliderLabel: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 4 },
  slider: { width: "100%", height: 32 },
  settingsHint: { padding: 10, backgroundColor: "#fef3c7", borderRadius: 8, marginBottom: 8 },
  settingsHintText: { fontSize: 13, color: "#92400e" },
  footer: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    marginRight: 12,
  },
  clearBtnText: { fontSize: 16, fontWeight: "600", color: "#475569" },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
  },
  applyBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
