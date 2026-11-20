import { describe, expect, it } from "vitest";
import {
  getDeterministicAgroMetrics,
  isUsableDailyForecast,
  isValidWeatherCoordinates,
  mapRealtimeToWeatherDay,
  mapTomorrowToWeatherDay,
} from "@/hooks/useWeather";

describe("AgroForecast input validation", () => {
  it("accepts valid coordinates including zero and rejects out-of-range values", () => {
    expect(isValidWeatherCoordinates(0, 0)).toBe(true);
    expect(isValidWeatherCoordinates(5.6, -0.2)).toBe(true);
    expect(isValidWeatherCoordinates(91, 0)).toBe(false);
    expect(isValidWeatherCoordinates(5, 181)).toBe(false);
    expect(isValidWeatherCoordinates(Number.NaN, 0)).toBe(false);
  });

  it("rejects incomplete daily forecasts instead of fabricating temperatures", () => {
    expect(isUsableDailyForecast({ time: "2026-11-20T00:00:00Z", values: { temperatureMax: 32, temperatureMin: 24 } })).toBe(true);
    expect(isUsableDailyForecast({ time: "not-a-date", values: { temperatureMax: 32, temperatureMin: 24 } })).toBe(false);
    expect(isUsableDailyForecast({ time: "2026-11-20T00:00:00Z", values: { humidityAvg: 60 } })).toBe(false);
  });
});

describe("AgroForecast metric provenance and units", () => {
  it("marks derived soil metrics as estimated and converts provider wind speed to km/h", () => {
    const day = mapTomorrowToWeatherDay({
      time: "2026-11-20T00:00:00Z",
      values: {
        temperatureMax: 33,
        temperatureMin: 23,
        humidityAvg: 70,
        windSpeedMax: 5,
        precipitationProbabilityMax: 45,
        rainAccumulationSum: 6,
        weatherCodeMax: 1001,
      },
    }, 0);

    expect(day.wind).toBe(18);
    expect(day.rainSource).toBe("provider");
    expect(day.evapotranspirationSource).toBe("estimated");
    expect(day.soilMoistureSource).toBe("estimated");
    expect(day.soilTemperatureSource).toBe("estimated");
  });

  it("marks provider soil and ET fields as provider-derived", () => {
    const day = mapTomorrowToWeatherDay({
      time: "2026-11-20T00:00:00Z",
      values: {
        temperatureMax: 33,
        temperatureMin: 23,
        humidityAvg: 70,
        windSpeedMax: 5,
        weatherCodeMax: 1000,
        evapotranspiration: 4.8,
        soilMoistureVolumetric0To10: 0.31,
        soilTemperature0To10: 25.4,
      },
    }, 0);

    expect(day.evapotranspirationSource).toBe("provider");
    expect(day.soilMoisture).toBe(31);
    expect(day.soilMoistureSource).toBe("provider");
    expect(day.soilTemperature).toBe(25);
    expect(day.soilTemperatureSource).toBe("provider");
  });

  it("does not turn incomplete realtime payloads into plausible weather", () => {
    expect(mapRealtimeToWeatherDay({ data: { values: { humidity: 80 } } })).toBeNull();
  });

  it("bounds deterministic agro estimates and uses provider rainfall when supplied", () => {
    const estimate = getDeterministicAgroMetrics(35, 45, 3, 70, 12.34);
    expect(estimate.rainMm).toBe(12.3);
    expect(estimate.soilMoisture).toBeGreaterThanOrEqual(10);
    expect(estimate.soilMoisture).toBeLessThanOrEqual(95);
    expect(estimate.evapotranspiration).toBeGreaterThanOrEqual(1.5);
    expect(estimate.evapotranspiration).toBeLessThanOrEqual(8.5);
  });
});
