export interface WeatherDay {
  day: string;
  date: string;
  icon: string;
  tempHigh: number;
  tempLow: number;
  rainProb: number;
  description: string;
  humidity: number;
  wind: number;
  // Optional agro-forecast fields
  weatherCode?: number;
  rainMm?: number;
  evapotranspiration?: number;
  soilMoisture?: number;
  soilTemperature?: number;
}

export interface CropCalendarEntry {
  crop: string;
  activities: {
    name: string;
    startWeek: number;
    endWeek: number;
    color: string;
  }[];
}

export interface Alert {
  id: string;
  type: "warning" | "danger" | "info" | "success";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export const regions = [
  { id: "ashanti", name: "Ashanti Region", country: "Ghana" },
  { id: "northern", name: "Northern Region", country: "Ghana" },
];

export const crops = [
  { id: "maize", name: "Maize", icon: "🌽" },
  { id: "rice", name: "Rice", icon: "🌾" },
  { id: "cassava", name: "Cassava", icon: "🥔" },
];

export const weeklyForecast: WeatherDay[] = [
  { day: "Today", date: "Feb 21", icon: "☀️", tempHigh: 34, tempLow: 23, rainProb: 15, description: "Sunny and warm", humidity: 62, wind: 8 },
  { day: "Sat", date: "Feb 22", icon: "⛅", tempHigh: 33, tempLow: 22, rainProb: 30, description: "Partly cloudy", humidity: 65, wind: 10 },
  { day: "Sun", date: "Feb 23", icon: "🌧️", tempHigh: 30, tempLow: 22, rainProb: 75, description: "Rain expected", humidity: 80, wind: 12 },
  { day: "Mon", date: "Feb 24", icon: "🌧️", tempHigh: 28, tempLow: 21, rainProb: 85, description: "Heavy rain likely", humidity: 88, wind: 15 },
  { day: "Tue", date: "Feb 25", icon: "⛅", tempHigh: 31, tempLow: 22, rainProb: 40, description: "Clearing up", humidity: 70, wind: 9 },
  { day: "Wed", date: "Feb 26", icon: "☀️", tempHigh: 33, tempLow: 23, rainProb: 10, description: "Sunny", humidity: 58, wind: 7 },
  { day: "Thu", date: "Feb 27", icon: "☀️", tempHigh: 35, tempLow: 24, rainProb: 5, description: "Hot and dry", humidity: 50, wind: 6 },
];

export const cropCalendars: CropCalendarEntry[] = [
  {
    crop: "Maize",
    activities: [
      { name: "Land Prep", startWeek: 1, endWeek: 3, color: "earth" },
      { name: "Planting", startWeek: 4, endWeek: 5, color: "primary" },
      { name: "Fertilizer", startWeek: 7, endWeek: 8, color: "secondary" },
      { name: "Weeding", startWeek: 6, endWeek: 10, color: "warning" },
      { name: "Harvest", startWeek: 14, endWeek: 16, color: "success" },
    ],
  },
  {
    crop: "Rice",
    activities: [
      { name: "Land Prep", startWeek: 2, endWeek: 4, color: "earth" },
      { name: "Transplanting", startWeek: 5, endWeek: 6, color: "primary" },
      { name: "Fertilizer", startWeek: 8, endWeek: 9, color: "secondary" },
      { name: "Weeding", startWeek: 7, endWeek: 11, color: "warning" },
      { name: "Harvest", startWeek: 18, endWeek: 20, color: "success" },
    ],
  },
  {
    crop: "Cassava",
    activities: [
      { name: "Land Prep", startWeek: 1, endWeek: 2, color: "earth" },
      { name: "Planting", startWeek: 3, endWeek: 4, color: "primary" },
      { name: "Weeding", startWeek: 8, endWeek: 14, color: "warning" },
      { name: "Harvest", startWeek: 36, endWeek: 48, color: "success" },
    ],
  },
];

export const alerts: Alert[] = [
  {
    id: "1",
    type: "warning",
    title: "Heavy Rain Alert",
    message: "Rain expected in your area in 2 days. Prepare land for maize planting before the rains begin.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "2",
    type: "success",
    title: "Planting Window Open",
    message: "Good soil moisture detected. This is an ideal time to plant maize in Ashanti Region.",
    time: "5 hours ago",
    read: false,
  },
  {
    id: "3",
    type: "danger",
    title: "Pest Risk High",
    message: "Fall armyworm risk is elevated this week due to humidity. Inspect your maize fields.",
    time: "1 day ago",
    read: true,
  },
  {
    id: "4",
    type: "info",
    title: "Fertilizer Reminder",
    message: "Your rice crop is approaching the 8-week mark. Consider applying NPK fertilizer this week.",
    time: "2 days ago",
    read: true,
  },
];

export const todayAdvisory = {
  crop: "Maize",
  region: "Ashanti Region",
  action: "Prepare land for planting",
  detail: "Rain is expected on Sunday. Clear and till your land now so it's ready for planting when the soil moisture is optimal.",
  urgency: "high" as const,
};
