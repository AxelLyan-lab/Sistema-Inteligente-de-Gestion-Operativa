/**
 * audioService.ts
 * Servicio seguro de audio táctico compatible con Expo Go en iOS y Android.
 * Evita excepciones fatales de módulos nativos no encontrados en Expo Go.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export const hasNativeAudio = (): boolean => false;

export interface AudioState {
  isRecording: boolean;
  seconds: number;
}
