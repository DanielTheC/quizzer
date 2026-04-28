import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { hapticLight, hapticSavedQuiz } from "../lib/playerHaptics";
import {
  dayShort,
  formatTime24 as formatPreviewTime,
  formatEntryFeeLine,
} from "../lib/formatters";

/** "2026-04-28" → "Tue 28 Apr" */
function formatOccurrenceDayLabel(occurrenceDate: string): string {
  const [y, m, d] = (occurrenceDate ?? "").split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return occurrenceDate;
  const dt = new Date(Date.UTC(y as number, (m as number) - 1, d as number));
  const weekday = dayShort(dt.getUTCDay());
  const day = dt.getUTCDate();
  const month = dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}
import { spacing, radius, borderWidth, shadow, typography, type SemanticTheme } from "../theme";
import type { MapQuizPin } from "./NearbyMapView.types";

export type { MapQuizPin } from "./NearbyMapView.types";

const SHEET_HIDDEN = 320;
const SPRING_IN = { damping: 22, stiffness: 280 };
const SPRING_OUT = { damping: 26, stiffness: 280 };

type Props = {
  quizzes: MapQuizPin[];
  userLocation: { lat: number; lng: number } | null;
  /** Called when the user opens full quiz detail from the preview card. */
  onOpenQuizDetail: (quizEventId: string) => void;
};

function buildMapStyles(semantic: SemanticTheme) {
  return StyleSheet.create({
    wrap: { flex: 1, minHeight: 320, borderRadius: radius.large, overflow: "hidden", ...shadow.small },
    map: { ...StyleSheet.absoluteFillObject },
    markerBubble: {
      backgroundColor: semantic.accentYellow,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.small,
      padding: 4,
      ...shadow.small,
    },
    recenterBtn: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.medium,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      ...shadow.small,
    },
    recenterPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
    recenterText: { marginLeft: spacing.xs, ...typography.captionStrong, color: semantic.textPrimary },
    emptyOverlay: {
      flex: 1,
      minHeight: 280,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.large,
    },
    emptyTitle: { marginTop: spacing.md, ...typography.heading, color: semantic.textPrimary },
    emptyText: { marginTop: spacing.sm, textAlign: "center", ...typography.body, color: semantic.textSecondary },
    sheetOuter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "box-none",
    },
    sheetCard: {
      marginHorizontal: spacing.md,
      backgroundColor: semantic.bgPrimary,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      borderRadius: radius.large,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      ...shadow.medium,
    },
    sheetAccent: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 6,
      borderTopLeftRadius: radius.large,
      borderTopRightRadius: radius.large,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: semantic.borderPrimary,
    },
    sheetRowTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    sheetMainPress: {
      flex: 1,
      minWidth: 0,
    },
    sheetVenueName: {
      flex: 1,
      minWidth: 0,
      ...typography.bodyStrong,
      fontSize: 18,
      color: semantic.textPrimary,
    },
    heartBtn: {
      padding: spacing.xs,
      marginTop: -spacing.xs,
      marginRight: -spacing.xs,
    },
    sheetDayTime: {
      marginTop: spacing.sm,
      ...typography.body,
      fontSize: 15,
      fontWeight: "600",
      color: semantic.textSecondary,
    },
    sheetFee: {
      marginTop: spacing.xs,
      ...typography.body,
      fontSize: 15,
      fontWeight: "700",
      color: semantic.textPrimary,
    },
    sheetHint: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    sheetHintText: {
      ...typography.captionStrong,
      fontSize: 13,
      color: semantic.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sheetTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    sheetCadencePill: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.small,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentYellow,
    },
    sheetCadencePillText: {
      ...typography.captionStrong,
      fontSize: 10,
      letterSpacing: 0.9,
      color: semantic.textPrimary,
      textTransform: "uppercase",
    },
    sheetMetaRow: {
      marginTop: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    sheetMetaText: {
      ...typography.captionStrong,
      fontSize: 12,
      color: semantic.textSecondary,
    },
    sheetCancelledPill: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.small,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.accentRed,
    },
    sheetCancelledPillText: {
      ...typography.captionStrong,
      fontSize: 10,
      letterSpacing: 1,
      color: "#fff",
      textTransform: "uppercase",
    },
    sheetNoHostPill: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.small,
      borderWidth: borderWidth.default,
      borderColor: semantic.borderPrimary,
      backgroundColor: semantic.bgSecondary,
    },
    sheetNoHostPillText: {
      ...typography.captionStrong,
      fontSize: 10,
      letterSpacing: 0.8,
      color: semantic.textPrimary,
      textTransform: "uppercase",
    },
    heartBtnDisabled: { opacity: 0.45 },
  });
}

