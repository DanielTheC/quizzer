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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HostStackParamList } from "../../navigation/RootNavigator";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { fetchIsAllowlistedHost } from "../../lib/hostAccess";
import { getLatestPackOrFallback } from "../../lib/quizPack";
import type { QuizPack } from "../../lib/quizPack";
import {
  getLastVenueId,
  setLastVenueId,
  setLastPackId,
} from "../../lib/hostSetupStorage";
import { loadRunQuizState } from "../../lib/runQuizStorage";
import { ScreenTitle } from "../../components/ScreenTitle";
import { colors, semantic, spacing, radius, borderWidth, shadow, typography } from "../../theme";

type VenueRow = {
  id: string;
  name: string;
  address: string;
  postcode: string | null;
};

export default function HostSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList>>();
  const { session } = useAuth();
  const [gateReady, setGateReady] = useState(false);
  const [isAllowlisted, setIsAllowlisted] = useState(false);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [pack, setPack] = useState<QuizPack | null>(null);
  const [packLoading, setPackLoading] = useState(true);
  const [hasResumable, setHasResumable] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerBackVisible: false,
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.headerRight} accessibilityLabel="Settings">
          <MaterialCommunityIcons name="cog-outline" size={24} color={semantic.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const v = await fetchIsAllowlistedHost(session);
        if (!active) return;
        setIsAllowlisted(v === true);
        setGateReady(true);
      })();
      return () => {
        active = false;
      };
    }, [session])
  );

  useEffect(() => {
    if (!gateReady || !isAllowlisted) return;
    let cancelled = false;
    setVenuesLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("venues")
        .select("id, name, address, postcode")
        .order("name", { ascending: true });
      if (!cancelled) {
        setVenues((data as VenueRow[]) ?? []);
        setVenuesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateReady, isAllowlisted]);

  useEffect(() => {
    if (!gateReady || !isAllowlisted) return;
    let cancelled = false;
    getLastVenueId().then((id) => {
      if (!cancelled) setSelectedVenueId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [gateReady, isAllowlisted]);

  useEffect(() => {
    if (!gateReady || !isAllowlisted) return;
    let cancelled = false;
    setPackLoading(true);
    getLatestPackOrFallback().then((p) => {
      if (!cancelled) setPack(p);
      if (!cancelled) setPackLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gateReady, isAllowlisted]);

  useEffect(() => {
    if (!gateReady || !isAllowlisted) return;
    let cancelled = false;
    loadRunQuizState().then((state) => {
      if (!cancelled) setHasResumable(state != null && state.teams.length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [gateReady, isAllowlisted]);

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

  const recheckAccess = useCallback(() => {
    setGateReady(false);
    void (async () => {
      const v = await fetchIsAllowlistedHost(session);
      setIsAllowlisted(v === true);
      setGateReady(true);
    })();
  }, [session]);

  const canStart = pack != null && selectedVenueId != null && selectedVenueId.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {!gateReady ? (
        <View style={styles.gateLoading}>
          <ActivityIndicator size="large" color={semantic.textPrimary} />
        </View>
      ) : !isAllowlisted ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScreenTitle subtitle="Host tools unlock quiz packs, answers, and venue dashboards once your email is approved.">
            Host setup
          </ScreenTitle>
          <View style={styles.gateCard}>
            <MaterialCommunityIcons name="account-key-outline" size={36} color={semantic.textPrimary} style={styles.gateIcon} />
            <Text style={styles.gateTitle}>Host access required</Text>
            <Text style={styles.gateBody}>
              New hosts can request access with a short form. If you’ve already been approved, tap refresh below.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.applyPrimary, pressed && styles.btnPressed]}
              onPress={() => navigation.navigate("HostApply")}
              accessibilityRole="button"
              accessibilityLabel="Apply for host access"
            >
              <Text style={styles.applyPrimaryText}>Apply for host access</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.applySecondary, pressed && styles.btnPressed]}
              onPress={recheckAccess}
              accessibilityRole="button"
              accessibilityLabel="Refresh host access status"
            >
              <Text style={styles.applySecondaryText}>I’ve been approved — refresh</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScreenTitle subtitle="Choose a venue and pack, then start the night.">Host setup</ScreenTitle>

          <Pressable
            style={({ pressed }) => [styles.dashboardLink, pressed && styles.btnPressed]}
            onPress={() => navigation.navigate("HostDashboard")}
            accessibilityLabel="Open listings and interest dashboard"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="chart-box-outline" size={22} color={semantic.textPrimary} />
            <View style={styles.dashboardLinkTextWrap}>
              <Text style={styles.dashboardLinkTitle}>Listings & interest</Text>
              <Text style={styles.dashboardLinkHint}>Counts, capacity notes, cancellation</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={semantic.textSecondary} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Venue</Text>
            {venuesLoading ? (
              <ActivityIndicator size="small" color={semantic.textPrimary} style={styles.loader} />
            ) : venues.length === 0 ? (
              <Text style={styles.hint}>No venues in database. Add venues in Supabase.</Text>
            ) : (
              <View style={styles.venueList}>
                {venues.map((v) => (
                  <Pressable
                    key={v.id}
                    style={({ pressed }) => [
                      styles.venueRow,
                      selectedVenueId === v.id && styles.venueRowSelected,
                      pressed && styles.venueRowPressed,
                    ]}
                    onPress={() => selectVenue(v.id)}
                  >
                    <Text style={styles.venueName}>{v.name}</Text>
                    {v.address ? <Text style={styles.venueAddress}>{v.address}</Text> : null}
                    {v.postcode ? <Text style={styles.venuePostcode}>{v.postcode}</Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quiz pack</Text>
            {packLoading ? (
              <ActivityIndicator size="small" color={semantic.textPrimary} style={styles.loader} />
            ) : pack ? (
              <View style={styles.packRow}>
                <Text style={styles.packName}>{pack.name}</Text>
                <Text style={styles.packHint}>Latest pack</Text>
              </View>
            ) : (
              <Text style={styles.hint}>No pack loaded.</Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, !canStart && styles.primaryButtonDisabled, pressed && canStart && styles.btnPressed]}
              onPress={startQuizNight}
              disabled={!canStart}
            >
              <Text style={styles.primaryButtonText}>Start quiz night</Text>
            </Pressable>
            {hasResumable ? (
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.btnPressed]} onPress={resume}>
                <Text style={styles.secondaryButtonText}>Resume quiz</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.bgSecondary },
  gateLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  headerRight: { padding: spacing.sm, marginRight: spacing.sm },
  gateCard: {
    padding: spacing.xl,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "stretch",
    ...shadow.small,
  },
  gateIcon: { alignSelf: "center", marginBottom: spacing.md },
  gateTitle: { ...typography.bodyStrong, fontSize: 20, color: semantic.textPrimary, textAlign: "center", marginBottom: spacing.sm },
  gateBody: { ...typography.body, color: semantic.textSecondary, textAlign: "center", lineHeight: 22 },
  applyPrimary: {
    marginTop: spacing.xl,
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  applyPrimaryText: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
  applySecondary: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.bgSecondary,
    alignItems: "center",
  },
  applySecondaryText: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  dashboardLink: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    gap: spacing.sm,
    ...shadow.small,
  },
  dashboardLinkTextWrap: { flex: 1, minWidth: 0 },
  dashboardLinkTitle: { ...typography.bodyStrong, fontSize: 16, color: semantic.textPrimary },
  dashboardLinkHint: { ...typography.caption, color: semantic.textSecondary, marginTop: 2 },
  btnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  section: {
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: semantic.bgPrimary,
    borderRadius: radius.large,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    ...shadow.small,
  },
  sectionTitle: { ...typography.labelUppercase, color: semantic.textSecondary, marginBottom: spacing.md },
  loader: { marginVertical: spacing.md },
  hint: { ...typography.body, color: semantic.textSecondary },
  venueList: {},
  venueRow: {
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: colors.grey200,
    backgroundColor: semantic.bgSecondary,
    marginBottom: spacing.sm,
  },
  venueRowSelected: {
    borderColor: semantic.borderPrimary,
    backgroundColor: semantic.accentYellow,
    ...shadow.small,
  },
  venueRowPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  venueName: { ...typography.bodyStrong, color: semantic.textPrimary, fontSize: 17 },
  venueAddress: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
  venuePostcode: { ...typography.caption, color: colors.grey400, marginTop: 2 },
  packRow: {
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: semantic.bgSecondary,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
  },
  packName: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
  packHint: { ...typography.caption, color: semantic.textSecondary, marginTop: spacing.xs },
  actions: { marginTop: spacing.md },
  primaryButton: {
    backgroundColor: semantic.accentYellow,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadow.small,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { ...typography.bodyStrong, fontSize: 18, color: semantic.textPrimary },
  secondaryButton: {
    backgroundColor: semantic.bgPrimary,
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    borderWidth: borderWidth.default,
    borderColor: semantic.borderPrimary,
    alignItems: "center",
    ...shadow.small,
  },
  secondaryButtonText: { ...typography.bodyStrong, fontSize: 17, color: semantic.textPrimary },
});
