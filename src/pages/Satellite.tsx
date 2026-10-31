import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  Activity,
  Anchor,
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Droplets,
  Eye,
  Globe,
  Layers,
  ListFilter,
  LocateFixed,
  Loader2,
  Maximize2,
  MapPin,
  Minus,
  Navigation,
  Play,
  Plus,
  RefreshCw,
  Ruler,
  Satellite as SatelliteIcon,
  Search,
  Sliders,
  Sparkles,
  Sprout,
  Truck,
  Volume2,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { LandSuitabilityPanel } from "@/components/satellite/LandSuitabilityPanel";
import { MaritimeSafetyPanel, type MaritimeMapPosition } from "@/components/satellite/MaritimeSafetyPanel";
import { PortsMapLayer } from "@/components/satellite/PortsMapLayer";
import { GeoFeaturesMapLayer } from "@/components/satellite/GeoFeaturesMapLayer";
import { createGeoFeature, toPointGeometry, type GeoFeatureType } from "@/services/satellite/geospatial";
import { cacheNavigationRoute, getCachedNavigationRoute, routeCacheAgeMinutes, type CachedNavigationRoute } from "@/services/satellite/offlineNavigation";
import { saveSharedRoadRoute } from "@/services/satellite/geospatial";
import type { MaritimeSosEvent } from "@/services/satellite/maritime";
import type { PortSearchFeature } from "@/services/satellite/ports";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { interpretFieldIndices, interpretVegetationAlert } from "@/services/satellite/interpretation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  calculatePolygonAreaHectares,
  describeNdmi,
  describeNdvi,
  getFieldIndexStatistics,
  getIndexAtPoint,
  getSentinelTileTemplate,
  searchSentinelScenes,
  type FieldIndexStatistics,
  type GeoPoint,
  type SentinelScene,
  type SpectralIndex,
} from "@/services/satellite/sentinel";
import {
  STRATEGIC_BOARDS,
  type StationNode,
  type StrategicBoard,
  type TelemetryPoint,
} from "@/services/satellite/stations";
import {
  calculateRoute,
  reverseGeocode,
  searchPlaces,
  type RouteData,
  type RouteStep,
  type SearchResult,
  type TravelMode,
} from "@/services/satellite/navigation";
import {
  MapCameraController,
  NavigationRouteOverlay,
  RouteBoundsController,
  StrategicCorridorOverlay,
} from "@/components/satellite/SatelliteMapHUD";
import "leaflet/dist/leaflet.css";

type Place = GeoPoint & { label: string };
type SatelliteField = Database["public"]["Tables"]["satellite_fields"]["Row"];
type SatelliteAlert = Database["public"]["Tables"]["satellite_field_alerts"]["Row"];
type ImageryLayer = "true-color" | "false-color" | SpectralIndex | "nasa-true" | "nasa-false" | "nasa-ndvi";
type BasemapStyle = "esri-satellite" | "tactical-dark" | "sentinel" | "hybrid" | "osm";

