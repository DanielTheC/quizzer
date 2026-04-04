import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { haversineMiles } from "../../../lib/haversine";
import type { LocationPermissionStatus, Venue } from "./nearbyTypes";

export function useNearbyLocation() {
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>("undetermined");
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setLocationPermission(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          setDeviceLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch {
          if (!cancelled) setDeviceLocation(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referenceLocation = locationPermission === "denied" ? null : deviceLocation;

  const getMiles = useCallback(
    (venue: Venue | null): number | null => {
      if (!referenceLocation || !venue) return null;
      const lat = venue.lat;
      const lng = venue.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return haversineMiles(referenceLocation.lat, referenceLocation.lng, lat, lng);
    },
    [referenceLocation]
  );

  return { locationPermission, deviceLocation, referenceLocation, getMiles };
}
