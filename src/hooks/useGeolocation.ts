import { useRef, useState, useCallback } from "react";

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface UseGeolocationReturn {
  coords: Coords | null;
  error: string | null;
  loading: boolean;
  request: () => Promise<Coords | null>;
  reset: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<Promise<Coords | null> | null>(null);

  const request = useCallback((): Promise<Coords | null> => {
    if (pendingRef.current) return pendingRef.current;
    if (!("geolocation" in navigator)) {
      setError("Browser tidak mendukung GPS");
      return Promise.resolve(null);
    }
    setError(null);
    setLoading(true);

    const p = new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: Coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setCoords(c);
          setLoading(false);
          pendingRef.current = null;
          resolve(c);
        },
        (err) => {
          let msg = "Gagal mengambil lokasi";
          if (err.code === err.PERMISSION_DENIED) msg = "Izinkan akses lokasi di browser";
          else if (err.code === err.POSITION_UNAVAILABLE) msg = "Lokasi tidak tersedia — nyalakan GPS";
          else if (err.code === err.TIMEOUT) msg = "Timeout — sinyal GPS lemah, coba lagi";
          setError(msg);
          setLoading(false);
          pendingRef.current = null;
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
    pendingRef.current = p;
    return p;
  }, []);

  const reset = useCallback(() => {
    setCoords(null);
    setError(null);
    setLoading(false);
  }, []);

  return { coords, error, loading, request, reset };
}
