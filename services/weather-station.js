/**
 * Weather Station — demo service for mcpi Stage 2.
 *
 * Reads WEATHER_API_KEY from process.env (injected by `op run`)
 * and serves weather data from OpenWeatherMap. The API key never
 * touches disk and is never returned in any response.
 */

import { createServer } from "node:http";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const API_KEY = process.env.WEATHER_API_KEY;

if (!API_KEY) {
  console.error("[weather-station] WEATHER_API_KEY not set — exiting");
  process.exit(1);
}

async function fetchWeather(city) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWeatherMap ${res.status}: ${body}`);
  }
  const data = await res.json();

  return {
    city: data.name,
    country: data.sys?.country,
    temperature_celsius: data.main?.temp,
    feels_like_celsius: data.main?.feels_like,
    humidity_percent: data.main?.humidity,
    conditions: data.weather?.[0]?.description,
    wind_speed_mps: data.wind?.speed,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "weather-station" }));
    return;
  }

  if (url.pathname === "/weather") {
    const city = url.searchParams.get("city") ?? "Toronto";
    try {
      const weather = await fetchWeather(city);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(weather, null, 2));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Try /health or /weather?city=Toronto" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`[weather-station] listening on 127.0.0.1:${PORT}`);
});
