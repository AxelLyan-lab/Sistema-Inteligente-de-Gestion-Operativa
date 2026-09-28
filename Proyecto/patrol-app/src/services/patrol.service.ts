import apiClient from './apiClient';
import { TripulacionMiembro, Coordenadas } from '../types';

// ── Refuerzos / SOS ──────────────────────────────────────────────────────────
export async function requestReinforcements(coords: Coordenadas) {
  const { data } = await apiClient.post('/patrol/sos', {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  return data;
}

// ── Dotación / Tripulación ───────────────────────────────────────────────────
export async function getCrew(): Promise<TripulacionMiembro[]> {
  const { data } = await apiClient.get('/patrol/crew');
  return data.tripulacion;
}

export async function addCrewMember(rut_acompanante: string) {
  const { data } = await apiClient.post('/patrol/crew/add', { rut_acompanante });
  return data;
}

export async function removeCrewMember(rut: string) {
  const { data } = await apiClient.delete(`/patrol/crew/${rut}`);
  return data;
}

// ── Telemetría GPS ───────────────────────────────────────────────────────────
export async function sendTelemetry(coords: Coordenadas) {
  const { data } = await apiClient.post('/patrol/telemetry', {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  return data;
}
