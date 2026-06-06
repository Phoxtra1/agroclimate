import { useState, useEffect } from 'react';

export type DroneStatus = 'disconnected' | 'connecting' | 'connected' | 'flying' | 'returning' | 'landing' | 'emergency';

export interface TelemetryData {
  altitude: number; // meters
  groundSpeed: number; // m/s
  verticalSpeed: number; // m/s
  heading: number; // degrees
  battery: number; // percentage
  signalStrength: number; // percentage
  gpsAccuracy: number; // meters
  flightDuration: number; // seconds
  distanceCovered: number; // meters
}

export interface EnvironmentData {
  windSpeed: number; // km/h
  windDirection: string; // N, NE, E, etc.
  temperature: number; // Celsius
  humidity: number; // percentage
  rainProbability: number; // percentage
  visibility: number; // km
}

export const useDroneState = () => {
  const [status, setStatus] = useState<DroneStatus>('disconnected');
  const [droneName, setDroneName] = useState<string>('Odeneho-X1');
  
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    altitude: 0,
    groundSpeed: 0,
    verticalSpeed: 0,
    heading: 0,
    battery: 100,
    signalStrength: 0,
    gpsAccuracy: 0,
    flightDuration: 0,
    distanceCovered: 0,
  });

  const [environment, setEnvironment] = useState<EnvironmentData>({
    windSpeed: 15,
    windDirection: 'NE',
    temperature: 28,
    humidity: 65,
    rainProbability: 10,
    visibility: 10,
  });

  // Simulate telemetry when flying
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'flying' || status === 'returning') {
      interval = setInterval(() => {
        setTelemetry(prev => {
          // Add some randomness to simulate live data
          const newAlt = status === 'flying' ? prev.altitude + (Math.random() * 0.4 - 0.2) : prev.altitude - 1;
          const newBattery = prev.battery - 0.05; // Battery drops
          
          return {
            ...prev,
            altitude: Math.max(0, newAlt),
            groundSpeed: status === 'flying' ? 12 + (Math.random() * 2 - 1) : 15,
            verticalSpeed: status === 'flying' ? (Math.random() * 0.2 - 0.1) : -1,
            heading: (prev.heading + (Math.random() * 2 - 1)) % 360,
            battery: Math.max(0, newBattery),
            signalStrength: 85 + (Math.random() * 10 - 5),
            gpsAccuracy: 0.5 + (Math.random() * 0.2),
            flightDuration: prev.flightDuration + 1,
            distanceCovered: prev.distanceCovered + prev.groundSpeed,
          };
        });

        // Simulate environmental changes slightly
        setEnvironment(prev => ({
          ...prev,
          windSpeed: Math.max(0, prev.windSpeed + (Math.random() * 1 - 0.5)),
        }));
      }, 1000);
    } else if (status === 'connected') {
      setTelemetry(prev => ({
        ...prev,
        signalStrength: 95 + (Math.random() * 4 - 2),
        gpsAccuracy: 0.3 + (Math.random() * 0.1),
      }));
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const connect = () => {
    setStatus('connecting');
    setTimeout(() => {
      setStatus('connected');
      setTelemetry(prev => ({ ...prev, signalStrength: 98, gpsAccuracy: 0.4 }));
    }, 2000);
  };

  const disconnect = () => setStatus('disconnected');
  
  const startMission = () => {
    if (status === 'connected') {
      setStatus('flying');
    }
  };

  const returnToHome = () => {
    if (status === 'flying') {
      setStatus('returning');
    }
  };

  const emergencyLand = () => {
    setStatus('emergency');
    setTimeout(() => setStatus('disconnected'), 3000);
  };

  return {
    status,
    droneName,
    telemetry,
    environment,
    connect,
    disconnect,
    startMission,
    returnToHome,
    emergencyLand
  };
};
