import { useCallback, useEffect, useRef, useState } from "react";
import type { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  LIST_TOOLBAR_EXPAND_FALLBACK_PX,
  LIST_TOOLBAR_NEAR_TOP_PX,
  LIST_TOOLBAR_SCROLL_COLLAPSE_RANGE_MAX,
  LIST_SCROLL_DIRECTION_PX,
} from "./nearbyConstants";
import type { QuizEvent } from "./nearbyTypes";

export function useNearbyListToolbarScroll(nearbyView: "list" | "map") {
  const [listFiltersUserHidden, setListFiltersUserHidden] = useState(false);
  const [showCollapsedToolbarChrome, setShowCollapsedToolbarChrome] = useState(false);
  const listScrollYRef = useRef(0);
  const quizListRef = useRef<FlatList<QuizEvent>>(null);
  const listFiltersUserHiddenRef = useRef(false);

  const scrollY = useSharedValue(0);
  const filtersHiddenSV = useSharedValue(0);
  const expandableHeightSV = useSharedValue(LIST_TOOLBAR_EXPAND_FALLBACK_PX);

  useEffect(() => {
    listFiltersUserHiddenRef.current = listFiltersUserHidden;
  }, [listFiltersUserHidden]);

  useEffect(() => {
    filtersHiddenSV.value = listFiltersUserHidden ? 1 : 0;
  }, [listFiltersUserHidden, filtersHiddenSV]);

  useEffect(() => {
    if (nearbyView === "map") {
      setListFiltersUserHidden(false);
      scrollY.value = 0;
      listScrollYRef.current = 0;
    }
  }, [nearbyView, scrollY]);

  useEffect(() => {
    const y = listScrollYRef.current;
    const collapsedByScroll = y >= LIST_TOOLBAR_SCROLL_COLLAPSE_RANGE_MAX - 8;
    setShowCollapsedToolbarChrome(listFiltersUserHidden || collapsedByScroll);
  }, [listFiltersUserHidden]);

  const revealListToolbarFromCollapsed = useCallback(() => {
    setListFiltersUserHidden(false);
    requestAnimationFrame(() => {
      quizListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const onListToolbarExpandableLayout = useCallback(
    (ev: LayoutChangeEvent) => {
      const h = ev.nativeEvent.layout.height;
      if (h > 0) expandableHeightSV.value = h;
    },
    [expandableHeightSV]
  );

  const listToolbarExpandableStyle = useAnimatedStyle(() => {
    const h = Math.max(expandableHeightSV.value, 1);
    const fromScroll = interpolate(
      scrollY.value,
      [0, LIST_TOOLBAR_SCROLL_COLLAPSE_RANGE_MAX],
      [h, 0],
      Extrapolation.CLAMP
    );
    const maxH = filtersHiddenSV.value > 0.5 ? 0 : fromScroll;
    return {
      maxHeight: maxH,
      opacity: interpolate(maxH, [0, h * 0.25], [0, 1], Extrapolation.CLAMP),
      overflow: "hidden",
    };
  });

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - listScrollYRef.current;
      listScrollYRef.current = y;
      scrollY.value = y;

      const collapsedByScroll = y >= LIST_TOOLBAR_SCROLL_COLLAPSE_RANGE_MAX - 8;
      const nextChrome = listFiltersUserHiddenRef.current || collapsedByScroll;
      setShowCollapsedToolbarChrome((prev) => (prev === nextChrome ? prev : nextChrome));

      if (y < LIST_TOOLBAR_NEAR_TOP_PX) {
        setListFiltersUserHidden(false);
        return;
      }
      if (dy < -LIST_SCROLL_DIRECTION_PX) {
        setListFiltersUserHidden(false);
      }
    },
    [scrollY]
  );

  return {
    listFiltersUserHidden,
    setListFiltersUserHidden,
    showCollapsedToolbarChrome,
    quizListRef,
    listToolbarExpandableStyle,
    onListToolbarExpandableLayout,
    onListScroll,
    revealListToolbarFromCollapsed,
  };
}
