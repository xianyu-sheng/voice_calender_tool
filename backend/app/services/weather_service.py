from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import requests


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 16
CACHE_TTL_SECONDS = 30 * 60


@dataclass
class CacheEntry:
    created_at: datetime
    data: dict[str, Any]


_weather_cache: dict[str, CacheEntry] = {}


def _cache_key(city: str) -> str:
    return city.strip().lower() or "北京"


def _get_cached(city: str) -> dict[str, Any] | None:
    key = _cache_key(city)
    entry = _weather_cache.get(key)
    if not entry:
        return None
    if datetime.now() - entry.created_at > timedelta(seconds=CACHE_TTL_SECONDS):
        return None
    return entry.data


def _set_cached(city: str, data: dict[str, Any]) -> None:
    _weather_cache[_cache_key(city)] = CacheEntry(datetime.now(), data)


def _geocode_city(city: str) -> dict[str, Any]:
    response = requests.get(
        GEOCODING_URL,
        params={
            "name": city,
            "count": 1,
            "language": "zh",
            "format": "json",
        },
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    results = payload.get("results") or []
    if not results:
        raise ValueError(f"未找到城市：{city}")
    return results[0]


def _fetch_forecast(latitude: float, longitude: float) -> dict[str, Any]:
    response = requests.get(
        FORECAST_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "current": "temperature_2m,weather_code",
            "timezone": "auto",
            "forecast_days": FORECAST_DAYS,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _normalize_forecast(city: str, place: dict[str, Any], forecast: dict[str, Any]) -> dict[str, Any]:
    daily = forecast.get("daily") or {}
    times = daily.get("time") or []
    max_temps = daily.get("temperature_2m_max") or []
    min_temps = daily.get("temperature_2m_min") or []
    weather_codes = daily.get("weather_code") or []
    precipitation = daily.get("precipitation_probability_max") or []

    forecasts = []
    for index, day in enumerate(times):
        forecasts.append(
            {
                "date": day,
                "weather_code": weather_codes[index] if index < len(weather_codes) else None,
                "temperature_max": max_temps[index] if index < len(max_temps) else None,
                "temperature_min": min_temps[index] if index < len(min_temps) else None,
                "precipitation_probability": precipitation[index] if index < len(precipitation) else None,
            }
        )

    generated_at = datetime.now().isoformat(timespec="seconds")
    available_until = (date.today() + timedelta(days=max(FORECAST_DAYS - 1, 0))).isoformat()

    return {
        "city": city,
        "place": {
            "name": place.get("name") or city,
            "country": place.get("country"),
            "admin1": place.get("admin1"),
            "latitude": place.get("latitude"),
            "longitude": place.get("longitude"),
        },
        "generated_at": generated_at,
        "available_until": available_until,
        "current": forecast.get("current") or {},
        "forecasts": forecasts,
    }


def get_weather(city: str) -> dict[str, Any]:
    normalized_city = city.strip() or "北京"
    cached = _get_cached(normalized_city)
    if cached:
        return {**cached, "from_cache": True}

    place = _geocode_city(normalized_city)
    forecast = _fetch_forecast(float(place["latitude"]), float(place["longitude"]))
    data = _normalize_forecast(normalized_city, place, forecast)
    _set_cached(normalized_city, data)
    return {**data, "from_cache": False}
