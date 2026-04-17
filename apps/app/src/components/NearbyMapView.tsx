import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "../context/ThemeContext";
import { spacing, radius, borderWidth, shadow, typography, type SemanticTheme } from "../theme";
import type { MapQuizPin } from "./NearbyMapView.types";

export type { MapQuizPin } from "./NearbyMapView.types";

type Props = {
  quizzes: MapQuizPin[];
  userLocation: { lat: number; lng: number } | null;
  onSelectQuiz: (quizEventId: string) => void;
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

export function NearbyMapView({ quizzes, userLocation, onSelectQuiz }: Props) {
  const { semantic } = useAppTheme();
  const styles = useMemo(() => buildMapStyles(semantic), [semantic]);
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
      edgePadding: { top: 100, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [placemarks, userLocation]);

  useEffect(() => {
    if (!mapReady || placemarks.length === 0) return;
    const t = setTimeout(() => fitAll(), 400);
    return () => clearTimeout(t);
  }, [mapReady, placemarks, fitAll]);

  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

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
        >
          {placemarks.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              title={p.title}
              onPress={() => onSelectQuiz(p.id)}
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
    </View>
  );
}
