import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type { SortMode } from "../../../lib/sortStorage";
import type { NearbySortModalStyles } from "./nearbyScreenStyles";

type Props = {
  visible: boolean;
  sortBy: SortMode;
  sortModalStyles: NearbySortModalStyles;
  onClose: () => void;
  onSelectSort: (mode: SortMode) => void;
};

export function NearbySortModal({ visible, sortBy, sortModalStyles, onClose, onSelectSort }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={sortModalStyles.backdrop} onPress={onClose}>
        <View style={sortModalStyles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={sortModalStyles.title}>Sort by</Text>
          {(["soonest", "distance", "entry_fee"] as const).map((mode) => (
            <Pressable
              key={mode}
              style={({ pressed }) => [sortModalStyles.option, pressed && sortModalStyles.optionPressed]}
              onPress={() => onSelectSort(mode)}
            >
              <Text style={[sortModalStyles.optionText, sortBy === mode && sortModalStyles.optionTextActive]}>
                {mode === "soonest" ? "Soonest" : mode === "distance" ? "Distance" : "Entry fee"}
              </Text>
            </Pressable>
          ))}
          <Pressable style={sortModalStyles.cancel} onPress={onClose}>
            <Text style={sortModalStyles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
