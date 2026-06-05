"use client";

import { useWeather, useLocation } from "@/lib/hooks/useWeather";
import { getWeatherInfo } from "@/lib/utils/weatherIcon";

type Props = {
  variant?: "card" | "inline";
};

export default function WeatherWidget({ variant = "card" }: Props) {
  const loc = useLocation();
  const { weather, loading } = useWeather(loc.lat, loc.lng);

  if (variant === "inline") {
    if (loading || !weather) return <span style={{ width: 80 }} />;
    const today = getWeatherInfo(weather.today.weatherCode);
    const tomorrow = getWeatherInfo(weather.tomorrow.weatherCode);
    return (
      <span className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "#9CA3AF" }}>
        <span>{today.icon} {weather.today.tempMax}°</span>
        <span style={{ color: "#D1D5DB" }}>·</span>
        <span>{tomorrow.icon} {weather.tomorrow.tempMax}°</span>
      </span>
    );
  }

  // card variant（発注画面等で使用）
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
      }}
    >
      <div className="flex items-center gap-2 flex-1">
        <span style={{ fontSize: "22px", lineHeight: 1 }}>{today.icon}</span>
        <div>
          <p style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500, lineHeight: 1.2 }}>今日</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1F2937", lineHeight: 1.3 }}>
            {weather.today.tempMax}°
            <span style={{ fontSize: "11px", fontWeight: 400, color: "#9CA3AF" }}>/{weather.today.tempMin}°</span>
          </p>
        </div>
      </div>
      <div style={{ width: "1px", height: "28px", backgroundColor: "#BFDBFE", flexShrink: 0, margin: "0 12px" }} />
      <div className="flex items-center gap-2 flex-1">
        <span style={{ fontSize: "22px", lineHeight: 1 }}>{tomorrow.icon}</span>
        <div>
          <p style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500, lineHeight: 1.2 }}>明日</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1F2937", lineHeight: 1.3 }}>
            {weather.tomorrow.tempMax}°
            <span style={{ fontSize: "11px", fontWeight: 400, color: "#9CA3AF" }}>/{weather.tomorrow.tempMin}°</span>
          </p>
        </div>
      </div>
    </div>
  );
}
