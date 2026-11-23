import { Injectable, signal, computed, effect } from '@angular/core';
import {
  SesionOperativa, AlertaEmergencia, AsignacionTactica,
  EstadoOperativo, GpsPayload, TipoMedio, calcularUveSesion, CONFIG_MEDIOS_UVE,
} from '../../../core/models';
import { HotspotZone } from '../../../core/services/map.service';

export interface PatrullaFicticia {
  id: string;
  nombre: string;
  tipo: 'PATRULLA' | 'FURGON_Z' | 'MOTO' | 'BICICLETA' | 'INFANTERIA' | TipoMedio;
  tipo_medio?: TipoMedio;
  valor_uve?: number;
  dotacion_total?: number;
  estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO';
  lat: number;
  lng: number;
  destinoZone?: HotspotZone;
  isManual?: boolean;
}

/**
 * Signal Store del Dashboard.
 * Toda la lógica de estado reactivo centralizada aquí.
 * Usar como servicio inyectado en DashboardComponent.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  // ─── Estado primario ───────────────────────────────────────────────────
  readonly unidades = signal<SesionOperativa[]>([]);
  readonly alertasSOS = signal<AlertaEmergencia[]>([]);
  readonly asignaciones = signal<AsignacionTactica[]>([]);
  readonly unidadSeleccionada = signal<SesionOperativa | null>(null);
  readonly cargando = signal<boolean>(false);
  readonly showOverrideModal = signal<boolean>(false);
  readonly showSOSDrawer = signal<boolean>(false);

  // ─── Patrullas DEMO (Persistentes en localStorage) ─────────────────────
  readonly patrullasFicticias = signal<PatrullaFicticia[]>(
    (() => {
      try {
        const saved = localStorage.getItem('sigo_patrullas_ficticias');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) return list;
        }
      } catch (e) {
        console.warn('[DashboardStore] Error cargando patrullas ficticias:', e);
      }
      return [];
    })()
  );
  readonly patrullaFicticiaSeleccionada = signal<PatrullaFicticia | null>(null);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem('sigo_patrullas_ficticias', JSON.stringify(this.patrullasFicticias()));
      } catch (e) {
        console.warn('[DashboardStore] Error guardando patrullas ficticias:', e);
      }
    });
  }

  resetDemoPatrolsToAvailable(): void {
    this.patrullasFicticias.update(list =>
      list.map(p => ({
        ...p,
        estado: 'DISPONIBLE' as const,
        destinoZone: undefined,
        isManual: false,
      }))
    );
  }

  // ─── Capas del mapa ───────────────────────────────────────────────────
  readonly layerHeatmap = signal<boolean>(true);
  readonly layerSimcards = signal<boolean>(true);
  readonly layerPolygons = signal<boolean>(true);

  // ─── Computed (derivaciones reactivas) ────────────────────────────────
  readonly conteoDisponibles = computed(() =>
    this.unidades().filter(u => u.estado_operativo === EstadoOperativo.DISPONIBLE).length
  );
  readonly conteoEnRuta = computed(() =>
    this.unidades().filter(u => u.estado_operativo === EstadoOperativo.EN_RUTA_HOTSPOT).length
  );
  readonly conteoPatrullando = computed(() =>
    this.unidades().filter(u => u.estado_operativo === EstadoOperativo.PATRULLANDO_ZONA).length
  );
  readonly conteoEmergencia = computed(() =>
    this.unidades().filter(u => u.estado_operativo === EstadoOperativo.OCUPADO_EMERGENCIA).length
  );
  readonly conteoInactivo = computed(() =>
    this.unidades().filter(u => u.estado_operativo === EstadoOperativo.INACTIVO).length
  );
  readonly totalActivas = computed(() =>
    this.unidades().filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO).length
  );
  readonly tieneEmergenciaActiva = computed(() =>
    this.alertasSOS().some(a => a.estado === 'ACTIVA')
  );
  readonly alertasActivasCount = computed(() =>
    this.alertasSOS().filter(a => a.estado === 'ACTIVA').length
  );

  // ─── Balance de Capacidad U.V.E. en Tiempo Real ───────────────────────
  private resolveFicticiaUve(p: PatrullaFicticia): number {
    if (p.valor_uve != null) return Number(p.valor_uve);
    const raw = (p.tipo_medio || p.tipo || 'RPD').toUpperCase();
    if (raw === 'RPT' || raw === 'FZ' || raw === 'FURGON_Z') return 1.00;
    if (raw === 'RPD' || raw === 'PATRULLA') return 0.80;
    if (raw === 'MTT' || raw === 'MOTO') return 0.45;
    if (raw === 'CB' || raw === 'BICICLETA') return 0.30;
    return 0.20;
  }

  readonly ofertaTotalUve = computed(() => {
    const realUve = this.unidades()
      .filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO)
      .reduce((acc, u) => acc + calcularUveSesion(u).valorUve, 0);
    const demoUve = this.patrullasFicticias()
      .reduce((acc, p) => acc + this.resolveFicticiaUve(p), 0);
    return Number((realUve + demoUve).toFixed(2));
  });

  readonly uveComprometidaEnZonas = computed(() => {
    const realComp = this.unidades()
      .filter(u =>
        u.estado_operativo === EstadoOperativo.PATRULLANDO_ZONA ||
        u.estado_operativo === EstadoOperativo.EN_RUTA_HOTSPOT ||
        u.estado_operativo === EstadoOperativo.OCUPADO_EMERGENCIA
      )
      .reduce((acc, u) => acc + calcularUveSesion(u).valorUve, 0);
    const demoComp = this.patrullasFicticias()
      .filter(p => p.estado === 'EN_RUTA' || p.estado === 'PATRULLANDO')
      .reduce((acc, p) => acc + this.resolveFicticiaUve(p), 0);
    return Number((realComp + demoComp).toFixed(2));
  });

  readonly uveEnReserva = computed(() => {
    const res = this.ofertaTotalUve() - this.uveComprometidaEnZonas();
    return Number(Math.max(0, res).toFixed(2));
  });

  // ─── Mutaciones ───────────────────────────────────────────────────────

  setUnidades(lista: SesionOperativa[]): void {
    this.unidades.set(lista);
  }

  /** Actualiza coordenadas GPS en tiempo real de una unidad (vía MQTT) */
  updateGpsUnidad(payload: GpsPayload): void {
    this.unidades.update(lista =>
      lista.map(u =>
        u.imei_simcard === payload.imei
          ? { ...u, coordenadas_rt: { lat: payload.lat, lng: payload.lng } }
          : u
      )
    );
  }

  /** Actualiza el estado operativo de una unidad (vía Supabase Realtime) */
  updateEstadoUnidad(idSesion: number, nuevoEstado: EstadoOperativo): void {
    this.unidades.update(lista =>
      lista.map(u =>
        u.id_sesion === idSesion ? { ...u, estado_operativo: nuevoEstado } : u
      )
    );
  }

  agregarAlertaSOS(alerta: AlertaEmergencia): void {
    this.alertasSOS.update(lista => [alerta, ...lista]);
  }

  resolverAlertaSOS(idEmergencia: number): void {
    this.alertasSOS.update(lista =>
      lista.map(a =>
        a.id_emergencia === idEmergencia ? { ...a, estado: 'RESUELTA' as const } : a
      )
    );
  }

  seleccionarUnidad(sesion: SesionOperativa | null): void {
    this.unidadSeleccionada.set(sesion);
  }

  setAsignaciones(lista: AsignacionTactica[]): void {
    this.asignaciones.set(lista);
  }
}
