import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useSavedQuizzes } from "../context/SavedQuizzesContext";
import { hapticLight, hapticSavedQuiz } from "../lib/playerHaptics";
import { spacing, radius, borderWidth, shadow, typography, type SemanticTheme } from "../theme";
import type { MapQuizPin } from "./NearbyMapView.types";

export type { MapQuizPin } from "./NearbyMapView.types";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayShort(day: number): string {
  return DAY_SHORT[day] ?? String(day);
}

function formatPreviewTime(time: string): string {
  const s = String(time);
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

function formatEntryFeeLine(pence: number): string {
  if (pence === 0) return "Free entry";
  return `Entry £${(pence / 100).toFixed(2)}`;
}

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
  });
}

/** Slight offset per quiz so stacked venues remain tappable. */
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

  useEffect(() => {
    if (sheetQuiz && !quizzes.some((q) => q.id === sheetQuiz.id)) {
      closeSheet();
    }
  }, [quizzes, sheetQuiz, closeSheet]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const placemarks = useMemo(() => {
    const out: { id: string; title: string; latitude: number; longitude: number }[] = [];
    for (const q of quizzes) {
      const v = q.venues;
      if (!v) continue;
      const lat = v.lat;
      const lng = v.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const { latitude, longitude } = jitterCoord(q.id, lat, lng);
      out.push({
        id: q.id,
        title: (v.name ?? "Quiz").trim() || "Quiz",
        latitude,
        longitude,
      });
    }
    return out;
  }, [quizzes]);

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
      const q = quizzes.find((x) => x.id === quizId);
      if (!q) return;
      if (sheetQuiz != null) {
        translateY.value = withSpring(0, SPRING_IN);
      }
      setSheetQuiz(q);
    },
    [quizzes, sheetQuiz, closeSheet, translateY]
  );

  const onToggleHeart = useCallback(() => {
    if (!sheetQuiz) return;
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
                <Text style={styles.sheetVenueName} numberOfLines={2}>
                  {sheetQuiz.venues?.name?.trim() || "Quiz night"}
                </Text>
                <Text style={styles.sheetDayTime}>
                  {dayShort(sheetQuiz.day_of_week)} · {formatPreviewTime(sheetQuiz.start_time)}
                </Text>
                <Text style={styles.sheetFee}>{formatEntryFeeLine(sheetQuiz.entry_fee_pence)}</Text>
                <View style={styles.sheetHint}>
                  <Text style={styles.sheetHintText}>Full details</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={semantic.textSecondary} />
                </View>
              </Pressable>
              <Pressable
                onPress={onToggleHeart}
                style={styles.heartBtn}
                hitSlop={12}
                accessibilityLabel={saved ? "Remove from saved" : "Save quiz"}
                accessibilityRole="button"
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
