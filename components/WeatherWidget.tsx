"use client";

import { useWeather, useLocation } from "@/lib/hooks/useWeather";
import { getWeatherInfo } from "@/lib/utils/weatherIcon";

export default function WeatherWidget() {
  const loc = useLocation();
  const { weather, loading } = useWeather(loc.lat, loc.lng);

  if (loading) {
    return (
      <div
        className="rounded-xl bg-sky-50 animate-pulse shrink-0"
        style={{ height: "52px" }}
      />
    );
  }

  if (!weather) return null;

  const today = getWeatherInfo(weather.today.weatherCode);
  const tomorrow = getWeatherInfo(weather.tomorrow.weatherCode);

  return (
    <div
      className="flex items-center rounded-xl shrink-0"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)",
        padding: "8px 12px",
        gap: "0",
      }}
    >
      {/* 今日 */}
      <div className="flex items-center gap-2 flex-1">
        <span style={{ fontSize: "22px", lineHeight: 1 }}>{today.icon}</span>
        <div>
          <p style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500, lineHeight: 1.2 }}>今日</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1F2937", lineHeight: 1.3 }}>
            {weather.today.tempMax}°
            <span style={{ fontSize: "11px", fontWeight: 400, color: "#9CA3AF" }}>
              /{weather.today.tempMin}°
            </span>
          </p>
        </div>
      </div>

      {/* 区切り */}
      <div style={{ width: "1px", height: "28px", backgroundColor: "#BFDBFE", flexShrink: 0, margin: "0 12px" }} />

      {/* 明日 */}
      <div className="flex items-center gap-2 flex-1">
        <span style={{ fontSize: "22px", lineHeight: 1 }}>{tomorrow.icon}</span>
        <div>
          <p style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500, lineHeight: 1.2 }}>明日</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1F2937", lineHeight: 1.3 }}>
            {weather.tomorrow.tempMax}°
            <span style={{ fontSize: "11px", fontWeight: 400, color: "#9CA3AF" }}>
              /{weather.tomorrow.tempMin}°
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
