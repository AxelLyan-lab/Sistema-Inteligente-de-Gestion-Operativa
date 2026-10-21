import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SesionOperativa, ZonaPatrullaje, EstadoOperativo } from '../../../core/models';
import { IconComponent } from '../icon/icon.component';
import { HOTSPOT_ZONES, HotspotZone, getRisk, MapService, findMatchingHotspotZone } from '../../../core/services/map.service';

@Component({
  selector: 'app-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
              <app-icon name="mira" [size]="18" [stroke]="1.8"></app-icon>
            </div>
            <div>
              <h3 class="font-bold text-sm text-sigo-text">Despacho Táctico Manual</h3>
              <p class="text-xs text-sigo-muted">Asignar sector operativo prioritario a la patrulla</p>
            </div>
          </div>
          <button (click)="close.emit()" class="text-sigo-muted hover:text-sigo-text p-1 rounded-lg hover:bg-sigo-surface2">
            <app-icon name="cerrar" [size]="18"></app-icon>
          </button>
        </div>

        <!-- Formulario -->
        <div class="p-5 space-y-4 text-xs">
          <!-- Unidad Seleccionada -->
          <div>
            <label class="block text-sigo-muted font-medium mb-1.5">Unidad Operativa Destino</label>
            <div class="p-3 rounded-lg bg-sigo-surface2 border border-sigo-border flex items-center justify-between">
              <div class="flex items-center gap-2">
                <app-icon name="auto" [size]="18" color="var(--sigo-accent)"></app-icon>
                <span class="font-bold text-sigo-text text-sm">{{ sesion.identificador_unidad || 'Unidad ' + sesion.id_sesion }}</span>
                <span class="text-sigo-muted text-[11px]">({{ sesion.conductor?.nombre_completo || 'Funcionario en terreno' }})</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-sigo-accent/15 text-sigo-accent">
                {{ sesion.estado_operativo }}
              </span>
            </div>
          </div>

          <!-- Alerta de Bloqueo si la patrulla ya está en ronda/misión activa -->
          <div *ngIf="hasActiveMission()" class="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex flex-col gap-2.5">
            <div class="flex items-start gap-2">
              <div class="p-1 rounded-md bg-amber-500/25 text-amber-300 flex-shrink-0">
                <app-icon name="alerta" [size]="16"></app-icon>
              </div>
              <div class="flex-1">
                <p class="font-bold text-xs text-amber-300">Patrulla en Ronda / Misión Activa</p>
                <p class="text-[11px] text-amber-200/90 leading-relaxed mt-0.5">
                  Esta unidad ya tiene asignado el sector <b>{{ sesion.asignacion_activa?.nombre_zona || sesion.estado_operativo }}</b>. No puede ser despachada a otra zona sin antes finalizar o cancelar su ronda actual.
                </p>
              </div>
            </div>
            <div class="flex items-center justify-end">
              <button
                type="button"
                (click)="cancelarRondaActual()"
                [disabled]="cancelling"
                class="px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <app-icon name="cerrar" [size]="14"></app-icon>
                <span>{{ cancelling ? 'Cancelando Ronda...' : 'Finalizar / Cancelar Ronda Actual' }}</span>
              </button>
            </div>
          </div>

          <!-- Selección de Zona (todas las zonas registradas en el mapa) -->
          <div>
            <label class="block text-sigo-muted font-medium mb-1.5">Zona de Patrullaje</label>
            <select
              [(ngModel)]="selectedZonaKey"
              (ngModelChange)="onZonaChange($event)"
              class="input-field"
            >
              <option [ngValue]="null">-- Coordenadas personalizadas --</option>
              <option *ngFor="let z of mapZones" [ngValue]="'map-' + z.id">
                {{ z.name }} · {{ z.address }} (Riesgo {{ riskLabel(z.crimeCount) }})
              </option>
              <option *ngFor="let z of zonas" [ngValue]="'db-' + z.id_zona">
                {{ z.nombre }} (Radio {{ z.radio_m }}m)
              </option>
            </select>
          </div>

          <!-- Campos Coordenadas y Radio -->
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Latitud</label>
              <input type="number" step="0.00001" [(ngModel)]="lat" class="input-field" />
            </div>
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Longitud</label>
              <input type="number" step="0.00001" [(ngModel)]="lng" class="input-field" />
            </div>
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Radio (metros)</label>
              <input type="number" step="0.1" min="0.5" [(ngModel)]="radio_m" class="input-field" />
            </div>
          </div>

          <div class="p-2.5 rounded-lg bg-sigo-accent/10 border border-sigo-accent/20 flex items-center justify-between text-[11px]">
            <span class="text-sigo-muted">Área de cobertura estimada:</span>
            <span class="font-bold text-sigo-accent">
              {{ (radio_m * radio_m * 3.14159) | number:'1.1-2' }} m²
              <span *ngIf="radio_m <= 1.2" class="text-xs font-normal opacity-80">(círculo pequeño de 4 m²)</span>
            </span>
          </div>

          <!-- Nombre de Zona / Alias -->
          <div>
            <label class="block text-sigo-muted font-medium mb-1">Nombre o Referencia del Sector</label>
            <input type="text" [(ngModel)]="nombre_zona" placeholder="Ej: Z1" class="input-field" />
          </div>

          <!-- Instrucciones -->
          <div>
            <label class="block text-sigo-muted font-medium mb-1">Instrucciones Operativas</label>
            <textarea
              [(ngModel)]="instrucciones"
              rows="2"
              placeholder="Instrucciones al personal (ej. fiscalización preventiva de punto focal)..."
              class="input-field"
            ></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-sigo-border bg-sigo-surface2/40 flex items-center justify-between gap-2.5">
          <div class="text-[11px] text-amber-300 font-medium" *ngIf="hasActiveMission()">
            Ronda activa: Finalícela para despachar a otra zona
          </div>
          <div *ngIf="!hasActiveMission()"></div>
          <div class="flex items-center gap-2.5">
            <button (click)="close.emit()" class="btn-ghost text-xs">Cancelar</button>
            <button
              (click)="ejecutarDespacho()"
              [disabled]="loading || cancelling || hasActiveMission() || !lat || !lng"
              class="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              [title]="hasActiveMission() ? 'Debe finalizar la ronda actual antes de poder despachar' : ''"
            >
              <app-icon name="enviar" [size]="14"></app-icon>
              <span>{{ loading ? 'Despachando...' : 'Despachar Ahora' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DispatchModalComponent implements OnInit {
  @Input({ required: true }) sesion!: SesionOperativa;
  @Output() close      = new EventEmitter<void>();
  @Output() dispatched = new EventEmitter<void>();
  @Output() cancelled  = new EventEmitter<any>();

  private readonly api        = inject(ApiService);
  private readonly mapService = inject(MapService);

  readonly mapZones: HotspotZone[] = HOTSPOT_ZONES;
  zonas: ZonaPatrullaje[] = [];
  selectedZonaKey: string | null = null;

  lat: number = HOTSPOT_ZONES[0].lat;
  lng: number = HOTSPOT_ZONES[0].lng;
  radio_m: number = 50; // 1 cuadra (radio 50m)
  nombre_zona: string = HOTSPOT_ZONES[0].name;
  instrucciones: string = 'Patrullaje preventivo focalizado en la zona asignada.';
  loading = false;
  cancelling = false;

  hasActiveMission(): boolean {
    if (!this.sesion) return false;
    if (this.sesion.asignacion_activa) return true;
    return this.sesion.estado_operativo === EstadoOperativo.EN_RUTA_HOTSPOT ||
           this.sesion.estado_operativo === EstadoOperativo.PATRULLANDO_ZONA;
  }

  async cancelarRondaActual(): Promise<void> {
    if (!this.sesion) return;
    this.cancelling = true;
    try {
      const activeAsig = this.sesion.asignacion_activa;
      await this.api.cancelarAsignacion(
        activeAsig?.id_asignacion ?? null,
        this.sesion.id_sesion
      );

      // Liberar de inmediato la zona táctica en el mapa
      if (activeAsig) {
        const matched = findMatchingHotspotZone(activeAsig);
        if (matched) {
          this.mapService.releaseActiveZone(matched.id);
        }
      }

      this.sesion.asignacion_activa = null;
      this.sesion.estado_operativo = EstadoOperativo.DISPONIBLE;
      this.cancelled.emit(activeAsig);
      this.close.emit();
    } catch (err: any) {
      alert('Error al cancelar la ronda: ' + (err.message || 'No se pudo cancelar'));
    } finally {
      this.cancelling = false;
    }
  }

  riskLabel(count: number): string {
    return getRisk(count).label;
  }

  async ngOnInit(): Promise<void> {
    this.selectedZonaKey = 'map-' + HOTSPOT_ZONES[0].id;
    try {
      this.zonas = await this.api.getZonas();
    } catch (e) {
      console.warn('Error cargando zonas:', e);
    }
  }

  onZonaChange(key: string | null): void {
    if (!key) return;
    if (key.startsWith('map-')) {
      const z = HOTSPOT_ZONES.find(x => 'map-' + x.id === key);
      if (z) {
        this.lat = z.lat;
        this.lng = z.lng;
        this.radio_m = 50;
        this.nombre_zona = z.name;
      }
    } else if (key.startsWith('db-')) {
      const z = this.zonas.find(x => 'db-' + x.id_zona === key);
      if (z) {
        this.lat = z.lat;
        this.lng = z.lng;
        this.radio_m = z.radio_m || 50;
        this.nombre_zona = z.nombre;
      }
    }
  }

  async ejecutarDespacho(): Promise<void> {
    if (!this.sesion || !this.lat || !this.lng) return;
    this.loading = true;
    try {
      const radio = Number(this.radio_m) || 50;
      await this.api.despacharManual({
        id_sesion:      this.sesion.id_sesion,
        lat:            Number(this.lat),
        lng:            Number(this.lng),
        radio_m:        radio,
        nombre_zona:    this.nombre_zona,
        instrucciones:  this.instrucciones,
        id_zona:        this.selectedZonaKey?.startsWith('db-')
                          ? Number(this.selectedZonaKey.slice(3))
                          : undefined,
      });

      // Activar inmediatamente la zona táctica en el mapa del supervisor
      const matchedZone = findMatchingHotspotZone({
        id_zona: this.selectedZonaKey?.startsWith('db-')
          ? Number(this.selectedZonaKey.slice(3))
          : undefined,
        nombre_zona: this.nombre_zona,
        lat: Number(this.lat),
        lng: Number(this.lng),
      });
      if (matchedZone) {
        this.mapService.ensureActiveZone(matchedZone);
      }

      this.dispatched.emit();
      this.close.emit();
    } catch (err: any) {
      alert('Error al despachar: ' + (err.message || 'No se pudo registrar la asignación'));
    } finally {
      this.loading = false;
    }
  }
}
