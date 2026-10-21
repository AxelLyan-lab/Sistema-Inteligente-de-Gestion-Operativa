import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  SesionOperativa, EventoHotspot, RegistroEvidencia,
  AlertaEmergencia, AsignacionTactica, OverrideManualDto,
  ZonaPatrullaje, Mensaje, EstadoOperativo, EstadoMision,
  OrigenAsignacion, TipoEvidencia, Usuario,
} from '../models';
import { SupabaseService } from './supabase.service';

/** Resta horas a una fecha sin depender de date-fns */
function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

/** Genera un polígono PostGIS EWKT circular de 32 vértices */
function buildCircleWkt(lat: number, lng: number, radiusM: number, points = 32): string {
  const coords: string[] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    const pLat = lat + dLat * Math.sin(theta);
    const pLng = lng + dLng * Math.cos(theta);
    coords.push(`${pLng} ${pLat}`);
  }
  return `SRID=4326;POLYGON((${coords.join(', ')}))`;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http     = inject(HttpClient);
  private readonly baseUrl  = environment.apiBaseUrl;
  private readonly supabase = inject(SupabaseService);

  /** Si el timestamp viene sin zona horaria (timestamp sin tz), se interpreta como UTC. */
  private toUtcIso(v: string | null | undefined): any {
    if (!v) return v;
    return /(Z|[+-]\d{2}:?\d{2})$/.test(v) ? v : v.replace(' ', 'T') + 'Z';
  }

  // ─── Sesiones operativas ────────────────────────────────────────────────

  async getSesionesActivas(): Promise<SesionOperativa[]> {
    if (!this.supabase.isConfigured) return [];
    const { data, error } = await this.supabase.client
      .from('sesiones_operativas')
      .select(`
        id_sesion,
        imei_simcard,
        rut_conductor,
        tipo_transporte,
        identificador_unidad,
        estado_operativo,
        fecha_inicio,
        fecha_cierre,
        conductor:usuarios!rut_conductor (
          rut_usuario,
          nombre_completo,
          rol,
          grado_cargo
        ),
        tripulacion:tripulacion_sesion (
          id_tripulacion,
          rut_acompanante,
          acompanante:usuarios!rut_acompanante (
            rut_usuario,
            nombre_completo,
            rol,
            grado_cargo
          )
        ),
        asignacion_activa:asignaciones_tacticas (
          id_asignacion,
          origen_asignacion,
          estado_mision,
          hora_despacho,
          hora_ingreso_zona,
          hora_liberacion,
          centro_lat,
          centro_lng,
          radio_m,
          nombre_zona,
          instrucciones
        )
      `)
      .is('fecha_cierre', null)
      .not('imei_simcard', 'like', 'DEMO-%')
      .order('fecha_inicio', { ascending: false });

    if (error) {
      console.error('[API] Error cargando sesiones desde Supabase:', error);
      return [];
    }

    return ((data ?? []) as any[]).map((s: any) => ({
      ...s,
      fecha_inicio: this.toUtcIso(s.fecha_inicio),
      fecha_cierre: this.toUtcIso(s.fecha_cierre),
      conductor: Array.isArray(s.conductor) ? s.conductor[0] ?? null : s.conductor,
      tripulacion: (s.tripulacion ?? []).map((t: any) => ({
        id_tripulacion: t.id_tripulacion,
        id_sesion: s.id_sesion,
        rut_acompanante: t.rut_acompanante,
        acompanante: Array.isArray(t.acompanante) ? t.acompanante[0] ?? null : t.acompanante,
      })),
      asignacion_activa: (s.asignacion_activa ?? []).find(
        (a: any) => !['COMPLETADA', 'CANCELADA'].includes(a.estado_mision)
      ) ?? null,
    })) as SesionOperativa[];
  }

  async getSesionDetalle(idSesion: number): Promise<SesionOperativa> {
    const { data, error } = await this.supabase.client
      .from('sesiones_operativas')
      .select(`
        id_sesion,
        imei_simcard,
        rut_conductor,
        tipo_transporte,
        identificador_unidad,
        estado_operativo,
        fecha_inicio,
        fecha_cierre,
        conductor:usuarios!rut_conductor (
          rut_usuario,
          nombre_completo,
          rol,
          grado_cargo
        ),
        tripulacion:tripulacion_sesion (
          id_tripulacion,
          rut_acompanante,
          acompanante:usuarios!rut_acompanante (
            rut_usuario,
            nombre_completo,
            rol,
            grado_cargo
          )
        )
      `)
      .eq('id_sesion', idSesion)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sesión no encontrada');
    const s = data as any;
    return {
      ...s,
      fecha_inicio: this.toUtcIso(s.fecha_inicio),
      fecha_cierre: this.toUtcIso(s.fecha_cierre),
      conductor: Array.isArray(s.conductor) ? s.conductor[0] ?? null : s.conductor,
      tripulacion: (s.tripulacion ?? []).map((t: any) => ({
        id_tripulacion: t.id_tripulacion,
        id_sesion: s.id_sesion,
        rut_acompanante: t.rut_acompanante,
        acompanante: Array.isArray(t.acompanante) ? t.acompanante[0] ?? null : t.acompanante,
      })),
    } as SesionOperativa;
  }

  // ─── Usuarios de la Dotación ──────────────────────────────────────────────

  async getUsuarios(): Promise<Usuario[]> {
    const { data, error } = await this.supabase.client
      .from('usuarios')
      .select('rut_usuario, nombre_completo, rol, grado_cargo, activo')
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('[API] Error getUsuarios:', error);
      return [];
    }
    return (data ?? []) as Usuario[];
  }

  // ─── Hotspots (mapa de calor) ────────────────────────────────────────────

  async getHotspots(horasAtras: number = 24, limite: number = 5000): Promise<EventoHotspot[]> {
    if (!this.supabase.isConfigured) return [];
    const fechaBase = subHours(new Date(), horasAtras).toISOString();

    const { data, error } = await this.supabase.client
      .from('eventos_hotspots')
      .select('*')
      .gte('fecha_ocurrencia', fechaBase)
      .limit(limite);

    if (error) {
      console.warn('[API] getHotspots fallback:', error.message);
      return [];
    }

    return (data || []).map((d: any) => {
      let coords: [number, number] = [0, 0];
      const hex = d.geom_delito;
      if (typeof hex === 'string' && hex.length >= 50 && hex.startsWith('0101')) {
        const pt = this.supabase.parseEwkbPoint(hex);
        if (pt) coords = [pt.lng, pt.lat];
      } else if (d.geom_delito?.coordinates) {
        coords = d.geom_delito.coordinates;
      }
      return {
        ...d,
        geom_delito: { type: 'Point', coordinates: coords }
      };
    });
  }

  // ─── Asignaciones tácticas & Despacho Manual ──────────────────────────────

  async getAsignacionesActivas(): Promise<AsignacionTactica[]> {
    const { data, error } = await this.supabase.client
      .from('asignaciones_tacticas')
      .select('*, sesion:sesiones_operativas!inner(id_sesion, fecha_cierre, estado_operativo)')
      .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
      .is('sesion.fecha_cierre', null)
      .neq('sesion.estado_operativo', 'INACTIVO')
      .order('hora_despacho', { ascending: false });

    if (error) {
      console.error('[API] Error getAsignacionesActivas:', error);
      return [];
    }
    return (data ?? []) as AsignacionTactica[];
  }

  /**
   * Despacho manual del supervisor hacia una sesión operativa activa.
   * Cancela asignaciones previas, registra la nueva en asignaciones_tacticas
   * y pone la sesión en EN_RUTA_HOTSPOT.
   */
  async despacharManual(dto: OverrideManualDto): Promise<AsignacionTactica> {
    const radio = dto.radio_m || 50;
    const geomWkt = buildCircleWkt(dto.lat, dto.lng, radio);

    // 1. Cancelar asignaciones pendientes previas de esta sesión
    await this.supabase.client
      .from('asignaciones_tacticas')
      .update({
        estado_mision: EstadoMision.CANCELADA,
        hora_liberacion: new Date().toISOString(),
      })
      .eq('id_sesion', dto.id_sesion)
      .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")');

    const etaMin = Number(localStorage.getItem('sigo_tiempo_llegada_min')) || 15;
    const baseInstruccion = dto.instrucciones || 'Desplazamiento táctico prioritario.';
    const instruccionesConEta = baseInstruccion.includes('[ETA:')
      ? baseInstruccion
      : `[ETA:${etaMin}] ${baseInstruccion}`;

    // 2. Insertar nueva asignación táctica
    const { data, error } = await this.supabase.client
      .from('asignaciones_tacticas')
      .insert({
        id_sesion:          dto.id_sesion,
        origen_asignacion:  OrigenAsignacion.MANUAL_SUPERVISOR,
        geom_destino:       geomWkt,
        centro_lat:         dto.lat,
        centro_lng:         dto.lng,
        radio_m:            radio,
        nombre_zona:        dto.nombre_zona || 'Sector asignado manualmente',
        instrucciones:      instruccionesConEta,
        id_zona:            dto.id_zona || null,
        estado_mision:      EstadoMision.PENDIENTE,
        hora_despacho:      new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error en despacharManual:', error);
      throw error;
    }

    // 3. Actualizar estado operativo de la patrulla
    await this.supabase.client
      .from('sesiones_operativas')
      .update({ estado_operativo: EstadoOperativo.EN_RUTA_HOTSPOT })
      .eq('id_sesion', dto.id_sesion);

    return data as AsignacionTactica;
  }

  async cancelarAsignacion(idAsignacion?: number | null, idSesion?: number): Promise<void> {
    if (idAsignacion && idAsignacion > 0) {
      await this.supabase.client
        .from('asignaciones_tacticas')
        .update({
          estado_mision: EstadoMision.CANCELADA,
          hora_liberacion: new Date().toISOString(),
        })
        .eq('id_asignacion', idAsignacion);
    }

    if (idSesion) {
      await this.supabase.client
        .from('asignaciones_tacticas')
        .update({
          estado_mision: EstadoMision.CANCELADA,
          hora_liberacion: new Date().toISOString(),
        })
        .eq('id_sesion', idSesion)
        .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")');

      await this.supabase.client
        .from('sesiones_operativas')
        .update({ estado_operativo: EstadoOperativo.DISPONIBLE })
        .eq('id_sesion', idSesion);
    }
  }

  async marcarLlegadaZona(idSesion: number): Promise<void> {
    await this.supabase.client
      .from('sesiones_operativas')
      .update({ estado_operativo: EstadoOperativo.PATRULLANDO_ZONA })
      .eq('id_sesion', idSesion);

    await this.supabase.client
      .from('asignaciones_tacticas')
      .update({
        estado_mision: EstadoMision.PATRULLANDO,
        hora_ingreso_zona: new Date().toISOString(),
      })
      .eq('id_sesion', idSesion)
      .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")');
  }

  // ─── Zonas de Patrullaje ──────────────────────────────────────────────────

  async getZonas(): Promise<ZonaPatrullaje[]> {
    const { data, error } = await this.supabase.client
      .from('zonas_patrullaje')
      .select('*')
      .order('id_zona', { ascending: true });

    if (error) {
      console.error('[API] Error getZonas:', error);
      return [];
    }
    return (data ?? []) as ZonaPatrullaje[];
  }

  async guardarZona(zona: Partial<ZonaPatrullaje>): Promise<ZonaPatrullaje> {
    if (zona.id_zona) {
      const { data, error } = await this.supabase.client
        .from('zonas_patrullaje')
        .update({
          nombre:    zona.nombre,
          direccion: zona.direccion,
          lat:       zona.lat,
          lng:       zona.lng,
          radio_m:   zona.radio_m,
          activa:    zona.activa ?? true,
        })
        .eq('id_zona', zona.id_zona)
        .select()
        .single();
      if (error) throw error;
      return data as ZonaPatrullaje;
    } else {
      const { data, error } = await this.supabase.client
        .from('zonas_patrullaje')
        .insert({
          nombre:    zona.nombre,
          direccion: zona.direccion,
          lat:       zona.lat,
          lng:       zona.lng,
          radio_m:   zona.radio_m || 1.13,
          activa:    zona.activa ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ZonaPatrullaje;
    }
  }

  async eliminarZona(idZona: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('zonas_patrullaje')
      .delete()
      .eq('id_zona', idZona);
    if (error) throw error;
  }

  // ─── Mensajería Táctica Supervisor <-> Patrulla ───────────────────────────

  async getMensajes(idSesion: number): Promise<Mensaje[]> {
    const { data, error } = await this.supabase.client
      .from('mensajes')
      .select('*')
      .eq('id_sesion', idSesion)
      .order('fecha', { ascending: true });

    if (error) {
      console.error('[API] Error getMensajes:', error);
      return [];
    }
    return (data ?? []) as Mensaje[];
  }

  async getHistorialMensajes(diasAtras: number = 365): Promise<any[]> {
    const cutoff = new Date(Date.now() - diasAtras * 86400000).toISOString();
    try {
      const { data, error } = await this.supabase.client
        .from('mensajes')
        .select('*, sesion:sesiones_operativas(id_sesion, identificador_unidad, rut_conductor, conductor:usuarios(nombre_completo))')
        .gte('fecha', cutoff)
        .order('fecha', { ascending: false });

      if (error) throw error;
      return data ?? [];
    } catch {
      const fallback = await this.supabase.client
        .from('mensajes')
        .select('*')
        .gte('fecha', cutoff)
        .order('fecha', { ascending: false });
      return fallback.data ?? [];
    }
  }

  async enviarMensaje(idSesion: number, texto: string, rutSupervisor?: string): Promise<Mensaje> {
    const { data, error } = await this.supabase.client
      .from('mensajes')
      .insert({
        id_sesion:     idSesion,
        remitente:     'SUPERVISOR',
        rut_remitente: rutSupervisor || null,
        texto:         texto.trim(),
        fecha:         new Date().toISOString(),
        leido:         false,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error enviarMensaje:', error);
      throw error;
    }
    return data as Mensaje;
  }

  async marcarMensajesLeidos(idSesion: number): Promise<void> {
    await this.supabase.client
      .from('mensajes')
      .update({ leido: true })
      .eq('id_sesion', idSesion)
      .eq('remitente', 'FUNCIONARIO');
  }

  // ─── Registro de Evidencias (Móvil y Dashboard) ──────────────────────────

  async getEvidencias(): Promise<RegistroEvidencia[]> {
    const { data, error } = await this.supabase.client
      .from('v_evidencias')
      .select('*')
      .order('fecha_subida', { ascending: false });

    if (error) {
      console.error('[API] Error getEvidencias:', error);
      return [];
    }
    return (data ?? []) as RegistroEvidencia[];
  }

  getJustificaciones(): Promise<RegistroEvidencia[]> {
    return this.getEvidencias();
  }

  async crearEvidencia(payload: {
    id_sesion:         number;
    id_asignacion?:    number | null;
    tipo_evidencia:    TipoEvidencia;
    es_obligatoria?:   boolean;
    url_fotografia?:   string | null;
    descripcion_texto: string;
    subido_por?:       string;
    lat?:              number | null;
    lng?:              number | null;
  }): Promise<RegistroEvidencia> {
    let geomWkt = null;
    if (payload.lat != null && payload.lng != null) {
      geomWkt = `SRID=4326;POINT(${payload.lng} ${payload.lat})`;
    }

    const { data, error } = await this.supabase.client
      .from('registro_evidencias')
      .insert({
        id_sesion:         payload.id_sesion,
        id_asignacion:     payload.id_asignacion || null,
        tipo_evidencia:    payload.tipo_evidencia,
        es_obligatoria:    payload.es_obligatoria ?? false,
        url_fotografia:    payload.url_fotografia || null,
        descripcion_texto: payload.descripcion_texto,
        origen:            'DASHBOARD',
        subido_por:        payload.subido_por || 'Supervisor Web',
        geom_evidencia:    geomWkt,
        fecha_subida:      new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error crearEvidencia:', error);
      throw error;
    }
    return data as RegistroEvidencia;
  }

  async eliminarEvidencia(idEvidencia: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('registro_evidencias')
      .delete()
      .eq('id_evidencia', idEvidencia);

    if (error) throw error;
  }

  // ─── Alertas de emergencia ────────────────────────────────────────────────

  async getAlertasActivas(): Promise<AlertaEmergencia[]> {
    const { data, error } = await this.supabase.client
      .from('v_alertas_emergencia')
      .select('*')
      .eq('estado', 'ACTIVA')
      .order('fecha_alerta', { ascending: false });

    if (error) {
      console.error('[API] Error getAlertasActivas:', error);
      return [];
    }
    return (data ?? []) as AlertaEmergencia[];
  }

  async resolverAlerta(idEmergencia: number, idSesionSolicitante?: number): Promise<void> {
    const { data: alerta, error } = await this.supabase.client
      .from('alertas_emergencia')
      .update({ estado: 'RESUELTA' })
      .eq('id_emergencia', idEmergencia)
      .select('id_sesion_solicitante')
      .maybeSingle();

    if (error) throw error;

    const sesionId = idSesionSolicitante ?? alerta?.id_sesion_solicitante;
    if (sesionId) {
      await this.supabase.client
        .from('sesiones_operativas')
        .update({ estado_operativo: EstadoOperativo.DISPONIBLE })
        .eq('id_sesion', sesionId)
        .eq('estado_operativo', EstadoOperativo.OCUPADO_EMERGENCIA);
    }
  }

  // ─── Gestión de Perfiles App Móvil ─────────────────────────────────────────

  async getUsuariosMoviles(): Promise<any[]> {
    if (!this.supabase.isConfigured) return [];
    const { data, error } = await this.supabase.client
      .from('usuarios')
      .select('rut_usuario, nombre_completo, rol, grado_cargo, activo')
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('[API] Error getUsuariosMoviles:', error);
      return [];
    }
    return (data ?? []) as any[];
  }

  async crearUsuarioMovil(user: {
    rut_usuario: string;
    nombre_completo: string;
    password_hash: string;
    grado_cargo?: string;
  }): Promise<any> {
    const { data, error } = await this.supabase.client
      .from('usuarios')
      .insert({
        rut_usuario: user.rut_usuario.trim(),
        nombre_completo: user.nombre_completo.trim(),
        password_hash: user.password_hash.trim(),
        grado_cargo: user.grado_cargo || 'Carabinero',
        rol: 'FUNCIONARIO_MOVIL',
        activo: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async eliminarUsuarioMovil(rutUsuario: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('usuarios')
      .delete()
      .eq('rut_usuario', rutUsuario);

    if (error) throw error;
  }
}
