import { supabaseAdmin } from '../config/supabase';
import { resolverTipoMedio, CONFIG_MEDIOS_UVE } from './uve.utils';

export type ModoDespacho = 'MANUAL' | 'AUTO' | 'OPTIMIZADO';

export interface DelitoCalibrado {
  id: string;
  zona_id: string;
  tipo_delito: string;
  categoria_peso: number;
  fecha_hora: string;
}

export interface ZonaTactica {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radio_m?: number;
  crimeCount?: number;
  scoreGravedad: number;
  nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  uveObjetivoMin: number;
  delitos?: DelitoCalibrado[];
}

export interface PatrullaTactica {
  id: string;
  nombre: string;
  tipo_medio: 'RPT' | 'RPD' | 'FZ' | 'MTT' | 'CB' | 'INF';
  valor_uve: number;
  dotacion_total: number;
  estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO';
  lat: number;
  lng: number;
  destino_zona_id: number | null;
  destino_zona_json: ZonaTactica | null;
  is_manual: boolean;
  angulo_orbita: number;
}

const DEFAULT_ZONES: ZonaTactica[] = [
  { id: 1, lat: -33.01840, lng: -71.51398, crimeCount: 9, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z1', address: 'Chonta 3544, Miraflores', radio_m: 160 },
  { id: 2, lat: -33.02229, lng: -71.55278, crimeCount: 6, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z2', address: '1 Norte / 1 Poniente', radio_m: 160 },
  { id: 3, lat: -33.01533, lng: -71.55008, crimeCount: 2, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z3', address: '8 Norte / Av. Libertad', radio_m: 160 },
  { id: 4, lat: -33.02500, lng: -71.55237, crimeCount: 9, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z4', address: 'Av. Valparaíso / Plaza Vergara', radio_m: 160 },
  { id: 5, lat: -33.02079, lng: -71.55627, crimeCount: 6, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z5', address: '2 Norte / 4 Poniente', radio_m: 160 },
  { id: 6, lat: -33.00800, lng: -71.54849, crimeCount: 2, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z6', address: '15 Norte / Av. Libertad', radio_m: 160 },
  { id: 7, lat: -33.01983, lng: -71.54837, crimeCount: 9, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z7', address: '4 Norte / 2 Oriente', radio_m: 160 },
  { id: 8, lat: -33.01439, lng: -71.55655, crimeCount: 6, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z8', address: 'Av. Perú / 8 Norte', radio_m: 160 },
  { id: 9, lat: -33.02546, lng: -71.55872, crimeCount: 2, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z9', address: 'Alvarez / Traslaviña', radio_m: 160 },
];

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

function defaultDelitosForZona(idZona: number, nombre: string): DelitoCalibrado[] {
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

function classifyByScore(score: number): {
  nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  uveObjetivoMin: number;
  crimeCount: number;
} {
  if (score > 80) return { nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, crimeCount: 9 };
  if (score >= 40) return { nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, crimeCount: 6 };
  return { nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, crimeCount: 2 };
}

class TacticalEngine24x7 {
  private modo: ModoDespacho = 'MANUAL';
  private kZonas = 3;
  private intervaloSeg = 120;
  private tiempoLlegadaMin = 15;
  private zonasActivasIds: number[] = [];
  private proximoCicloAt = Date.now() + 120_000;
  private cycleIndex = 0;
  private patrullas = new Map<string, PatrullaTactica>();
  private unidadesReales: Array<{ id_sesion: number; tipo_medio: string; valor_uve: number; destino_zona_id: number | null }> = [];
  private zonasCatalogo: ZonaTactica[] = [...DEFAULT_ZONES];
  private delitosPorZona = new Map<number, DelitoCalibrado[]>();
  private dbDisponible = true;
  private tickCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastDispatchedRealZone = new Map<number, number>();
  private isDispatchingReals = false;

  async start(): Promise<void> {
    await this.loadZonesFromSupabase();
    await this.loadFromSupabase();
    await this.refreshRealSessionsFromSupabase();
    if (this.modo !== 'MANUAL' && this.zonasActivasIds.length > 0) {
      const elegidas = this.zonasActivasIds
        .map(id => this.zonasCatalogo.find(z => z.id === id))
        .filter((z): z is ZonaTactica => !!z);
      if (elegidas.length > 0) {
        this.assignPatrolsToZones(elegidas);
      }
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch(err => console.warn('[TacticalEngine] Tick error:', err?.message));
    }, 1000);
    console.log(`🛰️  Motor Táctico 24/7 iniciado (modo=${this.modo}, patrullas=${this.patrullas.size}, kZonas=${this.kZonas}, zonasCatalogo=${this.zonasCatalogo.length})`);
  }

  public async loadZonesFromSupabase(): Promise<ZonaTactica[]> {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('zonas_patrullaje')
        .select('*')
        .order('id_zona', { ascending: true });

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const loaded: ZonaTactica[] = [];
        for (const r of rows) {
          if (r.activa === false || r.lat == null || r.lng == null) continue;
          const id = Number(r.id_zona);
          const name = String(r.nombre || `Z${id}`);
          let delitos = this.delitosPorZona.get(id);
          if (!delitos || delitos.length === 0) {
            delitos = defaultDelitosForZona(id, name);
            this.delitosPorZona.set(id, delitos);
          }
          const score = delitos.reduce((acc, d) => acc + Number(d.categoria_peso || 0), 0);
          const clasif = classifyByScore(score);
          loaded.push({
            id,
            name,
            address: String(r.direccion || 'Sector Operativo Registrado'),
            lat: Number(r.lat),
            lng: Number(r.lng),
            radio_m: Math.max(20, Number(r.radio_m) || 160),
            crimeCount: clasif.crimeCount,
            scoreGravedad: score,
            nivelRiesgo: clasif.nivelRiesgo,
            uveObjetivoMin: clasif.uveObjetivoMin,
            delitos,
          });
        }
        if (loaded.length > 0) {
          this.zonasCatalogo = loaded;
        }
      }
    } catch (e: any) {
      console.warn('[TacticalEngine] Error cargando zonas_patrullaje:', e?.message);
    }
    return this.zonasCatalogo;
  }

  public async updateZoneCalibration(
    idZona: number,
    delitosInput?: DelitoCalibrado[],
    forceReassign = true
  ): Promise<ZonaTactica[]> {
    await this.loadZonesFromSupabase();
    const id = Number(idZona);
    if (Array.isArray(delitosInput)) {
      this.delitosPorZona.set(
        id,
        delitosInput.map((d, idx) => ({
          id: d.id || `del-${id}-${Date.now()}-${idx}`,
          zona_id: String(id),
          tipo_delito: String(d.tipo_delito || 'Evento delictual'),
          categoria_peso: Number(d.categoria_peso || 0),
          fecha_hora: d.fecha_hora || new Date().toISOString(),
        }))
      );
    }
    this.zonasCatalogo = this.zonasCatalogo.map(z => {
      if (z.id !== id) return z;
      const delitos = this.delitosPorZona.get(id) ?? z.delitos ?? defaultDelitosForZona(z.id, z.name);
      const score = delitos.reduce((acc, d) => acc + Number(d.categoria_peso || 0), 0);
      const clasif = classifyByScore(score);
      return {
        ...z,
        delitos,
        scoreGravedad: score,
        nivelRiesgo: clasif.nivelRiesgo,
        uveObjetivoMin: clasif.uveObjetivoMin,
        crimeCount: clasif.crimeCount,
      };
    });

    if (forceReassign && this.modo !== 'MANUAL' && this.zonasActivasIds.length > 0) {
      const elegidas = this.zonasActivasIds
        .map(zid => this.zonasCatalogo.find(z => z.id === zid))
        .filter((z): z is ZonaTactica => !!z);
      if (elegidas.length > 0) {
        this.assignPatrolsToZones(elegidas);
        await this.persistAllPatrols();
      }
    }
    return this.zonasCatalogo;
  }

  private async refreshRealSessionsFromSupabase(): Promise<void> {
    try {
      const { data: sesiones, error } = await supabaseAdmin
        .from('sesiones_operativas')
        .select(`
          id_sesion,
          imei_simcard,
          tipo_transporte,
          identificador_unidad,
          estado_operativo,
          fecha_cierre,
          tripulacion:tripulacion_sesion ( id_tripulacion ),
          asignaciones:asignaciones_tacticas (
            id_asignacion,
            id_zona,
            nombre_zona,
            centro_lat,
            centro_lng,
            estado_mision,
            origen_asignacion,
            instrucciones
          )
        `)
        .is('fecha_cierre', null)
        .neq('estado_operativo', 'INACTIVO');

      if (error || !Array.isArray(sesiones)) return;

      const realList: Array<{
        id_sesion: number;
        tipo_medio: string;
        valor_uve: number;
        destino_zona_id: number | null;
        estado_operativo?: string;
        en_emergencia?: boolean;
      }> = [];

      for (const s of sesiones as any[]) {
        if (String(s.imei_simcard || '').startsWith('DEMO-')) continue;
        const numComp = Array.isArray(s.tripulacion) ? s.tripulacion.length : 0;
        const esFz =
          String(s.identificador_unidad || '').toUpperCase().startsWith('FZ') ||
          s.tipo_transporte === 'FURGON_Z';
        const tipoMedio = resolverTipoMedio(esFz ? 'FURGON_Z' : s.tipo_transporte, numComp);
        const valorUve = CONFIG_MEDIOS_UVE[tipoMedio]?.valor_uve ?? 0.80;

        const asigActiva = (s.asignaciones ?? []).find(
          (a: any) => !['COMPLETADA', 'CANCELADA'].includes(a.estado_mision)
        );
        let destId: number | null = null;
        if (asigActiva) {
          if (asigActiva.id_zona != null) {
            destId = Number(asigActiva.id_zona);
          } else if (asigActiva.nombre_zona) {
            const nom = String(asigActiva.nombre_zona).trim().toLowerCase();
            const matchByName = this.zonasCatalogo.find(
              z => z.name.trim().toLowerCase() === nom
            );
            if (matchByName) destId = matchByName.id;
          }
          if (destId == null && asigActiva.centro_lat != null && asigActiva.centro_lng != null) {
            const matchByCoord = this.zonasCatalogo.find(z => {
              const dLat = (z.lat - Number(asigActiva.centro_lat)) * 111.32;
              const dLng = (z.lng - Number(asigActiva.centro_lng)) * 111.32;
              return Math.hypot(dLat, dLng) <= 0.22;
            });
            if (matchByCoord) destId = matchByCoord.id;
          }
        }

        realList.push({
          id_sesion: Number(s.id_sesion),
          tipo_medio: tipoMedio,
          valor_uve: valorUve,
          destino_zona_id: destId,
          estado_operativo: s.estado_operativo,
          en_emergencia:
            s.estado_operativo === 'OCUPADO_EMERGENCIA' ||
            String(asigActiva?.nombre_zona || '').includes('REFUERZO SOS'),
        });
      }

      const prevSig = this.unidadesReales.map(u => `${u.id_sesion}:${u.tipo_medio}:${u.valor_uve}`).sort().join('|');
      const nextSig = realList.map(u => `${u.id_sesion}:${u.tipo_medio}:${u.valor_uve}`).sort().join('|');
      this.unidadesReales = realList;

      if (prevSig !== nextSig && this.modo !== 'MANUAL' && this.zonasActivasIds.length > 0) {
        const elegidas = this.zonasActivasIds
          .map(id => this.zonasCatalogo.find(z => z.id === id))
          .filter((z): z is ZonaTactica => !!z);
        if (elegidas.length > 0) {
          this.assignPatrolsToZones(elegidas);
          await this.persistAllPatrols();
        }
      }
    } catch (e: any) {
      console.warn('[TacticalEngine] Error consultando sesiones reales:', e?.message);
    }
  }

  private async dispatchRealUnitsOnServer(realTargets: Map<number, ZonaTactica>): Promise<void> {
    if (this.isDispatchingReals || this.modo === 'MANUAL') return;
    this.isDispatchingReals = true;
    try {
      for (const r of this.unidadesReales as any[]) {
        if (r.en_emergencia) continue;
        const target = realTargets.get(r.id_sesion);
        if (!target) continue;

        const alreadyAtTarget =
          r.destino_zona_id === target.id ||
          this.lastDispatchedRealZone.get(r.id_sesion) === target.id;
        if (alreadyAtTarget) continue;

        this.lastDispatchedRealZone.set(r.id_sesion, target.id);
        r.destino_zona_id = target.id;

        const radio = Math.max(20, Number(target.radio_m) || 160);
        const geomWkt = buildCircleWkt(target.lat, target.lng, radio);
        const nowIso = new Date().toISOString();

        await supabaseAdmin
          .from('asignaciones_tacticas')
          .update({
            estado_mision: 'CANCELADA',
            hora_liberacion: nowIso,
          })
          .eq('id_sesion', r.id_sesion)
          .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")');

        const modoLabel = this.modo === 'OPTIMIZADO' ? 'Auto-Optimizado' : 'Automático';
        await supabaseAdmin
          .from('asignaciones_tacticas')
          .insert({
            id_sesion: r.id_sesion,
            origen_asignacion: 'MANUAL_SUPERVISOR',
            geom_destino: geomWkt,
            centro_lat: target.lat,
            centro_lng: target.lng,
            radio_m: radio,
            nombre_zona: target.name,
            instrucciones: `[ETA:${this.tiempoLlegadaMin}] Despacho ${modoLabel} U.V.E. hacia ${target.name} (${target.address}).`,
            id_zona: target.id,
            estado_mision: 'PENDIENTE',
            hora_despacho: nowIso,
          });

        await supabaseAdmin
          .from('sesiones_operativas')
          .update({ estado_operativo: 'EN_RUTA_HOTSPOT' })
          .eq('id_sesion', r.id_sesion);
      }
    } catch (e: any) {
      console.warn('[TacticalEngine] Error despachando unidades reales en servidor:', e?.message);
    } finally {
      this.isDispatchingReals = false;
    }
  }

  private async loadFromSupabase(): Promise<void> {
    try {
      const { data: globalRow, error: errG } = await supabaseAdmin
        .from('estado_operacion_global')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (errG) {
        this.dbDisponible = false;
        console.warn('[TacticalEngine] Tablas 24/7 aún no creadas en Supabase, operando en memoria:', errG.message);
        return;
      }

      if (globalRow) {
        this.modo = (globalRow.modo_despacho as ModoDespacho) || 'MANUAL';
        this.kZonas = Number(globalRow.k_zonas) || 3;
        this.intervaloSeg = Number(globalRow.intervalo_rotacion_seg) || 120;
        this.zonasActivasIds = Array.isArray(globalRow.zonas_activas_ids) ? globalRow.zonas_activas_ids : [];
        this.proximoCicloAt = globalRow.proximo_ciclo_at
          ? new Date(globalRow.proximo_ciclo_at).getTime()
          : Date.now() + this.intervaloSeg * 1000;
      }

      // Recuperar último tiempo_llegada_min desde la asignación más reciente si existe
      try {
        const { data: lastAsig } = await supabaseAdmin
          .from('asignaciones_tacticas')
          .select('instrucciones')
          .order('hora_despacho', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastAsig?.instrucciones && !String(lastAsig.instrucciones).includes('Código Rojo')) {
          const m = String(lastAsig.instrucciones).match(/\[ETA:(\d+)\]/);
          if (m) {
            const parsed = parseInt(m[1], 10);
            if (parsed >= 1 && parsed <= 120) {
              this.tiempoLlegadaMin = parsed;
            }
          }
        }
      } catch {}

      const { data: rowsP } = await supabaseAdmin.from('patrullas_tacticas').select('*');
      if (Array.isArray(rowsP)) {
        for (const r of rowsP) {
          const destId = r.destino_zona_id != null ? Number(r.destino_zona_id) : null;
          const catalogZone = destId != null ? this.zonasCatalogo.find(z => z.id === destId) : null;
          this.patrullas.set(r.id, {
            id: r.id,
            nombre: r.nombre,
            tipo_medio: r.tipo_medio,
            valor_uve: Number(r.valor_uve),
            dotacion_total: Number(r.dotacion_total) || 1,
            estado: r.estado,
            lat: Number(r.lat),
            lng: Number(r.lng),
            destino_zona_id: destId,
            destino_zona_json: catalogZone ?? r.destino_zona_json ?? null,
            is_manual: Boolean(r.is_manual),
            angulo_orbita: Number(r.angulo_orbita) || 0,
          });
        }
      }
    } catch (e: any) {
      this.dbDisponible = false;
      console.warn('[TacticalEngine] Error cargando desde Supabase:', e?.message);
    }
  }

  private async persistGlobal(): Promise<void> {
    if (!this.dbDisponible) return;
    await supabaseAdmin
      .from('estado_operacion_global')
      .upsert({
        id: 1,
        modo_despacho: this.modo,
        k_zonas: this.kZonas,
        intervalo_rotacion_seg: this.intervaloSeg,
        zonas_activas_ids: this.zonasActivasIds,
        proximo_ciclo_at: new Date(this.proximoCicloAt).toISOString(),
        updated_at: new Date().toISOString(),
      });
  }

  private async persistPatrol(p: PatrullaTactica): Promise<void> {
    if (!this.dbDisponible) return;
    await supabaseAdmin.from('patrullas_tacticas').upsert({
      ...p,
      updated_at: new Date().toISOString(),
    });
  }

  private async persistAllPatrols(): Promise<void> {
    if (!this.dbDisponible || this.patrullas.size === 0) return;
    const rows = Array.from(this.patrullas.values()).map(p => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from('patrullas_tacticas').upsert(rows);
  }

  private async tick(): Promise<void> {
    this.tickCount++;
    const now = Date.now();
    let changedState = false;

    // Cada 3 segundos refrescar unidades reales activas directamente desde Supabase
    if (this.tickCount % 3 === 0) {
      await this.refreshRealSessionsFromSupabase();
    }

    // Cada 15 segundos refrescar catálogo de zonas de Supabase por si se creó/eliminó alguna
    if (this.tickCount % 15 === 0) {
      await this.loadZonesFromSupabase();
    }

    // 1. Rotación automática 24/7 en el servidor si el modo es AUTO u OPTIMIZADO
    if (this.modo !== 'MANUAL') {
      if (this.zonasActivasIds.length === 0 || now >= this.proximoCicloAt) {
        this.cycleIndex++;
        this.lastDispatchedRealZone.clear();
        this.rotateZonesAndAssign();
        this.proximoCicloAt = now + this.intervaloSeg * 1000;
        changedState = true;
      }
    }

    // 2. Avanzar patrullas EN_RUTA o PATRULLANDO 24/7 en el servidor (sin depender de pestañas abiertas)
    for (const p of this.patrullas.values()) {
      const z = p.destino_zona_json;
      if (!z || p.estado === 'DISPONIBLE') continue;

      if (p.estado === 'EN_RUTA') {
        const dLat = z.lat - p.lat;
        const dLng = z.lng - p.lng;
        const dist = Math.hypot(dLat, dLng);
        const stepSize = 0.0011;
        if (dist <= stepSize) {
          p.lat = z.lat;
          p.lng = z.lng;
          p.estado = 'PATRULLANDO';
          changedState = true;
        } else {
          p.lat = Number((p.lat + (dLat / dist) * stepSize).toFixed(6));
          p.lng = Number((p.lng + (dLng / dist) * stepSize).toFixed(6));
        }
      } else if (p.estado === 'PATRULLANDO') {
        p.angulo_orbita = (p.angulo_orbita + 0.14) % (Math.PI * 2);
        const radioM = z.radio_m || 160;
        const orbitMeters = Math.max(30, radioM * 0.65);
        const radiusLat = orbitMeters / 111320;
        const radiusLng = orbitMeters / (111320 * Math.cos((z.lat * Math.PI) / 180));
        p.lat = Number((z.lat + Math.sin(p.angulo_orbita) * radiusLat).toFixed(6));
        p.lng = Number((z.lng + Math.cos(p.angulo_orbita) * radiusLng).toFixed(6));
      }
    }

    if (changedState) {
      await this.persistGlobal();
      await this.persistAllPatrols();
    } else if (this.tickCount % 3 === 0) {
      await this.persistAllPatrols();
    }
  }

  public getOptimalRiskSlotsForCount(count: number, allZonesInput?: ZonaTactica[]): Array<'ALTO' | 'MEDIO' | 'BAJO'> {
    const allZones = allZonesInput && allZonesInput.length > 0 ? allZonesInput : this.zonasCatalogo;
    const k = Math.max(1, Math.min(5, count));

    const highCount = allZones.filter(z => z.nivelRiesgo === 'ALTO' || z.scoreGravedad > 80).length;
    const medCount = allZones.filter(z => z.nivelRiesgo === 'MEDIO' || (z.scoreGravedad >= 40 && z.scoreGravedad <= 80)).length;
    const lowCount = allZones.filter(z => z.nivelRiesgo === 'BAJO' || z.scoreGravedad < 40).length;
    const total = Math.max(1, highCount + medCount + lowCount);

    const quotas = [
      { nivel: 'ALTO' as const, available: highCount, exact: (highCount / total) * k, priority: 3 },
      { nivel: 'MEDIO' as const, available: medCount, exact: (medCount / total) * k, priority: 2 },
      { nivel: 'BAJO' as const, available: lowCount, exact: (lowCount / total) * k, priority: 1 },
    ].map(q => ({
      ...q,
      slots: Math.min(q.available, Math.floor(q.exact)),
      remainder: q.exact - Math.floor(q.exact),
    }));

    if (k >= 1 && quotas[0].available > 0 && quotas[0].slots === 0) {
      quotas[0].slots = 1;
      quotas[0].remainder = 0;
    }
    if (k >= 2 && quotas[1].available > 0 && quotas[1].slots === 0 && (quotas[0].slots + quotas[2].slots < k)) {
      quotas[1].slots = 1;
      quotas[1].remainder = 0;
    }
    if (k >= 3 && quotas[2].available > 0 && quotas[2].slots === 0 && (quotas[0].slots + quotas[1].slots < k)) {
      quotas[2].slots = 1;
      quotas[2].remainder = 0;
    }

    let assigned = quotas.reduce((sum, q) => sum + q.slots, 0);
    while (assigned < k) {
      const candidates = quotas
        .filter(q => q.slots < q.available)
        .sort((a, b) => (b.remainder - a.remainder) || (b.priority - a.priority));
      if (candidates.length === 0) break;
      candidates[0].slots++;
      candidates[0].remainder = 0;
      assigned++;
    }

    const slots: Array<'ALTO' | 'MEDIO' | 'BAJO'> = [];
    for (const q of quotas) {
      for (let i = 0; i < q.slots; i++) {
        slots.push(q.nivel);
      }
    }
    while (slots.length < k) {
      slots.push('MEDIO');
    }
    return slots.slice(0, k);
  }

  private rotateZonesAndAssign(forcedZoneIds?: number[]): void {
    const k = Math.max(1, Math.min(5, this.kZonas));
    let elegidas: ZonaTactica[] = [];

    if (Array.isArray(forcedZoneIds) && forcedZoneIds.length > 0) {
      elegidas = forcedZoneIds
        .map(id => this.zonasCatalogo.find(z => z.id === id))
        .filter((z): z is ZonaTactica => !!z);
    }

    if (elegidas.length === 0) {
      const previousIds = new Set<number>(this.zonasActivasIds);
      const sortedPool = [...this.zonasCatalogo].sort((a, b) => b.scoreGravedad - a.scoreGravedad || a.id - b.id);
      const poolsByRisk: Record<'ALTO' | 'MEDIO' | 'BAJO', ZonaTactica[]> = {
        ALTO: sortedPool.filter(z => z.nivelRiesgo === 'ALTO' || z.scoreGravedad > 80),
        MEDIO: sortedPool.filter(z => z.nivelRiesgo === 'MEDIO' || (z.scoreGravedad >= 40 && z.scoreGravedad <= 80)),
        BAJO: sortedPool.filter(z => z.nivelRiesgo === 'BAJO' || z.scoreGravedad < 40),
      };

      const pickedIds = new Set<number>();
      const riskSlots = this.getOptimalRiskSlotsForCount(k, sortedPool);

      for (let i = 0; i < riskSlots.length; i++) {
        const targetRisk = riskSlots[i];
        const pool = poolsByRisk[targetRisk];
        const nonRepeating = pool.filter(z => !previousIds.has(z.id) && !pickedIds.has(z.id));
        let chosen: ZonaTactica | null = null;
        if (nonRepeating.length > 0) {
          chosen = nonRepeating[(this.cycleIndex + i) % nonRepeating.length];
        } else {
          const samePool = pool.filter(z => !pickedIds.has(z.id));
          if (samePool.length > 0) {
            chosen = samePool[(this.cycleIndex + i) % samePool.length];
          } else {
            const anyPool = sortedPool.filter(z => !previousIds.has(z.id) && !pickedIds.has(z.id));
            if (anyPool.length > 0) {
              chosen = anyPool[(this.cycleIndex + i) % anyPool.length];
            }
          }
        }
        if (chosen) {
          elegidas.push(chosen);
          pickedIds.add(chosen.id);
        }
      }

      if (elegidas.length === 0) {
        elegidas = sortedPool.slice(0, k);
      }
    }

    this.zonasActivasIds = elegidas.map(z => z.id);
    this.assignPatrolsToZones(elegidas);
  }

  /**
   * Asigna de forma unificada TODAS las unidades (Reales + Demo) sobre las zonas activas
   * respetando estrictamente la jerarquía de riesgo y U.V.E.:
   * - ALTO (1.00): FZ (1.00) o RPT (1.00), o combo RPD (0.80) + MTT (0.45). Nunca CB ni INF.
   * - MEDIO (0.45-0.80): RPD (0.80) o MTT (0.45). Nunca CB ni INF.
   * - BAJO (0.20-0.30): CB (0.30) o INF (0.20).
   */
  private assignPatrolsToZones(zonas: ZonaTactica[]): void {
    const sortedZonas = [...zonas].sort((a, b) => b.scoreGravedad - a.scoreGravedad || a.id - b.id);

    type PoolUnit = {
      uid: string;
      isReal: boolean;
      idSesion?: number;
      patrulla?: PatrullaTactica;
      tipo_medio: string;
      valor_uve: number;
    };

    const realItems: PoolUnit[] = (this.unidadesReales as any[])
      .filter(r => !r.en_emergencia)
      .map(r => ({
        uid: `real-${r.id_sesion}`,
        isReal: true,
        idSesion: r.id_sesion,
        tipo_medio: r.tipo_medio,
        valor_uve: Number(r.valor_uve) || 0.80,
      }));

    const demoPoolList = Array.from(this.patrullas.values())
      .filter(p => !p.is_manual && p.destino_zona_id !== 9999);

    const demoItems: PoolUnit[] = demoPoolList.map(p => ({
      uid: `demo-${p.id}`,
      isReal: false,
      patrulla: p,
      tipo_medio: p.tipo_medio,
      valor_uve: Number(p.valor_uve) || 0.80,
    }));

    // Ordenar de MAYOR a MENOR U.V.E.; en empate de U.V.E., priorizar unidad Real
    const unifiedPool: PoolUnit[] = [...realItems, ...demoItems].sort((a, b) => {
      if (Math.abs(b.valor_uve - a.valor_uve) > 0.001) return b.valor_uve - a.valor_uve;
      if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
      return a.uid.localeCompare(b.uid);
    });

    const asignadas = new Map<string, ZonaTactica>();
    const unidadesPorZona = new Map<number, PoolUnit[]>();
    sortedZonas.forEach(z => unidadesPorZona.set(z.id, []));

    const asignar = (u: PoolUnit, z: ZonaTactica) => {
      asignadas.set(u.uid, z);
      unidadesPorZona.get(z.id)?.push(u);
    };

    // 1. Zonas ALTO
    for (const z of sortedZonas.filter(x => x.nivelRiesgo === 'ALTO' || x.scoreGravedad > 80)) {
      const disp = unifiedPool.filter(u => !asignadas.has(u.uid));
      const alta = disp.find(u => u.tipo_medio === 'FZ' || u.tipo_medio === 'RPT');
      if (alta) {
        asignar(alta, z);
        continue;
      }
      const rpd = disp.find(u => u.tipo_medio === 'RPD');
      if (rpd) {
        asignar(rpd, z);
        const mtt = unifiedPool.find(u => !asignadas.has(u.uid) && u.tipo_medio === 'MTT');
        if (mtt) asignar(mtt, z);
        continue;
      }
      const mttSola = disp.find(u => u.tipo_medio === 'MTT');
      if (mttSola) asignar(mttSola, z);
    }

    // 2. Zonas MEDIO
    for (const z of sortedZonas.filter(x => x.nivelRiesgo === 'MEDIO' || (x.scoreGravedad >= 40 && x.scoreGravedad <= 80))) {
      const disp = unifiedPool.filter(u => !asignadas.has(u.uid));
      const media = disp.find(u => u.tipo_medio === 'RPD' || u.tipo_medio === 'MTT');
      if (media) asignar(media, z);
    }

    // 3. Zonas BAJO
    for (const z of sortedZonas.filter(x => x.nivelRiesgo === 'BAJO' || x.scoreGravedad < 40)) {
      const disp = unifiedPool.filter(u => !asignadas.has(u.uid));
      const baja = disp.find(u => u.tipo_medio === 'CB' || u.tipo_medio === 'INF');
      if (baja) asignar(baja, z);
    }

    // 4. Si alguna zona quedó vacía y quedan unidades compatibles, cubrir sin violar restricción CB/INF
    for (const z of sortedZonas.filter(x => (unidadesPorZona.get(x.id)?.length ?? 0) === 0)) {
      const disp = unifiedPool.filter(u => !asignadas.has(u.uid));
      if (disp.length === 0) break;
      const esBaja = z.nivelRiesgo === 'BAJO' || z.scoreGravedad < 40;
      const compatibles = esBaja ? disp : disp.filter(u => u.tipo_medio !== 'CB' && u.tipo_medio !== 'INF');
      const elegida = esBaja ? compatibles[compatibles.length - 1] : compatibles[0];
      if (elegida) asignar(elegida, z);
    }

    // 5. Cualquier unidad sobrante también sale a patrullar a una zona compatible
    if (sortedZonas.length > 0) {
      const sobrantes = unifiedPool.filter(u => !asignadas.has(u.uid));
      sobrantes.forEach((u, idx) => {
        const esBaja = u.tipo_medio === 'CB' || u.tipo_medio === 'INF';
        const zCompatible = esBaja
          ? (sortedZonas.find(z => z.nivelRiesgo === 'BAJO' || z.scoreGravedad < 40) ?? sortedZonas[sortedZonas.length - 1])
          : sortedZonas[idx % sortedZonas.length];
        asignar(u, zCompatible);
      });
    }

    // Aplicar asignaciones a patrullas DEMO
    for (const p of demoPoolList) {
      const dest = asignadas.get(`demo-${p.id}`);
      if (dest) {
        const changedZone = p.destino_zona_id !== dest.id;
        p.destino_zona_id = dest.id;
        p.destino_zona_json = dest;
        if (changedZone || p.estado === 'DISPONIBLE') {
          p.estado = 'EN_RUTA';
        }
        const companeras = (unidadesPorZona.get(dest.id) ?? []).filter(u => !u.isReal);
        const idxInZone = Math.max(0, companeras.findIndex(x => x.patrulla?.id === p.id));
        if (changedZone) {
          p.angulo_orbita = (idxInZone * 2 * Math.PI) / Math.max(1, companeras.length);
        }
      } else {
        p.estado = 'DISPONIBLE';
        p.destino_zona_id = null;
        p.destino_zona_json = null;
      }
    }

    // Aplicar asignaciones a unidades REALES directamente en Supabase desde el servidor
    const realTargets = new Map<number, ZonaTactica>();
    for (const r of realItems) {
      const dest = asignadas.get(r.uid);
      if (dest && r.idSesion != null) {
        realTargets.set(r.idSesion, dest);
      }
    }
    if (realTargets.size > 0) {
      this.dispatchRealUnitsOnServer(realTargets).catch(() => {});
    }
  }

  public getTiempoLlegadaMin(): number {
    return this.tiempoLlegadaMin;
  }

  getEstado() {
    const segundosRestantes =
      this.modo === 'MANUAL'
        ? 0
        : Math.max(0, Math.ceil((this.proximoCicloAt - Date.now()) / 1000));

    return {
      modo_despacho: this.modo,
      k_zonas: this.kZonas,
      intervalo_rotacion_seg: this.intervaloSeg,
      tiempo_llegada_min: this.tiempoLlegadaMin,
      zonas_activas_ids: this.zonasActivasIds,
      segundos_restantes: segundosRestantes,
      patrullas: Array.from(this.patrullas.values()),
      zonas_catalogo: this.zonasCatalogo,
    };
  }

  async updateConfig(kZonas?: number, intervaloSeg?: number, tiempoLlegadaMin?: number) {
    let changed = false;
    if (kZonas && kZonas >= 1 && kZonas <= 5 && kZonas !== this.kZonas) {
      this.kZonas = kZonas;
      changed = true;
    }
    if (intervaloSeg && intervaloSeg >= 10 && intervaloSeg <= 7200 && intervaloSeg !== this.intervaloSeg) {
      this.intervaloSeg = intervaloSeg;
      this.proximoCicloAt = Date.now() + this.intervaloSeg * 1000;
      changed = true;
    }
    if (tiempoLlegadaMin && tiempoLlegadaMin >= 1 && tiempoLlegadaMin <= 120 && tiempoLlegadaMin !== this.tiempoLlegadaMin) {
      this.tiempoLlegadaMin = Math.round(tiempoLlegadaMin);
      try {
        const nowIso = new Date().toISOString();
        const { data: abiertas } = await supabaseAdmin
          .from('asignaciones_tacticas')
          .select('id_asignacion, instrucciones')
          .eq('estado_mision', 'PENDIENTE');
        if (Array.isArray(abiertas)) {
          for (const a of abiertas) {
            const prevInst = String(a.instrucciones || '');
            if (prevInst.includes('Código Rojo')) continue;
            const nextInst = /\[ETA:\d+\]/.test(prevInst)
              ? prevInst.replace(/\[ETA:\d+\]/, `[ETA:${this.tiempoLlegadaMin}]`)
              : `[ETA:${this.tiempoLlegadaMin}] ${prevInst}`.trim();
            await supabaseAdmin
              .from('asignaciones_tacticas')
              .update({ instrucciones: nextInst, hora_despacho: nowIso })
              .eq('id_asignacion', a.id_asignacion);
          }
        }
      } catch {}
    }
    if (changed && this.modo !== 'MANUAL') {
      this.lastDispatchedRealZone.clear();
      this.rotateZonesAndAssign();
    }
    await this.persistGlobal();
    await this.persistAllPatrols();
    return this.getEstado();
  }

  async setModo(
    modo: ModoDespacho,
    kZonas?: number,
    intervaloSeg?: number,
    zonasActivasIds?: number[],
    tiempoLlegadaMin?: number
  ) {
    this.modo = modo;
    if (kZonas && kZonas >= 1 && kZonas <= 5) this.kZonas = kZonas;
    if (intervaloSeg && intervaloSeg >= 10 && intervaloSeg <= 7200) this.intervaloSeg = intervaloSeg;
    if (tiempoLlegadaMin && tiempoLlegadaMin >= 1 && tiempoLlegadaMin <= 120) {
      this.tiempoLlegadaMin = Math.round(tiempoLlegadaMin);
    }

    await this.refreshRealSessionsFromSupabase();
    this.lastDispatchedRealZone.clear();

    if (modo === 'MANUAL') {
      for (const p of this.patrullas.values()) {
        p.estado = 'DISPONIBLE';
        p.destino_zona_id = null;
        p.destino_zona_json = null;
        p.is_manual = false;
      }
      this.zonasActivasIds = [];
    } else {
      for (const p of this.patrullas.values()) {
        if (p.destino_zona_id !== 9999) {
          p.is_manual = false;
        }
      }
      this.rotateZonesAndAssign(zonasActivasIds);
      this.proximoCicloAt = Date.now() + this.intervaloSeg * 1000;
    }

    await this.persistGlobal();
    await this.persistAllPatrols();
    return this.getEstado();
  }

  async upsertPatrol(patrulla: PatrullaTactica) {
    const existing = this.patrullas.get(patrulla.id);
    const merged: PatrullaTactica = existing
      ? {
        ...existing,
        nombre: patrulla.nombre ?? existing.nombre,
        tipo_medio: patrulla.tipo_medio ?? existing.tipo_medio,
        valor_uve: patrulla.valor_uve ?? existing.valor_uve,
        dotacion_total: patrulla.dotacion_total ?? existing.dotacion_total,
      }
      : patrulla;
    this.patrullas.set(merged.id, merged);
    await this.persistPatrol(merged);
    if (!existing && this.modo !== 'MANUAL' && this.zonasActivasIds.length > 0) {
      const elegidas = this.zonasActivasIds
        .map(id => this.zonasCatalogo.find(z => z.id === id))
        .filter((z): z is ZonaTactica => !!z);
      if (elegidas.length > 0) {
        this.assignPatrolsToZones(elegidas);
        await this.persistAllPatrols();
      }
    }
    return this.patrullas.get(merged.id) ?? merged;
  }

  async deletePatrol(id: string) {
    this.patrullas.delete(id);
    if (this.dbDisponible) {
      await supabaseAdmin.from('patrullas_tacticas').delete().eq('id', id);
    }
  }

  async despacharManual(id: string, zona: ZonaTactica) {
    const p = this.patrullas.get(id);
    if (!p) return null;
    const catZone = this.zonasCatalogo.find(z => z.id === Number(zona.id)) ?? zona;
    p.estado = 'EN_RUTA';
    p.destino_zona_id = catZone.id;
    p.destino_zona_json = catZone;
    p.is_manual = true;
    await this.persistPatrol(p);
    return p;
  }

  async terminarRonda(id: string) {
    const p = this.patrullas.get(id);
    if (!p) return null;
    p.estado = 'DISPONIBLE';
    p.destino_zona_id = null;
    p.destino_zona_json = null;
    p.is_manual = false;
    await this.persistPatrol(p);
    return p;
  }
}

export const tacticalEngine = new TacticalEngine24x7();
