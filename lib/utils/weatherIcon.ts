export type WeatherInfo = { icon: string; label: string };

export function getWeatherInfo(code: number): WeatherInfo {
  if (code === 0)                      return { icon: "☀️",  label: "晴れ" };
  if (code <= 2)                       return { icon: "🌤️", label: "晴れ時々曇り" };
  if (code === 3)                      return { icon: "☁️",  label: "曇り" };
  if (code >= 45 && code <= 48)        return { icon: "🌫️", label: "霧" };
  if (code >= 51 && code <= 57)        return { icon: "🌦️", label: "霧雨" };
  if (code >= 61 && code <= 67)        return { icon: "🌧️", label: "雨" };
  if (code >= 71 && code <= 77)        return { icon: "❄️",  label: "雪" };
  if (code >= 80 && code <= 82)        return { icon: "🌧️", label: "にわか雨" };
  if (code >= 85 && code <= 86)        return { icon: "🌨️", label: "にわか雪" };
  if (code >= 95)                      return { icon: "⛈️",  label: "雷雨" };
  return { icon: "☁️", label: "曇り" };
}