/** ~11 m bucket — quizzes sharing the same bucket are treated as the same pin location. */
function venueCoordBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Slight spread per quiz so overlapping markers at one venue remain tappable. Unused when alone. */
function jitterCoord(quizId: string, lat: number, lng: number): { latitude: number; longitude: number } {
  let sum = 0;
  for (let i = 0; i < quizId.length; i++) sum = (sum + quizId.charCodeAt(i)) % 9973;
  const angle = (sum % 360) * (Math.PI / 180);
  const d = 0.00028;
  return {
    latitude: lat + Math.cos(angle) * d,
    longitude: lng + Math.sin(angle) * d,
  };
}

const UK_FALLBACK: Region = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

export function NearbyMapView({ quizzes, userLocation, onOpenQuizDetail }: Props) {
  const { semantic } = useAppTheme();
  const styles = useMemo(() => buildMapStyles(semantic), [semantic]);
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSaved } = useSavedQuizzes();
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [sheetQuiz, setSheetQuiz] = useState<MapQuizPin | null>(null);
  const wasOpenRef = useRef(false);
  const translateY = useSharedValue(SHEET_HIDDEN);

  const onSheetFullyClosed = useCallback(() => {
    setSheetQuiz(null);
    wasOpenRef.current = false;
  }, []);

  const closeSheet = useCallback(() => {
    if (sheetQuiz == null) return;
    translateY.value = withSpring(SHEET_HIDDEN, SPRING_OUT, (finished) => {
      if (finished) runOnJS(onSheetFullyClosed)();
    });
  }, [sheetQuiz, onSheetFullyClosed, translateY]);

  useLayoutEffect(() => {
    if (!sheetQuiz) return;
    if (!wasOpenRef.current) {
      translateY.value = SHEET_HIDDEN;
      translateY.value = withSpring(0, SPRING_IN);
    }
    wasOpenRef.current = true;
  }, [sheetQuiz?.id, translateY]);

  /** One pin per series: keep the earliest upcoming occurrence for each quiz_event_id. */
  const nextByQuizEvent = useMemo(() => {
    const byId = new Map<string, MapQuizPin>();
    for (const q of quizzes) {
      const prev = byId.get(q.id);
      if (!prev || String(q.occurrence_date) < String(prev.occurrence_date)) {
        byId.set(q.id, q);
      }
    }
    return Array.from(byId.values());
  }, [quizzes]);

  useEffect(() => {
    if (sheetQuiz && !nextByQuizEvent.some((q) => q.id === sheetQuiz.id)) {
      closeSheet();
    }
  }, [nextByQuizEvent, sheetQuiz, closeSheet]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const placemarks = useMemo(() => {
    type Row = {
      quizId: string;
      title: string;
      lat: number;
      lng: number;
    };
    const raw: Row[] = [];
    for (const q of nextByQuizEvent) {
      const v = q.venues;
      if (!v) continue;
      const lat = v.lat;
      const lng = v.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      raw.push({
        quizId: q.id,
        title: (v.name ?? "Quiz").trim() || "Quiz",
        lat,
        lng,
      });
    }
    const counts = new Map<string, number>();
    for (const r of raw) {
      const k = venueCoordBucketKey(r.lat, r.lng);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const out: { id: string; title: string; latitude: number; longitude: number }[] = [];
    for (const r of raw) {
      const needJitter = (counts.get(venueCoordBucketKey(r.lat, r.lng)) ?? 0) > 1;
      const { latitude, longitude } = needJitter
        ? jitterCoord(r.quizId, r.lat, r.lng)
        : { latitude: r.lat, longitude: r.lng };
      out.push({ id: r.quizId, title: r.title, latitude, longitude });
    }
    return out;
  }, [nextByQuizEvent]);

  const initialRegion = useMemo((): Region => {
    if (userLocation) {
      return {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.09,
        longitudeDelta: 0.09,
      };
    }
    if (placemarks.length > 0) {
      const lat = placemarks.reduce((s, p) => s + p.latitude, 0) / placemarks.length;
      const lng = placemarks.reduce((s, p) => s + p.longitude, 0) / placemarks.length;
      return { latitude: lat, longitude: lng, latitudeDelta: 0.14, longitudeDelta: 0.14 };
    }
    return UK_FALLBACK;
  }, [userLocation, placemarks]);

  const fitAll = useCallback(() => {
    if (!mapRef.current) return;
    const coords = placemarks.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (userLocation) coords.push({ latitude: userLocation.lat, longitude: userLocation.lng });
    if (coords.length === 0) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 100, right: 48, bottom: 120, left: 48 },
      animated: true,
    });
  }, [placemarks, userLocation]);

  useEffect(() => {
    if (!mapReady || placemarks.length === 0) return;
    const t = setTimeout(() => fitAll(), 400);
    return () => clearTimeout(t);
  }, [mapReady, placemarks, fitAll]);

  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

  const openDetailFromSheet = useCallback(() => {
    if (!sheetQuiz) return;
    onOpenQuizDetail(sheetQuiz.id);
  }, [sheetQuiz, onOpenQuizDetail]);

  const onMarkerPress = useCallback(
    (quizId: string) => {
      if (sheetQuiz?.id === quizId) {
        closeSheet();
        return;
      }
      const q = nextByQuizEvent.find((x) => x.id === quizId);
      if (!q) return;
      if (sheetQuiz != null) {
        translateY.value = withSpring(0, SPRING_IN);
      }
      setSheetQuiz(q);
    },
    [nextByQuizEvent, sheetQuiz, closeSheet, translateY]
  );

  const onToggleHeart = useCallback(() => {
    if (!sheetQuiz || sheetQuiz.cancelled) return;
    if (isSaved(sheetQuiz.id)) hapticLight();
    else hapticSavedQuiz();
    toggleSaved(sheetQuiz.id);
  }, [sheetQuiz, isSaved, toggleSaved]);

  const saved = sheetQuiz != null && isSaved(sheetQuiz.id);

  return (
    <View style={styles.wrap}>
      {placemarks.length === 0 ? (
        <View style={styles.emptyOverlay}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={semantic.textSecondary} />
          <Text style={styles.emptyTitle}>No mappable quizzes</Text>
          <Text style={styles.emptyText}>
            Nothing in your current filters has a venue with coordinates. Try widening filters or check venue data in
            Supabase.
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={mapProvider}
          initialRegion={initialRegion}
          showsUserLocation={!!userLocation}
          showsMyLocationButton={false}
          onMapReady={() => setMapReady(true)}
          onPress={() => closeSheet()}
        >
          {placemarks.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              title={p.title}
              onPress={() => onMarkerPress(p.id)}
            >
              <View style={styles.markerBubble}>
                <MaterialCommunityIcons name="glass-mug-variant" size={14} color={semantic.textPrimary} />
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {placemarks.length > 0 ? (
        <Pressable onPress={fitAll} style={({ pressed }) => [styles.recenterBtn, pressed && styles.recenterPressed]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={semantic.textPrimary} />
          <Text style={styles.recenterText}>Fit all</Text>
        </Pressable>
      ) : null}

      {sheetQuiz ? (
        <Animated.View
          style={[
            styles.sheetOuter,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
            sheetAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.sheetCard}>
            <View style={[styles.sheetAccent, { backgroundColor: semantic.accentYellow }]} />
            <View style={[styles.sheetRowTop, { paddingTop: spacing.md + 4 }]}>
              <Pressable
                onPress={openDetailFromSheet}
                style={styles.sheetMainPress}
                accessibilityRole="button"
                accessibilityLabel={`${sheetQuiz.venues?.name ?? "Quiz"}, open full details`}
              >
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetVenueName} numberOfLines={2}>
                    {sheetQuiz.venues?.name?.trim() || "Quiz night"}
                  </Text>
                  {sheetQuiz.cadence_pill_label ? (
                    <View style={styles.sheetCadencePill}>
                      <Text style={styles.sheetCadencePillText} numberOfLines={1}>
                        {sheetQuiz.cadence_pill_label}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.sheetDayTime}>
                  {formatOccurrenceDayLabel(sheetQuiz.occurrence_date)} · {formatPreviewTime(sheetQuiz.start_time)}
                </Text>
                <Text style={styles.sheetFee}>{formatEntryFeeLine(sheetQuiz.entry_fee_pence)}</Text>
                <View style={styles.sheetMetaRow}>
                  {sheetQuiz.cancelled ? (
                    <View style={styles.sheetCancelledPill}>
                      <Text style={styles.sheetCancelledPillText}>Cancelled</Text>
                    </View>
                  ) : null}
                  {!sheetQuiz.cancelled && sheetQuiz.interest_count > 0 ? (
                    <Text style={styles.sheetMetaText}>{sheetQuiz.interest_count} going</Text>
                  ) : null}
                  {!sheetQuiz.has_host && !sheetQuiz.cancelled ? (
                    <View style={styles.sheetNoHostPill}>
                      <Text style={styles.sheetNoHostPillText}>No host yet</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.sheetHint}>
                  <Text style={styles.sheetHintText}>Full details</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={semantic.textSecondary} />
                </View>
              </Pressable>
              <Pressable
                onPress={onToggleHeart}
                style={[styles.heartBtn, sheetQuiz.cancelled && styles.heartBtnDisabled]}
                hitSlop={12}
                accessibilityLabel={saved ? "Remove from saved" : "Save quiz"}
                accessibilityRole="button"
                accessibilityState={sheetQuiz.cancelled ? { disabled: true } : undefined}
                disabled={sheetQuiz.cancelled}
              >
                <MaterialCommunityIcons
                  name={saved ? "heart" : "heart-outline"}
                  size={26}
                  color={saved ? semantic.accentRed : semantic.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
