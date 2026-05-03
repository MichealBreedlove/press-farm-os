"use client";

import { useEffect, useState } from "react";

const YOUNTVILLE_LAT = 38.4014;
const YOUNTVILLE_LON = -122.3614;

interface DailyWeather {
  code: number;
  high: number;
  low: number;
  precipitation: number;
  windMax: number;
}

interface WeatherWarning {
  headline: string;
  detail: string;
}

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

function detectWarnings(w: DailyWeather): WeatherWarning[] {
  const warnings: WeatherWarning[] = [];

  if (w.low < 35) {
    warnings.push({
      headline: "Frost expected overnight",
      detail: "Tender herbs (basil) and delicate edible flowers may be limited.",
    });
  }

  const heavyRainCode = (w.code >= 61 && w.code <= 67) || (w.code >= 80 && w.code <= 82);
  if (w.precipitation > 0.5 || heavyRainCode) {
    warnings.push({
      headline: "Heavy rain expected",
      detail: "Lettuces, soft herbs, and delicate greens may be limited.",
    });
  }

  if (w.windMax > 20) {
    warnings.push({
      headline: "High winds expected",
      detail: "Tall blooms and edible flowers may be limited.",
    });
  }

  if (w.high > 95) {
    warnings.push({
      headline: "Extreme heat expected",
      detail: "Lettuces and tender greens may bolt or wilt — quantities may be reduced.",
    });
  }

  if (w.code >= 95 && w.code <= 99) {
    warnings.push({
      headline: "Thunderstorms expected",
      detail: "Harvest windows may shift; some items may be impacted.",
    });
  }

  return warnings;
}

interface DeliveryWeatherBannerProps {
  deliveryDate: string;
  deliveryDateFormatted: string;
}

/**
 * Compact weather strip + inclement-weather warning for chef order pages.
 * Pulls daily forecast for the delivery date from Open-Meteo (free, no key)
 * and surfaces category-aware warnings (frost → herbs, rain → greens, etc.).
 * Silent on fetch error — never blocks the order flow.
 */
export function DeliveryWeatherBanner({ deliveryDate, deliveryDateFormatted }: DeliveryWeatherBannerProps) {
  const [w, setW] = useState<DailyWeather | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(YOUNTVILLE_LAT));
    url.searchParams.set("longitude", String(YOUNTVILLE_LON));
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    );
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", "America/Los_Angeles");
    url.searchParams.set("start_date", deliveryDate);
    url.searchParams.set("end_date", deliveryDate);

    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        const d = data.daily;
        if (!d || !Array.isArray(d.weather_code) || d.weather_code.length === 0) {
          setError(true);
          return;
        }
        setW({
          code: d.weather_code[0] ?? 0,
          high: Math.round(d.temperature_2m_max?.[0] ?? 0),
          low: Math.round(d.temperature_2m_min?.[0] ?? 0),
          precipitation: Number(d.precipitation_sum?.[0] ?? 0),
          windMax: Math.round(d.wind_speed_10m_max?.[0] ?? 0),
        });
      })
      .catch(() => setError(true));
  }, [deliveryDate]);

  if (error || !w) return null;

  const { label, icon } = decodeWeather(w.code);
  const warnings = detectWarnings(w);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-farm-dark/5 shadow-sm px-4 py-3 flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden="true">{icon}</span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-farm-muted"
            style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
          >
            Yountville · {deliveryDateFormatted}
          </p>
          <p className="text-sm font-medium text-farm-dark mt-0.5">{label}</p>
        </div>
        <div className="text-right text-[11px] text-farm-muted leading-tight">
          <p>
            <span className="text-farm-dark font-semibold">{w.high}°</span> / {w.low}°
          </p>
          <p>{w.windMax} mph</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <span aria-hidden="true">⚠</span>
            Weather may affect availability
          </p>
          <ul className="space-y-1.5">
            {warnings.map((warning, idx) => (
              <li key={idx} className="text-xs text-amber-900 leading-snug">
                <span className="font-semibold">{warning.headline}.</span>{" "}
                <span className="text-amber-800/90">{warning.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
