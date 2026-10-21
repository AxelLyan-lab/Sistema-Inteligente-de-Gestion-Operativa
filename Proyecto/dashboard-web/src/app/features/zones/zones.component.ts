import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { ZonaPatrullaje, SesionOperativa } from '../../core/models';
import { registerCustomHotspotZone, removeCustomHotspotZone, getRisk, CRIME_PRESETS } from '../../core/services/map.service';

@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-sigo-bg text-sigo-text select-none">
      <app-navbar></app-navbar>

      <main class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                <app-icon name="zonas" [size]="18" [stroke]="1.8"></app-icon>
              </div>
              <div>
                <h1 class="text-lg font-bold text-sigo-text">Zonas y Puntos de Patrullaje</h1>
                <p class="text-xs text-sigo-muted">Gestión de geocercas, puntos focales críticos y asignación táctica</p>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              (click)="abrirModalNueva()"
              class="btn-primary flex items-center gap-2 text-xs py-2 px-3.5"
            >
              <app-icon name="mas" [size]="14"></app-icon>
              <span>Nueva Zona</span>
            </button>
            <button
              (click)="cargar()"
              class="btn-ghost flex items-center gap-1.5 text-xs py-2 px-3"
              [disabled]="cargando()"
            >
              <app-icon name="mira" [size]="14"></app-icon>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        <!-- Grilla de Zonas -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            *ngFor="let z of zonas()"
            class="card flex flex-col justify-between hover:border-sigo-accent/50 transition-all space-y-4"
          >
            <div>
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent">
                    <app-icon name="zonas" [size]="15"></app-icon>
                  </div>
                  <div>
                    <h3 class="font-bold text-sm text-sigo-text">{{ z.nombre }}</h3>
                    <!-- Badge de Riesgo y Delitos -->
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span
                        class="text-[9px] font-bold px-1.5 py-0.2 rounded"
                        [style.color]="getRiskInfo(z.cantidad_delitos || 5).color"
                        [style.backgroundColor]="getRiskInfo(z.cantidad_delitos || 5).bg"
                      >
                        🔥 {{ z.cantidad_delitos || 5 }}/10 Delitos · {{ getRiskInfo(z.cantidad_delitos || 5).label }}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  [ngClass]="z.activa ? 'bg-sigo-surface2 text-sigo-accent border border-sigo-accent/30' : 'bg-sigo-surface2 text-sigo-muted'"
                >
                  {{ z.activa ? 'Activa' : 'Inactiva' }}
                </span>
              </div>

              <p class="text-xs text-sigo-muted mb-3">{{ z.direccion || 'Sin dirección específica' }}</p>

              <!-- Métricas Técnicas -->
              <div class="p-3 rounded-lg bg-sigo-surface2/60 border border-sigo-border/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span class="text-sigo-muted block text-[10px]">Coordenadas:</span>
                  <span class="font-mono text-sigo-text font-medium">{{ z.lat | number:'1.4-4' }}, {{ z.lng | number:'1.4-4' }}</span>
                </div>
                <div>
                  <span class="text-sigo-muted block text-[10px]">Radio / Área:</span>
                  <span class="font-mono text-sigo-accent font-bold">
                    {{ z.radio_m }}m
                    <span class="text-[10px] opacity-80">({{ (z.radio_m * z.radio_m * 3.14159) | number:'1.0-1' }} m²)</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Acciones -->
            <div class="pt-3 border-t border-sigo-border flex items-center justify-between gap-2">
              <div class="flex items-center gap-1">
                <button
                  (click)="editarZona(z)"
                  class="btn-ghost text-xs p-1.5"
                  title="Editar zona"
                >
                  <app-icon name="editar" [size]="14"></app-icon>
                </button>
                <button
                  (click)="eliminar(z.id_zona)"
                  class="btn-ghost text-xs p-1.5 hover:text-emergencia"
                  title="Eliminar zona"
                >
                  <app-icon name="basura" [size]="14"></app-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Modal Crear / Editar Zona con Mapa Interactivo y Autocompletado -->
      <div *ngIf="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50 shrink-0">
            <div>
              <h3 class="font-bold text-sm text-sigo-text">
                {{ editandoZona.id_zona ? 'Editar Zona de Patrullaje' : 'Nueva Zona de Patrullaje Táctico' }}
              </h3>
              <p class="text-[11px] text-sigo-muted">Busca por dirección o haz clic en el mapa para posicionar el punto focal</p>
            </div>
            <button (click)="cerrarModal()" class="text-sigo-muted hover:text-sigo-text">
              <app-icon name="cerrar" [size]="18"></app-icon>
            </button>
          </div>

          <form (ngSubmit)="guardar()" class="p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Nombre / Identificador de Zona</label>
                <input
                  type="text"
                  [(ngModel)]="editandoZona.nombre"
                  name="nombre"
                  placeholder="Ej: Z10 - Miraflores Alto"
                  class="input-field"
                  required
                />
              </div>

              <div>
                <label class="block text-sigo-muted font-medium mb-1 flex items-center justify-between">
                  <span>Cantidad de Delitos (Ficticios)</span>
                  <span
                    class="text-[9px] font-bold px-1.5 py-0.2 rounded"
                    [style.color]="getRiskInfo(editandoZona.cantidad_delitos || 5).color"
                    [style.backgroundColor]="getRiskInfo(editandoZona.cantidad_delitos || 5).bg"
                  >
                    Riesgo {{ getRiskInfo(editandoZona.cantidad_delitos || 5).label }}
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  [(ngModel)]="editandoZona.cantidad_delitos"
                  name="cantidad_delitos"
                  class="input-field font-bold"
                  required
                />
              </div>
            </div>

            <!-- Dirección con Autocompletado de Google Maps -->
            <div>
              <label class="block text-sigo-muted font-medium mb-1 flex items-center justify-between">
                <span>Dirección / Calle de Referencia (Google Maps)</span>
                <span class="text-[10px] text-sigo-accent">Escribe para autocompletar</span>
              </label>
              <div class="relative">
                <input
                  #direccionInput
                  type="text"
                  [(ngModel)]="editandoZona.direccion"
                  name="direccion"
                  placeholder="Ej: Av. Alvarez 450, Viña del Mar"
                  class="input-field pr-8"
                  (keydown.enter)="$event.preventDefault()"
                />
                <button
                  type="button"
                  (click)="geocodificarTexto(editandoZona.direccion)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-sigo-muted hover:text-sigo-accent"
                  title="Buscar dirección en mapa"
                >
                  <app-icon name="lupa" [size]="14"></app-icon>
                </button>
              </div>
            </div>

            <!-- Mapa Interactivo para Clic de Posicionamiento -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sigo-muted font-medium">Ubicación Táctica en el Mapa</label>
                <span class="text-[10px] text-emerald-500 font-semibold">📍 Haz clic en el mapa para marcar el punto</span>
              </div>
              <div
                #zoneMapContainer
                class="w-full h-44 rounded-xl border border-sigo-border overflow-hidden relative shadow-inner bg-sigo-surface2"
              ></div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Latitud</label>
                <input
                  type="number"
                  step="0.00001"
                  [(ngModel)]="editandoZona.lat"
                  name="lat"
                  class="input-field font-mono"
                  (change)="onCoordsManualChange()"
                  required
                />
              </div>
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Longitud</label>
                <input
                  type="number"
                  step="0.00001"
                  [(ngModel)]="editandoZona.lng"
                  name="lng"
                  class="input-field font-mono"
                  (change)="onCoordsManualChange()"
                  required
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 items-center">
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Radio en Metros (50m = 1 cuadra)</label>
                <input type="number" step="1" min="1" [(ngModel)]="editandoZona.radio_m" name="radio_m" class="input-field" required />
              </div>

              <div class="flex items-center gap-2 pt-4">
                <input type="checkbox" id="activa" [(ngModel)]="editandoZona.activa" name="activa" class="rounded w-4 h-4 text-sigo-accent" />
                <label for="activa" class="text-sigo-text font-medium cursor-pointer">Zona activa en operaciones</label>
              </div>
            </div>

            <div class="pt-3 border-t border-sigo-border flex items-center justify-end gap-2.5">
              <button type="button" (click)="cerrarModal()" class="btn-ghost text-xs">Cancelar</button>
              <button type="submit" [disabled]="guardando" class="btn-primary text-xs py-2 px-4">
                {{ guardando ? 'Guardando...' : 'Guardar Zona' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class ZonesComponent implements OnInit {
  private readonly api = inject(ApiService);

  @ViewChild('zoneMapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('direccionInput') direccionInputRef?: ElementRef<HTMLInputElement>;

  readonly zonas    = signal<ZonaPatrullaje[]>([]);
  readonly cargando = signal<boolean>(false);

  sesiones: SesionOperativa[] = [];
  showModal = false;
  guardando = false;

  pickerMap?: any;
  pickerMarker?: any;
  autocomplete?: any;

  editandoZona: any = {
    id_zona: undefined,
    nombre: '',
    direccion: '',
    lat: -33.01840,
    lng: -71.51398,
    radio_m: 50,
    cantidad_delitos: 7,
    activa: true,
  };

  async ngOnInit(): Promise<void> {
    await this.cargar();
    this.sesiones = await this.api.getSesionesActivas();
  }

  getRiskInfo(count: number) {
    return getRisk(count);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.api.getZonas();
      const mapped = (data || []).map(z => {
        const lower = (z.nombre || '').trim().toLowerCase();
        return {
          ...z,
          cantidad_delitos: (z as any).cantidad_delitos || CRIME_PRESETS[lower] || 6
        };
      });
      this.zonas.set(mapped);
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalNueva(): void {
    this.editandoZona = {
      id_zona: undefined,
      nombre: '',
      direccion: 'Chonta 3544, Miraflores, Viña del Mar',
      lat: -33.01840,
      lng: -71.51398,
      radio_m: 50,
      cantidad_delitos: 7,
      activa: true,
    };
    this.showModal = true;
    setTimeout(() => this.initMapPicker(), 150);
  }

  editarZona(z: ZonaPatrullaje): void {
    const lower = (z.nombre || '').trim().toLowerCase();
    this.editandoZona = {
      ...z,
      cantidad_delitos: (z as any).cantidad_delitos || CRIME_PRESETS[lower] || 6,
    };
    this.showModal = true;
    setTimeout(() => this.initMapPicker(), 150);
  }

  cerrarModal(): void {
    this.showModal = false;
    this.pickerMap = null;
    this.pickerMarker = null;
  }

  private initMapPicker(): void {
    if (!this.mapContainerRef?.nativeElement) return;
    if (typeof window === 'undefined' || !(window as any).google?.maps) return;

    const gm = (window as any).google.maps;
    const center = { lat: Number(this.editandoZona.lat) || -33.0184, lng: Number(this.editandoZona.lng) || -71.5139 };

    this.pickerMap = new gm.Map(this.mapContainerRef.nativeElement, {
      center,
      zoom: 15,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
    });

    this.pickerMarker = new gm.Marker({
      position: center,
      map: this.pickerMap,
      draggable: true,
      animation: gm.Animation.DROP,
    });

    // Clic en el mapa para posicionar la zona
    this.pickerMap.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.actualizarPosicion(lat, lng);
    });

    // Arrastre del marcador
    this.pickerMarker.addListener('dragend', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.actualizarPosicion(lat, lng);
    });

    // Inicializar autocompletado de dirección si está disponible
    if (this.direccionInputRef?.nativeElement && gm.places?.Autocomplete) {
      this.autocomplete = new gm.places.Autocomplete(this.direccionInputRef.nativeElement, {
        fields: ['geometry', 'formatted_address', 'name'],
      });
      this.autocomplete.addListener('place_changed', () => {
        const place = this.autocomplete.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          this.editandoZona.direccion = place.formatted_address || place.name || '';
          if (!this.editandoZona.nombre) {
            this.editandoZona.nombre = place.name || 'Nueva Zona';
          }
          this.actualizarPosicion(lat, lng, false);
        }
      });
    }
  }

  private actualizarPosicion(lat: number, lng: number, reverseGeocode = true): void {
    this.editandoZona.lat = Number(lat.toFixed(6));
    this.editandoZona.lng = Number(lng.toFixed(6));

    const gm = (window as any).google?.maps;
    if (this.pickerMarker && gm) {
      const pos = new gm.LatLng(lat, lng);
      this.pickerMarker.setPosition(pos);
      this.pickerMap?.panTo(pos);
    }

    if (reverseGeocode && gm?.Geocoder) {
      const geocoder = new gm.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
        if (status === 'OK' && results?.[0]) {
          this.editandoZona.direccion = results[0].formatted_address;
        }
      });
    }
  }

  onCoordsManualChange(): void {
    const lat = Number(this.editandoZona.lat);
    const lng = Number(this.editandoZona.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.actualizarPosicion(lat, lng, true);
    }
  }

  geocodificarTexto(texto: string): void {
    if (!texto) return;
    const gm = (window as any).google?.maps;
    if (!gm?.Geocoder) return;

    const geocoder = new gm.Geocoder();
    geocoder.geocode({ address: texto }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        this.editandoZona.direccion = results[0].formatted_address;
        this.actualizarPosicion(loc.lat(), loc.lng(), false);
      } else {
        alert('No se pudo encontrar la dirección en Google Maps');
      }
    });
  }

  async guardar(): Promise<void> {
    this.guardando = true;
    try {
      const guardada = await this.api.guardarZona(this.editandoZona);

      // Registrar también en el sistema de zonas tácticas en memoria para mapa de calor y rotación
      registerCustomHotspotZone({
        id: guardada.id_zona,
        lat: Number(this.editandoZona.lat),
        lng: Number(this.editandoZona.lng),
        crimeCount: Number(this.editandoZona.cantidad_delitos) || 6,
        name: this.editandoZona.nombre || 'Zona Táctica',
        address: this.editandoZona.direccion || 'Sector Operativo',
      });

      this.cerrarModal();
      await this.cargar();
    } catch (e: any) {
      alert('Error guardando zona: ' + e.message);
    } finally {
      this.guardando = false;
    }
  }

  async eliminar(idZona: number): Promise<void> {
    if (!confirm('¿Confirma la eliminación de esta zona de patrullaje?')) return;
    try {
      await this.api.eliminarZona(idZona);
      removeCustomHotspotZone(idZona);
      await this.cargar();
    } catch (e: any) {
      alert('Error eliminando: ' + e.message);
    }
  }
}

