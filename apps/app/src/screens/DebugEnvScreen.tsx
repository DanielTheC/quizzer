import React from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;

function getExtra(): Extra {
  const fromExpo = Constants.expoConfig?.extra as Extra;
  const fromManifest = (Constants as { manifest?: { extra?: Extra } }).manifest?.extra as
    | Extra
    | undefined;
  return fromExpo ?? fromManifest;
}

export default function DebugEnvScreen() {
  const extra = getExtra();
  const supabaseUrl = (extra?.supabaseUrl ?? "").trim();
  const anonKeySet = !!((extra?.supabaseAnonKey ?? "").trim());

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <ScrollView>
        <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 16 }}>
          Env debug (temporary)
        </Text>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 4 }}>supabaseUrl</Text>
          <Text style={{ fontSize: 14, color: "#333" }} selectable>
            {supabaseUrl || "(not set)"}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 4 }}>anon key set</Text>
          <Text style={{ fontSize: 14, color: "#333" }}>{anonKeySet ? "Yes" : "No"}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
