import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  SesionOperativa, EventoHotspot, RegistroEvidencia,
  AlertaEmergencia, AsignacionTactica, OverrideManualDto,
  ZonaPatrullaje, Mensaje, EstadoOperativo, EstadoMision,
  OrigenAsignacion, TipoEvidencia, Usuario,
  calcularUveSesion, clasificarZonaPorScore, calcularScoreAjustado,
  PesoSeveridadDelito, DelitoRegistro, ResultadoDespachoRefuerzosUve,
  UnidadRefuerzoDespachada,
} from '../models';
import { firstValueFrom } from 'rxjs';
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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
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

    return ((data ?? []) as any[]).map((s: any) => {
      const tripulacion = (s.tripulacion ?? []).map((t: any) => ({
        id_tripulacion: t.id_tripulacion,
        id_sesion: s.id_sesion,
        rut_acompanante: t.rut_acompanante,
        acompanante: Array.isArray(t.acompanante) ? t.acompanante[0] ?? null : t.acompanante,
      }));
      const uve = calcularUveSesion({ ...s, tripulacion });
      return {
        ...s,
        tipo_medio: uve.tipoMedio,
        valor_uve: uve.valorUve,
        fecha_inicio: this.toUtcIso(s.fecha_inicio),
        fecha_cierre: this.toUtcIso(s.fecha_cierre),
        conductor: Array.isArray(s.conductor) ? s.conductor[0] ?? null : s.conductor,
        tripulacion,
        asignacion_activa: (s.asignacion_activa ?? []).find(
          (a: any) => !['COMPLETADA', 'CANCELADA'].includes(a.estado_mision)
        ) ?? null,
      };
    }) as SesionOperativa[];
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
    const tripulacion = (s.tripulacion ?? []).map((t: any) => ({
      id_tripulacion: t.id_tripulacion,
      id_sesion: s.id_sesion,
      rut_acompanante: t.rut_acompanante,
      acompanante: Array.isArray(t.acompanante) ? t.acompanante[0] ?? null : t.acompanante,
    }));
    const uve = calcularUveSesion({ ...s, tripulacion });
    return {
      ...s,
      tipo_medio: uve.tipoMedio,
      valor_uve: uve.valorUve,
      fecha_inicio: this.toUtcIso(s.fecha_inicio),
      fecha_cierre: this.toUtcIso(s.fecha_cierre),
      conductor: Array.isArray(s.conductor) ? s.conductor[0] ?? null : s.conductor,
      tripulacion,
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
        id_sesion: dto.id_sesion,
        origen_asignacion: OrigenAsignacion.MANUAL_SUPERVISOR,
        geom_destino: geomWkt,
        centro_lat: dto.lat,
        centro_lng: dto.lng,
        radio_m: radio,
        nombre_zona: dto.nombre_zona || 'Sector asignado manualmente',
        instrucciones: instruccionesConEta,
        id_zona: dto.id_zona || null,
        estado_mision: EstadoMision.PENDIENTE,
        hora_despacho: new Date().toISOString(),
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

  // ─── Zonas de Patrullaje & Calibración por Gravedad Delictual U.V.E. ───────

  private readonly ZONAS_CALIBRADAS_KEY = 'sigo_zonas_calibradas_uve_v2';

  private loadZonasCalibradasOverlay(): Record<number, Partial<ZonaPatrullaje>> {
    try {
      const raw = localStorage.getItem(this.ZONAS_CALIBRADAS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  private saveZonasCalibradasOverlay(map: Record<number, Partial<ZonaPatrullaje>>): void {
    try {
      localStorage.setItem(this.ZONAS_CALIBRADAS_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  private defaultVerticesForZone(lat: number, lng: number, radiusM: number): { lat: number; lng: number }[] {
    const r = Math.max(radiusM || 160, 20);
    const puntos = 32;
    const coords: { lat: number; lng: number }[] = [];
    const latRad = (lat * Math.PI) / 180;
    for (let i = 0; i < puntos; i++) {
      const ang = (2 * Math.PI * i) / puntos;
      const dLat = (r * Math.sin(ang)) / 111320;
      const dLng = (r * Math.cos(ang)) / (111320 * Math.cos(latRad));
      coords.push({
        lat: Number((lat + dLat).toFixed(6)),
        lng: Number((lng + dLng).toFixed(6)),
      });
    }
    return coords;
  }

  private defaultDelitosForZona(idZona: number, nombre: string): DelitoRegistro[] {
    const now = new Date().toISOString();
    const n = (nombre || '').toLowerCase();
    if (n.includes('libertad') || n.includes('valpara') || idZona % 3 === 1) {
      return [
        { id: `d-${idZona}-1`, zona_id: String(idZona), tipo_delito: 'Porte de arma / Delito violento', categoria_peso: 50, fecha_hora: now },
        { id: `d-${idZona}-2`, zona_id: String(idZona), tipo_delito: 'Robo con intimidación a peatón', categoria_peso: 20, fecha_hora: now },
        { id: `d-${idZona}-3`, zona_id: String(idZona), tipo_delito: 'Robo de vehículo motorizado', categoria_peso: 10, fecha_hora: now },
        { id: `d-${idZona}-4`, zona_id: String(idZona), tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: now },
      ]; // 85 pts -> ALTO
    }
    if (n.includes('reloj') || n.includes('perú') || n.includes('san mart') || idZona % 3 === 2) {
      return [
        { id: `d-${idZona}-1`, zona_id: String(idZona), tipo_delito: 'Robo con violencia', categoria_peso: 20, fecha_hora: now },
        { id: `d-${idZona}-2`, zona_id: String(idZona), tipo_delito: 'Robo en lugar habitado', categoria_peso: 10, fecha_hora: now },
        { id: `d-${idZona}-3`, zona_id: String(idZona), tipo_delito: 'Robo de accesorios de vehículo', categoria_peso: 10, fecha_hora: now },
        { id: `d-${idZona}-4`, zona_id: String(idZona), tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: now },
      ]; // 45 pts -> MEDIO
    }
    return [
      { id: `d-${idZona}-1`, zona_id: String(idZona), tipo_delito: 'Robo en lugar no habitado', categoria_peso: 10, fecha_hora: now },
      { id: `d-${idZona}-2`, zona_id: String(idZona), tipo_delito: 'Hurto simple', categoria_peso: 2, fecha_hora: now },
      { id: `d-${idZona}-3`, zona_id: String(idZona), tipo_delito: 'Consumo de alcohol en vía pública', categoria_peso: 1, fecha_hora: now },
    ]; // 13 pts -> BAJO
  }

  private enrichZonaCalibrada(z: ZonaPatrullaje, overlay: Record<number, Partial<ZonaPatrullaje>>): ZonaPatrullaje {
    const saved = overlay[z.id_zona] || {};
    const delitos: DelitoRegistro[] = saved.delitos ?? z.delitos ?? this.defaultDelitosForZona(z.id_zona, z.nombre);
    const scoreGravedad = delitos.reduce((acc, d) => acc + Number(d.categoria_peso || 0), 0);
    const minutosPatrulladosHoy = saved.minutos_patrullados_hoy ?? z.minutos_patrullados_hoy ?? (z.id_zona * 12) % 45;
    const scoreAjustado = calcularScoreAjustado(scoreGravedad, minutosPatrulladosHoy);
    const clasificacion = clasificarZonaPorScore(scoreGravedad);
    const vertices =
      saved.vertices && saved.vertices.length >= 3
        ? saved.vertices
        : z.vertices && z.vertices.length >= 3
          ? z.vertices
          : this.defaultVerticesForZone(z.lat, z.lng, z.radio_m);

    return {
      ...z,
      ...saved,
      delitos,
      cantidad_delitos: delitos.length,
      score_gravedad: scoreGravedad,
      score_ajustado: scoreAjustado,
      nivel_riesgo: clasificacion.nivelRiesgo,
      estado: 'LIBRE',
      minutos_patrullados_hoy: minutosPatrulladosHoy,
      ultimo_patrullaje: saved.ultimo_patrullaje ?? z.ultimo_patrullaje ?? null,
      uve_objetivo_min: clasificacion.uveObjetivoMin,
      uve_objetivo_max: clasificacion.uveObjetivoMax,
      medios_sugeridos: clasificacion.mediosSugeridos,
      etiqueta_demanda: clasificacion.etiquetaDemanda,
      vertices,
    };
  }

  async getZonas(): Promise<ZonaPatrullaje[]> {
    const { data, error } = await this.supabase.client
      .from('zonas_patrullaje')
      .select('*')
      .order('id_zona', { ascending: true });

    if (error) {
      console.error('[API] Error getZonas:', error);
      return [];
    }
    const overlay = this.loadZonasCalibradasOverlay();
    const enriched = ((data ?? []) as ZonaPatrullaje[]).map((z) => this.enrichZonaCalibrada(z, overlay));
    this.saveZonasCalibradasOverlay(
      enriched.reduce((acc, z) => {
        acc[z.id_zona] = {
          delitos: z.delitos,
          vertices: z.vertices,
          estado: z.estado,
          minutos_patrullados_hoy: z.minutos_patrullados_hoy,
          ultimo_patrullaje: z.ultimo_patrullaje,
        };
        return acc;
      }, {} as Record<number, Partial<ZonaPatrullaje>>)
    );
    return enriched;
  }

  async guardarZona(zona: Partial<ZonaPatrullaje>): Promise<ZonaPatrullaje> {
    let savedRow: ZonaPatrullaje;
    if (zona.id_zona) {
      const { data, error } = await this.supabase.client
        .from('zonas_patrullaje')
        .update({
          nombre: zona.nombre,
          direccion: zona.direccion,
          lat: zona.lat,
          lng: zona.lng,
          radio_m: zona.radio_m || 180,
          activa: zona.activa ?? true,
        })
        .eq('id_zona', zona.id_zona)
        .select()
        .single();
      if (error) throw error;
      savedRow = data as ZonaPatrullaje;
    } else {
      const { data, error } = await this.supabase.client
        .from('zonas_patrullaje')
        .insert({
          nombre: zona.nombre,
          direccion: zona.direccion,
          lat: zona.lat,
          lng: zona.lng,
          radio_m: zona.radio_m || 180,
          activa: zona.activa ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      savedRow = data as ZonaPatrullaje;
    }

    const overlay = this.loadZonasCalibradasOverlay();
    overlay[savedRow.id_zona] = {
      ...(overlay[savedRow.id_zona] || {}),
      vertices: zona.vertices && zona.vertices.length >= 3
        ? zona.vertices
        : overlay[savedRow.id_zona]?.vertices ?? this.defaultVerticesForZone(savedRow.lat, savedRow.lng, savedRow.radio_m),
      delitos: zona.delitos ?? overlay[savedRow.id_zona]?.delitos ?? this.defaultDelitosForZona(savedRow.id_zona, savedRow.nombre),
      estado: zona.estado ?? overlay[savedRow.id_zona]?.estado ?? 'LIBRE',
      minutos_patrullados_hoy: zona.minutos_patrullados_hoy ?? overlay[savedRow.id_zona]?.minutos_patrullados_hoy ?? 0,
    };
    this.saveZonasCalibradasOverlay(overlay);

    // Sincronizar opcionalmente con sigo-api si está levantado
    firstValueFrom(
      this.http.post(`${this.baseUrl}/zonas/riesgo`, {
        nombre: savedRow.nombre,
        vertices: overlay[savedRow.id_zona].vertices,
        delitos_iniciales: (overlay[savedRow.id_zona].delitos || []).map((d) => ({
          tipo_delito: d.tipo_delito,
          categoria_peso: d.categoria_peso,
        })),
      })
    ).catch(() => { });

    return this.enrichZonaCalibrada(savedRow, overlay);
  }

  async eliminarZona(idZona: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('zonas_patrullaje')
      .delete()
      .eq('id_zona', idZona);
    if (error) throw error;
    const overlay = this.loadZonasCalibradasOverlay();
    delete overlay[idZona];
    this.saveZonasCalibradasOverlay(overlay);
  }

  /**
   * Registra un delito en delitos_registro para una zona y recalcula automáticamente
   * score_gravedad y nivel_riesgo (< 40 BAJO, 40-80 MEDIO, > 80 ALTO).
   */
  async registrarDelitoZona(
    idZona: number,
    tipoDelito: string,
    categoriaPeso: PesoSeveridadDelito
  ): Promise<ZonaPatrullaje[]> {
    const overlay = this.loadZonasCalibradasOverlay();
    const actual = overlay[idZona] || {};
    const listaActual = actual.delitos || [];
    const nuevoDelito: DelitoRegistro = {
      id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      zona_id: String(idZona),
      tipo_delito: tipoDelito.trim(),
      categoria_peso: categoriaPeso,
      fecha_hora: new Date().toISOString(),
    };
    overlay[idZona] = {
      ...actual,
      delitos: [nuevoDelito, ...listaActual],
    };
    this.saveZonasCalibradasOverlay(overlay);
    return this.getZonas();
  }

  async eliminarDelitoZona(idZona: number, delitoId: string): Promise<ZonaPatrullaje[]> {
    const overlay = this.loadZonasCalibradasOverlay();
    const actual = overlay[idZona];
    if (actual?.delitos) {
      actual.delitos = actual.delitos.filter((d) => d.id !== delitoId);
      overlay[idZona] = actual;
      this.saveZonasCalibradasOverlay(overlay);
    }
    return this.getZonas();
  }

  /**
   * Algoritmo Anti-Fijación de Selección Rotativa de Zonas (k de 1 a 5):
   * - Filtra zonas donde estado != 'ASIGNADA' y con cooldown cumplido (ultimo_patrullaje > 90 min o NULL).
   * - Calcula score_ajustado = score_gravedad / (1 + (0.02 * minutos_patrullados_hoy)).
   * - Toma las k zonas distintas con mayor score_ajustado y actualiza su estado a 'ASIGNADA'.
   */
  async seleccionarZonasRotativas(k: number): Promise<{
    k_solicitado: number;
    k_asignado: number;
    uve_objetivo_total_min: number;
    uve_objetivo_total_max: number;
    zonas_seleccionadas: ZonaPatrullaje[];
    todas_las_zonas: ZonaPatrullaje[];
  }> {
    const kVal = Math.max(1, Math.min(5, Math.floor(Number(k) || 1)));

    // Intentar notificar al endpoint REST POST /api/v1/zonas/seleccionar-rotativas
    firstValueFrom(this.http.post(`${this.baseUrl}/zonas/seleccionar-rotativas`, { k: kVal })).catch(() => { });

    const zonas = await this.getZonas();
    const ahoraMs = Date.now();
    const COOLDOWN_MS = 90 * 60 * 1000;

    // Si ya había zonas ASIGNADAS previamente, pasan a EN_ENFRIAMIENTO con minutos patrullados actualizados
    const overlay = this.loadZonasCalibradasOverlay();

    let candidatas = zonas.filter((z) => {
      if (!z.activa) return false;
      if (z.estado === 'ASIGNADA') return false;
      if (!z.ultimo_patrullaje) return true;
      const diff = ahoraMs - new Date(z.ultimo_patrullaje).getTime();
      return diff > COOLDOWN_MS;
    });

    // Si todas las zonas estaban asignadas o en enfriamiento, rotar liberando las anteriores para permitir nueva tanda sin repetir las recién asignadas
    if (candidatas.length < kVal) {
      const noAsignadas = zonas.filter((z) => z.activa && z.estado !== 'ASIGNADA');
      candidatas = noAsignadas.length >= kVal ? noAsignadas : zonas.filter((z) => z.activa);
    }

    const ordenadas = [...candidatas]
      .map((z) => ({
        ...z,
        score_ajustado: calcularScoreAjustado(z.score_gravedad || 0, z.minutos_patrullados_hoy || 0),
      }))
      .sort((a, b) => (b.score_ajustado || 0) - (a.score_ajustado || 0));

    const seleccionadas = ordenadas.slice(0, kVal);
    const idsSeleccionados = new Set(seleccionadas.map((s) => s.id_zona));

    const nowIso = new Date().toISOString();
    for (const z of zonas) {
      const prev = overlay[z.id_zona] || {};
      if (idsSeleccionados.has(z.id_zona)) {
        overlay[z.id_zona] = {
          ...prev,
          estado: 'ASIGNADA',
          ultimo_patrullaje: nowIso,
          minutos_patrullados_hoy: (z.minutos_patrullados_hoy || 0) + 15,
        };
      } else if (z.estado === 'ASIGNADA') {
        overlay[z.id_zona] = {
          ...prev,
          estado: 'LIBRE',
        };
      }
    }
    this.saveZonasCalibradasOverlay(overlay);

    const todasActualizadas = await this.getZonas();
    const seleccionadasActualizadas = todasActualizadas.filter((z) => idsSeleccionados.has(z.id_zona));

    const uveMin = Number(
      seleccionadasActualizadas.reduce((acc, z) => acc + (z.uve_objetivo_min || 0.2), 0).toFixed(2)
    );
    const uveMax = Number(
      seleccionadasActualizadas.reduce((acc, z) => acc + (z.uve_objetivo_max || 0.3), 0).toFixed(2)
    );

    return {
      k_solicitado: kVal,
      k_asignado: seleccionadasActualizadas.length,
      uve_objetivo_total_min: uveMin,
      uve_objetivo_total_max: uveMax,
      zonas_seleccionadas: seleccionadasActualizadas,
      todas_las_zonas: todasActualizadas,
    };
  }

  async liberarZonasAsignadas(): Promise<ZonaPatrullaje[]> {
    const overlay = this.loadZonasCalibradasOverlay();
    Object.keys(overlay).forEach((k) => {
      const id = Number(k);
      if (overlay[id]) {
        overlay[id].estado = 'LIBRE';
      }
    });
    this.saveZonasCalibradasOverlay(overlay);
    return this.getZonas();
  }

  /**
   * Algoritmo de Despacho de Refuerzos por U.V.E. (POST /api/refuerzos/despachar):
   * - Marca patrulla solicitante en emergencia/solicitando refuerzo.
   * - Busca patrullas activas ('PATRULLANDO_ZONA' o 'DISPONIBLE' o 'EN_RUTA_HOTSPOT').
   * - Calcula distancia geodésica (ST_Distance / Haversine) y tiempo estimado de llegada (ETA) según medio.
   * - Ordena por menor ETA y acumula unidades hasta cubrir o superar uve_requerida.
   */
  async despacharRefuerzosUve(
    patrullaOrigenId: string | number,
    uveRequerida: number,
    latOrigen: number,
    lngOrigen: number,
    todasLasSesiones: SesionOperativa[]
  ): Promise<ResultadoDespachoRefuerzosUve> {
    // Llamada asíncrona al endpoint REST del backend
    firstValueFrom(
      this.http.post(`${this.baseUrl}/refuerzos/despachar`, {
        patrulla_origen_id: String(patrullaOrigenId),
        uve_requerida: uveRequerida,
        latitude: latOrigen,
        longitude: lngOrigen,
      })
    ).catch(() => { });

    const VELOCIDAD_KMH: Record<string, number> = {
      RPT: 50,
      RPD: 50,
      FZ: 45,
      MTT: 55,
      CB: 20,
      INF: 5,
    };

    const haversineM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const candidatas = todasLasSesiones
      .filter((s) => {
        if (String(s.id_sesion) === String(patrullaOrigenId)) return false;
        if (s.estado_operativo === EstadoOperativo.INACTIVO) return false;
        return s.coordenadas_rt != null;
      })
      .map((s) => {
        const uveInfo = calcularUveSesion(s);
        const distM = haversineM(
          latOrigen,
          lngOrigen,
          s.coordenadas_rt!.lat,
          s.coordenadas_rt!.lng
        );
        const velKmh = VELOCIDAD_KMH[uveInfo.tipoMedio] || 40;
        const velMMin = (velKmh * 1000) / 60;
        const etaMin = Math.max(1, Number((distM / velMMin).toFixed(1)));
        return {
          sesion: s,
          id: String(s.id_sesion),
          id_sesion: s.id_sesion,
          identificador_unidad: s.identificador_unidad,
          conductor: s.conductor?.nombre_completo ?? s.rut_conductor,
          tipo_medio: uveInfo.tipoMedio,
          valor_uve: uveInfo.valorUve,
          distancia_metros: distM,
          eta_minutos: etaMin,
          lat: s.coordenadas_rt!.lat,
          lng: s.coordenadas_rt!.lng,
        };
      })
      .sort((a, b) => a.eta_minutos - b.eta_minutos || b.valor_uve - a.valor_uve);

    const seleccionadas: UnidadRefuerzoDespachada[] = [];
    let uveAcumulada = 0;

    for (const c of candidatas) {
      if (uveAcumulada >= uveRequerida) break;
      seleccionadas.push({
        id: c.id,
        id_sesion: c.id_sesion,
        identificador_unidad: c.identificador_unidad,
        conductor: c.conductor,
        tipo_medio: c.tipo_medio,
        valor_uve: c.valor_uve,
        distancia_metros: c.distancia_metros,
        eta_minutos: c.eta_minutos,
        lat: c.lat,
        lng: c.lng,
      });
      uveAcumulada = Number((uveAcumulada + c.valor_uve).toFixed(2));
    }

    return {
      patrulla_origen_id: String(patrullaOrigenId),
      uve_requerida: uveRequerida,
      uve_acumulada: uveAcumulada,
      demanda_cubierta: uveAcumulada >= uveRequerida,
      unidades_despachadas: seleccionadas,
      timestamp: new Date().toISOString(),
    };
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
        id_sesion: idSesion,
        remitente: 'SUPERVISOR',
        rut_remitente: rutSupervisor || null,
        texto: texto.trim(),
        fecha: new Date().toISOString(),
        leido: false,
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
    return ((data ?? []) as RegistroEvidencia[]).map(e => ({
      ...e,
      fecha_subida: this.toUtcIso(e.fecha_subida),
    }));
  }

  getJustificaciones(): Promise<RegistroEvidencia[]> {
    return this.getEvidencias();
  }

  async crearEvidencia(payload: {
    id_sesion: number;
    id_asignacion?: number | null;
    tipo_evidencia: TipoEvidencia;
    es_obligatoria?: boolean;
    url_fotografia?: string | null;
    descripcion_texto: string;
    subido_por?: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<RegistroEvidencia> {
    let geomWkt = null;
    if (payload.lat != null && payload.lng != null) {
      geomWkt = `SRID=4326;POINT(${payload.lng} ${payload.lat})`;
    }

    const { data, error } = await this.supabase.client
      .from('registro_evidencias')
      .insert({
        id_sesion: payload.id_sesion,
        id_asignacion: payload.id_asignacion || null,
        tipo_evidencia: payload.tipo_evidencia,
        es_obligatoria: payload.es_obligatoria ?? false,
        url_fotografia: payload.url_fotografia || null,
        descripcion_texto: payload.descripcion_texto,
        origen: 'DASHBOARD',
        subido_por: payload.subido_por || 'Supervisor Web',
        geom_evidencia: geomWkt,
        fecha_subida: new Date().toISOString(),
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
    return ((data ?? []) as AlertaEmergencia[]).map(a => ({
      ...a,
      fecha_alerta: this.toUtcIso(a.fecha_alerta),
    }));
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
