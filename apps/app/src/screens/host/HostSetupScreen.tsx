import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { supabase } from "../../lib/supabase";
import { getLatestPackOrFallback } from "../../lib/quizPack";
import type { QuizPack } from "../../lib/quizPack";
import {
  getLastVenueId,
  setLastVenueId,
  getLastPackId,
  setLastPackId,
} from "../../lib/hostSetupStorage";
import { loadRunQuizState } from "../../lib/runQuizStorage";

type VenueRow = {
  id: string;
  name: string;
  address: string;
  postcode: string | null;
};

export default function HostSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [pack, setPack] = useState<QuizPack | null>(null);
  const [packLoading, setPackLoading] = useState(true);
  const [hasResumable, setHasResumable] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight}>
          <Text style={styles.headerRightText}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address, postcode")
        .order("name", { ascending: true });
      if (!cancelled) {
        setVenues((data as VenueRow[]) ?? []);
        setVenuesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLastVenueId().then((id) => {
      if (!cancelled) setSelectedVenueId(id);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLatestPackOrFallback().then((p) => {
      if (!cancelled) setPack(p);
      if (!cancelled) setPackLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRunQuizState().then((state) => {
      if (!cancelled) setHasResumable(state != null && state.teams.length > 0);
    });
    return () => { cancelled = true; };
  }, []);

  const selectVenue = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
    setLastVenueId(venueId).catch(() => {});
  }, []);

  const startQuizNight = useCallback(() => {
    if (!pack) return;
    const venueId = selectedVenueId ?? undefined;
    setLastVenueId(venueId || "").catch(() => {});
    setLastPackId(pack.id).catch(() => {});
    navigation.navigate("RunQuiz", {
      mode: "new",
      packId: pack.id,
      venueId: venueId || undefined,
    });
  }, [navigation, pack, selectedVenueId]);

  const resume = useCallback(() => {
    navigation.navigate("RunQuiz", { mode: "resume" });
  }, [navigation]);

  const canStart = pack != null && selectedVenueId != null && selectedVenueId.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>Venue</Text>
        {venuesLoading ? (
          <ActivityIndicator size="small" style={styles.loader} />
        ) : venues.length === 0 ? (
          <Text style={styles.hint}>No venues in database. Add venues in Supabase.</Text>
        ) : (
          <View style={styles.venueList}>
            {venues.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.venueRow, selectedVenueId === v.id && styles.venueRowSelected]}
                onPress={() => selectVenue(v.id)}
              >
                <Text style={styles.venueName}>{v.name}</Text>
                {v.address ? <Text style={styles.venueAddress}>{v.address}</Text> : null}
                {v.postcode ? <Text style={styles.venuePostcode}>{v.postcode}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.sectionLabelTop]}>Quiz pack</Text>
        {packLoading ? (
          <ActivityIndicator size="small" style={styles.loader} />
        ) : pack ? (
          <View style={styles.packRow}>
            <Text style={styles.packName}>{pack.name}</Text>
            <Text style={styles.packHint}>Latest pack</Text>
          </View>
        ) : (
          <Text style={styles.hint}>No pack loaded.</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, !canStart && styles.primaryButtonDisabled]}
            onPress={startQuizNight}
            disabled={!canStart}
          >
            <Text style={styles.primaryButtonText}>Start quiz night</Text>
          </Pressable>
          {hasResumable && (
            <Pressable style={styles.secondaryButton} onPress={resume}>
              <Text style={styles.secondaryButtonText}>Resume quiz</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  headerRight: { padding: 8, marginRight: 8 },
  headerRightText: { fontSize: 16, color: "#2563eb", fontWeight: "500" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#64748b", textTransform: "uppercase", marginBottom: 8 },
  sectionLabelTop: { marginTop: 24 },
  loader: { marginVertical: 12 },
  hint: { fontSize: 14, color: "#94a3b8", marginBottom: 12 },
  venueList: { marginBottom: 8 },
  venueRow: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  venueRowSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  venueName: { fontSize: 16, fontWeight: "600", color: "#111" },
  venueAddress: { fontSize: 14, color: "#64748b", marginTop: 4 },
  venuePostcode: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  packRow: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  packName: { fontSize: 16, fontWeight: "600", color: "#111" },
  packHint: { fontSize: 13, color: "#64748b", marginTop: 4 },
  actions: { marginTop: 32 },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#334155", fontSize: 18, fontWeight: "600" },
});
