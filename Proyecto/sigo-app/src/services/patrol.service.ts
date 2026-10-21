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

// ── Misión asignada por el supervisor ────────────────────────────────────────
export interface AsignacionMision {
  id_asignacion: number;
  origen_asignacion: string;
  estado_mision: string;
  hora_despacho: string;
  hora_ingreso_zona: string | null;
  centro_lat: number;
  centro_lng: number;
  radio_m: number;
  nombre_zona: string | null;
  instrucciones: string | null;
}

export async function getActiveAssignment(): Promise<AsignacionMision | null> {
  const { data } = await apiClient.get('/patrol/assignment');
  return data.asignacion ?? null;
}

export async function markAssignmentArrived(id_asignacion: number) {
  const { data } = await apiClient.post('/patrol/assignment/arrived', { id_asignacion });
  return data;
}

// ── Mensajería con la central ────────────────────────────────────────────────
export interface MensajeChat {
  id_mensaje: number;
  remitente: 'SUPERVISOR' | 'FUNCIONARIO';
  texto: string;
  fecha: string;
  leido: boolean;
}

export async function getMessages(): Promise<MensajeChat[]> {
  const { data } = await apiClient.get('/patrol/messages');
  return data.mensajes ?? [];
}

export async function sendMessage(texto: string) {
  const { data } = await apiClient.post('/patrol/message', { texto });
  return data;
}

export async function sendAudioMessage(audioUri: string) {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/mp4',
    name: `audio_${Date.now()}.m4a`,
  } as any);

  const { data } = await apiClient.post('/patrol/message/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
