import * as SecureStore from 'expo-secure-store';
import apiClient, { TOKEN_KEY, SESSION_KEY } from './apiClient';
import { LoginForm, Funcionario, SesionOperativa } from '../types';

export interface AuthData {
  token: string;
  patrol_id: number;
  funcionario: Funcionario;
  sesion: SesionOperativa;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Autenticación Táctica (Tarea #44)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida credenciales institucionales del funcionario (Paso 1)
 */
export async function verifyCredentials(rut: string, password: string): Promise<{
  valid: boolean;
  funcionario: Funcionario;
}> {
  const { data } = await apiClient.post('/auth/verify-credentials', {
    rut: rut.trim(),
    password,
  });
  return data;
}

/**
 * Valida disponibilidad de un compañero para tripular (Paso 2)
 */
export async function validateCompanion(rutAcompanante: string, rutConductor: string): Promise<{
  disponible: boolean;
  funcionario: Funcionario;
}> {
  const { data } = await apiClient.post('/auth/validate-companion', {
    rut_acompanante: rutAcompanante.trim(),
    rut_conductor: rutConductor.trim(),
  });
  return data;
}

/**
 * Obtiene lista de vehículos institucionales disponibles
 */
export async function getVehicles(): Promise<{
  vehiculos: Array<{ patente?: string; tipo_vehiculo: string; identificador_operativo: string; disponible?: boolean }>;
}> {
  const { data } = await apiClient.get('/auth/vehicles');
  return data;
}

/**
 * Inicia el turno operativo y genera el JWT táctico (Paso 2 final)
 */
export async function patrolLogin(form: LoginForm & { tripulacion?: string[] }): Promise<AuthData> {
  const payload = {
    rut: form.rut.trim(),
    password: form.password,
    tipo_transporte: form.tipo_transporte,
    identificador_unidad: form.identificador_unidad.trim(),
    tripulacion: form.tripulacion ?? [],
  };

  const { data } = await apiClient.post<AuthData>('/auth/patrol-login', payload);

  // Almacenamiento seguro del token (Tarea #44)
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({
    patrol_id: data.patrol_id,
    funcionario: data.funcionario,
    sesion: data.sesion,
  }));

  return data;
}

/**
 * Cierra la sesión operativa: llama al backend y limpia el SecureStore
 */
export async function patrolLogout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (_) {
    // Ignorar errores de red al hacer logout
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

/**
 * Recupera la sesión guardada desde SecureStore (para reinicio de app)
 */
export async function getStoredSession(): Promise<AuthData | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const sessionRaw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!token || !sessionRaw) return null;

    const session = JSON.parse(sessionRaw);
    return { token, ...session };
  } catch {
    return null;
  }
}

/**
 * Obtiene datos actualizados del funcionario desde el servidor
 */
export async function getMe() {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

/**
 * Valida que el token almacenado sea todavía válido en el servidor.
 * Retorna true si el servidor responde 200, false si responde 401/403/error.
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    await apiClient.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpia el SecureStore (se usa cuando el token expiró)
 */
export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
