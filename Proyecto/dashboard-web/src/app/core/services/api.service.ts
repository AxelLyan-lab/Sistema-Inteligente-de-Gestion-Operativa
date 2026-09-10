import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SesionOperativa, EventoHotspot, RegistroEvidencia,
  AlertaEmergencia, AsignacionTactica, OverrideManualDto,
} from '../models';
import { SupabaseService } from './supabase.service';

/** Resta horas a una fecha sin depender de date-fns */
function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http     = inject(HttpClient);
  private readonly baseUrl  = environment.apiBaseUrl;
  private readonly supabase = inject(SupabaseService);

  // ─── Sesiones operativas ────────────────────────────────────────────────

  getSesionesActivas(): Promise<SesionOperativa[]> {
    return firstValueFrom(
      this.http.get<SesionOperativa[]>(`${this.baseUrl}/sesiones/activas`)
    );
  }

  getSesionDetalle(idSesion: number): Promise<SesionOperativa> {
    return firstValueFrom(
      this.http.get<SesionOperativa>(`${this.baseUrl}/sesiones/${idSesion}`)
    );
  }

  // ─── Hotspots (mapa de calor) ────────────────────────────────────────────

  async getHotspots(horasAtras: number = 24, limite: number = 5000): Promise<EventoHotspot[]> {
    if (!this.supabase.isConfigured) return [];
    
    const fechaBase = subHours(new Date(), horasAtras).toISOString();
    
    // TEMPORAL: Consultar directamente a Supabase (PostgREST) en lugar del backend Node
    const { data, error } = await this.supabase.client
      .from('eventos_hotspots')
      .select('*')
      .gte('fecha_ocurrencia', fechaBase)
      .limit(limite);
      
    if (error) {
      console.error('[API] Error cargando hotspots desde Supabase:', error);
      return [];
    }
    
    // PostgREST devuelve geometría como string EWKB Hexadecimal (ej: 0101000020E61000...)
    return (data || []).map((d: any) => {
      let coords = [0, 0];
      const hex = d.geom_delito;
      
      if (typeof hex === 'string' && hex.length >= 50 && hex.startsWith('0101')) {
         try {
           // Parsear EWKB (SRID=4326 Point)
           const buffer = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
           const view = new DataView(buffer.buffer);
           const isLittleEndian = buffer[0] === 1;
           const lng = view.getFloat64(9, isLittleEndian);
           const lat = view.getFloat64(17, isLittleEndian);
           coords = [lng, lat];
         } catch (e) { console.error('Error parseando EWKB:', e); }
      } else if (d.geom_delito?.coordinates) {
         coords = d.geom_delito.coordinates;
      }
      
      return {
        ...d,
        geom_delito: { type: 'Point', coordinates: coords }
      };
    });
  }

  // ─── Asignaciones tácticas ───────────────────────────────────────────────

  getAsignacionesActivas(): Promise<AsignacionTactica[]> {
    return firstValueFrom(
      this.http.get<AsignacionTactica[]>(`${this.baseUrl}/asignaciones/activas`)
    );
  }

  /** Override manual del supervisor: cambia estado a MANUAL_SUPERVISOR */
  despacharManual(dto: OverrideManualDto): Promise<AsignacionTactica> {
    return firstValueFrom(
      this.http.post<AsignacionTactica>(`${this.baseUrl}/asignaciones/manual`, dto)
    );
  }

  /** Cancelar una asignación activa */
  cancelarAsignacion(idAsignacion: number): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/asignaciones/${idAsignacion}/cancelar`, {})
    );
  }

  // ─── Evidencias / Reportes ───────────────────────────────────────────────

  getJustificaciones(): Promise<RegistroEvidencia[]> {
    return firstValueFrom(
      this.http.get<RegistroEvidencia[]>(`${this.baseUrl}/evidencias/justificaciones`)
    );
  }

  getEvidenciasByAsignacion(idAsignacion: number): Promise<RegistroEvidencia[]> {
    return firstValueFrom(
      this.http.get<RegistroEvidencia[]>(`${this.baseUrl}/evidencias/asignacion/${idAsignacion}`)
    );
  }

  // ─── Alertas de emergencia ────────────────────────────────────────────────

  getAlertasActivas(): Promise<AlertaEmergencia[]> {
    return firstValueFrom(
      this.http.get<AlertaEmergencia[]>(`${this.baseUrl}/alertas/activas`)
    );
  }

  resolverAlerta(idEmergencia: number): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/alertas/${idEmergencia}/resolver`, {})
    );
  }
}
