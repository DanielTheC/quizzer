import React from "react";
import { TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SemanticTheme } from "../../../theme";
import type { NearbyScreenStyles } from "./nearbyScreenStyles";

type Props = {
  styles: NearbyScreenStyles;
  semantic: SemanticTheme;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  nearbyView: "list" | "map";
  showCollapsedToolbarChrome: boolean;
};

export function NearbySearchField({
  styles,
  semantic,
  searchQuery,
  onSearchQueryChange,
  nearbyView,
  showCollapsedToolbarChrome,
}: Props) {
  return (
    <View
      style={[
        styles.searchWrap,
        nearbyView === "list" && showCollapsedToolbarChrome && styles.searchWrapListCollapsed,
      ]}
    >
      <MaterialCommunityIcons name="magnify" size={22} color={semantic.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        placeholder="Search area, venue or postcode"
        placeholderTextColor={semantic.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