const BASEMAP_TILES: Record<BasemapStyle, { url: string; attribution: string; maxZoom: number }> = {
  "esri-satellite": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, USDA, USGS",
    maxZoom: 19,
  },
  "tactical-dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  "hybrid": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Earthstar Geographics",
    maxZoom: 19,
  },
  "sentinel": {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  "osm": {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

const nasaLayers: Record<string, string> = {
  "nasa-true": "MODIS_Terra_CorrectedReflectance_TrueColor",
  "nasa-false": "MODIS_Terra_CorrectedReflectance_Bands721",
  "nasa-ndvi": "MODIS_Terra_NDVI_8Day",
};

const fmtDate = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

function MapEventsHandler({
  drawing,
  navPickMode,
  onMapClick,
  onSample,
  onPickNavPoint,
  captureFeature,
  onCaptureFeaturePoint,
}: {
  drawing: boolean;
  navPickMode: "start" | "end" | null;
  onMapClick: (point: GeoPoint) => void;
  onSample: (point: GeoPoint) => void;
  onPickNavPoint: (point: GeoPoint) => void;
  captureFeature: boolean;
  onCaptureFeaturePoint: (point: GeoPoint) => void;
}) {
  useMapEvents({
    click(event) {
      const point = { lat: event.latlng.lat, lon: event.latlng.lng };
      if (navPickMode) {
        onPickNavPoint(point);
      } else if (captureFeature) {
        onCaptureFeaturePoint(point);
      } else if (drawing) {
        onMapClick(point);
      } else {
        onSample(point);
      }
    },
  });
  return null;
}

export default function Satellite() {
  const { user } = useAuth();

  // Mode: TRACK (intelligence boards) vs QUERY (search & navigation)
  const [activeMode, setActiveMode] = useState<"TRACK" | "QUERY">("TRACK");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Selected Strategic Board & Station
  const [selectedBoardId, setSelectedBoardId] = useState<string>("bab-el-mandeb");
  const activeBoard = useMemo(
    () => STRATEGIC_BOARDS.find((b) => b.id === selectedBoardId) || STRATEGIC_BOARDS[0],
    [selectedBoardId]
  );
  const [selectedStationId, setSelectedStationId] = useState<string>(activeBoard.primaryStationId);
  const selectedStation = useMemo(
    () => activeBoard.stations.find((s) => s.id === selectedStationId) || activeBoard.stations[0],
    [activeBoard, selectedStationId]
  );

  // Time Series Range for Chart: "30d" | "90d" | "1y"
  const [chartRange, setChartRange] = useState<"30d" | "90d" | "1y">("90d");
  const chartData = useMemo(() => {
    if (chartRange === "30d") return activeBoard.history30d;
    if (chartRange === "1y") return activeBoard.history1y;
    return activeBoard.history90d;
  }, [activeBoard, chartRange]);

  // Basemap style & imagery
  const [basemap, setBasemap] = useState<BasemapStyle>("esri-satellite");
  const [imageryOverlay, setImageryOverlay] = useState<ImageryLayer>("true-color");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [telemetryOpen, setTelemetryOpen] = useState(true);
  const [fullBoardModal, setFullBoardModal] = useState(false);

  // Map Camera Center & Zoom
  const [mapCenter, setMapCenter] = useState<[number, number]>(activeBoard.center);
  const [mapZoom, setMapZoom] = useState<number>(activeBoard.zoom);

  // Resolve location hand-offs from AG Trans, Post-Harvest Tracker and Flight Advisory.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q") || params.get("query");
    const latValue = params.get("lat");
    const lonValue = params.get("lon");
    if (query?.trim()) setSearchQuery(query.trim());
    if (latValue !== null && lonValue !== null) {
      const lat = Number(latValue);
      const lon = Number(lonValue);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const label = params.get("label") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        const requestedZoom = Number(params.get("zoom") || 15);
        setMapCenter([lat, lon]);
        setMapZoom(Number.isFinite(requestedZoom) ? Math.max(2, Math.min(22, requestedZoom)) : 15);
        setCurrentLocation({ lat, lon, label });
      }
    }
  }, []);

  // Google Earth Place Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [dipaQuestion, setDipaQuestion] = useState("");
  const [dipaAnswer, setDipaAnswer] = useState("");
  const [dipaLoading, setDipaLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Real-time Navigation / Directions state
  const [navOpen, setNavOpen] = useState(false);
  const [navStartText, setNavStartText] = useState("");
  const [navEndText, setNavEndText] = useState("");
  const [navStartPoint, setNavStartPoint] = useState<GeoPoint | null>(null);
  const [navEndPoint, setNavEndPoint] = useState<GeoPoint | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("freight");
  const [navPickMode, setNavPickMode] = useState<"start" | "end" | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState("");

  // Simulated route preview playback (not a vehicle GPS feed).
  const [isSimulatingNav, setIsSimulatingNav] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [simulatedVehiclePos, setSimulatedVehiclePos] = useState<[number, number] | null>(null);
  const [simulatedSpeedKmh, setSimulatedSpeedKmh] = useState(48);

  // Sentinel-2 Live Scene & Polygon Field Drawing states
  const [currentLocation, setCurrentLocation] = useState<Place>({
    lat: activeBoard.center[0],
    lon: activeBoard.center[1],
    label: activeBoard.title,
  });
  const [daysBack, setDaysBack] = useState("30");
  const [maxCloud, setMaxCloud] = useState("40");
  const [scenes, setScenes] = useState<SentinelScene[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [tileTemplate, setTileTemplate] = useState("");
  const [sceneLoading, setSceneLoading] = useState(false);
  const [tileLoading, setTileLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fieldPoints, setFieldPoints] = useState<GeoPoint[]>([]);
  const [fieldStats, setFieldStats] = useState<Partial<Record<SpectralIndex, FieldIndexStatistics>>>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [sample, setSample] = useState<{ point: GeoPoint; values: Partial<Record<SpectralIndex, number | null>> } | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  // Saved Fields & Alerts from Supabase
  const [savedFields, setSavedFields] = useState<SatelliteField[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<SatelliteAlert[]>([]);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [maritimePanelOpen, setMaritimePanelOpen] = useState(false);
  const [geoFeaturePanelOpen, setGeoFeaturePanelOpen] = useState(false);
  const [geoFeatureType, setGeoFeatureType] = useState<GeoFeatureType>("warehouse");
  const [geoFeatureName, setGeoFeatureName] = useState("");
  const [geoFeatureNotes, setGeoFeatureNotes] = useState("");
  const [geoFeaturePoint, setGeoFeaturePoint] = useState<GeoPoint | null>(null);
  const [captureGeoFeaturePoint, setCaptureGeoFeaturePoint] = useState(false);
  const [geoFeatureSaving, setGeoFeatureSaving] = useState(false);
  const [maritimeEvents, setMaritimeEvents] = useState<MaritimeSosEvent[]>([]);
  const [maritimePositions, setMaritimePositions] = useState<MaritimeMapPosition[]>([]);
  const [portsLayerEnabled, setPortsLayerEnabled] = useState(false);
  const [mappedPorts, setMappedPorts] = useState<PortSearchFeature[]>([]);
  const [offlineRouteInfo, setOfflineRouteInfo] = useState<CachedNavigationRoute | null>(null);

  const selectedScene = useMemo(() => scenes.find((s) => s.id === sceneId) ?? null, [scenes, sceneId]);
  const suitabilityPoint = useMemo<GeoPoint>(() => {
    if (fieldPoints.length > 0) {
      const total = fieldPoints.reduce((acc, point) => ({ lat: acc.lat + point.lat, lon: acc.lon + point.lon }), { lat: 0, lon: 0 });
      return { lat: total.lat / fieldPoints.length, lon: total.lon / fieldPoints.length };
    }
    return { lat: currentLocation.lat, lon: currentLocation.lon };
  }, [fieldPoints, currentLocation]);
  const suitabilityGeometry = useMemo<GeoJSON.Polygon | null>(() => {
    if (fieldPoints.length < 3) return null;
    const ring: number[][] = fieldPoints.map((point) => [point.lon, point.lat]);
    ring.push([...ring[0]]);
    return { type: "Polygon", coordinates: [ring] };
  }, [fieldPoints]);
  const isNasa = imageryOverlay.startsWith("nasa-");
  const maxDate = fmtDate(new Date(Date.now() - 86400000));
  const nasaUrl = isNasa
    ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${nasaLayers[imageryOverlay]}/default/${maxDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
    : "";
  const fieldArea = useMemo(() => calculatePolygonAreaHectares(fieldPoints), [fieldPoints]);

  // Sync board change with camera and stations
  const handleSelectBoard = (board: StrategicBoard) => {
    setSelectedBoardId(board.id);
    setSelectedStationId(board.primaryStationId);
    setMapCenter(board.center);
    setMapZoom(board.zoom);
    setCurrentLocation({ lat: board.center[0], lon: board.center[1], label: board.title });
  };

  const handleSelectStation = (station: StationNode) => {
    setSelectedStationId(station.id);
    setMapCenter([station.lat, station.lon]);
  };

  // Google Earth Live Search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    const timeout = setTimeout(async () => {
      const results = await searchPlaces(searchQuery, controller.signal);
      if (!controller.signal.aborted) {
        setSearchResults(results);
        setShowSearchResults(results.length > 0);
        setSearching(false);
      }
    }, 320);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery(result.name);
    setMapCenter([result.lat, result.lon]);
    setMapZoom(13);
    setCurrentLocation({ lat: result.lat, lon: result.lon, label: result.displayName });
    toast.success(`Flying to ${result.name}`, {
      description: `${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`,
    });
  };

  const handleAskDipa = async (event: FormEvent) => {
    event.preventDefault();
    const question = dipaQuestion.trim();
    if (!question || dipaLoading) return;
    setDipaLoading(true);
    setDipaAnswer("");
    try {
      const { data, error } = await supabase.functions.invoke("dipa-intelligence", {
        body: {
          action: "summary",
          payload: {
            topic: "Satellite geospatial and agricultural assessment",
            audience: "farmer, field officer or agricultural logistics operator",
            data: {
              question,
              selectedLocation: currentLocation,
              mapCenter: { lat: mapCenter[0], lon: mapCenter[1] },
              selectedImageryProvider: basemap,
              selectedObservationDate: selectedScene?.acquiredAt || null,
              selectedSceneCloudCover: selectedScene?.cloudCover ?? null,
              selectedFieldAreaHectares: fieldArea || null,
              fieldSpectralStatistics: fieldStats,
              dataLimitations: [
                "Use only the supplied observations and context.",
                "Do not infer soil laboratory results, land ownership, crop identity or live conditions from coordinates alone.",
                "State when evidence is missing, old, coarse-resolution or uncertain.",
              ],
            },
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDipaAnswer(typeof data?.text === "string" ? data.text : "Dipa did not return an assessment. Please try again.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dipa could not complete this assessment.";
      setDipaAnswer(message);
      toast.error("Dipa analysis unavailable", { description: message });
    } finally {
      setDipaLoading(false);
    }
  };

  // Locate User
  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    toast.loading("Acquiring GPS fix…", { id: "gps" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss("gps");
        const pt = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const label = await reverseGeocode(pt);
        setCurrentLocation({ ...pt, label });
        setMapCenter([pt.lat, pt.lon]);
        setMapZoom(14);
        toast.success("Location acquired", { description: label });
      },
      (err) => {
        toast.dismiss("gps");
        toast.error("Could not obtain GPS location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Calculate a road route from the live routing provider, or use a dated cached
  // route when offline. A cached route is never represented as live navigation.
  const handleCalculateRoute = async () => {
    if (!navStartPoint || !navEndPoint) {
      toast.error("Please specify both origin and destination points.");
      return;
    }
    setRoutingLoading(true);
    setRoutingError("");
    setOfflineRouteInfo(null);
    const routeType = travelMode === "walking" ? "walking" : travelMode === "tractor" ? "tractor" : travelMode === "freight" ? "freight" : "road";

    const useCachedRoute = async () => {
      const cached = await getCachedNavigationRoute(navStartPoint, navEndPoint, travelMode);
      if (!cached) throw new Error("No saved route is available for these exact endpoints and travel mode.");
      setRouteData(cached.route);
      setOfflineRouteInfo(cached);
      setIsSimulatingNav(false);
      setSimulatedVehiclePos(null);
      setSimStepIndex(0);
      toast.message("Showing a saved route", {
        description: `Cached ${routeCacheAgeMinutes(cached)} minutes ago. This is not a live route or traffic update.`,
      });
    };

    try {
      if (!navigator.onLine) {
        await useCachedRoute();
        return;
      }
      const route = await calculateRoute(navStartPoint, navEndPoint, travelMode);
      setRouteData(route);
      setSimStepIndex(0);
      setIsSimulatingNav(false);
      setSimulatedVehiclePos(null);
      try {
        await cacheNavigationRoute({
          origin: navStartPoint,
          destination: navEndPoint,
          mode: travelMode,
          route,
          provider: "OSRM public demo routing service",
        });
      } catch (cacheError) {
        console.warn("Route could not be saved to the offline browser cache:", cacheError);
      }
      try {
        await saveSharedRoadRoute({
          routeType,
          origin: navStartPoint,
          destination: navEndPoint,
          geometry: route.geometry,
          distanceM: route.distanceKm * 1000,
          durationS: route.durationMinutes * 60,
          provider: "OSRM public demo routing service",
        });
      } catch (saveError) {
        console.warn("Route could not be saved to the shared route registry:", saveError);
      }
      toast.success("Road route calculated", {
        description: `${route.distanceKm} km · planning estimate ${route.durationMinutes} min. Traffic and heavy-vehicle restrictions are not verified.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to calculate navigation route.";
      try {
        await useCachedRoute();
      } catch (cacheError) {
        const cacheMessage = cacheError instanceof Error ? cacheError.message : "";
        setRoutingError(`${message} ${cacheMessage}`.trim());
        toast.error("Routing unavailable", { description: `${message} ${cacheMessage}`.trim() });
      }
    } finally {
      setRoutingLoading(false);
    }
  };

  // Route preview playback is a visual simulation, not a vehicle GPS feed.
  useEffect(() => {
    if (!isSimulatingNav || !routeData || !routeData.geometry.length) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 1;
      if (currentIndex >= routeData.geometry.length) {
        setIsSimulatingNav(false);
        toast.success("Arrived at destination!");
        clearInterval(interval);
        return;
      }
      const pos = routeData.geometry[currentIndex];
      setSimulatedVehiclePos(pos);
      setMapCenter(pos);

      // Estimate current step
      const stepIdx = Math.min(
        routeData.steps.length - 1,
        Math.floor((currentIndex / routeData.geometry.length) * routeData.steps.length)
      );
      setSimStepIndex(stepIdx);
      setSimulatedSpeedKmh(0);
    }, 800);

    return () => clearInterval(interval);
  }, [isSimulatingNav, routeData]);

  // Handle map click for picking navigation points
  const handlePickNavPoint = async (point: GeoPoint) => {
    const address = await reverseGeocode(point);
    if (navPickMode === "start") {
      setNavStartPoint(point);
      setNavStartText(address);
      setNavPickMode(null);
      toast.success("Origin set: " + address);
    } else if (navPickMode === "end") {
      setNavEndPoint(point);
      setNavEndText(address);
      setNavPickMode(null);
      toast.success("Destination set: " + address);
    }
  };

  // Sentinel Scene Search on location change
  useEffect(() => {
    if (basemap !== "sentinel") return;
    const controller = new AbortController();
    setSceneLoading(true);
    searchSentinelScenes({
      point: { lat: mapCenter[0], lon: mapCenter[1] },
      daysBack: Number(daysBack),
      maxCloudCover: Number(maxCloud),
      signal: controller.signal,
    })
      .then((results) => {
        setScenes(results);
        setSceneId(results[0]?.id ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setSceneLoading(false);
      });
    return () => controller.abort();
  }, [mapCenter, daysBack, maxCloud, basemap]);

  // Sentinel Tile Layer URL
  useEffect(() => {
    if (!selectedScene || isNasa || basemap !== "sentinel") {
      setTileTemplate("");
      return;
    }
    const controller = new AbortController();
    setTileLoading(true);
    getSentinelTileTemplate(
      selectedScene.itemUrl,
      imageryOverlay as "true-color" | "false-color" | SpectralIndex,
      controller.signal
    )
      .then(setTileTemplate)
      .catch(() => setTileTemplate(""))
      .finally(() => {
        if (!controller.signal.aborted) setTileLoading(false);
      });
    return () => controller.abort();
  }, [selectedScene, imageryOverlay, isNasa, basemap]);

  // Field Analysis
  const runFieldAnalysis = async () => {
    if (!selectedScene || fieldPoints.length < 3) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    const geometry: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[...fieldPoints.map((p) => [p.lon, p.lat]), [fieldPoints[0].lon, fieldPoints[0].lat]]],
    };
    try {
      const [ndvi, ndmi, ndwi] = await Promise.all([
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndvi"),
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndmi"),
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndwi"),
      ]);
      setFieldStats({ ndvi, ndmi, ndwi });
      toast.success("Field spectral analysis completed", {
        description: `NDVI: ${ndvi.mean?.toFixed(3) ?? "—"} | NDMI: ${ndmi.mean?.toFixed(3) ?? "—"}`,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Field analysis could not be completed.";
      setAnalysisError(errorMessage);
      toast.error("Spectral analysis failed: " + errorMessage);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const inspectPoint = async (point: GeoPoint) => {
    if (drawing || navPickMode) return;
    if (!selectedScene) {
      const address = await reverseGeocode(point);
      setCurrentLocation({ ...point, label: address });
      return;
    }
    if (isNasa) return;
    setSampleLoading(true);
    setSample({ point, values: {} });
    try {
      const indices: SpectralIndex[] = ["ndvi", "ndmi", "ndwi"];
      const entries = await Promise.all(
        indices.map(async (index) => [index, await getIndexAtPoint(selectedScene.itemUrl, point, index)] as const)
      );
      setSample({ point, values: Object.fromEntries(entries) });
    } catch (err) {
      console.warn("Failed to inspect point indices:", err);
    } finally {
      setSampleLoading(false);
    }
  };

  // Supabase Monitored Fields & Alerts Loading
  const refreshSavedFields = useCallback(async () => {
    if (!user) return;
    const { data: fields } = await supabase
      .from("satellite_fields")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedFields(fields ?? []);
    if (fields?.length) {
      const { data: alerts } = await supabase
        .from("satellite_field_alerts")
        .select("*")
        .in("field_id", fields.map((f) => f.id))
        .order("created_at", { ascending: false })
        .limit(20);
      setSavedAlerts(alerts ?? []);
    }
  }, [user]);

  useEffect(() => {
    void refreshSavedFields();
  }, [refreshSavedFields]);

  const handleCaptureGeoFeaturePoint = useCallback((point: GeoPoint) => {
    setGeoFeaturePoint(point);
    setCaptureGeoFeaturePoint(false);
    setMapCenter([point.lat, point.lon]);
    setMapZoom(17);
    toast.success("Map position selected", { description: `${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}` });
  }, []);

  const handleSaveGeoFeature = async () => {
    if (!user) {
      toast.error("Sign in to save a shared map record.");
      return;
    }
    if (!geoFeatureName.trim() || !geoFeaturePoint) {
      toast.error("Enter a name and select a position on the map.");
      return;
    }
    setGeoFeatureSaving(true);
    try {
      const feature = await createGeoFeature({
        featureType: geoFeatureType,
        name: geoFeatureName.trim(),
        description: geoFeatureNotes.trim() || undefined,
        visibility: "private",
        geometry: toPointGeometry(geoFeaturePoint),
        properties: {
          registration_method: "manual_map_pin",
          source_context: "AgroClimate Satellite",
        },
        sourceName: "User-pinned location in AgroClimate Satellite",
        dataQuality: "unverified",
      });
      toast.success("Map record saved privately", { description: `${feature.name} · ${feature.feature_type}` });
      setGeoFeatureName("");
      setGeoFeatureNotes("");
      setGeoFeaturePoint(null);
      setCaptureGeoFeaturePoint(false);
    } catch (error) {
      toast.error("Could not save this map record", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setGeoFeatureSaving(false);
    }
  };

  const handleInspectMapLocation = useCallback((point: GeoPoint, label: string) => {
    setMapCenter([point.lat, point.lon]);
    setMapZoom(15);
    setCurrentLocation({ ...point, label });
    setSearchQuery(label);
    setShowSearchResults(false);
  }, []);

  const handleMaritimeMapData = useCallback((events: MaritimeSosEvent[], positions: MaritimeMapPosition[]) => {
    setMaritimeEvents(events);
    setMaritimePositions(positions);
  }, []);

  const handleSelectPort = useCallback((port: PortSearchFeature) => {
    const label = `${port.name} · OpenStreetMap mapped port`;
    handleInspectMapLocation({ lat: port.lat, lon: port.lon }, label);
    toast.message(port.name, { description: "Mapped location only. Operational status, cargo capabilities and customs services are not verified." });
  }, [handleInspectMapLocation]);

  // Filtered Boards by Category
  const filteredBoards = useMemo(() => {
    if (activeCategory === "ALL") return STRATEGIC_BOARDS;
    return STRATEGIC_BOARDS.filter((b) => b.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-[#070b14] text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* ─────────────────────────────────────────────────────────────
          TOP COMMAND & TELEMETRY BAR (Matching Attached Screenshot)
      ───────────────────────────────────────────────────────────── */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#0a101f]/95 px-3 backdrop-blur-md">
        {/* Left: Mode Tabs & Back */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-slate-900/90 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveMode("QUERY");
                setNavOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono font-bold tracking-wider transition ${
                activeMode === "QUERY"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              &lt; QUERY
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("TRACK");
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono font-bold tracking-wider transition ${
                activeMode === "TRACK"
                  ? "bg-amber-500 text-slate-950 font-extrabold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              TRACK
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800"
            title="Toggle Boards Dossier"
          >
            <span>BOARDS {STRATEGIC_BOARDS.length}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Center: Strategic Layers Pill Bar */}
        <div className="hidden items-center gap-1.5 md:flex">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mr-1">LAYERS</span>
          {[
            { id: "ALL", label: "ALL", color: "bg-slate-400" },
            { id: "maritime", label: "maritime", color: "bg-sky-400" },
            { id: "commodity", label: "commodity", color: "bg-amber-400" },
            { id: "energy", label: "energy", color: "bg-rose-400" },
            { id: "battery", label: "battery", color: "bg-purple-400" },
            { id: "agriculture", label: "agriculture", color: "bg-emerald-400" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono transition border ${
                activeCategory === cat.id
                  ? "border-slate-500 bg-slate-800 text-white shadow-sm"
                  : "border-transparent bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cat.color}`} />
              <span>{cat.label}</span>
            </button>
          ))}

          {/* Other Layers Basemap & Spectral Index Dropdown */}
          <div className="relative group ml-1">
            <button className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-slate-700">
              <span>OTHER LAYERS</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden w-56 rounded-lg border border-slate-800 bg-[#0b1325] p-2 shadow-2xl group-hover:block z-50">
              <div className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1">Basemap Imagery</div>
              <button
                onClick={() => setBasemap("esri-satellite")}
                className={`w-full text-left px-2 py-1 text-xs rounded font-mono ${
                  basemap === "esri-satellite" ? "text-amber-400 bg-slate-800/80" : "text-slate-300 hover:bg-slate-800/40"
                }`}
              >
                Esri High-Res Satellite
              </button>
              <button
                onClick={() => setBasemap("tactical-dark")}
                className={`w-full text-left px-2 py-1 text-xs rounded font-mono ${
                  basemap === "tactical-dark" ? "text-amber-400 bg-slate-800/80" : "text-slate-300 hover:bg-slate-800/40"
                }`}
              >
                Tactical Deep Dark (AIS/SAR)
              </button>
              <button
                onClick={() => setBasemap("sentinel")}
                className={`w-full text-left px-2 py-1 text-xs rounded font-mono ${
                  basemap === "sentinel" ? "text-amber-400 bg-slate-800/80" : "text-slate-300 hover:bg-slate-800/40"
                }`}
              >
                Sentinel-2 STAC 10m
              </button>

              <div className="my-1 border-t border-slate-800" />
              <div className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1">Spectral Indices</div>
              <button
                onClick={() => setImageryOverlay("ndvi")}
                className="w-full text-left px-2 py-1 text-xs rounded font-mono text-slate-300 hover:bg-slate-800/40 flex items-center justify-between"
              >
                <span>NDVI Crop Greenness</span>
                <span className="text-[10px] text-emerald-400">10m</span>
              </button>
              <button
                onClick={() => setImageryOverlay("ndmi")}
                className="w-full text-left px-2 py-1 text-xs rounded font-mono text-slate-300 hover:bg-slate-800/40 flex items-center justify-between"
              >
                <span>NDMI Canopy Moisture</span>
                <span className="text-[10px] text-sky-400">20m</span>
              </button>
              <button
                onClick={() => setImageryOverlay("ndwi")}
                className="w-full text-left px-2 py-1 text-xs rounded font-mono text-slate-300 hover:bg-slate-800/40 flex items-center justify-between"
              >
                <span>NDWI Surface Water</span>
                <span className="text-[10px] text-cyan-400">10m</span>
              </button>
              <button
                onClick={() => setImageryOverlay("nasa-true")}
                className="w-full text-left px-2 py-1 text-xs rounded font-mono text-slate-300 hover:bg-slate-800/40 flex items-center justify-between"
              >
                <span>NASA GIBS Global Day</span>
                <span className="text-[10px] text-slate-400">MODIS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Feed Status, Full Board, and Tools */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] text-amber-300">
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1">STRATEGIC REFERENCE BOARD</span>
            <span className="text-slate-400">Illustrative board values are not verified live telemetry.</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setFullBoardModal(true)}
            className="hidden sm:flex h-8 gap-1 border-slate-700 bg-slate-900 text-xs font-mono text-slate-200 hover:bg-slate-800"
          >
            <Maximize2 className="h-3.5 w-3.5 text-amber-400" />
            <span>FULL BOARD VIEW</span>
          </Button>

          <Button size="sm" variant={geoFeaturePanelOpen ? "default" : "outline"}
            onClick={() => setGeoFeaturePanelOpen((open) => !open)}
            className={`h-8 gap-1.5 text-xs font-mono ${geoFeaturePanelOpen ? "bg-emerald-700 text-white" : "border-slate-700 bg-slate-900 text-slate-300"}`}>
            <MapPin className="h-3.5 w-3.5" /><span className="hidden sm:inline">Add location</span>
          </Button>

          <Button size="sm" variant={portsLayerEnabled ? "default" : "outline"}
            onClick={() => setPortsLayerEnabled((enabled) => !enabled)}
            className={`h-8 gap-1.5 text-xs font-mono ${portsLayerEnabled ? "bg-cyan-700 text-white" : "border-slate-700 bg-slate-900 text-slate-300"}`}
            title="Discover mapped ports in the current view">
            <Anchor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ports</span>
            {portsLayerEnabled && mappedPorts.length > 0 ? <span>{mappedPorts.length}</span> : null}
          </Button>

          {/* Navigation Route Toggle Button */}
          <Button
            size="sm"
            variant={navOpen ? "default" : "outline"}
            onClick={() => setNavOpen(!navOpen)}
            className={`h-8 gap-1.5 text-xs font-mono ${
              navOpen ? "bg-sky-600 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Directions</span>
          </Button>

          {/* Field Boundary Drawing Toggle */}
          <Button
            size="sm"
            variant={drawing ? "destructive" : "outline"}
            onClick={() => {
              setDrawing(!drawing);
              setNavPickMode(null);
            }}
            className="h-8 gap-1 text-xs font-mono border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            <Ruler className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">{drawing ? "Stop" : "Draw field"}</span>
          </Button>

          {/* Alerts Bell */}
          <button
            type="button"
            onClick={() => setAlertsDrawerOpen(true)}
            className="relative rounded-md border border-slate-800 bg-slate-900/80 p-2 text-slate-300 hover:text-white hover:bg-slate-800"
            title="Satellite Alerts"
          >
            <Bell className="h-4 w-4" />
            {savedAlerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {savedAlerts.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN WORKSPACE GRID (Left Dossier, Center Map, Right HUD)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── LEFT INTELLIGENCE DOSSIER DRAWER (Collapsible) ── */}
        <aside
          className={`z-20 flex h-full flex-col border-r border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-md transition-all duration-300 ${
            sidebarOpen ? "w-80 lg:w-96" : "w-0 -translate-x-full border-r-0 overflow-hidden"
          }`}
        >
          {/* Top Board Title & Esc */}
          <div className="border-b border-slate-800/80 p-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>GLOBAL VIEW ESC</span>
              </button>
              {activeBoard.beta && (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-400 font-mono">
                  BETA
                </Badge>
              )}
            </div>

            <h1 className="mt-2 font-mono text-sm font-bold text-amber-400 leading-snug">
              {activeBoard.title}
            </h1>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-sans line-clamp-3">
              {activeBoard.summary}
            </p>

            <div className="mt-3 rounded-md bg-slate-900/80 p-2.5 border border-slate-800 text-[11px] leading-relaxed">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
                <span>REGIONAL READ &mdash; DESCRIPTIVE, NOT A FORECAST</span>
                {activeBoard.staleDays && (
                  <span className="text-amber-500 font-bold">STALE {activeBoard.staleDays}d</span>
                )}
              </div>
              <p className="mt-1 text-slate-300">{activeBoard.regionalRead}</p>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">Strategic-board metrics are reference values, not verified live telemetry. Field observations display their own source and acquisition dates.</p>

            {/* Badges */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeBoard.statusBadges.map((badge, idx) => (
                <span
                  key={idx}
                  className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="border-b border-slate-800/80 p-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-300"><Sparkles className="h-4 w-4" /> DIPA SATELLITE INTELLIGENCE</div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Ask about the selected location or field. Dipa receives available coordinates, imagery date and measured field indices, and must identify missing evidence.</p>
            <form onSubmit={(event) => void handleAskDipa(event)} className="mt-2 space-y-2">
              <Input value={dipaQuestion} onChange={(event) => setDipaQuestion(event.target.value)} placeholder="Ask Dipa about this location…" className="h-9 border-slate-700 bg-slate-900 text-xs text-slate-100 placeholder:text-slate-500" disabled={dipaLoading} />
              <Button type="submit" size="sm" disabled={!dipaQuestion.trim() || dipaLoading} className="w-full h-8 bg-sky-700 hover:bg-sky-600 text-xs">
                {dipaLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                {dipaLoading ? "Analyzing…" : "Ask Dipa"}
              </Button>
            </form>
            {dipaAnswer && <div className="mt-2 rounded-md border border-sky-900/70 bg-sky-950/30 p-2.5 text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">{dipaAnswer}</div>}
          </div>

          {geoFeaturePanelOpen && (
            <div className="border-b border-slate-800/80 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-300">
                <MapPin className="h-4 w-4" /> REGISTER A SHARED MAP RECORD
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">Pin an actual location, such as a warehouse, silo, cold store, buyer, supplier, port, pickup or delivery point. New records are private and marked unverified until evidence is attached.</p>
              <select value={geoFeatureType} onChange={(event) => setGeoFeatureType(event.target.value as GeoFeatureType)}
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100">
                <option value="warehouse">Warehouse</option>
                <option value="silo">Silo</option>
                <option value="cold_store">Cold store</option>
                <option value="collection_centre">Collection centre</option>
                <option value="processing_facility">Processing facility</option>
                <option value="buyer">Buyer location</option>
                <option value="supplier">Supplier location</option>
                <option value="port">Port / harbour</option>
                <option value="pickup_point">Pickup point</option>
                <option value="delivery_point">Delivery point</option>
                <option value="water_source">Water source</option>
                <option value="road_hazard">Road hazard</option>
                <option value="drone_observation">Aerial observation point</option>
                <option value="other">Other</option>
              </select>
              <Input value={geoFeatureName} onChange={(event) => setGeoFeatureName(event.target.value)}
                placeholder="Record name" className="h-9 border-slate-700 bg-slate-900 text-xs text-slate-100" />
              <Input value={geoFeatureNotes} onChange={(event) => setGeoFeatureNotes(event.target.value)}
                placeholder="Description / reference (optional)" className="h-9 border-slate-700 bg-slate-900 text-xs text-slate-100" />
              <Button size="sm" variant={captureGeoFeaturePoint ? "destructive" : "outline"} className="w-full h-8 border-slate-700 bg-slate-900 text-xs"
                onClick={() => { setCaptureGeoFeaturePoint((value) => !value); setDrawing(false); setNavPickMode(null); }}>
                {captureGeoFeaturePoint ? "Cancel map selection" : geoFeaturePoint ? "Choose another map position" : "Pick exact position on map"}
              </Button>
              {geoFeaturePoint && (
                <div className="rounded border border-slate-700 bg-slate-900 p-2 text-[10px] text-slate-300">
                  Selected {geoFeaturePoint.lat.toFixed(6)}, {geoFeaturePoint.lon.toFixed(6)}
                </div>
              )}
              <Button size="sm" onClick={() => void handleSaveGeoFeature()} disabled={geoFeatureSaving || !geoFeatureName.trim() || !geoFeaturePoint} className="w-full h-8 bg-emerald-700 hover:bg-emerald-600 text-xs">
                {geoFeatureSaving ? "Saving private record…" : "Save to shared geospatial registry"}
              </Button>
            </div>
          )}

          <LandSuitabilityPanel
            point={suitabilityPoint}
            pointLabel={fieldPoints.length >= 3 ? "Drawn field centroid · climate point screen" : currentLocation.label}
            fieldGeometry={suitabilityGeometry}
            fieldAreaHa={fieldPoints.length >= 3 ? fieldArea : undefined}
          />

          <div className="border-b border-slate-800/80 p-3">
            <Button size="sm" variant="outline" className="w-full h-8 border-slate-700 bg-slate-900 text-xs"
              onClick={() => setMaritimePanelOpen((open) => !open)}>
              <Anchor className="mr-2 h-3.5 w-3.5" /> {maritimePanelOpen ? "Hide maritime safety" : "Open maritime safety & rescue"}
            </Button>
          </div>
          {maritimePanelOpen && (
            <div className="border-b border-slate-800/80 p-2">
              <MaritimeSafetyPanel onInspectLocation={handleInspectMapLocation} onMapDataChange={handleMaritimeMapData} />
            </div>
          )}

          {/* Monitored Corridors & Boards List */}
          <div className="p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Strategic Reference Boards ({filteredBoards.length})
            </div>
            {filteredBoards.map((board) => {
              const isSelected = board.id === selectedBoardId;
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => handleSelectBoard(board)}
                  className={`w-full rounded-lg border p-2.5 text-left transition ${
                    isSelected
                      ? "border-amber-500/80 bg-amber-500/10 shadow-sm"
                      : "border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200 line-clamp-1">
                      {board.title.split("—")[0]}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-amber-400 tabular-nums">
                      {board.currentStatMetric} {board.currentStatValue.split(" ")[0]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="capitalize">{board.category}</span>
                    <span>{board.stations.length} stations</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom GPS Location Strip */}
          <div className="border-t border-slate-800/80 p-3 bg-slate-950/60 flex items-center justify-between text-xs font-mono">
            <div className="truncate text-slate-400">
              <span className="text-slate-500">Center:</span> {mapCenter[0].toFixed(3)}, {mapCenter[1].toFixed(3)}
            </div>
            <button
              onClick={locateMe}
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
              title="My current location"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              <span>GPS</span>
            </button>
          </div>
          </div>
        </aside>

        {/* ── CENTER MAP VIEWPORT (Satellite, Intel HUD, Google Earth Search & Navigation) ── */}
        <main className="relative flex-1 h-full w-full bg-[#050913]">
          {/* Map Container */}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            maxZoom={22}
            scrollWheelZoom
            preferCanvas
            zoomControl={false}
            className="h-full w-full"
          >
            {/* Basemap Tiles */}
            <TileLayer
              key={basemap}
              url={BASEMAP_TILES[basemap].url}
              attribution={BASEMAP_TILES[basemap].attribution}
              maxZoom={22}
              maxNativeZoom={BASEMAP_TILES[basemap].maxZoom}
              updateWhenIdle
              keepBuffer={3}
            />

            {/* Hybrid Labels/Roads Overlay if Hybrid selected */}
            {basemap === "hybrid" && (
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                attribution="&copy; OpenStreetMap &copy; CARTO"
                maxZoom={19}
              />
            )}

            {/* NASA GIBS Context Layer if active */}
            {isNasa && (
              <TileLayer
                key={nasaUrl}
                url={nasaUrl}
                maxZoom={9}
                attribution='Imagery: &copy; <a href="https://earthdata.nasa.gov/">NASA GIBS / Earthdata</a>'
              />
            )}

            {/* Sentinel-2 TiTiler Real Tile Overlay */}
            {basemap === "sentinel" && tileTemplate && (
              <TileLayer
                key={tileTemplate}
                url={tileTemplate}
                maxZoom={18}
                attribution='Sentinel-2 data: AWS Open Data / TiTiler'
              />
            )}

            {/* Map Camera Controller */}
            <MapCameraController center={mapCenter} zoom={mapZoom} />

            {/* Route Bounds Controller */}
            <RouteBoundsController route={routeData} />

            {/* Map Interaction Events */}
            <MapEventsHandler
              drawing={drawing}
              navPickMode={navPickMode}
              captureFeature={captureGeoFeaturePoint}
              onCaptureFeaturePoint={handleCaptureGeoFeaturePoint}
              onMapClick={(point) => {
                setFieldPoints((prev) => [...prev, point]);
                setFieldStats({});
              }}
              onSample={(point) => void inspectPoint(point)}
              onPickNavPoint={(point) => void handlePickNavPoint(point)}
            />

            <GeoFeaturesMapLayer onSelect={handleInspectMapLocation} />
            <PortsMapLayer enabled={portsLayerEnabled} onResults={setMappedPorts} onSelect={handleSelectPort} />
            {maritimeEvents.map((event) => (
              <CircleMarker key={`maritime-sos-${event.id}`} center={[event.lat, event.lon]}
                radius={event.status === "BROADCAST" ? 10 : 8}
                pathOptions={{ color: event.status === "BROADCAST" ? "#fb7185" : "#f59e0b", weight: 2, fillColor: event.status === "BROADCAST" ? "#be123c" : "#b45309", fillOpacity: 0.85 }}>
                <Popup>
                  <strong>Maritime emergency · {event.status}</strong>
                  <div>{event.vessel_id}</div>
                  <div>{new Date(event.created_at).toLocaleString()}</div>
                  <div className="text-amber-700">Map marker only. Rescue response status is shown in the Maritime Safety panel.</div>
                </Popup>
              </CircleMarker>
            ))}
            {maritimePositions.map((position) => (
              <CircleMarker key={`vessel-location-${position.vesselId}`} center={[position.point.lat, position.point.lon]} radius={7}
                pathOptions={{ color: "#38bdf8", weight: 2, fillColor: "#0369a1", fillOpacity: 0.9 }}>
                <Popup>
                  <strong>{position.vesselName}</strong>
                  <div>Recorded GPS position · {new Date(position.capturedAt).toLocaleString()}</div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Strategic Corridor & Stations Overlay (Attached Image) */}
            <StrategicCorridorOverlay
              corridorLine={activeBoard.corridorLine}
              stations={activeBoard.stations}
              selectedStationId={selectedStationId}
              onSelectStation={handleSelectStation}
            />

            {/* Real-time Navigation Route Overlay */}
            <NavigationRouteOverlay
              route={routeData}
              startPoint={navStartPoint ? [navStartPoint.lat, navStartPoint.lon] : null}
              endPoint={navEndPoint ? [navEndPoint.lat, navEndPoint.lon] : null}
              simulatedPosition={simulatedVehiclePos}
              simulatedHeading={simStepIndex * 45}
            />

            {/* Drawn Field Boundaries */}
            {fieldPoints.length > 0 && (
              <Polygon
                positions={fieldPoints.map((pt) => [pt.lat, pt.lon])}
                pathOptions={{
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  weight: 2,
                  fillOpacity: 0.2,
                  dashArray: "4 4",
                }}
              />
            )}
            {fieldPoints.map((pt, idx) => (
              <Marker
                key={`field-pt-${idx}`}
                position={[pt.lat, pt.lon]}
                icon={L.divIcon({
                  className: "field-corner-pin",
                  html: `<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid white;box-shadow:0 0 6px #f59e0b;"></div>`,
                  iconSize: [10, 10],
                  iconAnchor: [5, 5],
                })}
              />
            ))}

            {/* Monitored Saved Fields Boundaries from Database */}
            {savedFields
              .filter((f) => f.monitoring_enabled)
              .map((field) => (
                <GeoJSON
                  key={field.id}
                  data={field.field_geojson as unknown as GeoJSON.GeoJsonObject}
                  style={{ color: "#10b981", weight: 2, fillOpacity: 0.12, dashArray: "5 4" }}
                />
              ))}
          </MapContainer>

          {/* ── GOOGLE EARTH SEARCH BAR (Floating Top-Left) ── */}
          <div className="absolute left-4 top-4 z-[400] w-80 sm:w-96">
            <div className="relative flex items-center rounded-lg border border-slate-700/80 bg-[#0a1122]/95 shadow-2xl backdrop-blur-md">
              <Search className="absolute left-3 h-4 w-4 text-sky-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                placeholder="Search globally: farm, port, city, facility or coordinates…"
                className="h-10 w-full rounded-lg bg-transparent pl-9 pr-16 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />}
                <button
                  type="button"
                  onClick={locateMe}
                  className="rounded p-1 text-slate-400 hover:text-white"
                  title="My GPS location"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Autocomplete Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-[#0a1122]/98 p-1.5 shadow-2xl backdrop-blur-md">
                {searchResults.map((item) => (
                  <button
                    key={item.placeId}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-slate-800/80 transition"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-200">{item.name}</p>
                      <p className="truncate text-[10px] text-slate-400 font-mono">{item.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── REAL-TIME NAVIGATION / DIRECTIONS PANEL (Floating) ── */}
          {navOpen && (
            <div className="absolute left-4 top-16 z-[400] w-80 sm:w-96 rounded-xl border border-slate-700/80 bg-[#090f1f]/95 p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 font-bold text-sky-400">
                  <Navigation className="h-4 w-4" />
                  ROAD ROUTING & DIRECTIONS
                </span>
                <button
                  onClick={() => setNavOpen(false)}
                  className="rounded p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {offlineRouteInfo && (
                <div className="mt-2 rounded border border-amber-700/40 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100">
                  Cached road route · saved {routeCacheAgeMinutes(offlineRouteInfo)} minutes ago. This is not a live route, traffic update or confirmation that the road remains passable.
                </div>
              )}
              {routingError && <div className="mt-2 rounded border border-rose-800/50 bg-rose-950/30 p-2 text-[10px] text-rose-200">{routingError}</div>}

              {/* Mode Selector */}
              <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-md bg-slate-900/90 p-1 border border-slate-800">
                {[
                  { id: "freight", label: "Freight", icon: Truck },
                  { id: "driving", label: "Auto", icon: Navigation },
                  { id: "tractor", label: "Tractor", icon: Sprout },
                  { id: "walking", label: "Walk", icon: Compass },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTravelMode(m.id as TravelMode)}
                      className={`flex flex-col items-center gap-0.5 rounded py-1 text-[10px] transition ${
                        travelMode === m.id
                          ? "bg-sky-600 text-white font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Origin & Destination inputs */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-[10px]">
                    A
                  </span>
                  <input
                    type="text"
                    value={navStartText}
                    onChange={(e) => setNavStartText(e.target.value)}
                    placeholder="Origin or click 'Set A' on map"
                    className="h-8 flex-1 rounded border border-slate-800 bg-slate-900/90 px-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNavPickMode(navPickMode === "start" ? null : "start")}
                    className={`rounded px-2 py-1 text-[10px] border ${
                      navPickMode === "start"
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {navPickMode === "start" ? "Click map…" : "Pick on map"}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
                    B
                  </span>
                  <input
                    type="text"
                    value={navEndText}
                    onChange={(e) => setNavEndText(e.target.value)}
                    placeholder="Destination or click 'Pick on map'"
                    className="h-8 flex-1 rounded border border-slate-800 bg-slate-900/90 px-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNavPickMode(navPickMode === "end" ? null : "end")}
                    className={`rounded px-2 py-1 text-[10px] border ${
                      navPickMode === "end"
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {navPickMode === "end" ? "Click map…" : "Pick on map"}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCalculateRoute}
                  disabled={routingLoading || !navStartPoint || !navEndPoint}
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs h-8 gap-1"
                >
                  {routingLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}
                  Calculate Live Route
                </Button>
                {routeData && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSimulatingNav(!isSimulatingNav)}
                    className="border-slate-700 bg-slate-900 text-xs font-mono text-emerald-400 hover:bg-slate-800 h-8 gap-1"
                  >
                    <Play className={`h-3.5 w-3.5 ${isSimulatingNav ? "text-amber-400 animate-pulse" : ""}`} />
                    <span>{isSimulatingNav ? "Pause" : "Live Simulation"}</span>
                  </Button>
                )}
              </div>

              {/* Route Summary & Turn-by-Turn Steps */}
              {routeData && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div>
                      <span className="text-base font-bold text-emerald-400 tabular-nums">
                        {routeData.distanceKm} km
                      </span>
                      <span className="ml-2 text-slate-400">
                        {Math.floor(routeData.durationMinutes / 60) > 0
                          ? `${Math.floor(routeData.durationMinutes / 60)}h `
                          : ""}
                        {routeData.durationMinutes % 60}m
                      </span>
                    </div>
                    {isSimulatingNav && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                        {simulatedSpeedKmh} km/h
                      </Badge>
                    )}
                  </div>

                  {/* Active Guidance Step during Simulation */}
                  {routeData.steps[simStepIndex] && (
                    <div className="mt-2 rounded bg-sky-950/40 border border-sky-800/40 p-2 text-sky-200 text-[11px] flex items-start gap-2">
                      <Navigation className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-white">Next Maneuver:</div>
                        <div>{routeData.steps[simStepIndex].instruction}</div>
                      </div>
                    </div>
                  )}

                  {/* Steps Scroll Area */}
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {routeData.steps.slice(0, 8).map((step, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start justify-between text-[10px] p-1 rounded ${
                          idx === simStepIndex ? "bg-slate-800 text-amber-300 font-bold" : "text-slate-400"
                        }`}
                      >
                        <span className="line-clamp-1">{idx + 1}. {step.instruction}</span>
                        <span className="shrink-0 tabular-nums text-slate-500 ml-2">
                          {(step.distanceMeters / 1000).toFixed(1)} km
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DRAWING MODE HUD BANNER ── */}
          {drawing && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 z-[400] flex items-center gap-3 rounded-lg border border-amber-500/80 bg-[#0c1427]/95 px-4 py-2 font-mono text-xs shadow-2xl backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Ruler className="h-4 w-4" />
                Click map to draw boundary ({fieldPoints.length} points &bull; {fieldArea.toFixed(2)} ha)
              </span>
              <Button
                size="sm"
                onClick={runFieldAnalysis}
                disabled={fieldPoints.length < 3 || analysisLoading}
                className="h-7 bg-amber-500 text-black hover:bg-amber-400 text-xs font-bold"
              >
                {analysisLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Analyse Sentinel Indices
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFieldPoints([])}
                className="h-7 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
          )}

          {/* ── MAP ZOOM & COMPASS HUD CONTROLS (Floating Top Right) ── */}
          <div className="absolute right-4 top-4 z-[400] flex flex-col gap-1.5">
            <button
              onClick={() => setMapZoom((z) => Math.min(22, z + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900/90 text-slate-200 hover:bg-slate-800 shadow"
              title="Zoom In"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMapZoom((z) => Math.max(2, z - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900/90 text-slate-200 hover:bg-slate-800 shadow"
              title="Zoom Out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setMapCenter(activeBoard.center);
                setMapZoom(activeBoard.zoom);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900/90 text-sky-400 hover:bg-slate-800 shadow"
              title="Reset Corridor View"
            >
              <Compass className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTelemetryOpen(!telemetryOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900/90 text-amber-400 hover:bg-slate-800 shadow"
              title="Toggle Telemetry Cards"
            >
              <Sliders className="h-4 w-4" />
            </button>
          </div>

          {portsLayerEnabled && (
            <div className="absolute left-4 bottom-16 z-[400] rounded-md border border-cyan-800/60 bg-[#071827]/95 px-3 py-2 text-[10px] text-cyan-100 shadow-xl">
              {mappedPorts.length} mapped port feature(s) in view · OpenStreetMap · status and cargo capability unverified
            </div>
          )}

          {/* ── BOTTOM MAP LEGEND STRIP (Faithful to Screenshot) ── */}
          <div className="absolute bottom-3 left-4 z-[400] hidden sm:flex items-center gap-4 rounded-md border border-slate-800/80 bg-[#09101f]/90 px-3 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur-md">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 border border-slate-400" />
              stock &mdash; level
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-sky-400" />
              flow &mdash; rate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-sky-400" />
              corridor &mdash; charted lane
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 border-b border-dashed border-slate-400" />
              anchorage spur
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span>&#9733;</span>
              selected
            </span>
          </div>

          {/* ── RIGHT TELEMETRY HUD & TIME-SERIES CARDS (Floating over Map) ── */}
          {telemetryOpen && (
            <aside className="absolute right-4 bottom-4 top-16 z-[400] flex w-80 sm:w-96 flex-col gap-2.5 pointer-events-none">
              {/* Primary Telemetry Card (Screenshot: Bab el-Mandeb gate) */}
              <div className="pointer-events-auto rounded-xl border border-slate-700/80 bg-[#090f1e]/96 p-4 shadow-2xl backdrop-blur-md font-mono">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">{selectedStation.name}</h2>
                    <p className="text-[10px] uppercase text-slate-400">{activeBoard.currentStatSub}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-mono ${
                      selectedStation.deltaType === "up"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                    }`}
                  >
                    {selectedStation.status}
                  </Badge>
                </div>

                {/* Big Primary Metric */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-400 tabular-nums">
                    {selectedStation.metricValue}
                  </span>
                  <span className="text-xs text-slate-400">{activeBoard.timeframeUnit}</span>
                  <span
                    className={`ml-auto text-xs font-bold ${
                      selectedStation.deltaType === "up" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {selectedStation.delta}
                  </span>
                </div>

                {/* Time-Series Trend Chart (Observed vs Rolling Average with Reference Band) */}
                <div className="mt-3 h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        fontSize={9}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#070d1a",
                          borderColor: "#334155",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontFamily: "monospace",
                        }}
                      />
                      {/* Confidence spread band */}
                      <Area
                        type="monotone"
                        dataKey="upperBand"
                        stroke="none"
                        fill="url(#bandGrad)"
                      />
                      {/* Observed daily counts line */}
                      <Line
                        type="monotone"
                        dataKey="observed"
                        stroke="#f1f5f9"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#f59e0b" }}
                      />
                      {/* 7-day rolling average line */}
                      <Line
                        type="monotone"
                        dataKey="average7d"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Time Range Selector & Legend */}
                <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-100" /> observed
                    </span>
                    <span className="flex items-center gap-1 text-sky-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> average (7d)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {(["30d", "90d", "1y"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setChartRange(r)}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          chartRange === r
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFullBoardModal(true)}
                  className="mt-3 w-full border-slate-800 bg-slate-900/60 text-xs font-mono text-slate-300 hover:bg-slate-800"
                >
                  FULL BOARD VIEW
                </Button>
              </div>

              {/* Secondary Station Mini-Cards Grid (Screenshot Lower Right) */}
              <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeBoard.stations.slice(0, 3).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStation(st)}
                    className={`rounded-lg border p-2 text-left font-mono transition backdrop-blur-md ${
                      st.id === selectedStationId
                        ? "border-amber-500 bg-[#0e172a]/95 text-white"
                        : "border-slate-800/90 bg-[#090f1d]/90 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <p className="truncate text-[10px] font-bold text-slate-200">{st.name}</p>
                    <div className="mt-1 flex items-baseline justify-between text-[11px]">
                      <span className="font-bold text-amber-400">{st.metricValue}</span>
                      <span className={`text-[9px] ${st.deltaType === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                        {st.delta}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-500">{st.sensor}</p>
                  </button>
                ))}
              </div>

              {/* Field Spectral Stats summary if analysis was run */}
              {fieldStats.ndvi && (
                <div className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-[#09151e]/96 p-3 shadow-2xl backdrop-blur-md font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Sprout className="h-3.5 w-3.5" />
                      FIELD SPECTRAL INDICES
                    </span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">
                      {fieldArea.toFixed(2)} ha
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded bg-slate-900/60 p-1 border border-slate-800">
                      <div className="text-[10px] text-slate-400">NDVI</div>
                      <div className="text-sm font-bold text-emerald-400">{fieldStats.ndvi.mean?.toFixed(3) ?? "—"}</div>
                    </div>
                    <div className="rounded bg-slate-900/60 p-1 border border-slate-800">
                      <div className="text-[10px] text-slate-400">NDMI</div>
                      <div className="text-sm font-bold text-sky-400">{fieldStats.ndmi?.mean?.toFixed(3) ?? "—"}</div>
                    </div>
                    <div className="rounded bg-slate-900/60 p-1 border border-slate-800">
                      <div className="text-[10px] text-slate-400">NDWI</div>
                      <div className="text-sm font-bold text-cyan-400">{fieldStats.ndwi?.mean?.toFixed(3) ?? "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FULL BOARD VIEW MATRIX MODAL
      ───────────────────────────────────────────────────────────── */}
      {fullBoardModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0a1122] shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div>
                <h3 className="text-base font-bold text-amber-400">{activeBoard.title}</h3>
                <p className="text-xs text-slate-400">Comprehensive station registry and live observations</p>
              </div>
              <button
                onClick={() => setFullBoardModal(false)}
                className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-2">Station / Node</th>
                    <th className="py-2">Measurement</th>
                    <th className="py-2">Delta</th>
                    <th className="py-2">Sensor</th>
                    <th className="py-2">Observed</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeBoard.stations.map((st) => (
                    <tr
                      key={st.id}
                      onClick={() => {
                        handleSelectStation(st);
                        setFullBoardModal(false);
                      }}
                      className="cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <td className="py-2.5 font-bold text-slate-200">
                        {st.name}
                        <div className="text-[10px] text-slate-500 font-normal">{st.subLabel}</div>
                      </td>
                      <td className="py-2.5 font-bold text-amber-400">{st.metricLabel}</td>
                      <td
                        className={`py-2.5 font-bold ${
                          st.deltaType === "up" ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {st.delta}
                      </td>
                      <td className="py-2.5 text-sky-400">{st.sensor}</td>
                      <td className="py-2.5 text-slate-400">{st.sensorDate}</td>
                      <td className="py-2.5">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                          {st.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 p-3 bg-slate-950/80 text-[11px] text-slate-400">
              <span>Feed timestamp: 2026-07-31 &bull; Settlement: daily confirmed passes</span>
              <Button size="sm" onClick={() => setFullBoardModal(false)} className="bg-amber-500 text-black">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SATELLITE ALERTS DRAWER
      ───────────────────────────────────────────────────────────── */}
      {alertsDrawerOpen && (
        <div className="fixed inset-0 z-[600] flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="relative h-full w-full max-w-md border-l border-slate-800 bg-[#090f1e] p-4 font-mono shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <Bell className="h-4 w-4" />
                SATELLITE FIELD ALERTS ({savedAlerts.length})
              </span>
              <button
                onClick={() => setAlertsDrawerOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {savedAlerts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No automated crop alerts recorded yet. Monitor a field boundary to establish an NDVI historical baseline.
                </p>
              ) : (
                savedAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{alert.title}</span>
                      <Badge
                        variant={alert.severity === "high" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">{alert.message}</p>
                    <div className="mt-2 text-[10px] text-slate-500">
                      Date: {new Date(alert.captured_at).toLocaleDateString()} &bull; Status: {alert.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
