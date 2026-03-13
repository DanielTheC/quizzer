import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  View,
  ActivityIndicator,
  Pressable,
  TextInput,
  Linking,
  Modal,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NearbyStackParamList } from "../../navigation/RootNavigator";
import { useSavedQuizzes } from "../../context/SavedQuizzesContext";
import { haversineMiles } from "../../lib/haversine";
import { getTonightMode, setTonightMode as persistTonightMode } from "../../lib/tonightModeStorage";
import { getSortMode, setSortMode as persistSortMode, type SortMode } from "../../lib/sortStorage";
import { NearbyFiltersSheet, type FiltersState } from "../../components/NearbyFiltersSheet";
import { QuizCard } from "../../components/QuizCard";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

type LocationPermissionStatus = "granted" | "denied" | "undetermined";

type Venue = {
  name: string;
  address: string;
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type QuizEvent = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: Venue | null;
};

const PRIZE_OPTIONS = ["all", "cash", "bar_tab", "drinks", "voucher", "other"] as const;
const DISTANCE_MILES = [1, 3, 5, 10] as const;
type DistanceFilter = (typeof DISTANCE_MILES)[number] | null;

type PrizeFilter = (typeof PRIZE_OPTIONS)[number];

/** Parse start_time (e.g. "19:30", "19:30:00", "1930") to minutes since midnight for sorting. */
function startTimeToMinutes(s: string): number {
  const str = String(s).trim();
  const parts = str.split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export default function NearbyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<NearbyStackParamList>>();
  const { savedIds, isSaved, toggleSaved } = useSavedQuizzes();

  const [quizzes, setQuizzes] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [prizeFilter, setPrizeFilter] = useState<PrizeFilter>("all");
  const [maxFeePounds, setMaxFeePounds] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [distanceFilterMiles, setDistanceFilterMiles] = useState<DistanceFilter>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>("undetermined");
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tonightMode, setTonightModeState] = useState(false);
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("soonest");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTonightMode().then((v) => {
      if (!cancelled) setTonightModeState(v);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSortMode().then((v) => {
      if (!cancelled) setSortBy(v);
    });
    return () => { cancelled = true; };
  }, []);

  const setTonightMode = useCallback((on: boolean) => {
    setTonightModeState(on);
    persistTonightMode(on).catch(() => {});
    if (on) {
      setSortBy("soonest");
      persistSortMode("soonest").catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setLocationPermission(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          setDeviceLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch {
          if (!cancelled) setDeviceLocation(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const referenceLocation =
    locationPermission === "denied" ? null : (deviceLocation ?? userLatLng);

  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("quiz_events")
        .select(
          `
          id,
          day_of_week,
          start_time,
          entry_fee_pence,
          prize,
          venues (
            name,
            address,
            postcode,
            lat,
            lng
          )
        `
        )
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.log("Error loading quizzes:", error);
        setErrorMsg(error.message);
        setQuizzes([]);
      } else {
        setQuizzes((data as unknown as QuizEvent[]) ?? []);
      }

      setLoading(false);
    }

    fetchQuizzes();
  }, []);

  const getMiles = useCallback(
    (venue: Venue | null): number | null => {
      if (!referenceLocation || !venue) return null;
      const lat = venue.lat;
      const lng = venue.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return haversineMiles(referenceLocation.lat, referenceLocation.lng, lat, lng);
    },
    [referenceLocation]
  );

  const handleSortSelect = useCallback((mode: SortMode) => {
    setSortBy(mode);
    setSortModalVisible(false);
    persistSortMode(mode).catch(() => {});
  }, []);

  const searchLower = searchQuery.trim().toLowerCase();

  const filteredQuizzes = useMemo(() => {
    const matchesSearch = (q: QuizEvent) => {
      if (!searchLower) return true;
      const name = (q.venues?.name ?? "").toLowerCase();
      const address = (q.venues?.address ?? "").toLowerCase();
      const postcode = (q.venues?.postcode ?? "").toLowerCase();
      return name.includes(searchLower) || address.includes(searchLower) || postcode.includes(searchLower);
    };

    if (tonightMode) {
      const todayDow = new Date().getDay();
      let filtered = quizzes.filter((q) => q.day_of_week === todayDow && matchesSearch(q));
      return [...filtered].sort(
        (a, b) => startTimeToMinutes(a.start_time) - startTimeToMinutes(b.start_time)
      );
    }

    const parsed = Number(maxFeePounds.replace(",", "."));
    const maxFeePence =
      maxFeePounds.trim() === "" || !Number.isFinite(parsed)
        ? null
        : Math.round(parsed * 100);

    let filtered = quizzes.filter((q) => {
      if (!matchesSearch(q)) return false;
      if (selectedDays.length > 0 && !selectedDays.includes(q.day_of_week))
        return false;
      if (prizeFilter !== "all" && q.prize !== prizeFilter)
        return false;
      if (maxFeePence !== null && q.entry_fee_pence > maxFeePence)
        return false;
      if (distanceFilterMiles != null && referenceLocation) {
        const miles = getMiles(q.venues);
        if (miles == null || miles > distanceFilterMiles) return false;
      }
      if (savedOnly && !isSaved(q.id)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "distance" && referenceLocation) {
        const ma = getMiles(a.venues) ?? Infinity;
        const mb = getMiles(b.venues) ?? Infinity;
        if (ma !== mb) return ma - mb;
      }
      if (sortBy === "entry_fee") {
        if (a.entry_fee_pence !== b.entry_fee_pence) return a.entry_fee_pence - b.entry_fee_pence;
      }
      return (
        a.day_of_week - b.day_of_week ||
        String(a.start_time).localeCompare(String(b.start_time))
      );
    });
    return sorted;
  }, [tonightMode, quizzes, selectedDays, prizeFilter, maxFeePounds, distanceFilterMiles, referenceLocation, getMiles, savedOnly, isSaved, sortBy, searchLower]);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  }

  function clearFilters() {
    setSelectedDays([]);
    setPrizeFilter("all");
    setMaxFeePounds("");
    setPostcodeInput("");
    setUserLatLng(null);
    setGeocodeError(null);
    setDistanceFilterMiles(null);
    setSavedOnly(false);
  }

  const applyFiltersFromModal = useCallback((f: FiltersState) => {
    setSelectedDays(f.selectedDays);
    setPrizeFilter(f.prizeFilter as PrizeFilter);
    setMaxFeePounds(f.maxFeePounds);
    setDistanceFilterMiles(f.distanceFilterMiles as DistanceFilter);
    setSavedOnly(f.savedOnly);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={semantic.textPrimary} />
      </SafeAreaView>
    );
  }

  const filtersState: FiltersState = {
    selectedDays,
    prizeFilter,
    distanceFilterMiles,
    maxFeePounds,
    savedOnly,
  };

  return (
    <SafeAreaView style={[styles.screen, { padding: spacing.lg }]}>
      <Text style={styles.screenTitle}>Nearby Quizzes</Text>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setTonightMode(!tonightMode)}
          style={({ pressed }) => [styles.chip, tonightMode && styles.chipActive, pressed && styles.chipPressed]}
        >
          <Text style={{ fontSize: 16, marginRight: 6 }}>🔥</Text>
          <Text style={[styles.chipText, tonightMode && styles.chipTextActive]}>Tonight</Text>
        </Pressable>
        <Pressable
          onPress={() => (navigation.getParent() as { navigate: (name: string) => void } | undefined)?.navigate("Saved")}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.chipText}>Saved ({savedIds.length})</Text>
        </Pressable>
        <Pressable
          onPress={() => setSortModalVisible(true)}
          style={({ pressed }) => [styles.chip, sortBy !== "soonest" && styles.chipActive, pressed && styles.chipPressed]}
        >
          <Text style={[styles.chipText, sortBy !== "soonest" && styles.chipTextActive]}>
            Sort: {sortBy === "soonest" ? "Soonest" : sortBy === "distance" ? "Distance" : "Entry fee"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFiltersSheetVisible(true)}
          style={({ pressed }) => [styles.chipPrimary, pressed && styles.chipPressed]}
        >
          <Text style={styles.chipPrimaryText}>Filters</Text>
        </Pressable>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>Couldn’t load quizzes</Text>
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
        </View>
      )}

      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search area, venue or postcode"
        placeholderTextColor={colors.grey400}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {locationPermission === "denied" && (
        <Pressable onPress={() => Linking.openSettings()} style={styles.locationHint}>
          <Text style={styles.locationHintText}>Enable location to filter by distance and see miles.</Text>
          <Text style={styles.locationHintSubtext}>Tap to open Settings</Text>
        </Pressable>
      )}

      <Text style={styles.resultCount}>
        {tonightMode
          ? `Showing ${filteredQuizzes.length} quiz${filteredQuizzes.length !== 1 ? "zes" : ""} tonight`
          : `Showing ${filteredQuizzes.length} of ${quizzes.length}`}
      </Text>

      <FlatList
        style={styles.list}
        data={filteredQuizzes}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const miles = locationPermission !== "denied" && referenceLocation ? getMiles(item.venues) : null;
          const distanceLabel = miles != null ? `${miles.toFixed(1)} mi` : null;
          return (
            <QuizCard
              quiz={item}
              distanceLabel={distanceLabel}
              isSaved={isSaved(item.id)}
              onToggleSaved={() => toggleSaved(item.id)}
              onPress={() => navigation.navigate("QuizDetail", { quizEventId: item.id })}
              isTonightMode={tonightMode}
              showRank={sortBy === "distance"}
              rank={sortBy === "distance" ? index + 1 : null}
              labelNextUp={tonightMode && index === 0}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No quizzes match your filters.</Text>
        }
      />
      <NearbyFiltersSheet
        visible={filtersSheetVisible}
        onClose={() => setFiltersSheetVisible(false)}
        initialFilters={filtersState}
        onApply={applyFiltersFromModal}
        locationPermission={locationPermission}
        isTonightMode={tonightMode}
      />

      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable style={sortModalStyles.backdrop} onPress={() => setSortModalVisible(false)}>
          <View style={sortModalStyles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={sortModalStyles.title}>Sort by</Text>
            {(["soonest", "distance", "entry_fee"] as const).map((mode) => (
              <Pressable key={mode} style={({ pressed }) => [sortModalStyles.option, pressed && sortModalStyles.optionPressed]} onPress={() => handleSortSelect(mode)}>
                <Text style={[sortModalStyles.optionText, sortBy === mode && sortModalStyles.optionTextActive]}>
                  {mode === "soonest" ? "Soonest" : mode === "distance" ? "Distance" : "Entry fee"}
                </Text>
              </Pressable>
            ))}
            <Pressable style={sortModalStyles.cancel} onPress={() => setSortModalVisible(false)}>
              <Text style={sortModalStyles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: semantic.bgSecondary },
  screen: { flex: 1, backgroundColor: semantic.bgSecondary },
  screenTitle: { ...typography.displayMedium, marginBottom: spacing.md, color: semantic.textPrimary },
  chipRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgPrimary,
    ...shadow.small,
  },
  chipActive: { backgroundColor: semantic.bgInverse },
  chipPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  chipText: { ...typography.captionStrong, color: semantic.textPrimary },
  chipTextActive: { color: semantic.textInverse },
  chipPrimary: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentYellow,
    ...shadow.small,
  },
  chipPrimaryText: { ...typography.captionStrong, color: semantic.textPrimary },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.danger,
    marginBottom: spacing.md,
  },
  errorBannerTitle: { ...typography.bodyStrong, color: semantic.textInverse },
  errorBannerText: { marginTop: spacing.sm, color: semantic.textInverse },
  searchInput: {
    backgroundColor: semantic.bgPrimary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    ...typography.body,
  },
  locationHint: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: semantic.accentYellow,
    borderRadius: radius.small,
    borderWidth: borderWidth.thin,
    borderColor: semantic.borderPrimary,
  },
  locationHintText: { ...typography.caption, color: semantic.textPrimary },
  locationHintSubtext: { fontSize: 12, color: semantic.textSecondary, marginTop: spacing.xs },
  resultCount: { marginBottom: spacing.sm, ...typography.caption, color: semantic.textSecondary },
  list: { marginTop: spacing.md },
  emptyText: { marginTop: spacing.md, ...typography.body, color: semantic.textSecondary },
});

const sortModalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: spacing.xxl },
  sheet: {
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.xl,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    padding: spacing.xl,
    ...shadow.medium,
  },
  title: { ...typography.heading, marginBottom: spacing.md, color: semantic.textPrimary },
  option: { paddingVertical: spacing.md, borderBottomWidth: borderWidth.thin, borderBottomColor: colors.grey200 },
  optionPressed: { backgroundColor: colors.grey100 },
  optionText: { ...typography.body, color: semantic.textSecondary },
  optionTextActive: { ...typography.bodyStrong, color: semantic.textPrimary },
  cancel: { marginTop: spacing.md, paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { ...typography.body, color: semantic.textSecondary },
});

