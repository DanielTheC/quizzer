import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;

const fromExpo = Constants.expoConfig?.extra as Extra;
const fromManifest = (Constants as { manifest?: { extra?: Extra } }).manifest?.extra as
  | Extra
  | undefined;
const extra = fromExpo ?? fromManifest;

const supabaseUrl = (extra?.supabaseUrl ?? "").trim();
const supabaseAnonKey = (extra?.supabaseAnonKey ?? "").trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart with: npx expo start --clear"
  );
}

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
