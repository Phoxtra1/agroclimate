import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  LatLng,
  RouteResult,
  NavigationState,
  Destination,
  TravelProfile,
} from "./types";
import { GPSTrackingService } from "./GPSTrackingService";
import { DestinationService } from "./DestinationService";
import { RoutingService } from "./RoutingService";
import { RouteRecalculationService } from "./RouteRecalculationService";
import { toast } from "sonner";

interface NavigationContextType {
  state: NavigationState;
  currentPos: LatLng;
  bearing: number;
  speedKn: number;
  gpsAccuracy: number | null;
  isMoving: boolean;
  gpsLocked: boolean;
  destination: Destination | null;
  startLocation: Destination | null;
  routeResult: RouteResult | null;
  isNavigating: boolean;
  isAutoFollow: boolean;
  travelMode: TravelProfile;
  navMode: "road" | "water";
  simulating: boolean;
  simStepIdx: number;
  routeBusy: boolean;
  voiceOn: boolean;

  setDestination: (dest: Destination | null) => void;
  setStartLocation: (start: Destination | null) => void;
  setTravelMode: (mode: TravelProfile) => void;
  setNavMode: (mode: "road" | "water") => void;
  setIsNavigating: (navigating: boolean) => void;
  setIsAutoFollow: (autoFollow: boolean) => void;
  setVoiceOn: (voiceOn: boolean) => void;
  setSimulating: (sim: boolean) => void;
  setSimStepIdx: (idx: number) => void;

