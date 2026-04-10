import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { supabase } from "../supabase";
import { signInWithOAuthProvider } from "./oauthPkceFlow";

function randomNonce(length = 32): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { error: new Error("Sign in with Apple is not available on this device.") };
    }
    const rawNonce = randomNonce(32);
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: new Error("Apple did not return an identity token.") };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });
    return { error: error ? new Error(error.message) : null };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return { error: null };
    }
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * iOS: native Sign in with Apple + Supabase `signInWithIdToken`.
 * Android / other: Supabase Apple OAuth in the in-app browser (enable Apple provider in Supabase).
 */
export async function signInWithApple(): Promise<{ error: Error | null }> {
  if (Platform.OS === "ios") {
    return signInWithAppleNative();
  }
  return signInWithOAuthProvider("apple");
}
