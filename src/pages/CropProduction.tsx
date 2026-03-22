import { useEffect, useState } from "react";

export default function CropProduction() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_URL =
    "https://YOUR_PROJECT.supabase.co/functions/v1/agro-recommendation";

  async function fetchData(lat: number, lon: number) {
    try {
      const res = await fetch(`${API_URL}?lat=${lat}&lon=${lon}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load crop data", err);
    } finally {
      setLoading(false);
    }
  }

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchData(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("Location denied, using fallback");

        // fallback (Africa center-ish)
        fetchData(9.082, 8.6753);
      }
    );
  }, []);

  // Auto refresh every 30 mins (independent)
  useEffect(() => {
    const interval = setInterval(() => {
      if (data?.location) {
        fetchData(data.location.lat, data.location.lon);
      }
    }, 1000 * 60 * 30);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="p-4">Loading live crop data...</p>;
  if (!data || !data.crops?.length)
    return <p className="p-4">No crop recommendations available</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-lg font-bold mb-4">
        Smart Crop Recommendations
      </h1>

      {data.crops.map((crop: any) => (
        <div key={crop.name} className="bg-card p-4 rounded-xl mb-3 shadow-sm">
          <div className="flex justify-between">
            <h2 className="font-semibold">{crop.name}</h2>
            <span>{Math.round(crop.score * 100)}%</span>
          </div>

          <p className="text-xs mt-1">
            Yield: {crop.yieldForecast} | Risk: {crop.riskLevel}
          </p>

          {crop.irrigation && (
            <p className="text-xs mt-1">💧 Irrigation recommended</p>
          )}

          {crop.regions && (
            <p className="text-xs mt-1">
              📍 {crop.regions.join(", ")}
            </p>
          )}

          <div className="mt-2 bg-primary/10 p-2 rounded">
            <p className="text-xs">💡 {crop.tips}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
