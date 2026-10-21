import { Injectable, signal, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EventoHotspot, SesionOperativa, AsignacionTactica, ESTADO_CONFIG, ZonaPatrullaje, EstadoOperativo } from '../models';
import { getIconSvg } from '../../shared/components/icon/icon.component';
import { SettingsService } from './settings.service';

export type MapLayer = 'heatmap' | 'simcards' | 'polygons' | 'flatmap';

declare global {
  interface Window {
    google?: any;
    __gm_bootstrap_done__?: boolean;
    __gm_cb__?: () => void;
  }
}

// Estilos para ocultar POIs (colegios, supermercados, tiendas) y paraderos/transporte
export const FLAT_MAP_STYLES = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
];

// Centro que abarca el Plan de Viña y Miraflores (Chonta 3544) simultáneamente
const VINA_CENTER = { lat: -33.0185, lng: -71.5320 };
const VINA_ZOOM   = 13;
const HEAT_RADIUS_M = 180; // 180m radio para cobertura térmica de cuadrante urbano

export interface HotspotZone {
  id:         number;
  lat:        number;
  lng:        number;
  crimeCount: number;  // 1-3: Bajo | 4-6: Medio | 7-10: Alto
  name:       string;  // Etiqueta corta (Z1, Z2, ...)
  address:    string;  // Dirección de referencia (se muestra al hacer click)
}

export function getRisk(count: number): { label: string; color: string; bg: string } {
  if (count >= 7) return { label: 'ALTO',  color: '#dc2626', bg: 'rgba(220,38,38,0.22)' };
  if (count >= 4) return { label: 'MEDIO', color: '#ea580c', bg: 'rgba(234,88,12,0.22)' };
  return             { label: 'BAJO',  color: '#16a34a', bg: 'rgba(22,163,74,0.22)' };
}

/**
 * Zonas críticas de patrullaje (Z1..Z9). Ninguna zona está fija: en cada ciclo
 * se activan 3 zonas distintas. La dirección solo se muestra al hacer click.
 */
export const HOTSPOT_ZONES: HotspotZone[] = [
  { id: 1, lat: -33.01840, lng: -71.51398, crimeCount: 10, name: 'Z1', address: 'Chonta 3544, Miraflores' },
  { id: 2, lat: -33.02229, lng: -71.55278, crimeCount: 10, name: 'Z2', address: '1 Norte / 1 Poniente' },
  { id: 3, lat: -33.01533, lng: -71.55008, crimeCount:  9, name: 'Z3', address: '8 Norte / Av. Libertad' },
  { id: 4, lat: -33.02500, lng: -71.55237, crimeCount:  7, name: 'Z4', address: 'Av. Valparaíso / Plaza Vergara' },
  { id: 5, lat: -33.02079, lng: -71.55627, crimeCount:  6, name: 'Z5', address: '2 Norte / 4 Poniente' },
  { id: 6, lat: -33.00800, lng: -71.54849, crimeCount:  5, name: 'Z6', address: '15 Norte / Av. Libertad' },
  { id: 7, lat: -33.01983, lng: -71.54837, crimeCount:  4, name: 'Z7', address: '4 Norte / 2 Oriente' },
  { id: 8, lat: -33.01439, lng: -71.55655, crimeCount:  3, name: 'Z8', address: 'Av. Perú / 8 Norte' },
  { id: 9, lat: -33.02546, lng: -71.55872, crimeCount:  2, name: 'Z9', address: 'Alvarez / Traslaviña' },
];

export const CRIME_PRESETS: Record<string, number> = {
  z1: 10,
  z2: 10,
  z3: 9,
  z4: 7,
  z5: 6,
  z6: 5,
  z7: 4,
  z8: 3,
  z9: 2,
};

export function registerCustomHotspotZone(zone: HotspotZone): void {
  const idx = HOTSPOT_ZONES.findIndex(z => z.id === zone.id);
  if (idx >= 0) {
    HOTSPOT_ZONES[idx] = zone;
  } else {
    HOTSPOT_ZONES.push(zone);
  }
}

export function removeCustomHotspotZone(id: number): void {
  const idx = HOTSPOT_ZONES.findIndex(z => z.id === id);
  if (idx >= 0) {
    HOTSPOT_ZONES.splice(idx, 1);
  }
}

export function syncDatabaseZones(dbZones: ZonaPatrullaje[]): void {
  if (!dbZones || dbZones.length === 0) return;

  const newZones: HotspotZone[] = [];
  for (const z of dbZones) {
    if (z.activa === false || z.lat == null || z.lng == null) continue;
    const lower = (z.nombre || '').trim().toLowerCase();
    const crimes = (z as any).cantidad_delitos || CRIME_PRESETS[lower] || 6;
    newZones.push({
      id: z.id_zona,
      lat: Number(z.lat),
      lng: Number(z.lng),
      crimeCount: crimes,
      name: z.nombre || `Z${newZones.length + 1}`,
      address: z.direccion || 'Sector Operativo Registrado',
    });
  }

  if (newZones.length > 0) {
    HOTSPOT_ZONES.splice(0, HOTSPOT_ZONES.length, ...newZones);
  }
}

