"use client";

import { useEffect, useState } from "react";
import { FARM_TIMEZONE } from "@/lib/utils";

// Yountville, California coordinates
const YOUNTVILLE_LAT = 38.4014;
const YOUNTVILLE_LON = -122.3614;

interface WeatherData {
  temp: number;
  high: number;
  low: number;
  code: number;
  wind: number;
  feelsLike: number;
}

// WMO weather codes → label + emoji
// Reference: https://open-meteo.com/en/docs#weathervariables
function decodeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code === 1) return { label: "Mostly clear", icon: "🌤️" };
  if (code === 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code >= 45 && code <= 48) return { label: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "🌦️" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "—", icon: "🌥️" };
}

/**
 * Compact weather strip for the admin dashboard hero.
 * Pulls live conditions from Open-Meteo (free, no API key) for Yountville, CA.
 * Shows: temp, conditions, high/low, wind. Refreshes on mount only.
 */
export function WeatherWidget() {
  const [w, setW] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(YOUNTVILLE_LAT));
    url.searchParams.set("longitude", String(YOUNTVILLE_LON));
    url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,apparent_temperature");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("timezone", FARM_TIMEZONE);

    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        setW({
          temp: Math.round(data.current?.temperature_2m ?? 0),
          high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
          low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
          code: data.current?.weather_code ?? 0,
          wind: Math.round(data.current?.wind_speed_10m ?? 0),
          feelsLike: Math.round(data.current?.apparent_temperature ?? 0),
        });
      })
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  if (!w) {
    return (
      <div className="text-right">
        <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold/60" style={{ fontFamily: "'Bank Gothic LT', sans-serif" }}>
          Yountville
        </p>
        <p className="text-2xl font-display text-farm-dark/40 mt-0.5">—°</p>
      </div>
    );
  }

  const { label, icon } = decodeWeather(w.code);

  return (
    <div className="text-right">
      <p
        className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1"
        style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
      >
        Yountville
      </p>
      <div className="flex items-baseline gap-2 justify-end">
        <span className="text-3xl">{icon}</span>
        <span className="font-display text-3xl text-farm-dark leading-none">{w.temp}°</span>
      </div>
      <p className="text-[11px] text-farm-muted mt-1">{label}</p>
      <p className="text-[10px] text-farm-muted/80 mt-0.5">
        H {w.high}° · L {w.low}° · {w.wind} mph
      </p>
    </div>
  );
}
