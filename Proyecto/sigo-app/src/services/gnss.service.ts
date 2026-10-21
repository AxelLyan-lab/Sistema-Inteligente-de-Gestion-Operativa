/**
 * gnss.service.ts — HU14: Módulo cliente de captura GNSS de alta precisión (#46)
 *
 * Responsabilidades:
 *  - Obtener fix GPS de alta precisión con metadatos completos
 *  - Transmitir telemetría enriquecida al backend (latitud, longitud, altitud,
 *    precisión, velocidad, rumbo, timestamp del dispositivo)
 *  - Calcular métricas de calidad de señal GNSS para el panel de estado (#45)
 */

import * as Location from 'expo-location';
import apiClient from './apiClient';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GnssReading {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;       // Precisión horizontal en metros
  speed: number | null;          // m/s
  heading: number | null;        // Grados (0–360)
  speedKmh: number | null;       // Velocidad calculada en km/h
  signalQuality: 'EXCELENTE' | 'BUENA' | 'REGULAR' | 'BAJA' | 'SIN_SEÑAL';
  timestamp: Date;
}

export interface TelemetryPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;    // m/s — el servidor convierte a km/h
  heading: number | null;
  timestamp_gps: string;   // ISO
}

export interface TelemetryResult {
  ok: boolean;
  patrol_id?: number;
  timestamp_srv?: string;
  error?: string;
}

// ── Clasificación de calidad GNSS ─────────────────────────────────────────────

export function classifyGnssQuality(
  accuracy: number | null
): GnssReading['signalQuality'] {
  if (accuracy === null) return 'SIN_SEÑAL';
  if (accuracy <= 5)    return 'EXCELENTE';
  if (accuracy <= 10)   return 'BUENA';
  if (accuracy <= 25)   return 'REGULAR';
  return 'BAJA';
}

// ── Captura de un fix GPS de alta precisión (#46) ─────────────────────────────

export async function captureGnssReading(
  accuracy: Location.Accuracy = Location.Accuracy.BestForNavigation
): Promise<GnssReading> {
  const loc = await Location.getCurrentPositionAsync({
    accuracy,
    timeInterval: 0,
    distanceInterval: 0,
  });

  const speedMs = loc.coords.speed != null && loc.coords.speed >= 0
    ? loc.coords.speed
    : null;

  return {
    latitude:     loc.coords.latitude,
    longitude:    loc.coords.longitude,
    altitude:     loc.coords.altitude,
    accuracy:     loc.coords.accuracy,
    speed:        speedMs,
    heading:      loc.coords.heading,
    speedKmh:     speedMs != null ? Math.round(speedMs * 3.6 * 10) / 10 : null,
    signalQuality: classifyGnssQuality(loc.coords.accuracy),
    timestamp:    new Date(loc.timestamp),
  };
}

// ── Transmitir telemetría al servidor (#48) ───────────────────────────────────

export async function sendGnssTelemetry(reading: GnssReading): Promise<TelemetryResult> {
  const payload: TelemetryPayload = {
    latitude:      reading.latitude,
    longitude:     reading.longitude,
    altitude:      reading.altitude,
    accuracy:      reading.accuracy,
    speed:         reading.speed,
    heading:       reading.heading,
    timestamp_gps: reading.timestamp.toISOString(),
  };

  const { data } = await apiClient.post<TelemetryResult>('/patrol/telemetry', payload);
  return data;
}

// ── Helper: formatear coordenadas para UI ─────────────────────────────────────

export function formatCoord(value: number, type: 'lat' | 'lon'): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(1);
  const dir = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'O');
  return `${deg}°${min}'${sec}"${dir}`;
}