export function findMatchingHotspotZone(criteria?: {
  id_zona?: number | null;
  centro_lat?: number | null;
  centro_lng?: number | null;
  lat?: number | null;
  lng?: number | null;
  nombre_zona?: string | null;
} | null): HotspotZone | null {
  if (!criteria) return null;
  const allZones = HOTSPOT_ZONES;
  if (!allZones || allZones.length === 0) return null;

  // 1. Coincidencia directa por id_zona
  if (criteria.id_zona != null) {
    const found = allZones.find(z => z.id === criteria.id_zona);
    if (found) return found;
  }

  // 2. Coincidencia por nombre de zona
  if (criteria.nombre_zona) {
    const nom = criteria.nombre_zona.trim().toLowerCase();
    const exactName = allZones.find(z => z.name.trim().toLowerCase() === nom);
    if (exactName) return exactName;

    const cleaned = nom.replace(/^zona\s+(táctica\s+)?/i, '').trim();
    if (cleaned) {
      const cleanedMatch = allZones.find(z => z.name.trim().toLowerCase() === cleaned);
      if (cleanedMatch) return cleanedMatch;
    }

    const addrMatch = allZones.find(z => z.address.trim().toLowerCase() === nom);
    if (addrMatch) return addrMatch;

    if (nom.includes('chonta')) {
      const chonta = allZones.find(z => z.name.toLowerCase() === 'z1' || z.address.toLowerCase().includes('chonta'));
      if (chonta) return chonta;
    }
  }

  // 3. Coincidencia geográfica por cercanía mínima (< 200m)
  const lat = criteria.centro_lat ?? criteria.lat;
  const lng = criteria.centro_lng ?? criteria.lng;
  if (lat != null && lng != null) {
    let closest: HotspotZone | null = null;
    let minD = Infinity;
    for (const z of allZones) {
      const dLat = (z.lat - Number(lat)) * 111.32;
      const dLng = (z.lng - Number(lng)) * (111.32 * Math.cos(z.lat * Math.PI / 180));
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distKm < minD) {
        minD = distKm;
        closest = z;
      }
    }
    if (closest && minD <= 0.20) {
      return closest;
    }
  }

  return null;
}

