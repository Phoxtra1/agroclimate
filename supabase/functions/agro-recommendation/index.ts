// supabase/functions/agro-recommendation/index.ts

import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  // 1. Fetch weather
  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=YOUR_KEY&units=metric`
  );
  const weather = await weatherRes.json();

  const temp = weather.main.temp;
  const humidity = weather.main.humidity;
  const rainfall = weather.rain?.["1h"] || 0;

  // 2. Crop rules (can later move to DB)
  const crops = [
    {
      name: "Green Pepper",
      minTemp: 18,
      maxTemp: 30,
      minRain: 600,
      maxRain: 1200
    },
    {
      name: "Maize",
      minTemp: 18,
      maxTemp: 32,
      minRain: 500,
      maxRain: 1200
    }
  ];

  // 3. Scoring
  const results = crops.map((crop) => {
    let score = 0;

    if (temp >= crop.minTemp && temp <= crop.maxTemp) score += 0.4;
    if (rainfall >= crop.minRain && rainfall <= crop.maxRain) score += 0.4;
    if (humidity > 40 && humidity < 90) score += 0.2;

    return {
      name: crop.name,
      score,
      suitable: score > 0.5
    };
  });

  return new Response(JSON.stringify({
    location: { lat, lon },
    weather: { temp, humidity, rainfall },
    crops: results.filter(c => c.suitable)
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
