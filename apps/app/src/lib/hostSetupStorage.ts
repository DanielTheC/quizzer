import AsyncStorage from "@react-native-async-storage/async-storage";

const VENUE_ID_KEY = "host_setup_venue_id";
const PACK_ID_KEY = "host_setup_pack_id";

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
