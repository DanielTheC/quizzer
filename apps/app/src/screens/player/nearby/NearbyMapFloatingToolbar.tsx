import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { hapticLight } from "../../../lib/playerHaptics";
import { colors, type SemanticTheme } from "../../../theme";
import type { NearbyScreenStyles } from "./nearbyScreenStyles";
import type { SortMode } from "../../../lib/sortStorage";
import { NearbySearchField } from "./NearbySearchField";

type Props = {
  styles: NearbyScreenStyles;
  semantic: SemanticTheme;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  nearbyView: "list" | "map";
  showCollapsedToolbarChrome: boolean;
  onSetNearbyView: (mode: "list" | "map") => void;
  tonightMode: boolean;
  onToggleTonight: () => void;
  sortBy: SortMode;
  onOpenSort: () => void;
  onOpenFilters: () => void;
  resultLine: string;
};

export function NearbyMapFloatingToolbar({
  styles,
  semantic,
  searchQuery,
  onSearchQueryChange,
  nearbyView,
  showCollapsedToolbarChrome,
  onSetNearbyView,
  tonightMode,
  onToggleTonight,
  sortBy,
  onOpenSort,
  onOpenFilters,
  resultLine,
}: Props) {
  const viewModeToggle = (
    <View style={styles.viewModeToggle}>
      <Pressable
        onPress={() => {
          hapticLight();
          onSetNearbyView("list");
        }}
        style={({ pressed }) => [
          styles.viewModeToggleSegment,
          nearbyView === "list" && styles.viewModeToggleSegmentActive,
          pressed && styles.chipPressed,
        ]}
      >
        <MaterialCommunityIcons
          name="format-list-bulleted"
          size={18}
          color={nearbyView === "list" ? colors.white : colors.black}
          style={styles.viewModeIcon}
        />
        <Text style={[styles.viewModeToggleLabel, nearbyView === "list" && styles.viewModeToggleLabelActive]}>List</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          hapticLight();
          onSetNearbyView("map");
        }}
        style={({ pressed }) => [
          styles.viewModeToggleSegment,
          nearbyView === "map" && styles.viewModeToggleSegmentActive,
          pressed && styles.chipPressed,
        ]}
      >
        <MaterialCommunityIcons
          name="map-outline"
          size={18}
          color={nearbyView === "map" ? colors.white : colors.black}
          style={styles.viewModeIcon}
        />
        <Text style={[styles.viewModeToggleLabel, nearbyView === "map" && styles.viewModeToggleLabelActive]}>Map</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.mapToolbarOverlay} pointerEvents="box-none">
      <View style={styles.mapToolbarCard} pointerEvents="auto">
        <Text style={styles.mapToolbarTitle}>Find a quiz</Text>
        <NearbySearchField
          styles={styles}
          semantic={semantic}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          nearbyView={nearbyView}
          showCollapsedToolbarChrome={showCollapsedToolbarChrome}
        />
        {viewModeToggle}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapChipScroll}>
          <Pressable
            onPress={onToggleTonight}
            style={({ pressed }) => [
              tonightMode ? styles.chipTonight : styles.chip,
              styles.mapChipScrollItem,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: tonightMode }}
            accessibilityLabel={
              tonightMode ? "Tonight on — tap to show all week" : "Tonight off — tap to show only today"
            }
          >
            <MaterialCommunityIcons
              name="fire"
              size={18}
              color={tonightMode ? colors.yellow : semantic.textPrimary}
              style={styles.chipLeadingIcon}
            />
            <Text style={tonightMode ? styles.chipTonightText : styles.chipText}>Tonight</Text>
          </Pressable>
          <Pressable
            onPress={onOpenSort}
            style={({ pressed }) => [
              sortBy === "soonest" ? styles.chipSortSoonest : styles.chip,
              sortBy !== "soonest" && styles.chipActive,
              pressed && styles.chipPressed,
              styles.mapChipScrollItem,
            ]}
          >
            <Text
              style={[
                sortBy === "soonest" ? styles.chipSortSoonestText : styles.chipText,
                sortBy !== "soonest" && styles.chipTextActive,
              ]}
            >
              Sort: {sortBy === "soonest" ? "Soonest" : sortBy === "distance" ? "Distance" : "Entry fee"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOpenFilters}
            style={({ pressed }) => [styles.chipFilters, pressed && styles.chipPressed, styles.mapChipScrollItem]}
          >
            <Text style={styles.chipFiltersText}>Filters</Text>
          </Pressable>
        </ScrollView>
        <Text style={styles.mapResultHint}>{resultLine}</Text>
      </View>
    </View>
  );
}
