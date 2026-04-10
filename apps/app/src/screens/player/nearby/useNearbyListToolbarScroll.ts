import { useCallback, useEffect, useRef, useState } from "react";
import type { FlatList, LayoutChangeEvent } from "react-native";
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LIST_TOOLBAR_EXPAND_FALLBACK_PX, LIST_TOOLBAR_NEAR_TOP_PX, LIST_SCROLL_DIRECTION_PX } from "./nearbyConstants";
import type { QuizEvent } from "./nearbyTypes";

const EXPAND_ANIM_MS = 220;

export function useNearbyListToolbarScroll(nearbyView: "list" | "map") {
  const [listFiltersUserHidden, setListFiltersUserHidden] = useState(false);
  const quizListRef = useRef<FlatList<QuizEvent>>(null);

  const lastY = useSharedValue(0);
  const filtersHiddenSV = useSharedValue(0);
  const expandableHeightSV = useSharedValue(LIST_TOOLBAR_EXPAND_FALLBACK_PX);
  /** 0 = visually collapsed, 1 = full expandable height — animated on manual hide only. */
  const expandVisualSV = useSharedValue(1);

  const revealFiltersRow = useCallback(() => {
    setListFiltersUserHidden((hidden) => (hidden ? false : hidden));
  }, []);

  useEffect(() => {
    filtersHiddenSV.value = listFiltersUserHidden ? 1 : 0;
  }, [listFiltersUserHidden, filtersHiddenSV]);

  useEffect(() => {
    if (nearbyView === "map") {
      setListFiltersUserHidden(false);
      lastY.value = 0;
      expandVisualSV.value = 1;
    }
  }, [nearbyView, lastY, expandVisualSV]);

  useAnimatedReaction(
    () => (filtersHiddenSV.value > 0.5 ? 0 : 1),
    (targetOpen, prevOpen) => {
      if (prevOpen === null) {
        expandVisualSV.value = targetOpen;
        return;
      }
      if (targetOpen === prevOpen) return;
      expandVisualSV.value = withTiming(targetOpen, { duration: EXPAND_ANIM_MS });
    }
  );

  const revealListToolbarFromCollapsed = useCallback(() => {
    setListFiltersUserHidden(false);
    requestAnimationFrame(() => {
      quizListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const onListToolbarExpandableLayout = useCallback(
    (ev: LayoutChangeEvent) => {
      const h = ev.nativeEvent.layout.height;
      if (h >= 40) expandableHeightSV.value = h;
    },
    [expandableHeightSV]
  );

  const listToolbarExpandableStyle = useAnimatedStyle(() => {
    const h = Math.max(expandableHeightSV.value, 1);
    const clipH = expandVisualSV.value * h;
    return {
      height: clipH,
      overflow: "hidden",
    };
  });

  /** Auto-expand filters when user scrolls back near the top (header is part of list content). */
  const listScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;

      if (y < LIST_TOOLBAR_NEAR_TOP_PX) {
        if (filtersHiddenSV.value > 0.5) {
          runOnJS(revealFiltersRow)();
        }
        return;
      }
      if (dy < -LIST_SCROLL_DIRECTION_PX && filtersHiddenSV.value > 0.5) {
        runOnJS(revealFiltersRow)();
      }
    },
  });

  return {
    listFiltersUserHidden,
    setListFiltersUserHidden,
    quizListRef,
    listToolbarExpandableStyle,
    onListToolbarExpandableLayout,
    listScrollHandler,
    revealListToolbarFromCollapsed,
  };
}
