import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View, Pressable, Linking, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NearbyStackParamList } from "../../navigation/RootNavigator";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { useAppTheme } from "../../context/ThemeContext";
import { prefetchQuizEventDetail } from "../../lib/quizEventDetailCache";
import { getTonightMode, setTonightMode as persistTonightMode } from "../../lib/tonightModeStorage";
import { getSortMode, setSortMode as persistSortMode, type SortMode } from "../../lib/sortStorage";
import { NearbyFiltersSheet, type FiltersState } from "../../components/NearbyFiltersSheet";
import { PaperGrainOverlay } from "../../components/PaperGrainOverlay";
import { QuizCard } from "../../components/QuizCard";
import { QuizListSkeleton } from "../../components/QuizListSkeleton";
import { NearbyMapView } from "../../components/NearbyMapView";
import { hapticLight, hapticMedium } from "../../lib/playerHaptics";
import { semantic, spacing } from "../../theme";
import {
  LOCATION_PRIVACY_PRIMARY,
  LOCATION_PRIVACY_SETTINGS,
  LOCATION_PRIVACY_TAP_SETTINGS,
} from "../../lib/legalUrls";
import { formatNearbyListInterestLabel } from "../../lib/quizEventInterestCount";
import { SEARCH_DEBOUNCE_MS } from "./nearby/nearbyConstants";
import { buildNearbyStyles } from "./nearby/nearbyScreenStyles";
import type { DistanceFilter, PrizeFilter } from "./nearby/nearbyTypes";
import { useNearbyLocation } from "./nearby/useNearbyLocation";
import { useNearbyQuizzes } from "./nearby/useNearbyQuizzes";
import { useNearbyFilteredQuizzes } from "./nearby/useNearbyFilteredQuizzes";
import { useNearbyListToolbarScroll } from "./nearby/useNearbyListToolbarScroll";
import { NearbyListToolbar } from "./nearby/NearbyListToolbar";
import { NearbyMapFloatingToolbar } from "./nearby/NearbyMapFloatingToolbar";
import { NearbySortModal } from "./nearby/NearbySortModal";

