import React from "react";
import { Linking, Pressable, Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { hapticLight } from "../../../lib/playerHaptics";
import {
  LOCATION_PRIVACY_PRIMARY,
  LOCATION_PRIVACY_SETTINGS,
  LOCATION_PRIVACY_TAP_SETTINGS,
} from "../../../lib/legalUrls";
import { colors, spacing } from "../../../theme";
import type { SemanticTheme } from "../../../theme";
import type { NearbyScreenStyles } from "./nearbyScreenStyles";
import type { LocationPermissionStatus } from "./nearbyTypes";
import type { SortMode } from "../../../lib/sortStorage";
import { NearbySearchField } from "./NearbySearchField";

type Props = {
  insetsTop: number;
  styles: NearbyScreenStyles;
  semantic: SemanticTheme;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  nearbyView: "list" | "map";
  showCollapsedToolbarChrome: boolean;
  listToolbarExpandableStyle: AnimatedStyle<ViewStyle>;
  onListToolbarExpandableLayout: (ev: import("react-native").LayoutChangeEvent) => void;
  tonightMode: boolean;
  onToggleTonight: () => void;
  sortBy: SortMode;
  onOpenSort: () => void;
  onOpenFilters: () => void;
  locationPermission: LocationPermissionStatus;
  resultLine: string;
  onHideFiltersRow: () => void;
  revealListToolbarFromCollapsed: () => void;
  listToolbarCompactSummary: string;
  onSetNearbyView: (mode: "list" | "map") => void;
};

export function NearbyListToolbar({
  insetsTop,
  styles,
  semantic,
  searchQuery,
  onSearchQueryChange,
  nearbyView,
  showCollapsedToolbarChrome,
  listToolbarExpandableStyle,
  onListToolbarExpandableLayout,
  tonightMode,
  onToggleTonight,
  sortBy,
  onOpenSort,
  onOpenFilters,
  locationPermission,
  resultLine,
  onHideFiltersRow,
  revealListToolbarFromCollapsed,
  listToolbarCompactSummary,
  onSetNearbyView,
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
    <View style={[styles.listToolbar, { paddingTop: insetsTop + spacing.md }]}>
      <Text style={styles.toolbarTitle}>Find a quiz</Text>
      <NearbySearchField
        styles={styles}
        semantic={semantic}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        nearbyView={nearbyView}
        showCollapsedToolbarChrome={showCollapsedToolbarChrome}
      />
      <Animated.View style={listToolbarExpandableStyle}>
        <View onLayout={onListToolbarExpandableLayout}>
          {viewModeToggle}
          <View style={styles.chipRow}>
            <Pressable
              onPress={onToggleTonight}
              style={({ pressed }) => [
                tonightMode ? styles.chipTonight : styles.chip,
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
              ]}
            >
              <Text
                style={[
                  sortBy === "soonest" ? styles.chipSortSoonestText : styles.chipText,
                  sortBy !== "soonest" && styles.chipTextActive,
                ]}
              >
                Sort:{" "}
                {sortBy === "soonest" ? "Soonest" : sortBy === "distance" ? "Distance" : "Entry fee"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenFilters}
              style={({ pressed }) => [styles.chipFilters, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipFiltersText}>Filters</Text>
            </Pressable>
          </View>

          {locationPermission === "denied" && (
            <Pressable onPress={() => Linking.openSettings()} style={styles.locationHint}>
              <Text style={styles.locationHintText}>{LOCATION_PRIVACY_PRIMARY}</Text>
              <Text style={styles.locationHintSubtext}>{LOCATION_PRIVACY_SETTINGS}</Text>
              <Text style={[styles.locationHintSubtext, { marginTop: spacing.sm }]}>
                {LOCATION_PRIVACY_TAP_SETTINGS}
              </Text>
            </Pressable>
          )}

          <Text style={styles.resultCount}>{resultLine}</Text>
          <Pressable
            onPress={() => {
              hapticLight();
              onHideFiltersRow();
            }}
            style={({ pressed }) => [styles.toolbarRevealRow, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Hide filters and map options"
          >
            <MaterialCommunityIcons
              name="chevron-up"
              size={22}
              color={colors.black}
              style={styles.toolbarRevealIcon}
            />
            <Text style={styles.toolbarRevealText}>Hide filters & view</Text>
          </Pressable>
        </View>
      </Animated.View>
      {showCollapsedToolbarChrome ? (
        <>
          <View style={styles.toolbarMiniSummary}>
            <Text style={styles.toolbarMiniSummaryText} numberOfLines={1} ellipsizeMode="tail">
              {listToolbarCompactSummary}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              hapticLight();
              revealListToolbarFromCollapsed();
            }}
            style={({ pressed }) => [styles.toolbarRevealRow, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Show filters, list and map options"
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={22}
              color={colors.black}
              style={styles.toolbarRevealIcon}
            />
            <Text style={styles.toolbarRevealText}>Show filters & view</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
