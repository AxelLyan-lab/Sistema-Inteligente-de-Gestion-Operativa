import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EventoHotspot, SesionOperativa, AsignacionTactica, ESTADO_CONFIG } from '../models';

export type MapLayer = 'heatmap' | 'simcards' | 'polygons';

declare global {
  interface Window {
    google?: any;
    __gm_bootstrap_done__?: boolean;
    __gm_cb__?: () => void;
  }
}

const VINA_CENTER = { lat: -33.0245, lng: -71.5518 };
const VINA_ZOOM   = 14;
const HEAT_RADIUS_M = 200;

// ─── Zona con conteo de delitos en escala 1-10 ───────────────────────────────
export interface HotspotZone {
  id:         number;
  lat:        number;
  lng:        number;
  crimeCount: number;  // 1-3: Bajo | 4-6: Medio | 7-10: Alto
  name:       string;
}

function getRisk(count: number): { label: string; color: string; bg: string } {
  if (count >= 7) return { label: 'ALTO',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
  if (count >= 4) return { label: 'MEDIO', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  return             { label: 'BAJO',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
}

/**
 * 8 zonas fijas en el Plan de Viña del Mar (zona plana, sin cerros ni mar).
 * crimeCount en escala 1-10: 7-10=ALTO, 4-6=MEDIO, 1-3=BAJO
 * Separación suficiente entre zonas para visibilidad individual.
 */
const HOTSPOT_ZONES: HotspotZone[] = [
  { id: 1, lat: -33.02229, lng: -71.55278, crimeCount: 10, name: '1 Norte / 1 Poniente'    },
  { id: 2, lat: -33.01533, lng: -71.55008, crimeCount:  9, name: '8 Norte / Av. Libertad'  },
  { id: 3, lat: -33.02500, lng: -71.55237, crimeCount:  7, name: 'Av. Valparaíso / Plaza Vergara' },
  { id: 4, lat: -33.02079, lng: -71.55627, crimeCount:  6, name: '2 Norte / 4 Poniente'    },
  { id: 5, lat: -33.00800, lng: -71.54849, crimeCount:  5, name: '15 Norte / Av. Libertad' },
  { id: 6, lat: -33.01983, lng: -71.54837, crimeCount:  4, name: '4 Norte / 2 Oriente'     },
  { id: 7, lat: -33.01439, lng: -71.55655, crimeCount:  3, name: 'Av. Perú / 8 Norte'      },
  { id: 8, lat: -33.02546, lng: -71.55872, crimeCount:  2, name: 'Alvarez / Traslaviña'    },
];

function metersToPx(meters: number, lat: number, zoom: number): number {
  const mpp = (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
  return Math.max(14, Math.min(200, meters / mpp));
}

// ─── Canvas Overlay ───────────────────────────────────────────────────────────
class HeatmapCanvasOverlay {
  private overlay: any = null;
  private canvas!: HTMLCanvasElement;
  private activeZones: HotspotZone[] = [];
  private visible = true;

  attach(map: google.maps.Map): void {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'absolute', top: '0', left: '0',
      pointerEvents: 'none', zIndex: '2',
    });
    map.getDiv().appendChild(this.canvas);

    const ov = new (google.maps as any).OverlayView();
    ov.onAdd    = () => {};
    ov.onRemove = () => {};
    ov.draw     = () => {
      if (!this.visible || !this.activeZones.length) { this.clear(); return; }
      const proj = ov.getProjection();
      if (!proj) return;

      const mapDiv = map.getDiv();
      this.canvas.width  = mapDiv.offsetWidth;
      this.canvas.height = mapDiv.offsetHeight;
      const ctx  = this.canvas.getContext('2d')!;
      const zoom = map.getZoom() ?? VINA_ZOOM;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (const zone of this.activeZones) {
        const px = proj.fromLatLngToContainerPixel(new google.maps.LatLng(zone.lat, zone.lng));
        if (!px) continue;

        // Radio fijo 200m convertido a píxeles según zoom (geográficamente correcto)
        const R = metersToPx(HEAT_RADIUS_M, zone.lat, zoom);

        // Paleta según nivel de riesgo — más vívida y distinguible
        // ALTO  (7-10): naranja-rojo  → ámbar  → amarillo brillante
        // MEDIO (4-6):  ámbar         → amarillo → lima
        // BAJO  (1-3):  lima          → verde claro → transparente
        const c = zone.crimeCount;
        let [cr, cg, cb] = [255, 120, 0];   // centro (default MEDIO)
        let [mr, mg, mb] = [255, 200, 0];   // medio
        let [or_, og, ob] = [255, 240, 0];  // borde exterior
        let baseAlpha = 0.75;

        if (c >= 7) {
          [cr, cg, cb]   = [255,  70,  0];  // naranja intenso
          [mr, mg, mb]   = [255, 160,  0];  // ámbar
          [or_, og, ob]  = [255, 220,  0];  // amarillo
          baseAlpha = 0.88;
        } else if (c >= 4) {
          [cr, cg, cb]   = [255, 140,  0];  // ámbar-naranja
          [mr, mg, mb]   = [255, 210,  0];  // amarillo
          [or_, og, ob]  = [220, 250,  0];  // lima-amarillo
          baseAlpha = 0.78;
        } else {
          [cr, cg, cb]   = [180, 230,  0];  // lima
          [mr, mg, mb]   = [120, 230, 60];  // verde claro
          [or_, og, ob]  = [ 80, 200, 80];  // verde
          baseAlpha = 0.65;
        }

        // El AdvancedMarkerElement ancla su contenido por el borde INFERIOR.
        // Para un marcador de 40px, el centro visual está 20px por encima del lat/lng.
        // Compensamos el radio de calor para que coincida con el centro visual del marcador.
        const MARKER_HALF_H = 20;  // mitad de la altura del div del marcador (40px / 2)
        const cy = px.y - MARKER_HALF_H;

        const grad = ctx.createRadialGradient(px.x, cy, 0, px.x, cy, R);
        grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${baseAlpha})`);
        grad.addColorStop(0.45, `rgba(${mr},${mg},${mb},${baseAlpha * 0.70})`);
        grad.addColorStop(0.80, `rgba(${or_},${og},${ob},${baseAlpha * 0.35})`);
        grad.addColorStop(1.0,  `rgba(${or_},${og},${ob},0)`);

        ctx.beginPath();
        ctx.arc(px.x, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    ov.setMap(map);
    this.overlay = ov;
    map.addListener('bounds_changed', () => this.overlay?.draw());
  }

  setActiveZones(z: HotspotZone[]): void {
    this.activeZones = z;
    // Siempre dibuja independientemente de visible; setVisible controla la visibilidad por separado.
    if (this.visible) this.overlay?.draw();
  }
  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) {
      this.clear();
    } else {
      // Al volver a activar: redibujar con las zonas activas actuales sin tocar el ciclo.
      this.overlay?.draw();
    }
  }
  detach(): void { this.overlay?.setMap(null); this.overlay = null; }

  private clear(): void {
    const ctx = this.canvas?.getContext?.('2d');
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private map!: google.maps.Map;
  private markerRefs       = new Map<string, any>();
  private ficticiaRefs     = new Map<string, any>();    // marcadores de patrullas ficticias
  private ficticiaEls      = new Map<string, HTMLElement>(); // elementos DOM de ficticias
  private ficticiaTypes    = new Map<string, string>(); // tipo de vehículo por patrol id
  private polygonRefs      = new Map<number, google.maps.Polygon>();
  private zoneMarkers:   any[] = [];
  private infoWindow:    any   = null;
  private heatOverlay    = new HeatmapCanvasOverlay();
  private lastRenderTime = new Map<string, number>();
  private cycleTimer: any  = null;
  private currentActiveIds = new Set<number>();

  private _Map!: any;
  private _AdvancedMarker!: any;

  readonly layerHeatmap    = signal(true);
  readonly layerSimcards   = signal(true);
  readonly layerPolygons   = signal(true);
  readonly mapLoaded       = signal(false);
  readonly cycleCountdown  = signal(30);   // segundos restantes para siguiente rotación
  readonly zones           = HOTSPOT_ZONES;
  readonly activeZones     = signal<HotspotZone[]>([]);  // zonas actualmente activas en el ciclo

  private countdownTimer: any = null;

  // ─── Bootstrap ────────────────────────────────────────────────────────
  private bootstrapPromise: Promise<void> | null = null;

  private loadBootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = new Promise<void>((resolve, reject) => {
      if (window.__gm_bootstrap_done__ && window.google?.maps?.importLibrary) { resolve(); return; }
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const s = document.createElement('script');
        s.src   = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&loading=async&callback=__gm_cb__`;
        s.async = true; s.defer = true;
        s.onerror = () => reject(new Error('[MapService] Error cargando Google Maps'));
        document.head.appendChild(s);
      }
      window.__gm_cb__ = () => { window.__gm_bootstrap_done__ = true; resolve(); };
    });
    return this.bootstrapPromise;
  }

  // ─── initMap ──────────────────────────────────────────────────────────
  async initMap(element: HTMLElement): Promise<void> {
    await this.loadBootstrap();
    const [mapsLib, markerLib] = await Promise.all([
      window.google.maps.importLibrary('maps'),
      window.google.maps.importLibrary('marker'),
    ]);
    this._Map            = mapsLib.Map;
    this._AdvancedMarker = markerLib.AdvancedMarkerElement;

    this.map = new this._Map(element, {
      center: VINA_CENTER, zoom: VINA_ZOOM,
      mapId: 'DEMO_MAP_ID', disableDefaultUI: false,
      zoomControl: true, mapTypeControl: false,
      streetViewControl: false, fullscreenControl: true,
    });

    await new Promise<void>(r => setTimeout(r, 60));
    google.maps.event.trigger(this.map, 'resize');
    this.map.setCenter(VINA_CENTER);
    this.heatOverlay.attach(this.map);

    // Cerrar InfoWindow al hacer clic derecho en el mapa (o clic en área vacía)
    this.map.addListener('rightclick', () => this.infoWindow?.close());
    this.map.addListener('click',      () => this.infoWindow?.close());

    this.mapLoaded.set(true);

    setTimeout(() => {
      this.initZoneMarkers();
      this.runCycle();

      const CYCLE_SECS = 30;
      this.cycleTimer     = setInterval(() => this.runCycle(), CYCLE_SECS * 1000);

      // Cuenta regresiva: decrementa cada segundo, se reinicia cuando runCycle() dispara
      this.cycleCountdown.set(CYCLE_SECS);
      this.countdownTimer = setInterval(() => {
        const cur = this.cycleCountdown();
        this.cycleCountdown.set(cur > 1 ? cur - 1 : CYCLE_SECS);
      }, 1000);
    }, 350);
  }


  // ─── Marcadores de zona con click ────────────────────────────────────
  private initZoneMarkers(): void {
    if (!this._AdvancedMarker) return;
    this.zoneMarkers.forEach(m => { (m as any).map = null; });
    this.zoneMarkers = [];

    // InfoWindow única y reutilizable
    this.infoWindow = new (google.maps as any).InfoWindow({ disableAutoPan: false });

    for (const zone of HOTSPOT_ZONES) {
      // Wrapper persistente — NUNCA se reemplaza. Solo cambia su innerHTML.
      const wrapper = document.createElement('div');
      wrapper.style.cursor = 'pointer';
      wrapper.innerHTML = this.buildZoneMarkerInner(zone, false);

      const marker = new this._AdvancedMarker({
        map:      this.layerPolygons() ? this.map : null,
        position: new google.maps.LatLng(zone.lat, zone.lng),
        content:  wrapper,
        title:    zone.name,
      });

      // ── Click registrado UNA SOLA VEZ mediante el evento oficial de AME ──
      // Captura 'zone' y 'marker' de la iteración correcta (for...of crea
      // un nuevo binding por iteración, no hay problema de closure).
      marker.addListener('gmp-click', () => {
        this.infoWindow.setContent(this.buildInfoWindowContent(zone));
        this.infoWindow.open({ map: this.map, anchor: marker });
      });

      (marker as any).__zoneId  = zone.id;
      (marker as any).__wrapper = wrapper;   // referencia para actualizaciones visuales
      this.zoneMarkers.push(marker);
    }
  }

  private buildZoneMarkerInner(zone: HotspotZone, isActive: boolean): string {
    const risk   = getRisk(zone.crimeCount);
    const bg     = isActive ? risk.bg    : 'rgba(15,23,42,0.75)';
    const glow   = isActive
      ? `0 0 16px ${risk.color}99, 0 0 4px ${risk.color}55`
      : `0 2px 8px rgba(0,0,0,0.5)`;
    const scale  = isActive ? 'scale(1.18)' : 'scale(1)';
    const border = isActive ? `3px solid ${risk.color}` : `2px solid ${risk.color}88`;

    return `
      <div style="
        background:${bg};
        border:${border};
        border-radius:50%;
        width:40px; height:40px;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        box-shadow:${glow};
        transform:${scale};
        transition:all 0.3s ease;
        font-family:'Inter',sans-serif;
        user-select:none;
      ">
        <span style="color:${risk.color};font-size:12px;font-weight:800;line-height:1.1;">Z${zone.id}</span>
        <span style="color:#cbd5e1;font-size:9px;font-weight:600;line-height:1;">${zone.crimeCount}</span>
      </div>`;
  }

  // ─── Estado visual activo/inactivo: solo actualiza innerHTML del wrapper ─
  private updateZoneMarkersState(activeIds: Set<number>): void {
    for (const marker of this.zoneMarkers) {
      const id      = (marker as any).__zoneId as number;
      const zone    = HOTSPOT_ZONES.find(z => z.id === id)!;
      const wrapper = (marker as any).__wrapper as HTMLElement;
      // Actualizar solo el innerHTML — el wrapper (y su registro gmp-click) no cambia
      wrapper.innerHTML = this.buildZoneMarkerInner(zone, activeIds.has(id));
    }
  }



  private buildInfoWindowContent(zone: HotspotZone): string {
    const risk  = getRisk(zone.crimeCount);
    const badge = `background:${risk.color}22;color:${risk.color};border:1px solid ${risk.color}66;`;
    return `
      <div style="
        font-family:'Inter',sans-serif;
        background:#0f172a; color:#e2e8f0;
        border-radius:10px; padding:14px 16px;
        min-width:200px; border:1px solid #1e293b;
        box-shadow:0 8px 24px rgba(0,0,0,0.6);
      ">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">
          Zona ${zone.id} — ${zone.name}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
          <div>
            <div style="font-size:22px;font-weight:800;color:#f1f5f9;line-height:1;">${zone.crimeCount}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">delitos registrados</div>
          </div>
          <div style="
            ${badge}
            border-radius:20px; padding:5px 12px;
            font-size:12px; font-weight:700;
            letter-spacing:.06em;
          ">
            ▲ ${risk.label}
          </div>
        </div>
        <div style="margin-top:10px;border-top:1px solid #1e293b;padding-top:8px;">
          <div style="
            background:#1e293b; border-radius:6px;
            height:6px; overflow:hidden;
          ">
            <div style="
              height:100%; border-radius:6px;
              background:${risk.color};
              width:${zone.crimeCount * 10}%;
              transition:width .4s;
            "></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#475569;margin-top:3px;">
            <span>0</span><span>BAJO</span><span>MEDIO</span><span>ALTO</span>
          </div>
        </div>
      </div>`;
  }



  private runCycle(): void {
    // Reiniciar la cuenta regresiva cada vez que el ciclo dispara
    this.cycleCountdown.set(30);

    // Filtrar las zonas que actualmente NO están activas para evitar repeticiones
    const availableZones = HOTSPOT_ZONES.filter(z => !this.currentActiveIds.has(z.id));

    // Seleccionar 3 nuevas zonas ponderando su probabilidad según su crimeCount
    // Al multiplicar Math.random() por el crimeCount, las de mayor criminalidad
    // tienen mucha más probabilidad de quedar en los primeros lugares.
    const activeArray = availableZones
      .map(z => ({ zone: z, weight: Math.random() * z.crimeCount }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(w => w.zone);

    const activeIds = new Set(activeArray.map(z => z.id));
    this.currentActiveIds = activeIds;

    this.activeZones.set(activeArray);   // notifica a suscriptores reactivos
    if (this.layerHeatmap())  this.heatOverlay.setActiveZones(activeArray);
    if (this.layerPolygons()) this.updateZoneMarkersState(activeIds);
  }


  // ─── Heatmap desde datos reales ───────────────────────────────────────
  renderHeatmap(eventos: EventoHotspot[]): void {
    if (eventos.length === 0) return;
    const tempZones: HotspotZone[] = eventos
      .filter(e => e.geom_delito.coordinates[0] !== 0)
      .slice(0, 8)
      .map((e, i) => ({
        id: i + 1,
        lat: e.geom_delito.coordinates[1],
        lng: e.geom_delito.coordinates[0],
        crimeCount: 5,
        name: `Evento #${i + 1}`,
      }));
    this.heatOverlay.setActiveZones(tempZones);
  }

  // ─── Capas ────────────────────────────────────────────────────────────
  toggleLayer(layer: MapLayer, visible: boolean): void {
    switch (layer) {
      case 'heatmap':
        this.layerHeatmap.set(visible);
        // Solo cambia la visibilidad del canvas. El ciclo/timer continúa sin interrupciones.
        // Al reactivar, setVisible(true) redibuja las zonas activas del último ciclo.
        this.heatOverlay.setVisible(visible);
        break;
      case 'simcards':
        this.layerSimcards.set(visible);
        // Ocultar/mostrar unidades reales
        this.markerRefs.forEach(m => { (m as any).map = visible ? this.map : null; });
        // Ocultar/mostrar patrullas ficticias (siguen funcionando en segundo plano)
        this.ficticiaRefs.forEach(m => { (m as any).map = visible ? this.map : null; });
        break;
      case 'polygons':
        this.layerPolygons.set(visible);
        this.zoneMarkers.forEach(m => { (m as any).map = visible ? this.map : null; });
        if (!visible) this.infoWindow?.close();
        break;
    }
  }

  // ─── Markers de unidades ──────────────────────────────────────────────
  upsertUnitMarker(sesion: SesionOperativa): void {
    const coords = sesion.coordenadas_rt;
    if (!coords || !this._AdvancedMarker) return;
    const key = sesion.imei_simcard;
    const pos = new google.maps.LatLng(coords.lat, coords.lng);
    if (this.markerRefs.has(key)) {
      (this.markerRefs.get(key) as any).position = pos;
    } else {
      const config = ESTADO_CONFIG[sesion.estado_operativo];
      const el = document.createElement('div');
      el.innerHTML = this.buildMarkerSvg(config.dotColor, sesion.tipo_transporte);
      el.title = sesion.conductor?.nombre_completo ?? sesion.rut_conductor;
      const marker = new this._AdvancedMarker({ map: this.layerSimcards() ? this.map : null, position: pos, content: el });
      el.addEventListener('click', () => this.onMarkerClick?.(sesion.id_sesion));
      this.markerRefs.set(key, marker);
    }
  }

  onMarkerClick?: (idSesion: number) => void;

  updateUnitPosition(imei: string, lat: number, lng: number): boolean {
    const now = Date.now(), last = this.lastRenderTime.get(imei) ?? 0;
    if (now - last < environment.gpsThrottleMs) return false;
    this.lastRenderTime.set(imei, now);
    const m = this.markerRefs.get(imei);
    if (m) (m as any).position = new google.maps.LatLng(lat, lng);
    return true;
  }

  removeUnitMarker(imei: string): void {
    const m = this.markerRefs.get(imei);
    if (m) { (m as any).map = null; this.markerRefs.delete(imei); }
  }

  upsertPolygon(asignacion: AsignacionTactica): void {
    this.polygonRefs.get(asignacion.id_asignacion)?.setMap(null);
    const coords = asignacion.geom_destino.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
    this.polygonRefs.set(asignacion.id_asignacion, new google.maps.Polygon({
      map: this.map, paths: coords,
      strokeColor: '#00d4ff', strokeOpacity: 0.8, strokeWeight: 2,
      fillColor: '#00d4ff', fillOpacity: 0.08,
    }));
  }

  removePolygon(id: number): void { this.polygonRefs.get(id)?.setMap(null); this.polygonRefs.delete(id); }

  addSOSMarker(_id: number, lat: number, lng: number): void {
    if (!this._AdvancedMarker) return;
    const el = document.createElement('div');
    el.innerHTML = `<div style="position:relative;cursor:pointer;"><div style="position:absolute;inset:-12px;background:rgba(239,68,68,0.3);border-radius:50%;animation:sos-pulse 1.2s ease-in-out infinite;"></div><div style="width:32px;height:32px;background:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #f87171;box-shadow:0 0 16px rgba(239,68,68,0.6);"><span style="color:white;font-size:14px;font-weight:bold;">!</span></div></div>`;
    new this._AdvancedMarker({ map: this.map, position: new google.maps.LatLng(lat, lng), content: el });
  }

  centerOn(lat: number, lng: number, zoom = 15): void { this.map?.setCenter({ lat, lng }); this.map?.setZoom(zoom); }
  getMap(): google.maps.Map { return this.map; }

  destroy(): void {
    if (this.cycleTimer) { clearInterval(this.cycleTimer); this.cycleTimer = null; }
  }

  // ─── Marcadores ficticios (demo) ─────────────────────────────────────
  /** Crea y coloca en el mapa un marcador para una patrulla de demostración */
  addFicticiaMarker(id: string, lat: number, lng: number, tipo: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): void {
    if (!this._AdvancedMarker) return;
    const color = this._ficticiaColor(estado);
    const el    = document.createElement('div');
    el.innerHTML = this._buildFicticiaMarkerHtml(color, tipo, estado);
    this.ficticiaEls.set(id, el);
    this.ficticiaTypes.set(id, tipo);   // guardar tipo para actualizaciones posteriores
    const marker = new this._AdvancedMarker({
      map:      this.map,
      position: new google.maps.LatLng(lat, lng),
      content:  el,
      title:    `Patrulla demo`,
      zIndex:   10,
    });
    this.ficticiaRefs.set(id, marker);
  }

  /** Mueve el marcador ficticio a nuevas coordenadas (llamado en cada step de animación) */
  moveFicticiaMarker(id: string, lat: number, lng: number): void {
    const m = this.ficticiaRefs.get(id);
    if (m) (m as any).position = new google.maps.LatLng(lat, lng);
  }

  /** Actualiza el color del marcador ficticio según el nuevo estado */
  updateFicticiaMarkerColor(id: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): void {
    const el    = this.ficticiaEls.get(id);
    if (!el) return;
    // Recuperar el tipo almacenado al crear el marcador
    const tipo  = this.ficticiaTypes.get(id) ?? 'PATRULLA';
    const color = this._ficticiaColor(estado);
    el.innerHTML = this._buildFicticiaMarkerHtml(color, tipo, estado);
  }

  /** Elimina el marcador ficticio del mapa */
  removeFicticiaMarker(id: string): void {
    const m = this.ficticiaRefs.get(id);
    if (m) { (m as any).map = null; }
    this.ficticiaRefs.delete(id);
    this.ficticiaEls.delete(id);
    this.ficticiaTypes.delete(id);
  }

  private _ficticiaColor(estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): string {
    return estado === 'DISPONIBLE' ? '#10b981'
         : estado === 'EN_RUTA'    ? '#3b82f6'
         : '#f59e0b';
  }

  private _buildFicticiaMarkerHtml(color: string, tipo: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): string {
    const icon    = tipo === 'MOTO' ? '🏍️' : tipo === 'BICICLETA' ? '🚲' : '🚓';
    const pulse   = estado === 'EN_RUTA'
      ? `animation:sos-pulse 1s ease-in-out infinite;`
      : '';
    const ring    = estado === 'EN_RUTA'
      ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color};opacity:0.5;${pulse}"></div>`
      : '';
    return `<div style="position:relative;">${ring}<div style="
      background:${color}22;
      border:2.5px solid ${color};
      border-radius:50%;
      width:38px; height:38px;
      display:flex; align-items:center; justify-content:center;
      font-size:17px;
      box-shadow: 0 0 14px ${color}88, 0 2px 6px rgba(0,0,0,0.4);
      cursor:pointer;
      transition:all 0.3s ease;
    ">${icon}</div></div>`;
  }

  private buildMarkerSvg(color: string, tipo: string): string {
    const icon = tipo === 'PATRULLA' ? '🚓' : tipo === 'MOTO' ? '🏍️' : '🚲';
    return `<div style="background:${color}22;border:2px solid ${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px ${color}66;cursor:pointer;transition:transform 0.2s;">${icon}</div>`;
  }
}
