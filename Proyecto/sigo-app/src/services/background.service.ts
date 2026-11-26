import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY } from './apiClient';

const { SigoBackground } = NativeModules;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://sigo-api-243815551696.southamerica-west1.run.app/api/v1';

export type SystemAlertType = 'MISION' | 'MENSAJE' | 'SOS' | 'FUERA_ZONA' | 'INFO';

export async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Permiso de Notificaciones SIGO',
          message:
            'SIGO necesita mostrar notificaciones con sonido para alertar misiones, mensajes y emergencias SOS incluso fuera de la aplicación.',
          buttonPositive: 'Permitir',
        }
      );
    }
  } catch (err) {
    console.warn('[BackgroundService] Error solicitando permiso de notificaciones:', err);
  }
}

export async function startPatrolBackgroundService(explicitToken?: string | null): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await requestNotificationPermission();
    const token = explicitToken ?? (await SecureStore.getItemAsync(TOKEN_KEY));
    SigoBackground?.startBackgroundService?.(API_BASE_URL, token ?? '');
  } catch (err) {
    console.warn('[BackgroundService] Error iniciando servicio en segundo plano:', err);
  }
}

export function updatePatrolBackgroundLocation(latitude: number, longitude: number): void {
  if (Platform.OS !== 'android') return;
  try {
    SigoBackground?.updateBackgroundLocation?.(latitude, longitude);
  } catch {}
}

export function stopPatrolBackgroundService(): void {
  if (Platform.OS !== 'android') return;
  try {
    SigoBackground?.stopBackgroundService?.();
  } catch (err) {
    console.warn('[BackgroundService] Error deteniendo servicio en segundo plano:', err);
  }
}

export function notifySystemAlert(
  title: string,
  body: string,
  type: SystemAlertType = 'INFO'
): void {
  if (Platform.OS !== 'android') return;
  try {
    SigoBackground?.showSystemNotification?.(title, body, type);
  } catch (err) {
    console.warn('[BackgroundService] Error mostrando notificación del sistema:', err);
  }
}
