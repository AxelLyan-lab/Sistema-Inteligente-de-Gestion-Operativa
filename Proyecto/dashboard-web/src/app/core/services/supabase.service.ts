import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    // Validación defensiva: si no hay URL real (placeholder de dev), usa un mock seguro
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
      // En modo demo (sin credenciales), crear cliente con URL ficticia válida
      // Las operaciones fallarán silenciosamente — esperado en desarrollo local
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

  /** Suscripción a cambios en sesiones_operativas (Postgres Realtime) */
  subscribeToSesiones(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    return this.client
      .channel('sesiones-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sesiones_operativas' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a nuevas alertas de emergencia */
  subscribeToAlertas(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    return this.client
      .channel('alertas-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertas_emergencia' },
        callback
      )
      .subscribe();
  }

  /** Suscripción a cambios en asignaciones_tacticas */
  subscribeToAsignaciones(callback: (payload: any) => void): any {
    if (!this.isConfigured) return { unsubscribe: () => {} };
    return this.client
      .channel('asignaciones-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'asignaciones_tacticas' },
        callback
      )
      .subscribe();
  }
}