function metersToPx(meters: number, lat: number, zoom: number): number {
  const mpp = (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
  return Math.max(14, Math.min(75, meters / mpp));
}

// ─── Canvas Overlay de Calor ──────────────────────────────────────────────────
class HeatmapCanvasOverlay {
  private overlay: any = null;
  private canvas!: HTMLCanvasElement;
  private activeZones: HotspotZone[] = [];
  private visible = true;

  attach(map: google.maps.Map): void {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'absolute', top: '0', left: '0',
      pointerEvents: 'none', zIndex: '1',
    });
    const mapDiv = map.getDiv();
    mapDiv.appendChild(this.canvas);

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

        const R = metersToPx(HEAT_RADIUS_M, zone.lat, zoom);
        const c = zone.crimeCount;
        let [cr, cg, cb] = [220, 38, 38];
        let [mr, mg, mb] = [234, 88, 12];
        let [or_, og, ob] = [245, 158, 11];
        let baseAlpha = 0.88;

        if (c >= 7) {
          [cr, cg, cb]   = [220, 38, 38]; // ALTO: Rojo vibrante
          [mr, mg, mb]   = [234, 88, 12];
          [or_, og, ob]  = [245, 158, 11];
          baseAlpha = 0.92;
        } else if (c >= 4) {
          [cr, cg, cb]   = [234, 88, 12]; // MEDIO: Naranjo táctico
          [mr, mg, mb]   = [245, 158, 11];
          [or_, og, ob]  = [251, 191, 36];
          baseAlpha = 0.82;
        } else {
          [cr, cg, cb]   = [22, 163, 74]; // BAJO: Verde operativo
          [mr, mg, mb]   = [34, 197, 94];
          [or_, og, ob]  = [74, 222, 128];
          baseAlpha = 0.75;
        }

        const cy = px.y;

        const grad = ctx.createRadialGradient(px.x, cy, 0, px.x, cy, R);
        grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${baseAlpha})`);
        grad.addColorStop(0.35, `rgba(${mr},${mg},${mb},${baseAlpha * 0.70})`);
        grad.addColorStop(0.70, `rgba(${or_},${og},${ob},${baseAlpha * 0.35})`);
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
    map.addListener('center_changed', () => this.overlay?.draw());
    map.addListener('zoom_changed',   () => this.overlay?.draw());
    map.addListener('idle',           () => this.overlay?.draw());
  }

  setActiveZones(z: HotspotZone[]): void {
    this.activeZones = z;
    if (this.visible) this.overlay?.draw();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.clear();
    else this.overlay?.draw();
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
  private ficticiaRefs     = new Map<string, any>();
  private ficticiaEls      = new Map<string, HTMLElement>();
  private ficticiaTypes    = new Map<string, string>();
  private polygonRefs       = new Map<number, google.maps.Polygon>();
  private circleRefs        = new Map<number, google.maps.Circle>();
  private patrolZoneCircles = new Map<number, google.maps.Circle>();
  private patrolZoneMarkers = new Map<number, any>();
  private patrolInfoWindow: any = null;
  private hotspotCircles:   google.maps.Circle[] = [];
  private zoneMarkers:    any[] = [];
  private infoWindow:     any   = null;
  private heatOverlay     = new HeatmapCanvasOverlay();
  private lastRenderTime = new Map<string, number>();
  private cycleTimer: any  = null;
  private currentActiveIds = new Set<number>();
  private manualActiveZoneIds = new Set<number>();

  private _Map!: any;
  private _AdvancedMarker!: any;

  private readonly settings = inject(SettingsService);

  readonly layerHeatmap    = signal(true);
  readonly layerSimcards   = signal(true);
  readonly layerPolygons   = signal(true);
  readonly layerFlatMap    = signal(false);
  readonly mapLoaded       = signal(false);
  readonly cycleCountdown  = signal(120);
  readonly zones           = HOTSPOT_ZONES;
  readonly activeZones     = signal<HotspotZone[]>([]);

  private countdownTimer: any = null;
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

  async initMap(element: HTMLElement): Promise<void> {
    await this.loadBootstrap();
    const [mapsLib, markerLib] = await Promise.all([
      window.google.maps.importLibrary('maps'),
      window.google.maps.importLibrary('marker'),
    ]);
    this._Map            = mapsLib.Map;
    // Marcador HTML propio (OverlayView): no requiere mapId, así los `styles` de Google sí se aplican.
    this._AdvancedMarker = this.buildHtmlMarkerClass();

    // Limpiar marcadores y overlays previos de la instancia anterior
    this.markerRefs.forEach(m => { if (typeof m.setMap === 'function') m.setMap(null); });
    this.markerRefs.clear();
    this.ficticiaRefs.forEach(m => { if (typeof m.setMap === 'function') m.setMap(null); });
    this.ficticiaRefs.clear();
    this.ficticiaEls.clear();
    this.ficticiaTypes.clear();
    this.sosMarkerRefs.forEach(m => { if (typeof m.setMap === 'function') m.setMap(null); });
    this.sosMarkerRefs.clear();
    this.polygonRefs.forEach(p => p.setMap(null));
    this.polygonRefs.clear();
    this.circleRefs.forEach(c => c.setMap(null));
    this.circleRefs.clear();
    this.patrolZoneCircles.forEach(c => c.setMap(null));
    this.patrolZoneCircles.clear();
    this.patrolZoneMarkers.forEach(m => { if (typeof m.setMap === 'function') m.setMap(null); });
    this.patrolZoneMarkers.clear();
    this.hotspotCircles.forEach(c => c.setMap(null));
    this.hotspotCircles = [];
    this.zoneMarkers.forEach(m => { if (typeof m.setMap === 'function') m.setMap(null); });
    this.zoneMarkers = [];
    this.lastRenderTime.clear();

    // IMPORTANTE: sin `mapId`. Con mapId Google ignora la opción `styles` y el modo plano no funciona.
    this.map = new this._Map(element, {
      center: VINA_CENTER, zoom: VINA_ZOOM,
      styles: this.layerFlatMap() ? FLAT_MAP_STYLES : null,
      disableDefaultUI: false,
      zoomControl: true, mapTypeControl: false,
      streetViewControl: false, fullscreenControl: true,
    });

    await new Promise<void>(r => setTimeout(r, 60));
    google.maps.event.trigger(this.map, 'resize');
    this.map.setCenter(VINA_CENTER);
    this.heatOverlay.attach(this.map);

    this.map.addListener('rightclick', () => this.infoWindow?.close());
    this.map.addListener('click',      () => this.infoWindow?.close());

    this.mapLoaded.set(true);

    this.initZoneMarkers();
    this.syncCycleState();

    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.syncCycleState();
    }, 1000);
  }

  /** Crea la clase de marcador HTML (ancla inferior-central, compatible con OverlayView sin recursión). */
  private buildHtmlMarkerClass(): any {
    const gm = google.maps as any;
    return class HtmlMarker extends gm.OverlayView {
      _pos: any;
      _el: HTMLElement;
      _div: HTMLDivElement;
      _currentMap: any = null;

      constructor(opts: any) {
        super();
        this._pos = opts.position;
        this._el  = opts.content;
        this._div = document.createElement('div');
        this._div.style.position  = 'absolute';
        this._div.style.cursor    = 'pointer';
        this._div.style.transform = 'translate(-50%, -100%)';
        if (opts.zIndex != null) this._div.style.zIndex = String(opts.zIndex);
        if (opts.title) this._div.title = opts.title;
        this._div.appendChild(this._el);
        if (opts.map) {
          this.setMap(opts.map);
        }
      }

      onAdd(): void {
        const panes = (this as any).getPanes();
        if (panes?.overlayMouseTarget) {
          panes.overlayMouseTarget.appendChild(this._div);
        }
      }

      draw(): void {
        const proj = (this as any).getProjection();
        if (!proj || !this._pos) return;
        const p = proj.fromLatLngToDivPixel(this._pos);
        if (!p) return;
        this._div.style.left = p.x + 'px';
        this._div.style.top  = p.y + 'px';
      }

      onRemove(): void {
        this._div.remove();
      }

      setMap(m: any): void {
        this._currentMap = m;
        super.setMap(m);
      }

      getMap(): any {
        return this._currentMap;
      }

      set position(p: any) {
        this._pos = p;
        this.draw();
      }

      get position(): any {
        return this._pos;
      }

      setPosition(p: any): void {
        this._pos = p;
        this.draw();
      }

      addListener(_evt: string, cb: () => void): void {
        this._div.addEventListener('click', (e) => {
          e.stopPropagation();
          cb();
        });
      }
    };
  }

  private initZoneMarkers(): void {
    if (!this._AdvancedMarker) return;
    this.zoneMarkers.forEach(m => {
      if (typeof m.setMap === 'function') m.setMap(null);
    });
    this.zoneMarkers = [];
    this.infoWindow = new (google.maps as any).InfoWindow({
      disableAutoPan: false,
      pixelOffset: new google.maps.Size(0, -32),
    });

    const visible = this.layerPolygons();

    for (const zone of HOTSPOT_ZONES) {
      const wrapper = document.createElement('div');
      wrapper.style.cursor = 'pointer';
      wrapper.innerHTML = this.buildZoneMarkerInner(zone, false);

      const marker = new this._AdvancedMarker({
        map:      visible ? this.map : null,
        position: new google.maps.LatLng(zone.lat, zone.lng),
        content:  wrapper,
        title:    `Zona Táctica ${zone.name}`,
      });

      marker.addListener('click', () => {
        this.infoWindow.setContent(this.buildInfoWindowContent(zone));
        this.infoWindow.setPosition(new google.maps.LatLng(zone.lat, zone.lng));
        this.infoWindow.open(this.map);
      });

      (marker as any).__zoneId  = zone.id;
      (marker as any).__wrapper = wrapper;
      this.zoneMarkers.push(marker);
    }
  }

  private buildZoneMarkerInner(zone: HotspotZone, isActive: boolean): string {
    const risk = getRisk(zone.crimeCount);

    if (isActive) {
      return `
        <div style="
          background:rgba(14,24,19,0.95);
          border:2px solid ${risk.color};
          border-radius:18px;
          padding:3px 8px;
          display:inline-flex; align-items:center; gap:5px;
          box-shadow:0 0 12px ${risk.color}88, 0 3px 8px rgba(0,0,0,0.5);
          font-family:'Inter',sans-serif;
          user-select:none;
          white-space:nowrap;
          cursor:pointer;
          transform: translateY(-24px) scale(1.06);
          transition:all 0.2s ease;
        ">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${risk.color};box-shadow:0 0 6px ${risk.color};"></span>
          <span style="color:#ffffff;font-size:11px;font-weight:800;">${zone.name}</span>
          <span style="background:${risk.color}33;color:${risk.color};font-size:9.5px;font-weight:800;padding:1px 5px;border-radius:6px;border:1px solid ${risk.color}66;">${zone.crimeCount}/10</span>
        </div>`;
    }

    return `
      <div style="
        background:rgba(14,24,19,0.92);
        border:1.5px solid ${risk.color}99;
        border-radius:16px;
        padding:2px 7px;
        display:inline-flex; align-items:center; gap:4px;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        font-family:'Inter',sans-serif;
        user-select:none;
        white-space:nowrap;
        cursor:pointer;
        transform: translateY(-20px);
        transition:all 0.2s ease;
      ">
        <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${risk.color};"></span>
        <span style="color:#e2e8f0;font-size:10px;font-weight:700;">${zone.name}</span>
      </div>`;
  }

  private updateZoneMarkersState(activeIds: Set<number>): void {
    for (const marker of this.zoneMarkers) {
      const id      = (marker as any).__zoneId as number;
      const zone    = HOTSPOT_ZONES.find(z => z.id === id);
      if (!zone) continue;
      const wrapper = (marker as any).__wrapper as HTMLElement;
      if (wrapper) wrapper.innerHTML = this.buildZoneMarkerInner(zone, activeIds.has(id));
    }
  }

  /**
   * Dibuja los perímetros de patrullaje activos (160m de radio táctico) con bordes de riesgo nítidos.
   * Pertenecen a la capa "Zonas y Puntos Críticos".
   */
  private updateHotspotCircles(activeZones: HotspotZone[]): void {
    if (!this.map) return;
    this.hotspotCircles.forEach(c => c.setMap(null));
    this.hotspotCircles = [];

    const visible = this.layerPolygons();

    for (const z of activeZones) {
      const risk = getRisk(z.crimeCount);

      // Núcleo focal del punto de calor (radio 50m) con color más vibrante
      const coreCircle = new google.maps.Circle({
        map:           visible ? this.map : null,
        center:        { lat: z.lat, lng: z.lng },
        radius:        50,
        fillColor:     risk.color,
        fillOpacity:   0.28,
        strokeColor:   risk.color,
        strokeOpacity: 0.95,
        strokeWeight:  2,
        clickable:     true,
      });

      // Círculo de perímetro táctico de zona a patrullar (160m)
      const perimeterCircle = new google.maps.Circle({
        map:           visible ? this.map : null,
        center:        { lat: z.lat, lng: z.lng },
        radius:        160,
        fillColor:     risk.color,
        fillOpacity:   0.14,
        strokeColor:   risk.color,
        strokeOpacity: 0.85,
        strokeWeight:  2,
        clickable:     true,
      });

      const showInfo = () => {
        this.infoWindow?.setContent(this.buildInfoWindowContent(z));
        this.infoWindow?.setPosition(new google.maps.LatLng(z.lat, z.lng));
        this.infoWindow?.open(this.map);
      };

      coreCircle.addListener('click', showInfo);
      perimeterCircle.addListener('click', showInfo);

      this.hotspotCircles.push(coreCircle, perimeterCircle);
    }
  }

  private buildInfoWindowContent(zone: HotspotZone): string {
    const risk = getRisk(zone.crimeCount);
    return `
      <div class="sigo-iw-card" style="font-family:'Inter',sans-serif; min-width:210px; max-width:280px; padding:4px 2px; user-select:none;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:5px; overflow:hidden;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${risk.color}; box-shadow:0 0 6px ${risk.color}; flex-shrink:0;"></span>
            <span class="sigo-iw-title" style="font-weight:800; font-size:13px; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              Zona Táctica ${zone.name}
            </span>
          </div>
          <span style="background:${risk.bg}; color:${risk.color}; font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:6px; border:1px solid ${risk.color}88; white-space:nowrap; flex-shrink:0;">
            ${risk.label} ${zone.crimeCount}/10
          </span>
        </div>
        <div class="sigo-iw-sub" style="font-size:11px; margin-top:5px; font-weight:500; color:#cbd5e1;">
          📍 ${zone.address}
        </div>
        <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.12); display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
          <span>Perímetro: <b>160 metros</b></span>
          <span style="color:${risk.color}; font-weight:700;">● Cuadrante de Patrullaje</span>
        </div>
      </div>
    `;
  }

  private lastCycleIndex = -1;

  private syncCycleState(): void {
    if (this.getActiveManualZones) {
      const liveManualIds = this.getActiveManualZones();
      for (const id of Array.from(this.manualActiveZoneIds)) {
        if (!liveManualIds.has(id)) {
          this.manualActiveZoneIds.delete(id);
          this.currentActiveIds.delete(id);
        }
      }
    }

    if (!this.settings.bucleZonasActivo()) {
      // Modo Manual: zonas fijadas por el operador en Ajustes + zonas asignadas manualmente a patrullas
      const manualIds = new Set([
        ...this.settings.zonasManuales(),
        ...this.manualActiveZoneIds,
      ]);
      const selected = HOTSPOT_ZONES.filter(z => manualIds.has(z.id));
      this.cycleCountdown.set(0);

      const currentRenderedIds = new Set<number>(this.activeZones().map(z => z.id));
      const changed =
        currentRenderedIds.size !== manualIds.size ||
        [...manualIds].some(id => !currentRenderedIds.has(id));

      if (changed) {
        this.currentActiveIds = manualIds;
        this.activeZones.set(selected);
        this.heatOverlay.setActiveZones(selected);
        this.updateHotspotCircles(selected);
        this.updateZoneMarkersState(manualIds);
      }
      return;
    }

    const CYCLE_SECS = this.settings.intervaloRotacionSeg();
    const countZonas = this.settings.cantidadZonasRotacion();
    const nowSec = Math.floor(Date.now() / 1000);
    const cycleIndex = Math.floor(nowSec / CYCLE_SECS);
    const remaining = CYCLE_SECS - (nowSec % CYCLE_SECS);

    this.cycleCountdown.set(remaining);

    // Intentar leer estado persistido del ciclo actual en localStorage
    let stored: any = null;
    try {
      const raw = localStorage.getItem('sigo_current_cycle_state');
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = null;
    }

    // Si estamos en el MISMO ciclo, con el mismo intervalo y cantidad de zonas:
    // MANTENER Y RESTAURAR EXACTAMENTE LAS MISMAS ZONAS ACTIVAS (¡no deben cambiar al recargar la página!)
    if (
      stored &&
      stored.cycleIndex === cycleIndex &&
      stored.intervaloSeg === CYCLE_SECS &&
      stored.cantidadZonas === countZonas &&
      Array.isArray(stored.activeZoneIds) &&
      stored.activeZoneIds.length === countZonas &&
      !stored.activeZoneIds.some((id: number) => this.manualActiveZoneIds.has(id))
    ) {
      const savedIds = new Set<number>([
        ...stored.activeZoneIds,
        ...this.manualActiveZoneIds,
      ]);
      const currentRenderedIds = new Set<number>(this.activeZones().map(z => z.id));
      const isAlreadyActive =
        this.lastCycleIndex === cycleIndex &&
        currentRenderedIds.size === savedIds.size &&
        [...savedIds].every(id => currentRenderedIds.has(id));

      if (!isAlreadyActive) {
        const selected = HOTSPOT_ZONES.filter(z => savedIds.has(z.id));
        this.lastCycleIndex = cycleIndex;
        this.currentActiveIds = savedIds;
        this.activeZones.set(selected);
        this.heatOverlay.setActiveZones(selected);
        this.updateHotspotCircles(selected);
        this.updateZoneMarkersState(savedIds);
        return;
      } else {
        return;
      }
    }

    // Si el ciclo cambió (el temporizador llegó a 0) o cambió la configuración de ajustes:
    if (this.lastCycleIndex !== cycleIndex) {
      this.lastCycleIndex = cycleIndex;
      const previousIds = stored?.activeZoneIds
        ? new Set<number>(stored.activeZoneIds)
        : new Set<number>(this.currentActiveIds);
      this.applyCycle(cycleIndex, previousIds, CYCLE_SECS, countZonas);
    }
  }

  /** Selección determinística garantizando representación de delitos Altos, Medios y Bajos según la cantidad configurada (1 a 5 zonas),
   * descartando estrictamente cualquier zona que ya esté seleccionada o asignada de forma manual. */
  private pickZonesForCycle(cycleIndex: number, exclude: Set<number>): HotspotZone[] {
    const count = Math.max(1, Math.min(5, this.settings.cantidadZonasRotacion()));
    const allZones = HOTSPOT_ZONES;
    if (allZones.length === 0) return [];

    // Descartar zonas asignadas de forma manual para que el sistema rotativo elija zonas distintas
    const manualIds = this.manualActiveZoneIds;
    const candidateZones = allZones.filter(z => !manualIds.has(z.id));
    const poolZones = candidateZones.length >= count
      ? candidateZones
      : (candidateZones.length > 0 ? candidateZones : allZones);

    const highZones   = poolZones.filter(z => z.crimeCount >= 7);
    const mediumZones = poolZones.filter(z => z.crimeCount >= 4 && z.crimeCount < 7);
    const lowZones    = poolZones.filter(z => z.crimeCount < 4);

    const pickFromPool = (pool: HotspotZone[], pickedIds: Set<number>): HotspotZone | null => {
      // 1. Zonas del pool que no estén en la rotación previa, no hayan sido tomadas en este ciclo y no sean manuales
      const nonExcluded = pool.filter(z => !exclude.has(z.id) && !pickedIds.has(z.id) && !manualIds.has(z.id));
      if (nonExcluded.length > 0) {
        return nonExcluded[Math.abs(cycleIndex) % nonExcluded.length];
      }
      // 2. Si se agotan, relajar la exclusión del ciclo previo pero manteniendo el descarte de zonas manuales
      const notInThisCycle = pool.filter(z => !pickedIds.has(z.id) && !manualIds.has(z.id));
      if (notInThisCycle.length > 0) {
        return notInThisCycle[Math.abs(cycleIndex) % notInThisCycle.length];
      }
      // 3. Fallback extremo solo si no hubiera suficientes zonas en todo el sistema
      const fallbackAny = pool.filter(z => !pickedIds.has(z.id));
      if (fallbackAny.length > 0) {
        return fallbackAny[Math.abs(cycleIndex) % fallbackAny.length];
      }
      return null;
    };

    const picked: HotspotZone[] = [];
    const pickedIds = new Set<number>();
    const poolPriority = [highZones, mediumZones, lowZones, highZones, mediumZones];

    for (let i = 0; i < count; i++) {
      const preferredPool = poolPriority[i % poolPriority.length];
      let zone = pickFromPool(preferredPool, pickedIds);
      if (!zone) {
        zone = pickFromPool(poolZones, pickedIds);
      }
      if (zone) {
        picked.push(zone);
        pickedIds.add(zone.id);
      }
    }

    if (picked.length > 0) return picked;

    const finalFallback = poolZones.filter(z => !manualIds.has(z.id));
    return finalFallback.length > 0 ? finalFallback.slice(0, count) : allZones.slice(0, count);
  }

  private applyCycle(
    cycleIndex: number,
    previous: Set<number>,
    intervaloSeg: number,
    cantidadZonas: number
  ): void {
    if (this.getActiveManualZones) {
      const liveManualIds = this.getActiveManualZones();
      this.manualActiveZoneIds = new Set(liveManualIds);
    }

    const cycleZones = this.pickZonesForCycle(cycleIndex, previous);
    const combinedIds = new Set<number>([
      ...cycleZones.map(z => z.id),
      ...this.manualActiveZoneIds,
    ]);
    const finalZones = HOTSPOT_ZONES.filter(z => combinedIds.has(z.id));

    this.currentActiveIds = combinedIds;
    this.activeZones.set(finalZones);
    this.heatOverlay.setActiveZones(finalZones);
    this.updateHotspotCircles(finalZones);
    this.updateZoneMarkersState(combinedIds);

    // Persistir el estado del ciclo actual en localStorage
    try {
      const stateToStore = {
        cycleIndex,
        intervaloSeg,
        cantidadZonas,
        activeZoneIds: cycleZones.map(z => z.id),
      };
      localStorage.setItem('sigo_current_cycle_state', JSON.stringify(stateToStore));
    } catch (e) {
      console.warn('[MapService] Error guardando estado de ciclo en localStorage:', e);
    }
  }

  /**
   * Los eventos históricos ya no sobreescriben las zonas del ciclo rotativo;
   * si el ciclo aún no corrió se fuerza su aplicación.
   */
  renderHeatmap(_eventos: EventoHotspot[]): void {
    if (this.activeZones().length === 0) {
      this.syncCycleState();
    }
  }

  toggleLayer(layer: MapLayer, visible: boolean): void {
    switch (layer) {
      case 'heatmap':
        this.layerHeatmap.set(visible);
        this.heatOverlay.setVisible(visible);
        break;
      case 'simcards':
        this.layerSimcards.set(visible);
        this.markerRefs.forEach(m => {
          if (typeof m.setMap === 'function') m.setMap(visible ? this.map : null);
        });
        this.ficticiaRefs.forEach(m => {
          if (typeof m.setMap === 'function') m.setMap(visible ? this.map : null);
        });
        break;
      case 'polygons':
        this.layerPolygons.set(visible);
        this.hotspotCircles.forEach(c => c.setMap(visible ? this.map : null));
        this.zoneMarkers.forEach(m => {
          if (typeof m.setMap === 'function') m.setMap(visible ? this.map : null);
        });
        this.patrolZoneCircles.forEach(c => c.setMap(visible ? this.map : null));
        this.patrolZoneMarkers.forEach(m => {
          if (typeof m.setMap === 'function') m.setMap(visible ? this.map : null);
        });
        this.polygonRefs.forEach(p => p.setMap(visible ? this.map : null));
        this.circleRefs.forEach(c => c.setMap(visible ? this.map : null));
        if (!visible) {
          this.infoWindow?.close();
          this.patrolInfoWindow?.close();
        }
        break;
      case 'flatmap':
        this.layerFlatMap.set(visible);
        if (this.map) {
          this.map.setOptions({ styles: visible ? FLAT_MAP_STYLES : null });
        }
        break;
    }
  }

  centerOn(lat: number, lng: number, zoom: number = 16): void {
    if (!this.map) return;
    const pos = new google.maps.LatLng(lat, lng);
    this.map.panTo(pos);
    if (zoom) this.map.setZoom(zoom);
  }


  onMarkerClick?: (idSesion: number) => void;
  onFicticiaClick?: (id: string) => void;
  getActiveManualZones?: () => Set<number>;

  /**
   * Garantiza que una zona esté presente en las zonas tácticas activas,
   * asegurando que sus círculos concéntricos y halo de calor se rendericen en el mapa.
   */
  ensureActiveZone(zone: HotspotZone): void {
    this.manualActiveZoneIds.add(zone.id);
    this.currentActiveIds.add(zone.id);
    const allActive = HOTSPOT_ZONES.filter(z => this.currentActiveIds.has(z.id));
    this.activeZones.set(allActive);
    this.heatOverlay.setActiveZones(allActive);
    this.updateHotspotCircles(allActive);
    this.updateZoneMarkersState(this.currentActiveIds);
  }

  releaseActiveZone(zoneId: number): void {
    this.manualActiveZoneIds.delete(zoneId);
    this.currentActiveIds.delete(zoneId);

    // Si la zona estaba guardada en el ciclo actual de localStorage, reemplazarla por otra zona automática
    try {
      const raw = localStorage.getItem('sigo_current_cycle_state');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored && Array.isArray(stored.activeZoneIds) && stored.activeZoneIds.includes(zoneId)) {
          const CYCLE_SECS = this.settings.intervaloRotacionSeg();
          const nowSec = Math.floor(Date.now() / 1000);
          const cycleIndex = Math.floor(nowSec / CYCLE_SECS);

          // Generar nuevas zonas excluyendo zoneId y las manuales
          const fresh = this.pickZonesForCycle(cycleIndex, new Set([zoneId, ...this.manualActiveZoneIds]));
          stored.activeZoneIds = fresh.map(z => z.id);
          localStorage.setItem('sigo_current_cycle_state', JSON.stringify(stored));
        }
      }
    } catch (e) {
      console.warn('[MapService] Error actualizando stored state en releaseActiveZone:', e);
    }

    // Calcular las zonas resultantes excluyendo taxativamente la zona liberada
    const targetIds = new Set<number>();
    try {
      const raw = localStorage.getItem('sigo_current_cycle_state');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored && Array.isArray(stored.activeZoneIds)) {
          stored.activeZoneIds.forEach((id: number) => {
            if (id !== zoneId) targetIds.add(id);
          });
        }
      }
    } catch {}
    this.manualActiveZoneIds.forEach(id => {
      if (id !== zoneId) targetIds.add(id);
    });

    if (targetIds.size === 0) {
      HOTSPOT_ZONES.slice(0, this.settings.cantidadZonasRotacion()).forEach(z => {
        if (z.id !== zoneId) targetIds.add(z.id);
      });
    }

    this.currentActiveIds = targetIds;
    const finalZones = HOTSPOT_ZONES.filter(z => targetIds.has(z.id));
    this.activeZones.set(finalZones);
    this.heatOverlay.setActiveZones(finalZones);
    this.updateHotspotCircles(finalZones);
    this.updateZoneMarkersState(targetIds);

    this.syncCycleState();
  }

  reconcileManualActiveZones(validManualZoneIds: Set<number>): void {
    let changed = false;
    for (const id of Array.from(this.manualActiveZoneIds)) {
      if (!validManualZoneIds.has(id)) {
        this.manualActiveZoneIds.delete(id);
        this.currentActiveIds.delete(id);
        changed = true;
      }
    }
    const currentRenderedIds = new Set<number>(this.activeZones().map(z => z.id));
    const targetIds = new Set<number>();
    try {
      const raw = localStorage.getItem('sigo_current_cycle_state');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored && Array.isArray(stored.activeZoneIds)) {
          stored.activeZoneIds.forEach((id: number) => targetIds.add(id));
        }
      }
    } catch {}
    this.manualActiveZoneIds.forEach(id => targetIds.add(id));

    const needsUpdate =
      changed ||
      currentRenderedIds.size !== targetIds.size ||
      [...targetIds].some(id => !currentRenderedIds.has(id));

    if (needsUpdate) {
      this.currentActiveIds = targetIds;
      const finalZones = HOTSPOT_ZONES.filter(z => targetIds.has(z.id));
      this.activeZones.set(finalZones);
      this.heatOverlay.setActiveZones(finalZones);
      this.updateHotspotCircles(finalZones);
      this.updateZoneMarkersState(targetIds);
    }
    this.syncCycleState();
  }

  clearManualActiveZones(): void {
    this.manualActiveZoneIds.clear();
    this.syncCycleState();
    const finalZones = HOTSPOT_ZONES.filter(z => this.currentActiveIds.has(z.id));
    this.activeZones.set(finalZones);
    this.heatOverlay.setActiveZones(finalZones);
    this.updateHotspotCircles(finalZones);
    this.updateZoneMarkersState(this.currentActiveIds);
  }

  upsertUnitMarker(sesion: SesionOperativa): void {
    const coords = sesion.coordenadas_rt;
    if (!coords || !this._AdvancedMarker || !this.map) return;
    const key = sesion.imei_simcard;
    const pos = new google.maps.LatLng(coords.lat, coords.lng);
    const config = ESTADO_CONFIG[sesion.estado_operativo] || ESTADO_CONFIG[EstadoOperativo.DISPONIBLE];

    if (this.markerRefs.has(key)) {
      const m = this.markerRefs.get(key);
      (m as any).position = pos;
      if (typeof m.getMap === 'function' && m.getMap() !== this.map) {
        m.setMap(this.layerSimcards() ? this.map : null);
      }
      if ((m as any).__estado !== sesion.estado_operativo) {
        (m as any).__estado = sesion.estado_operativo;
        if ((m as any)._el) {
          (m as any)._el.innerHTML = this.buildMarkerSvg(config.dotColor, sesion.tipo_transporte);
        }
      }
    } else {
      const el = document.createElement('div');
      el.innerHTML = this.buildMarkerSvg(config.dotColor, sesion.tipo_transporte);
      el.title = sesion.conductor?.nombre_completo ?? sesion.rut_conductor;
      const marker = new this._AdvancedMarker({
        map: this.layerSimcards() ? this.map : null,
        position: pos,
        content: el,
        zIndex: 20,
      });
      (marker as any).__idSesion = sesion.id_sesion;
      (marker as any).__estado = sesion.estado_operativo;
      el.addEventListener('click', () => this.onMarkerClick?.(sesion.id_sesion));
      this.markerRefs.set(key, marker);
    }
  }

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
    if (m) {
      if (typeof m.setMap === 'function') m.setMap(null);
      this.markerRefs.delete(imei);
    }
  }

  removeUnitMarkerById(idSesion: number): void {
    for (const [imei, marker] of this.markerRefs.entries()) {
      if ((marker as any).__idSesion === idSesion) {
        if (typeof marker.setMap === 'function') marker.setMap(null);
        this.markerRefs.delete(imei);
        break;
      }
    }
  }

  /** Dibuja el polígono o círculo táctico en el mapa para misiones en áreas personalizadas */
  upsertPolygon(asignacion: AsignacionTactica): void {
    this.polygonRefs.get(asignacion.id_asignacion)?.setMap(null);
    this.circleRefs.get(asignacion.id_asignacion)?.setMap(null);

    // Si la misión corresponde a una Zona Táctica catalogada (ej. Chonta Z1 o Z2..Z9),
    // activar de inmediato la zona con sus círculos concéntricos de patrullaje y mapa de calor
    const matchedHotspot = findMatchingHotspotZone(asignacion);

    if (asignacion.estado_mision === 'COMPLETADA' || asignacion.estado_mision === 'CANCELADA') {
      if (matchedHotspot) {
        this.releaseActiveZone(matchedHotspot.id);
      }
      return;
    }

    if (matchedHotspot) {
      this.ensureActiveZone(matchedHotspot);
      return;
    }

    const visible = this.layerPolygons();

    // Si tiene centro y radio, dibujamos un google.maps.Circle geográficamente exacto
    if (asignacion.centro_lat != null && asignacion.centro_lng != null) {
      const circle = new google.maps.Circle({
        map: visible ? this.map : null,
        center: { lat: asignacion.centro_lat, lng: asignacion.centro_lng },
        radius: Math.max(asignacion.radio_m || 50, 50),
        strokeColor: '#ef4444',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.22,
      });
      this.circleRefs.set(asignacion.id_asignacion, circle);
      return;
    }

    if (asignacion.geom_destino?.coordinates?.[0]) {
      const coords = asignacion.geom_destino.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
      const poly = new google.maps.Polygon({
        map: visible ? this.map : null, paths: coords,
        strokeColor: '#ef4444', strokeOpacity: 0.9, strokeWeight: 2,
        fillColor: '#ef4444', fillOpacity: 0.20,
      });
      this.polygonRefs.set(asignacion.id_asignacion, poly);
    }
  }

  removePolygon(id: number): void {
    this.polygonRefs.get(id)?.setMap(null);
    this.polygonRefs.delete(id);
    this.circleRefs.get(id)?.setMap(null);
    this.circleRefs.delete(id);
  }

  private sosMarkerRefs = new Map<number, any>();

  addSOSMarker(id: number, lat: number, lng: number): void {
    this.removeSOSMarker(id);
    if (!this._AdvancedMarker || !this.map) return;
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;cursor:pointer;transform:translateY(-28px);z-index:45;">
        <div style="position:absolute;inset:-10px;background:rgba(220,38,38,0.35);border-radius:50%;animation:sos-pulse 1.2s ease-in-out infinite;"></div>
        <div style="width:34px;height:34px;background:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #ffffff;box-shadow:0 0 16px rgba(220,38,38,0.85);">
          ${getIconSvg('alerta', '#ffffff', 18, 2)}
        </div>
      </div>`;
    const marker = new this._AdvancedMarker({
      map: this.map,
      position: new google.maps.LatLng(lat, lng),
      content: el,
      zIndex: 45,
    });
    this.sosMarkerRefs.set(id, marker);
  }

  removeSOSMarker(id: number): void {
    const marker = this.sosMarkerRefs.get(id);
    if (marker) {
      if (typeof marker.setMap === 'function') marker.setMap(null);
      this.sosMarkerRefs.delete(id);
    }
  }

  syncDatabaseZones(zonas: ZonaPatrullaje[]): void {
    syncDatabaseZones(zonas);
    if (this.map && this._AdvancedMarker) {
      this.initZoneMarkers();
      this.updateZoneMarkersState(this.currentActiveIds);
    }
  }

  renderPatrolZones(zonas: ZonaPatrullaje[]): void {
    if (!this.map) return;
    // Sincronizar todas las zonas en HOTSPOT_ZONES para unificar la gestión táctica
    this.syncDatabaseZones(zonas);
    // Ya no se dibujan círculos estáticos en zonas inactivas.
    // Los radios y mapas de calor se activan EXCLUSIVAMENTE cuando el algoritmo o el operador activan la zona en activeZones.
  }

  getMap(): google.maps.Map { return this.map; }

  destroy(): void {
    if (this.cycleTimer) { clearInterval(this.cycleTimer); this.cycleTimer = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    this.patrolZoneCircles.forEach(c => c.setMap(null));
    this.patrolZoneCircles.clear();
    this.patrolZoneMarkers.forEach(m => {
      if (typeof m.setMap === 'function') m.setMap(null);
    });
    this.patrolZoneMarkers.clear();
    this.hotspotCircles.forEach(c => c.setMap(null));
    this.hotspotCircles = [];
    this.zoneMarkers.forEach(m => {
      if (typeof m.setMap === 'function') m.setMap(null);
    });
    this.zoneMarkers = [];
  }

  // ─── Marcadores de Patrullas (SVG sin emojis) ─────────────────────────────

  addFicticiaMarker(id: string, lat: number, lng: number, tipo: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): void {
    if (!this._AdvancedMarker) return;
    const color = this._ficticiaColor(estado);
    const el    = document.createElement('div');
    el.innerHTML = this._buildFicticiaMarkerHtml(color, tipo, estado);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.onFicticiaClick?.(id);
    });
    this.ficticiaEls.set(id, el);
    this.ficticiaTypes.set(id, tipo);
    const marker = new this._AdvancedMarker({
      map:      this.map,
      position: new google.maps.LatLng(lat, lng),
      content:  el,
      title:    `Patrulla operativa`,
      zIndex:   10,
    });
    this.ficticiaRefs.set(id, marker);
  }

  moveFicticiaMarker(id: string, lat: number, lng: number): void {
    const m = this.ficticiaRefs.get(id);
    if (m) (m as any).position = new google.maps.LatLng(lat, lng);
  }

  updateFicticiaMarkerColor(id: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): void {
    const el    = this.ficticiaEls.get(id);
    if (!el) return;
    const tipo  = this.ficticiaTypes.get(id) ?? 'PATRULLA';
    const color = this._ficticiaColor(estado);
    el.innerHTML = this._buildFicticiaMarkerHtml(color, tipo, estado);
  }

  removeFicticiaMarker(id: string): void {
    const m = this.ficticiaRefs.get(id);
    if (m) {
      if (typeof m.setMap === 'function') m.setMap(null);
    }
    this.ficticiaRefs.delete(id);
    this.ficticiaEls.delete(id);
    this.ficticiaTypes.delete(id);
  }

  private _ficticiaColor(estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): string {
    return estado === 'DISPONIBLE' ? '#80B918'
         : estado === 'EN_RUTA'    ? '#2563eb'
         : '#d97706';
  }

  private _getTransportIconName(tipo: string): string {
    switch (tipo) {
      case 'MOTO':      return 'moto';
      case 'BICICLETA': return 'bici';
      case 'INFANTERIA':return 'peaton';
      default:          return 'auto';
    }
  }

  private _buildFicticiaMarkerHtml(color: string, tipo: string, estado: 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO'): string {
    const iconName = this._getTransportIconName(tipo);
    const svg = getIconSvg(iconName, color, 18, 1.8);
    const pulse = estado === 'EN_RUTA' ? `animation:sos-pulse 1.2s ease-in-out infinite;` : '';
    const ring  = estado === 'EN_RUTA' ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.4;${pulse}"></div>` : '';

    return `
      <div style="position:relative;">
        ${ring}
        <div style="
          background:var(--sigo-surface, #ffffff);
          border:2px solid ${color};
          border-radius:50%;
          width:36px; height:36px;
          display:flex; align-items:center; justify-content:center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.25);
          cursor:pointer;
          transition:all 0.25s ease;
        ">${svg}</div>
      </div>`;
  }

  private buildMarkerSvg(color: string, tipo: string): string {
    const iconName = this._getTransportIconName(tipo);
    const svg = getIconSvg(iconName, color, 18, 1.8);
    return `
      <div style="
        background:var(--sigo-surface, #ffffff);
        border:2px solid ${color};
        border-radius:50%;
        width:36px; height:36px;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 10px rgba(0,0,0,0.25);
        cursor:pointer;
        transition:transform 0.2s;
      ">${svg}</div>`;
  }
}
