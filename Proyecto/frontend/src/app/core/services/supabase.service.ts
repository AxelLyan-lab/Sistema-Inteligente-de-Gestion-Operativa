import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const url = environment.supabaseUrl;
    const key = environment.supabaseKey;

    const isConfigured =
      url && url.startsWith('http') && !url.includes('YOUR_SUPABASE');

    if (isConfigured) {
      this.client = createClient(url, key, {
        auth: {
          persistSession:     true,
          autoRefreshToken:   true,
          detectSessionInUrl: false,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      });
    } else {
      console.warn(
        '[S.I.G.O.] Supabase no configurado. Edita src/environments/environment.ts ' +
        'con tu URL y ANON_KEY reales para conectar a la base de datos.'
      );
      this.client = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  get isConfigured(): boolean {
    const url = environment.supabaseUrl;
    return !!url && url.startsWith('http') && !url.includes('YOUR_SUPABASE');
  }

  /**
   * Parsea geometría PostGIS EWKB (hex) a { lat, lng }.
   * Supabase Realtime entrega la geometría como string hex EWKB en lugar de JSON.
   * Formato: 0101000020E6100000 [lng:8 bytes LE] [lat:8 bytes LE]
   */
  public parseEwkbPoint(hex: string): { lat: number; lng: number } | null {
    try {
      if (!hex || hex.length < 50) return null;
      const buf = new Uint8Array(hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
      const view = new DataView(buf.buffer);
      const isLE = buf[0] === 1;
      // bytes 0: byte order, 1-4: geometry type, 5-8: SRID (si EWKB), 9-16: x (lng), 17-24: y (lat)
      const wkbType = view.getUint32(1, isLE);
      const hasSrid = (wkbType & 0x20000000) !== 0;
      const offset  = hasSrid ? 9 : 5;
      const lng = view.getFloat64(offset, isLE);
      const lat = view.getFloat64(offset + 8, isLE);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng };
    } catch {
      return null;
    }
  }

  /** Suscripción a cambios en sesiones_operativas (Postgres Realtime) */
  subscribeToSesiones(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'sesiones-changes-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sesiones_operativas' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a cambios en tripulacion_sesion (Acompañantes en tiempo real) */
  subscribeToTripulacion(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'tripulacion-changes-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tripulacion_sesion' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a nuevas alertas de emergencia */
  subscribeToAlertas(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'alertas-changes-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertas_emergencia' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a cambios en asignaciones_tacticas */
  subscribeToAsignaciones(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'asignaciones-changes-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'asignaciones_tacticas' },
        callback
      )
      .subscribe();
  }

  /**
   * Suscripción a nuevos pings de telemetría GPS (HU14).
   * Extrae lat/lon desde la geometría EWKB que retorna Supabase Realtime.
   * Callback recibe: { id_sesion, lat, lng, precision_m, velocidad_kmh, ... }
   */
  subscribeToTelemetria(callback: (payload: { id_sesion: number; lat: number; lng: number; [k: string]: any }) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'telemetria-changes-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'telemetria_activa' },
        (event: any) => {
          const row = event.new;
          if (!row) return;

          // geom_actual puede venir como string EWKB hex o como GeoJSON object
          let coords: { lat: number; lng: number } | null = null;

          if (typeof row.geom_actual === 'string') {
            coords = this.parseEwkbPoint(row.geom_actual);
          } else if (row.geom_actual?.coordinates) {
            const [lng, lat] = row.geom_actual.coordinates;
            coords = { lat, lng };
          }

          if (!coords) {
            console.warn('[Supabase] Telemetría recibida sin coordenadas válidas:', row);
            return;
          }

          callback({
            ...row,
            lat: coords.lat,
            lng: coords.lng,
          });
        }
      )
      .subscribe();
  }

  /**
   * Obtiene la última posición conocida de cada sesión activa
   * consultando la vista v_posicion_actual_unidades.
   * Retorna array con { id_sesion, latitud, longitud }.
   */
  async getUltimasPosiciones(): Promise<{ id_sesion: number; latitud: number; longitud: number }[]> {
    if (!this.isConfigured) return [];
    const { data, error } = await this.client
      .from('v_posicion_actual_unidades')
      .select('id_sesion, latitud, longitud');
    if (error) {
      console.warn('[Supabase] No se pudo leer v_posicion_actual_unidades:', error.message);
      return [];
    }
    return (data ?? []) as { id_sesion: number; latitud: number; longitud: number }[];
  }

  async getUltimaPosicion(idSesion: number): Promise<{ id_sesion: number; latitud: number; longitud: number } | null> {
    if (!this.isConfigured) return null;
    const { data, error } = await this.client
      .from('v_posicion_actual_unidades')
      .select('id_sesion, latitud, longitud')
      .eq('id_sesion', idSesion)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id_sesion: number; latitud: number; longitud: number };
  }

  /** Suscripción a mensajes en tiempo real */
  subscribeToMensajes(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'mensajes-channel-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a evidencias en tiempo real */
  subscribeToEvidencias(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'evidencias-channel-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registro_evidencias' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a zonas de patrullaje */
  subscribeToZonas(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    const ch = 'zonas-channel-' + Math.random().toString(36).substring(2, 7);
    return this.client
      .channel(ch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'zonas_patrullaje' },
        callback
      )
      .subscribe();
  }

  /** Subir fotografía de evidencia al bucket sigo-evidencias */
  async uploadEvidenciaFoto(file: File): Promise<string> {
    if (!this.isConfigured) throw new Error('Supabase no configurado');
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `dashboard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error } = await this.client.storage
      .from('sigo-evidencias')
      .upload(filePath, file, { contentType: file.type || 'image/jpeg', upsert: true });

    if (error) {
      console.error('[Supabase Storage] Error subiendo evidencia:', error);
      throw error;
    }

    const { data } = this.client.storage
      .from('sigo-evidencias')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}
