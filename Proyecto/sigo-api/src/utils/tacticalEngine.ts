import { supabaseAdmin } from '../config/supabase';

export type ModoDespacho = 'MANUAL' | 'AUTO' | 'OPTIMIZADO';

export interface ZonaTactica {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radio_m?: number;
  scoreGravedad: number;
  nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  uveObjetivoMin: number;
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
  { id: 1, lat: -33.01840, lng: -71.51398, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z1', address: 'Chonta 3544, Miraflores', radio_m: 160 },
  { id: 2, lat: -33.02229, lng: -71.55278, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z2', address: '1 Norte / 1 Poniente', radio_m: 160 },
  { id: 3, lat: -33.01533, lng: -71.55008, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z3', address: '8 Norte / Av. Libertad', radio_m: 160 },
  { id: 4, lat: -33.02500, lng: -71.55237, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z4', address: 'Av. Valparaíso / Plaza Vergara', radio_m: 160 },
  { id: 5, lat: -33.02079, lng: -71.55627, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z5', address: '2 Norte / 4 Poniente', radio_m: 160 },
  { id: 6, lat: -33.00800, lng: -71.54849, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z6', address: '15 Norte / Av. Libertad', radio_m: 160 },
  { id: 7, lat: -33.01983, lng: -71.54837, scoreGravedad: 85, nivelRiesgo: 'ALTO', uveObjetivoMin: 1.00, name: 'Z7', address: '4 Norte / 2 Oriente', radio_m: 160 },
  { id: 8, lat: -33.01439, lng: -71.55655, scoreGravedad: 45, nivelRiesgo: 'MEDIO', uveObjetivoMin: 0.45, name: 'Z8', address: 'Av. Perú / 8 Norte', radio_m: 160 },
  { id: 9, lat: -33.02546, lng: -71.55872, scoreGravedad: 13, nivelRiesgo: 'BAJO', uveObjetivoMin: 0.20, name: 'Z9', address: 'Alvarez / Traslaviña', radio_m: 160 },
];

class TacticalEngine24x7 {
  private modo: ModoDespacho = 'MANUAL';
  private kZonas = 3;
  private intervaloSeg = 60;
  private zonasActivasIds: number[] = [];
  private proximoCicloAt = Date.now() + 60_000;
  private patrullas = new Map<string, PatrullaTactica>();
  private zonasCatalogo: ZonaTactica[] = [...DEFAULT_ZONES];
  private dbDisponible = true;
  private tickCount = 0;
  private timer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    await this.loadFromSupabase();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch(err => console.warn('[TacticalEngine] Tick error:', err?.message));
    }, 1000);
    console.log(`🛰️  Motor Táctico 24/7 iniciado (modo=${this.modo}, patrullas=${this.patrullas.size})`);
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
        this.intervaloSeg = Number(globalRow.intervalo_rotacion_seg) || 60;
        this.zonasActivasIds = Array.isArray(globalRow.zonas_activas_ids) ? globalRow.zonas_activas_ids : [];
        this.proximoCicloAt = globalRow.proximo_ciclo_at
          ? new Date(globalRow.proximo_ciclo_at).getTime()
          : Date.now() + this.intervaloSeg * 1000;
      }

      const { data: rowsP } = await supabaseAdmin.from('patrullas_tacticas').select('*');
      if (Array.isArray(rowsP)) {
        for (const r of rowsP) {
          this.patrullas.set(r.id, {
            id: r.id,
            nombre: r.nombre,
            tipo_medio: r.tipo_medio,
            valor_uve: Number(r.valor_uve),
            dotacion_total: Number(r.dotacion_total) || 1,
            estado: r.estado,
            lat: Number(r.lat),
            lng: Number(r.lng),
            destino_zona_id: r.destino_zona_id ?? null,
            destino_zona_json: r.destino_zona_json ?? null,
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

    // 1. Rotación automática 24/7 si el modo es AUTO u OPTIMIZADO
    if (this.modo !== 'MANUAL' && now >= this.proximoCicloAt) {
      this.rotateZonesAndAssign();
      this.proximoCicloAt = now + this.intervaloSeg * 1000;
      changedState = true;
    }

    // 2. Avanzar patrullas EN_RUTA o PATRULLANDO (órbita)
    for (const p of this.patrullas.values()) {
      const z = p.destino_zona_json;
      if (!z || p.estado === 'DISPONIBLE') continue;

      if (p.estado === 'EN_RUTA') {
        const dLat = z.lat - p.lat;
        const dLng = z.lng - p.lng;
        const dist = Math.hypot(dLat, dLng);
        if (dist < 0.00035) {
          p.lat = z.lat;
          p.lng = z.lng;
          p.estado = 'PATRULLANDO';
          changedState = true;
        } else {
          p.lat += dLat * 0.18;
          p.lng += dLng * 0.18;
        }
      } else if (p.estado === 'PATRULLANDO') {
        p.angulo_orbita = (p.angulo_orbita + 0.08) % (Math.PI * 2);
        const radioM = z.radio_m || 160;
        const orbitMeters = Math.max(30, radioM * 0.65);
        const radiusLat = orbitMeters / 111320;
        const radiusLng = orbitMeters / (111320 * Math.cos((z.lat * Math.PI) / 180));
        p.lat = z.lat + Math.sin(p.angulo_orbita) * radiusLat;
        p.lng = z.lng + Math.cos(p.angulo_orbita) * radiusLng;
      }
    }

    if (changedState) {
      await this.persistGlobal();
      await this.persistAllPatrols();
    } else if (this.tickCount % 3 === 0) {
      await this.persistAllPatrols();
    }
  }

  private rotateZonesAndAssign(): void {
    const sorted = [...this.zonasCatalogo].sort((a, b) => b.scoreGravedad - a.scoreGravedad);
    // Rotación determinística por ciclo combinando prioridad
    const offset = Math.floor(Date.now() / (this.intervaloSeg * 1000)) % Math.max(1, sorted.length);
    const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
    const elegidas = rotated.slice(0, Math.min(this.kZonas, sorted.length));
    this.zonasActivasIds = elegidas.map(z => z.id);
    this.assignPatrolsToZones(elegidas);
  }

  private assignPatrolsToZones(zonas: ZonaTactica[]): void {
    const sortedZonas = [...zonas].sort((a, b) => b.scoreGravedad - a.scoreGravedad);
    const pool = Array.from(this.patrullas.values()).filter(p => !p.is_manual);
    const asignadas = new Map<string, ZonaTactica>();

    for (const z of sortedZonas) {
      let cubierta = 0;
      while (cubierta + 0.001 < z.uveObjetivoMin) {
        const disponibles = pool.filter(p => !asignadas.has(p.id));
        if (disponibles.length === 0) break;
        const falta = z.uveObjetivoMin - cubierta;
        const suficientes = disponibles.filter(p => p.valor_uve + 0.001 >= falta).sort((a, b) => a.valor_uve - b.valor_uve);
        const elegida = suficientes.length > 0 ? suficientes[0] : [...disponibles].sort((a, b) => b.valor_uve - a.valor_uve)[0];
        asignadas.set(elegida.id, z);
        cubierta = Number((cubierta + elegida.valor_uve).toFixed(2));
      }
    }

    if (this.modo === 'AUTO' && sortedZonas.length > 0) {
      const sobrantes = pool.filter(p => !asignadas.has(p.id));
      sobrantes.forEach((p, idx) => asignadas.set(p.id, sortedZonas[idx % sortedZonas.length]));
    }

    for (const p of pool) {
      const dest = asignadas.get(p.id);
      if (dest) {
        p.destino_zona_id = dest.id;
        p.destino_zona_json = dest;
        if (p.estado === 'DISPONIBLE') p.estado = 'EN_RUTA';
      } else {
        p.estado = 'DISPONIBLE';
        p.destino_zona_id = null;
        p.destino_zona_json = null;
      }
    }
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
      zonas_activas_ids: this.zonasActivasIds,
      segundos_restantes: segundosRestantes,
      patrullas: Array.from(this.patrullas.values()),
    };
  }

  async setModo(modo: ModoDespacho, kZonas?: number, intervaloSeg?: number) {
    this.modo = modo;
    if (kZonas) this.kZonas = kZonas;
    if (intervaloSeg) this.intervaloSeg = intervaloSeg;

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
        p.is_manual = false;
      }
      this.rotateZonesAndAssign();
      this.proximoCicloAt = Date.now() + this.intervaloSeg * 1000;
    }

    await this.persistGlobal();
    await this.persistAllPatrols();
    return this.getEstado();
  }

  async upsertPatrol(patrulla: PatrullaTactica) {
    this.patrullas.set(patrulla.id, patrulla);
    await this.persistPatrol(patrulla);
    return patrulla;
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
    p.estado = 'EN_RUTA';
    p.destino_zona_id = zona.id;
    p.destino_zona_json = zona;
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

  syncZonasCatalogo(zonas: ZonaTactica[]) {
    if (Array.isArray(zonas) && zonas.length > 0) {
      this.zonasCatalogo = zonas;
    }
  }
}

export const tacticalEngine = new TacticalEngine24x7();

