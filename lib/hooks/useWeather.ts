"use client";

import { useEffect, useState } from "react";

export type WeatherDay = {
  tempMax: number;
  tempMin: number;
  weatherCode: number;
};

export type WeatherData = {
  today: WeatherDay;
  tomorrow: WeatherDay;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

export function useWeather(lat: number, lng: number) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch_ = async () => {
      try {
        const cacheKey = `weather_${lat.toFixed(4)}_${lng.toFixed(4)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached) as { data: WeatherData; timestamp: number };
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            if (!cancelled) { setWeather(data); setLoading(false); }
            return;
          }
        }

        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lng}` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
          `&timezone=Asia%2FTokyo&forecast_days=2`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        const json = await res.json() as {
          daily: {
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            weather_code: number[];
          };
        };

        const parsed: WeatherData = {
          today: {
            tempMax: Math.round(json.daily.temperature_2m_max[0]),
            tempMin: Math.round(json.daily.temperature_2m_min[0]),
            weatherCode: json.daily.weather_code[0],
          },
          tomorrow: {
            tempMax: Math.round(json.daily.temperature_2m_max[1]),
            tempMin: Math.round(json.daily.temperature_2m_min[1]),
            weatherCode: json.daily.weather_code[1],
          },
        };

        localStorage.setItem(cacheKey, JSON.stringify({ data: parsed, timestamp: Date.now() }));
        if (!cancelled) setWeather(parsed);
      } catch {
        // サイレントフェイル
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch_();
    return () => { cancelled = true; };
  }, [lat, lng]);

  return { weather, loading };
}

const LOCATION_KEY = "recipro_location";
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

type CachedLocation = { lat: number; lng: number; timestamp: number };

export function useLocation(): { lat: number; lng: number } {
  const FALLBACK = { lat: 35.6762, lng: 139.6503 }; // 東京

  const [loc, setLoc] = useState<{ lat: number; lng: number }>(FALLBACK);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_KEY);
      if (raw) {
        const cached: CachedLocation = JSON.parse(raw);
        if (Date.now() - cached.timestamp < LOCATION_TTL_MS) {
          setLoc({ lat: cached.lat, lng: cached.lng });
          return;
        }
      }
    } catch {
      // ignore
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
        setLoc({ lat, lng });
      },
      () => {
        // 取得失敗はサイレントフェイル、東京フォールバックのまま
      },
      { timeout: 5000, maximumAge: LOCATION_TTL_MS }
    );
  }, []);

  return loc;
}