export default function NearbyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<NearbyStackParamList>>();
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSaved } = useSavedQuizzes();
  const { semantic, isDark } = useAppTheme();
  const { styles, sortModalStyles } = useMemo(
    () => buildNearbyStyles(semantic, isDark),
    [semantic, isDark]
  );

  const { locationPermission, referenceLocation, getMiles } = useNearbyLocation();
  const { quizzes, loading, errorMsg, refreshing, onRefreshList } = useNearbyQuizzes();

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [prizeFilter, setPrizeFilter] = useState<PrizeFilter>("all");
  const [maxFeePounds, setMaxFeePounds] = useState("");
  const [distanceFilterMiles, setDistanceFilterMiles] = useState<DistanceFilter>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("soonest");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [nearbyView, setNearbyView] = useState<"list" | "map">("list");
  const [tonightMode, setTonightModeState] = useState(true);

  const {
    showCollapsedToolbarChrome,
    quizListRef,
    listToolbarExpandableStyle,
    onListToolbarExpandableLayout,
    onListScroll,
    revealListToolbarFromCollapsed,
    setListFiltersUserHidden,
  } = useNearbyListToolbarScroll(nearbyView);

  const setTonightMode = useCallback((on: boolean) => {
    setTonightModeState(on);
    persistTonightMode(on).catch(() => {});
    if (on) {
      setSortBy("soonest");
      persistSortMode("soonest").catch(() => {});
    }
  }, []);

  const toggleTonight = useCallback(() => {
    if (!tonightMode) hapticMedium();
    else hapticLight();
    setTonightMode(!tonightMode);
  }, [tonightMode, setTonightMode]);

  useEffect(() => {
    let cancelled = false;
    getTonightMode().then((v) => {
      if (!cancelled) setTonightModeState(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSortMode().then((v) => {
      if (!cancelled) setSortBy(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = searchQuery;
    if (q.trim() === "") {
      setDebouncedSearchQuery("");
      return;
    }
    const id = setTimeout(() => setDebouncedSearchQuery(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const { filteredQuizzes, resultLine, listToolbarCompactSummary } = useNearbyFilteredQuizzes({
    quizzes,
    referenceLocation,
    getMiles,
    tonightMode,
    selectedDays,
    prizeFilter,
    maxFeePounds,
    distanceFilterMiles,
    savedOnly,
    isSaved,
    sortBy,
    debouncedSearchQuery,
    nearbyView,
  });

  const handleSortSelect = useCallback((mode: SortMode) => {
    setSortBy(mode);
    setSortModalVisible(false);
    persistSortMode(mode).catch(() => {});
  }, []);

  const applyFiltersFromModal = useCallback((f: FiltersState) => {
    setSelectedDays(f.selectedDays);
    setPrizeFilter(f.prizeFilter as PrizeFilter);
    setMaxFeePounds(f.maxFeePounds);
    setDistanceFilterMiles(f.distanceFilterMiles as DistanceFilter);
    setSavedOnly(f.savedOnly);
  }, []);

  const filtersState: FiltersState = {
    selectedDays,
    prizeFilter,
    distanceFilterMiles,
    maxFeePounds,
    savedOnly,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screenRoot} edges={["bottom", "left", "right"]}>
        <StatusBar style="dark" />
        <View style={[styles.bodyWrap, styles.bodyWrapList, { paddingTop: 0 }]}>
          <View style={[styles.listToolbar, { paddingTop: insets.top + spacing.md }]}>
            <Text style={styles.toolbarTitle}>Find a quiz</Text>
          </View>
          <View style={styles.flex1}>
            <PaperGrainOverlay stripeColor={semantic.textPrimary} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
              <QuizListSkeleton count={6} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screenRoot} edges={["bottom", "left", "right"]}>
      <StatusBar style="dark" />
      <View
        style={[
          styles.bodyWrap,
          nearbyView === "list" && styles.bodyWrapList,
          nearbyView === "map" && styles.bodyWrapMap,
          {
            paddingTop: nearbyView === "list" ? 0 : insets.top + spacing.md,
          },
        ]}
      >
        <View style={styles.flex1}>
          <PaperGrainOverlay stripeColor={semantic.textPrimary} />

          {errorMsg && (
            <View style={[styles.errorBanner, nearbyView === "map" && { marginHorizontal: spacing.lg }]}>
              <Text style={styles.errorBannerTitle}>Couldn’t load quizzes</Text>
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          {nearbyView === "list" ? (
            <NearbyListToolbar
              insetsTop={insets.top}
              styles={styles}
              semantic={semantic}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              nearbyView={nearbyView}
              showCollapsedToolbarChrome={showCollapsedToolbarChrome}
              listToolbarExpandableStyle={listToolbarExpandableStyle}
              onListToolbarExpandableLayout={onListToolbarExpandableLayout}
              tonightMode={tonightMode}
              onToggleTonight={toggleTonight}
              sortBy={sortBy}
              onOpenSort={() => setSortModalVisible(true)}
              onOpenFilters={() => setFiltersSheetVisible(true)}
              locationPermission={locationPermission}
              resultLine={resultLine}
              onHideFiltersRow={() => setListFiltersUserHidden(true)}
              revealListToolbarFromCollapsed={revealListToolbarFromCollapsed}
              listToolbarCompactSummary={listToolbarCompactSummary}
              onSetNearbyView={setNearbyView}
            />
          ) : (
            <>
              {locationPermission === "denied" && (
                <View style={{ paddingHorizontal: spacing.lg }}>
                  <Pressable onPress={() => Linking.openSettings()} style={styles.locationHint}>
                    <Text style={styles.locationHintText}>{LOCATION_PRIVACY_PRIMARY}</Text>
                    <Text style={styles.locationHintSubtext}>{LOCATION_PRIVACY_SETTINGS}</Text>
                    <Text style={[styles.locationHintSubtext, { marginTop: spacing.sm }]}>
                      {LOCATION_PRIVACY_TAP_SETTINGS}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {nearbyView === "list" ? (
            <Animated.FlatList
              ref={quizListRef}
              style={styles.list}
              data={filteredQuizzes}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              showsVerticalScrollIndicator={false}
              onScroll={onListScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefreshList}
                  tintColor={semantic.textPrimary}
                  colors={[semantic.accentYellow, semantic.textPrimary]}
                />
              }
              renderItem={({ item, index }) => {
                const miles = locationPermission !== "denied" && referenceLocation ? getMiles(item.venues) : null;
                const distanceLabel = miles != null ? `${miles.toFixed(1)} mi` : null;
                return (
                  <Animated.View entering={FadeInDown.delay(Math.min(index * 42, 400)).duration(340)}>
                    <QuizCard
                      quiz={item}
                      distanceLabel={distanceLabel}
                      isSaved={isSaved(item.id)}
                      onToggleSaved={() => toggleSaved(item.id)}
                      onPressIn={() => prefetchQuizEventDetail(item.id)}
                      onPress={() => navigation.navigate("QuizDetail", { quizEventId: item.id })}
                      isTonightMode={tonightMode}
                      showRank={sortBy === "distance"}
                      rank={sortBy === "distance" ? index + 1 : null}
                      interestPillLabel={formatNearbyListInterestLabel(item.interest_count, isSaved(item.id))}
                    />
                  </Animated.View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons
                    name={tonightMode ? "weather-night" : "map-search-outline"}
                    size={44}
                    color={semantic.textSecondary}
                  />
                  <Text style={styles.emptyTitle}>
                    {tonightMode ? "No quizzes on tonight’s list" : "Nothing matches yet"}
                  </Text>
                  <Text style={styles.emptyText}>
                    {tonightMode
                      ? "Turn off Tonight for the full week, relax filters, or clear search."
                      : "Widen filters, clear search, or check the map — your next quiz might be a street away."}
                  </Text>
                </View>
              }
            />
          ) : (
            <View style={styles.mapHost}>
              <NearbyMapView
                quizzes={filteredQuizzes}
                userLocation={referenceLocation}
                onSelectQuiz={(quizEventId) => {
                  prefetchQuizEventDetail(quizEventId);
                  navigation.navigate("QuizDetail", { quizEventId });
                }}
              />
              <NearbyMapFloatingToolbar
                styles={styles}
                semantic={semantic}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                nearbyView={nearbyView}
                showCollapsedToolbarChrome={showCollapsedToolbarChrome}
                onSetNearbyView={setNearbyView}
                tonightMode={tonightMode}
                onToggleTonight={toggleTonight}
                sortBy={sortBy}
                onOpenSort={() => setSortModalVisible(true)}
                onOpenFilters={() => setFiltersSheetVisible(true)}
                resultLine={resultLine}
              />
            </View>
          )}
        </View>
      </View>

      <NearbyFiltersSheet
        visible={filtersSheetVisible}
        onClose={() => setFiltersSheetVisible(false)}
        initialFilters={filtersState}
        onApply={applyFiltersFromModal}
        locationPermission={locationPermission}
        isTonightMode={tonightMode}
      />

      <NearbySortModal
        visible={sortModalVisible}
        sortBy={sortBy}
        sortModalStyles={sortModalStyles}
        onClose={() => setSortModalVisible(false)}
        onSelectSort={handleSortSelect}
      />
    </SafeAreaView>
  );
}