  searchDestination: (text: string) => Promise<void>;
  geocodeDestination: (text: string) => Promise<Destination | null>;
  searchStartLocation: (text: string) => Promise<Destination[]>;
  searchDestLocation: (text: string) => Promise<Destination[]>;
  computeRoute: (vesselId: string, userId?: string, passengers?: number, cargoKg?: number, rainProb?: number) => Promise<void>;
  resetNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const gpsService = new GPSTrackingService();
const destService = new DestinationService();
const routingService = new RoutingService();
const recalculationService = new RouteRecalculationService();

function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NavigationState>("IDLE");
  const [currentPos, setCurrentPos] = useState<LatLng>(() => ({ lat: 5.6037, lon: -0.187 }));
  const [bearing, setBearing] = useState<number>(0);
  const [speedKn, setSpeedKn] = useState<number>(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [gpsLocked, setGpsLocked] = useState<boolean>(false);

  const [destination, setDestinationState] = useState<Destination | null>(null);
  const [startLocation, setStartLocation] = useState<Destination | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isAutoFollow, setIsAutoFollow] = useState<boolean>(true);
  const [travelMode, setTravelMode] = useState<TravelProfile>("car");
  const [navMode, setNavMode] = useState<"road" | "water">("water");
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simStepIdx, setSimStepIdx] = useState<number>(0);
  const [routeBusy, setRouteBusy] = useState<boolean>(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(true);

  const deviationCountRef = useRef<number>(0);
  const lastArrivalAnnouncedRef = useRef<boolean>(false);
  const lastOffCourseAnnouncedRef = useRef<number>(0);
  const lastTurnAnnouncementStageRef = useRef<{ index: number; stage: "none" | "prep" | "now" }>({
    index: -1,
    stage: "none",
  });
  const navigationStartRef = useRef<LatLng | null>(null);
  const navigationTravelRef = useRef(0);
  const lastNavigationPointRef = useRef<LatLng | null>(null);
  const arrivalFixCountRef = useRef(0);

  // Track state transitions based on changes to destination & route calculation
  useEffect(() => {
    if (isNavigating) {
      setState("NAVIGATION_STARTED");
    } else if (routeResult) {
      setState("ROUTE_CALCULATED");
    } else if (destination) {
      setState("DESTINATION_SELECTED");
    } else {
      setState("IDLE");
    }
  }, [destination, routeResult, isNavigating]);

  // Handle continuous real-time GPS coordinates updates
  useEffect(() => {
    gpsService.startTracking(
      (update) => {
        setGpsLocked(true);
        setGpsAccuracy(update.accuracy ?? null);
        if (!simulating) {
          setCurrentPos(update.coords);
          setSpeedKn(update.speedKn);
          setBearing(update.bearing);
          setIsMoving(update.isMoving);
        }
      },
      () => {
        setGpsLocked(false);
      }
    );

    return () => {
      gpsService.stopTracking();
    };
  }, [simulating]);

  useEffect(() => {
    if (!isNavigating) {
      navigationStartRef.current = null;
      navigationTravelRef.current = 0;
      lastNavigationPointRef.current = null;
      arrivalFixCountRef.current = 0;
      return;
    }
    if (!navigationStartRef.current) {
      navigationStartRef.current = currentPos;
      lastNavigationPointRef.current = currentPos;
    }
  }, [isNavigating, currentPos]);

  // Simulator Player Loop
  useEffect(() => {
    if (!simulating || !routeResult || !routeResult.route || routeResult.route.length === 0) return;

    let intervalMs = 1000;
    let stepSize = 1;

    switch (travelMode) {
      case "walking":
        intervalMs = 1500;
        stepSize = 1;
        break;
      case "motorcycle":
        intervalMs = 1000;
        stepSize = 2;
        break;
      case "car":
        intervalMs = 800;
        stepSize = 3;
        break;
      case "train":
        intervalMs = 600;
        stepSize = 4;
        break;
    }

    const route = routeResult.route;
    const intervalId = setInterval(() => {
      setSimStepIdx((currIdx) => {
        const nextIdx = currIdx + stepSize;
        if (nextIdx >= route.length - 1) {
          clearInterval(intervalId);
          setSimulating(false);
          setIsMoving(false);
          setState("DESTINATION_REACHED");
          const arrivalMsg =
            navMode === "road"
              ? "You have arrived at your destination."
              : "Destination reached. Heave to and drop anchor.";
          speak(arrivalMsg, voiceOn);
          toast.success("Destination reached");
          setCurrentPos({ lat: route[route.length - 1][0], lon: route[route.length - 1][1] });
          return route.length - 1;
        }

        const p1 = route[currIdx];
        const p2 = route[nextIdx];
        if (p1 && p2) {
          const dy = p2[0] - p1[0];
          const dx = p2[1] - p1[1];
          let brng = (Math.atan2(dx, dy) * 180) / Math.PI;
          setBearing((brng + 360) % 360);

          const dt = intervalMs / 1000;
          const R = 6371000;
          const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
          const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((p1[0] * Math.PI) / 180) *
              Math.cos((p2[0] * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
          const dist = 2 * R * Math.asin(Math.sqrt(a));
          setSpeedKn((dist / dt) * 1.94384);
        }
        setIsMoving(true);
        setCurrentPos({ lat: route[nextIdx][0], lon: route[nextIdx][1] });
        return nextIdx;
      });
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      setIsMoving(false);
    };
  }, [simulating, routeResult, travelMode, voiceOn, navMode]);

  // Turn announcement and off-course checking loop
  useEffect(() => {
    const route = routeResult?.route;
    if (!route || route.length < 2) return;

    const activeRouteIdx = simulating ? simStepIdx : 0;
    const { lat, lon } = currentPos;
    const isRoad = navMode === "road";

    if (isNavigating && !simulating && gpsLocked && (gpsAccuracy ?? Infinity) <= 50) {
      const previous = lastNavigationPointRef.current;
      if (previous) {
        const travelled = thisHaversine(previous.lat, previous.lon, lat, lon);
        if (travelled >= 2 && travelled <= 150) navigationTravelRef.current += travelled;
      }
      lastNavigationPointRef.current = currentPos;
    }

    // Arrival requires active navigation, a reliable GPS fix, actual travel, and
    // three consecutive fixes at the destination. Merely calculating a route can
    // never announce arrival.
    const distToDest = thisHaversine(lat, lon, route[route.length - 1][0], route[route.length - 1][1]);
    const arrivalRadius = Math.max(20, Math.min(45, (gpsAccuracy ?? 20) * 1.25));
    const reliableArrivalFix = simulating || (
      isNavigating && gpsLocked && (gpsAccuracy ?? Infinity) <= 50 &&
      navigationTravelRef.current >= 20 && distToDest <= arrivalRadius
    );
    arrivalFixCountRef.current = reliableArrivalFix ? arrivalFixCountRef.current + 1 : 0;
    if (arrivalFixCountRef.current >= 3) {
      if (!lastArrivalAnnouncedRef.current) {
        lastArrivalAnnouncedRef.current = true;
        setState("DESTINATION_REACHED");
        const arrivalMsg = isRoad
          ? "You have arrived at your destination."
          : "Destination reached. Heave to and drop anchor.";
        speak(arrivalMsg, voiceOn);
        toast.success("Destination reached");
        if (simulating) {
          setSimulating(false);
        }
        setIsNavigating(false);
      }
      return;
    } else if (distToDest > arrivalRadius + 20) {
      lastArrivalAnnouncedRef.current = false;
    }

    // Perpendicular off-route detection
    const { offRoute, closestSegmentIndex, minDistance } = recalculationService.isOffRoute(
      currentPos,
      route,
      80
    );

    const activeNav = simulating || (isNavigating && isMoving && gpsLocked);

    if (offRoute && activeNav) {
      setState("OFF_ROUTE_DETECTION");
      deviationCountRef.current += 1;

      if (deviationCountRef.current >= 3 && !simulating) {
        deviationCountRef.current = 0;
        setState("ROUTE_RECALCULATION");
        // Recalculate route automatically
        autoReroute();
        return;
      }

      const nowTime = Date.now();
      if (nowTime - lastOffCourseAnnouncedRef.current > 25000) {
        lastOffCourseAnnouncedRef.current = nowTime;
        let destinationName = destination?.label || "your target destination";
        if (destinationName.length > 25) {
          destinationName = destinationName.slice(0, 22) + "...";
        }

        const offRouteMsg = isRoad
          ? `Warning. You have shifted from the planned road route. Continuing on this heading will bypass ${destinationName} and lead towards local rural coordinates. Please realign or recalculate to get back on track.`
          : `Warning. You are drifting off course from the river channel. Continuing on this bearing leads towards shallow sandbars and agricultural danger zones in the Volta Basin. Realign your vessel's heading immediately to remain safe.`;

        speak(offRouteMsg, voiceOn);
        toast.warning("Off-course drift detected", {
          description: isRoad ? "Headed towards rural coordinates" : "Headed towards Volta Basin danger zones",
        });
      }
    } else {
      deviationCountRef.current = 0;

      // Scan ahead for upcoming turns / course corrections
      let scanIdx = closestSegmentIndex + 1;
      let accumulatedDist = 0;

      while (scanIdx < route.length - 3 && accumulatedDist < 150) {
        const stepDist = thisHaversine(
          route[scanIdx - 1][0],
          route[scanIdx - 1][1],
          route[scanIdx][0],
          route[scanIdx][1]
        );
        accumulatedDist += stepDist;

        const b1 = thisGetBearing(
          route[scanIdx - 1][0],
          route[scanIdx - 1][1],
          route[scanIdx][0],
          route[scanIdx][1]
        );
        const b2 = thisGetBearing(
          route[scanIdx][0],
          route[scanIdx][1],
          route[scanIdx + 3][0],
          route[scanIdx + 3][1]
        );
        let diff = b2 - b1;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        if (Math.abs(diff) > 25) {
          const roundedDist = Math.round(accumulatedDist);
          const direction = isRoad ? (diff > 0 ? "right" : "left") : (diff > 0 ? "starboard" : "port");
          const actionWord = isRoad ? "turn" : "steer";

          if (activeNav) {
            const turnRef = lastTurnAnnouncementStageRef.current;
            if (turnRef.index !== scanIdx) {
              lastTurnAnnouncementStageRef.current = { index: scanIdx, stage: "none" };
            }

            const currentStage = lastTurnAnnouncementStageRef.current.stage;

            if (roundedDist <= 30 && currentStage !== "now") {
              lastTurnAnnouncementStageRef.current.stage = "now";
              speak(`${actionWord} ${direction} now.`, voiceOn);
              toast.info(`${actionWord} ${direction} now`);
            } else if (roundedDist > 30 && roundedDist <= 120 && currentStage === "none") {
              lastTurnAnnouncementStageRef.current.stage = "prep";
              speak(`In ${roundedDist} meters, ${actionWord} ${direction}.`, voiceOn);
              toast.info(`In ${roundedDist}m, ${actionWord} ${direction}`);
            }
          }
          break;
        }
        scanIdx++;
      }
    }
  }, [currentPos, routeResult, voiceOn, navMode, simulating, simStepIdx, isNavigating, isMoving, gpsLocked, gpsAccuracy]);

  const thisHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const thisGetBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };

  const autoReroute = async () => {
    if (!destination) return;
    setRouteBusy(true);
    try {
      const result = await routingService.computeRoute({
        start: currentPos,
        end: destination,
        vessel_id: "AUTOREROUTE",
        load: { passengers: 1, cargo_kg: 0 },
        profile: navMode === "road" ? travelMode : "car",
      });
      setRouteResult(result);
      setSimStepIdx(0);
      lastTurnAnnouncementStageRef.current = { index: -1, stage: "none" };
      arrivalFixCountRef.current = 0;
      toast.success("Rerouting completed automatically");
      speak("Re-routing. A new route has been computed.", voiceOn);
    } catch {
      toast.error("Auto rerouting calculation failed");
    } finally {
      setRouteBusy(false);
    }
  };

  const setDestination = (dest: Destination | null) => {
    if (dest && currentPos) {
      if (destService.isAtCurrentLocation(dest, currentPos)) {
        toast.error("Destination cannot be set to your exact current location.");
        return;
      }
    }
    setDestinationState(dest);
    setRouteResult(null);
    setSimStepIdx(0);
    setSimulating(false);
    setIsNavigating(false);
  };

  const searchDestination = async (text: string) => {
    setRouteBusy(true);
    try {
      const dest = await destService.geocode(text, currentPos);
      if (!dest) {
        toast.error("Destination place address not found.");
        return;
      }
      setDestination(dest);
      toast.success(`Destination set: ${dest.label}`);
    } catch (err: any) {
      toast.error(err.message || "Autocomplete location lookup failed.");
    } finally {
      setRouteBusy(false);
    }
  };

  const geocodeDestination = async (text: string) => {
    try {
      return await destService.geocode(text, currentPos);
    } catch (err: any) {
      toast.error(err.message || "Failed to geocode location.");
      return null;
    }
  };

  const searchStartLocation = (text: string) => destService.fetchSuggestions(text);
  const searchDestLocation = (text: string) => destService.fetchSuggestions(text);

  const computeRoute = async (
    vesselId: string,
    userId?: string,
    passengers = 1,
    cargoKg = 0,
    rainProb = 0
  ) => {
    if (!destination) {
      toast.error("Set a target destination first.");
      return;
    }

    const startPoint = navMode === "road" && startLocation ? startLocation : currentPos;
    setRouteBusy(true);

    try {
      const result = await routingService.computeRoute({
        start: startPoint,
        end: destination,
        vessel_id: vesselId,
        user_id: userId,
        load: { passengers, cargo_kg: cargoKg },
        rainProb,
        profile: navMode === "road" ? travelMode : "car",
      });

      setRouteResult(result);
      setSimStepIdx(0);
      setSimulating(false);
      setIsNavigating(false);
      lastArrivalAnnouncedRef.current = false;
      arrivalFixCountRef.current = 0;

      const km = (result.distance_m / 1000).toFixed(1);
      const min = (result.duration_s / 60).toFixed(0);
      toast.success(`Route calculated · ${km} km · ${min} min`);
      speak(`Route calculated. ${km} kilometres. About ${min} minutes.`, voiceOn);
    } catch (err: any) {
      toast.error(err.message || "OSRM Route calculation failed.");
    } finally {
      setRouteBusy(false);
    }
  };

  const resetNavigation = () => {
    setDestinationState(null);
    setStartLocation(null);
    setRouteResult(null);
    setSimStepIdx(0);
    setSimulating(false);
    setIsNavigating(false);
    setState("IDLE");
  };

  return (
    <NavigationContext.Provider
      value={{
        state,
        currentPos,
        bearing,
        speedKn,
        gpsAccuracy,
        isMoving,
        gpsLocked,
        destination,
        startLocation,
        routeResult,
        isNavigating,
        isAutoFollow,
        travelMode,
        navMode,
        simulating,
        simStepIdx,
        routeBusy,
        voiceOn,

        setDestination,
        setStartLocation,
        setTravelMode,
        setNavMode,
        setIsNavigating,
        setIsAutoFollow,
        setVoiceOn,
        setSimulating,
        setSimStepIdx,

        searchDestination,
        geocodeDestination,
        searchStartLocation,
        searchDestLocation,
        computeRoute,
        resetNavigation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationEngine = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigationEngine must be used within a NavigationProvider");
  }
  return context;
};
