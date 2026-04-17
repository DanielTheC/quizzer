import React from "react";
import { Pressable, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { hapticLight } from "../../../lib/playerHaptics";
import { colors, type SemanticTheme } from "../../../theme";
import type { NearbyScreenStyles } from "./nearbyScreenStyles";

type Props = {
  styles: NearbyScreenStyles;
  semantic: SemanticTheme;
  nearbyView: "list" | "map";
  onSetNearbyView: (mode: "list" | "map") => void;
  tonightMode: boolean;
  onToggleTonight: () => void;
};

export function NearbyMapFloatingToolbar({
  styles,
  semantic,
  nearbyView,
  onSetNearbyView,
  tonightMode,
  onToggleTonight,
}: Props) {
  return (
    <View style={styles.mapToolbarOverlay} pointerEvents="box-none">
      <View style={styles.mapToolbarCard} pointerEvents="auto">
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
            <Text style={[styles.viewModeToggleLabel, nearbyView === "list" && styles.viewModeToggleLabelActive]}>
              List
            </Text>
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
            <Text style={[styles.viewModeToggleLabel, nearbyView === "map" && styles.viewModeToggleLabelActive]}>
              Map
            </Text>
          </Pressable>
        </View>
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
      </View>
    </View>
  );
}
