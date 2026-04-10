import AsyncStorage from "@react-native-async-storage/async-storage";

const VENUE_ID_KEY = "host_setup_venue_id";
const PACK_ID_KEY = "host_setup_pack_id";
const HOST_ONBOARDING_COMPLETE_KEY = "host_onboarding_complete";

export async function getLastVenueId(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(VENUE_ID_KEY);
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function setLastVenueId(venueId: string): Promise<void> {
  await AsyncStorage.setItem(VENUE_ID_KEY, venueId);
}

export async function getLastPackId(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(PACK_ID_KEY);
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function setLastPackId(packId: string): Promise<void> {
  await AsyncStorage.setItem(PACK_ID_KEY, packId);
}

export async function getHostOnboardingComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HOST_ONBOARDING_COMPLETE_KEY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export async function setHostOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(HOST_ONBOARDING_COMPLETE_KEY, "1");
}
