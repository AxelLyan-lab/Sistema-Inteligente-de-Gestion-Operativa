import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { SettingsService } from '../../core/services/settings.service';
import {
  ZonaPatrullaje,
  SesionOperativa,
  CATALOGO_GRAVEDAD_DELITOS,
  clasificarZonaPorScore,
  calcularScoreAjustado,
  PesoSeveridadDelito,
  DelitoRegistro,
} from '../../core/models';
import {
  registerCustomHotspotZone,
  removeCustomHotspotZone,
  getRisk,
  CRIME_PRESETS,
  MapService,
  HOTSPOT_ZONES,
} from '../../core/services/map.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-sigo-bg text-sigo-text select-none">
      <app-navbar></app-navbar>

      <main class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                <app-icon name="zonas" [size]="18" [stroke]="1.8"></app-icon>
              </div>
              <div>
                <h1 class="text-lg font-bold text-sigo-text">Gestión de Zonas de Riesgo y Calibración U.V.E.</h1>
                <p class="text-xs text-sigo-muted">Circunferencias de patrullaje, severidad delictual intrínseca (50, 20, 10, 5, 2, 1 pts) y demanda U.V.E.</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              (click)="abrirModalNueva()"
              class="btn-primary flex items-center gap-2 text-xs py-2 px-3.5"
            >
              <app-icon name="mas" [size]="14"></app-icon>
              <span>Nueva Zona de Patrullaje</span>
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

        <!-- Leyenda de Calibración de Gravedad y Demanda U.V.E. -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Riesgo Bajo (&lt; 40 pts)</span>
              <span class="text-xs font-semibold text-sigo-text">Demanda: 0.20 a 0.30 U.V.E.</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">INF o CB</span>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Riesgo Medio (40 - 80 pts)</span>
              <span class="text-xs font-semibold text-sigo-text">Demanda: 0.45 a 0.80 U.V.E.</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-400">MTT o RPD</span>
          </div>
          <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-red-500 block">Riesgo Alto (&gt; 80 pts)</span>
              <span class="text-xs font-semibold text-sigo-text">Demanda: Mín. 1.00 U.V.E. continua</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-400">RPT o FZ</span>
          </div>
        </div>

        <!-- Grilla de Zonas de Riesgo -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            *ngFor="let z of zonas()"
            class="card flex flex-col justify-between hover:border-sigo-accent/50 transition-all space-y-4"
            [ngClass]="z.estado === 'ASIGNADA' ? 'ring-1 ring-sigo-accent border-sigo-accent' : ''"
          >
            <div>
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent font-bold text-xs">
                    {{ z.nombre }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <h3 class="font-bold text-sm text-sigo-text">Zona {{ z.nombre }}</h3>
                      <span
                        class="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        [ngClass]="z.estado === 'ASIGNADA' ? 'bg-sigo-accent text-white' : 'bg-sigo-surface2 text-sigo-muted'"
                      >
                        {{ z.estado || 'LIBRE' }}
                      </span>
                    </div>
                    <!-- Badge Calibrado (< 40 Verde/Bajo, 40-80 Amarillo/Medio, > 80 Rojo/Alto) -->
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        class="text-[10px] font-extrabold px-2 py-0.5 rounded border"
                        [ngClass]="getBadgeClassPorScore(z.score_gravedad || 0)"
                      >
                        Score: {{ z.score_gravedad || 0 }} pts · {{ getClasificacion(z.score_gravedad || 0).nivelRiesgo }}
                      </span>
                      <span class="text-[10px] font-semibold text-sigo-muted">
                        Ajustado: {{ z.score_ajustado | number:'1.1-2' }}
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

              <p class="text-xs text-sigo-muted mb-2.5">{{ z.direccion || 'Sin dirección específica' }}</p>

              <!-- Demanda U.V.E. Objetivo -->
              <div class="px-3 py-2 rounded-lg bg-sigo-surface2/80 border border-sigo-border mb-2.5 flex items-center justify-between text-[11px]">
                <span class="text-sigo-muted font-medium">Demanda U.V.E.:</span>
                <span class="font-bold text-sigo-accent">{{ getClasificacion(z.score_gravedad || 0).etiquetaDemanda }}</span>
              </div>

              <!-- Métricas Técnicas & Radio de Circunferencia -->
              <div class="p-2.5 rounded-lg bg-sigo-surface2/50 border border-sigo-border/60 grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span class="text-sigo-muted block">Circunferencia:</span>
                  <span class="font-mono text-sigo-text font-semibold">Radio {{ z.radio_m || 160 }} m</span>
                </div>
                <div>
                  <span class="text-sigo-muted block">Patrullaje hoy:</span>
                  <span class="font-mono text-sigo-text font-semibold">{{ z.minutos_patrullados_hoy || 0 }} min</span>
                </div>
                <div>
                  <span class="text-sigo-muted block">Delitos reg.:</span>
                  <span class="font-mono text-sigo-accent font-bold">{{ z.delitos?.length || 0 }} eventos</span>
                </div>
              </div>

              <!-- Lista resumida de últimos delitos registrados en la zona -->
              <div *ngIf="z.delitos && z.delitos.length > 0" class="mt-2.5 space-y-1 max-h-24 overflow-y-auto pr-1">
                <div
                  *ngFor="let del of z.delitos.slice(0, 3)"
                  class="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-sigo-surface2/60 border border-sigo-border/40"
                >
                  <span class="truncate text-sigo-text max-w-[180px]">{{ del.tipo_delito }}</span>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="font-bold text-amber-400">+{{ del.categoria_peso }} pts</span>
                    <button
                      type="button"
                      (click)="quitarDelitoDeZona(z.id_zona, del.id)"
                      class="text-sigo-muted hover:text-emergencia"
                      title="Eliminar delito"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Acciones -->
            <div class="pt-3 border-t border-sigo-border flex items-center justify-between gap-2">
              <button
                type="button"
                (click)="abrirModalDelito(z)"
                class="btn-ghost text-[11px] py-1 px-2.5 border border-sigo-border flex items-center gap-1 text-sigo-accent"
              >
                <app-icon name="mas" [size]="12"></app-icon>
                <span>Registrar Delito</span>
              </button>

              <div class="flex items-center gap-1">
                <button
                  (click)="editarZona(z)"
                  class="btn-ghost text-xs p-1.5"
                  title="Editar polígono y zona"
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

      <!-- Modal Rápido para Registrar Delito y Recalcular score_gravedad -->
      <div *ngIf="zonaParaDelito" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50">
            <div>
              <h3 class="font-bold text-sm text-sigo-text">Registrar Delito · Zona {{ zonaParaDelito.nombre }}</h3>
              <p class="text-[11px] text-sigo-muted">Suma puntos de severidad intrínseca directa (sin decaimiento temporal)</p>
            </div>
            <button (click)="zonaParaDelito = null" class="text-sigo-muted hover:text-sigo-text">
              <app-icon name="cerrar" [size]="18"></app-icon>
            </button>
          </div>

          <form (ngSubmit)="confirmarNuevoDelito()" class="p-5 space-y-4 text-xs">
            <!-- Score actual + Proyección -->
            <div class="p-3 rounded-xl bg-sigo-surface2 border border-sigo-border flex items-center justify-between">
              <div>
                <span class="text-[10px] text-sigo-muted block">Score Gravedad Proyectado:</span>
                <span class="text-sm font-extrabold text-sigo-text">
                  {{ (zonaParaDelito.score_gravedad || 0) }} pts → {{ (zonaParaDelito.score_gravedad || 0) + Number(nuevoDelitoPeso) }} pts
                </span>
              </div>
              <span
                class="text-[10px] font-extrabold px-2.5 py-1 rounded border"
                [ngClass]="getBadgeClassPorScore((zonaParaDelito.score_gravedad || 0) + Number(nuevoDelitoPeso))"
              >
                {{ getClasificacion((zonaParaDelito.score_gravedad || 0) + Number(nuevoDelitoPeso)).nivelRiesgo }}
              </span>
            </div>

            <div>
              <label class="block text-sigo-muted font-medium mb-1">Categoría de Severidad Calibrada</label>
              <select
                [(ngModel)]="nuevoDelitoPeso"
                name="nuevoDelitoPeso"
                (change)="onCategoriaDelitoChange()"
                class="input-field font-semibold"
              >
                <option *ngFor="let cat of catalogoDelitos" [ngValue]="cat.peso">
                  +{{ cat.peso }} pts — {{ cat.descripcion }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sigo-muted font-medium mb-1">Descripción / Tipo de Delito</label>
              <input
                type="text"
                [(ngModel)]="nuevoDelitoTexto"
                name="nuevoDelitoTexto"
                placeholder="Ej: Robo con intimidación en paradero"
                class="input-field"
                required
              />
            </div>

            <div class="pt-2 border-t border-sigo-border flex items-center justify-end gap-2">
              <button type="button" (click)="zonaParaDelito = null" class="btn-ghost text-xs">Cancelar</button>
              <button type="submit" class="btn-primary text-xs py-2 px-4">
                Sumar +{{ nuevoDelitoPeso }} pts a Zona
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Crear / Editar Zona con Selección de Circunferencia a Patrullar y Delitos -->
      <div *ngIf="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50 shrink-0">
            <div>
              <h3 class="font-bold text-sm text-sigo-text">
                {{ editandoZona.id_zona ? 'Editar Zona y Circunferencia de Patrullaje' : 'Nueva Zona de Patrullaje (Circunferencia)' }}
              </h3>
              <p class="text-[11px] text-sigo-muted">Selecciona el centro en el mapa y ajusta el radio del círculo que definirá el límite de patrullaje</p>
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

              <!-- Resumen Score Gravedad en vivo -->
              <div>
                <label class="block text-sigo-muted font-medium mb-1 flex items-center justify-between">
                  <span>Score Gravedad Calculado</span>
                  <span
                    class="text-[10px] font-extrabold px-2 py-0.5 rounded border"
                    [ngClass]="getBadgeClassPorScore(calcularScoreModal())"
                  >
                    {{ calcularScoreModal() }} pts · {{ getClasificacion(calcularScoreModal()).nivelRiesgo }}
                  </span>
                </label>
                <div class="input-field flex items-center justify-between bg-sigo-surface2/70">
                  <span class="font-bold text-sigo-text">{{ getClasificacion(calcularScoreModal()).etiquetaDemanda }}</span>
                </div>
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

            <!-- Mapa Interactivo con Circunferencia Ajustable -->
            <div>
              <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label class="block text-sigo-muted font-medium">
                  Circunferencia a Patrullar — Radio: <b class="text-sigo-accent">{{ editandoZona.radio_m || 160 }} m</b>
                  <span class="text-[10px] text-sigo-muted ml-1">(Arrastra el borde del círculo o usa el control de tamaño)</span>
                </label>
                <div class="flex items-center gap-1">
                  <button
                    *ngFor="let r of [50, 100, 160, 250, 400]"
                    type="button"
                    (click)="setRadioCirculo(r)"
                    class="px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer"
                    [ngClass]="editandoZona.radio_m === r ? 'bg-sigo-accent text-white border-sigo-accent' : 'bg-sigo-surface2 text-sigo-muted border-sigo-border hover:text-sigo-text'"
                  >
                    {{ r }}m
                  </button>
                </div>
              </div>

              <!-- Slider para ajustar el tamaño del círculo en tiempo real -->
              <div class="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg bg-sigo-surface2/70 border border-sigo-border">
                <span class="text-[10px] font-semibold text-sigo-muted shrink-0">Tamaño del Círculo:</span>
                <input
                  type="range"
                  min="20"
                  max="600"
                  step="5"
                  [(ngModel)]="editandoZona.radio_m"
                  name="radio_slider"
                  (ngModelChange)="onRadioCirculoChange($event)"
                  class="flex-1 accent-sigo-accent cursor-pointer"
                />
                <span class="font-mono font-bold text-xs text-sigo-accent w-16 text-right">
                  {{ editandoZona.radio_m || 160 }} m
                </span>
              </div>

              <div
                #zoneMapContainer
                class="w-full h-56 rounded-xl border border-sigo-border overflow-hidden relative shadow-inner bg-sigo-surface2"
              ></div>
            </div>

            <!-- Registro de Delitos dentro del Modal -->
            <div class="p-3 rounded-xl bg-sigo-surface2/60 border border-sigo-border space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sigo-text">Delitos Registrados en la Zona ({{ editandoZona.delitos?.length || 0 }})</span>
                <span class="text-[10px] text-sigo-muted">Calibración directa: 50, 20, 10, 5, 2, 1 pts</span>
              </div>

              <div class="flex flex-col sm:flex-row gap-2">
                <select
                  [(ngModel)]="modalDelitoPeso"
                  name="modalDelitoPeso"
                  (change)="onModalDelitoPesoChange()"
                  class="input-field sm:w-56 text-[11px]"
                >
                  <option *ngFor="let cat of catalogoDelitos" [ngValue]="cat.peso">
                    +{{ cat.peso }} pts — {{ cat.descripcion }}
                  </option>
                </select>
                <input
                  type="text"
                  [(ngModel)]="modalDelitoTexto"
                  name="modalDelitoTexto"
                  placeholder="Detalle del delito..."
                  class="input-field flex-1 text-[11px]"
                />
                <button
                  type="button"
                  (click)="agregarDelitoEnModal()"
                  class="btn-primary text-[11px] px-3 py-1.5 shrink-0"
                >
                  + Agregar
                </button>
              </div>

              <div *ngIf="editandoZona.delitos?.length" class="max-h-28 overflow-y-auto space-y-1 pr-1">
                <div
                  *ngFor="let d of editandoZona.delitos; let idx = index"
                  class="flex items-center justify-between px-2.5 py-1 rounded bg-sigo-surface border border-sigo-border text-[11px]"
                >
                  <span class="truncate">{{ d.tipo_delito }}</span>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="font-bold text-sigo-accent">+{{ d.categoria_peso }} pts</span>
                    <button
                      type="button"
                      (click)="eliminarDelitoEnModal(idx)"
                      class="text-sigo-muted hover:text-emergencia font-bold"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 items-center">
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Latitud Centro</label>
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
                <label class="block text-sigo-muted font-medium mb-1">Longitud Centro</label>
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
              <div>
                <label class="block text-sigo-muted font-medium mb-1">Radio Circunferencia (m)</label>
                <input
                  type="number"
                  step="5"
                  min="20"
                  max="1000"
                  [(ngModel)]="editandoZona.radio_m"
                  name="radio_m"
                  (ngModelChange)="onRadioCirculoChange($event)"
                  class="input-field font-mono"
                  required
                />
              </div>
            </div>

            <div class="pt-3 border-t border-sigo-border flex items-center justify-between gap-2.5">
              <div class="flex items-center gap-2">
                <input type="checkbox" id="activa" [(ngModel)]="editandoZona.activa" name="activa" class="rounded w-4 h-4 text-sigo-accent" />
                <label for="activa" class="text-sigo-text font-medium cursor-pointer">Zona habilitada para rotación de patrullaje</label>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" (click)="cerrarModal()" class="btn-ghost text-xs">Cancelar</button>
                <button type="submit" [disabled]="guardando" class="btn-primary text-xs py-2 px-4">
                  {{ guardando ? 'Guardando...' : 'Guardar Zona y Circunferencia' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class ZonesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly mapService = inject(MapService);
  readonly settings = inject(SettingsService);

  @ViewChild('zoneMapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('direccionInput') direccionInputRef?: ElementRef<HTMLInputElement>;

  readonly zonas = signal<ZonaPatrullaje[]>([]);
  readonly cargando = signal<boolean>(false);

  readonly catalogoDelitos = CATALOGO_GRAVEDAD_DELITOS;
  readonly Number = Number;

  sesiones: SesionOperativa[] = [];
  showModal = false;
  guardando = false;

  // Estado para modal rápido de registro de delito
  zonaParaDelito: ZonaPatrullaje | null = null;
  nuevoDelitoPeso: PesoSeveridadDelito = 20;
  nuevoDelitoTexto = 'Robo con violencia / intimidación';

  // Estado para agregar delitos dentro del modal de edición de zona
  modalDelitoPeso: PesoSeveridadDelito = 20;
  modalDelitoTexto = 'Robo con violencia / intimidación';

  pickerMap?: any;
  pickerMarker?: any;
  pickerCircle?: any;
  autocomplete?: any;
  private syncingFromCircle = false;
  private cycleSyncTimer: any = null;

  editandoZona: any = {
    id_zona: undefined,
    nombre: '',
    direccion: '',
    lat: -33.01840,
    lng: -71.51398,
    radio_m: 160,
    cantidad_delitos: 4,
    activa: true,
    vertices: [] as { lat: number; lng: number }[],
    delitos: [] as DelitoRegistro[],
  };

  async ngOnInit(): Promise<void> {
    await this.cargar();
    this.sesiones = await this.api.getSesionesActivas();
    // Mantener el estado ASIGNADA / LIBRE sincronizado en tiempo real con el Motor Táctico 24/7 del servidor
    this.cycleSyncTimer = setInterval(async () => {
      try {
        const res = await fetch(`${environment.apiBaseUrl}/tactico/estado`);
        if (res.ok) {
          const data = await res.json();
          this.mapService.applyServerCycleState(
            data.modo_despacho || 'MANUAL',
            Array.isArray(data.zonas_activas_ids) ? data.zonas_activas_ids : [],
            Number(data.segundos_restantes) || 0,
            Array.isArray(data.zonas_catalogo) ? data.zonas_catalogo : undefined
          );
        }
      } catch {
        this.mapService.syncCycleState();
      }
      this.sincronizarEstadoConDashboard();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.cycleSyncTimer) {
      clearInterval(this.cycleSyncTimer);
      this.cycleSyncTimer = null;
    }
  }

  private aplicarEstadoDashboard(lista: ZonaPatrullaje[]): ZonaPatrullaje[] {
    const activasDashboard = this.mapService.activeZones();
    const activeIds = new Set(activasDashboard.map(az => az.id));
    const activeNames = new Set(activasDashboard.map(az => (az.name || '').trim().toLowerCase()));

    return lista.map(z => {
      const nom = (z.nombre || '').trim().toLowerCase();
      const esAsignadaEnDashboard = activeIds.has(z.id_zona) || (nom !== '' && activeNames.has(nom));
      return {
        ...z,
        estado: esAsignadaEnDashboard ? 'ASIGNADA' : 'LIBRE',
      };
    });
  }

  private sincronizarEstadoConDashboard(): void {
    const actual = this.zonas();
    if (!actual.length) return;
    const sincronizadas = this.aplicarEstadoDashboard(actual);
    const cambio = sincronizadas.some((z, idx) => z.estado !== actual[idx].estado);
    if (cambio) {
      this.zonas.set(sincronizadas);
    }
  }

  getRiskInfo(count: number, scoreGravedad?: number) {
    return getRisk(count, scoreGravedad);
  }

  getClasificacion(scoreGravedad: number) {
    return clasificarZonaPorScore(scoreGravedad);
  }

  getBadgeClassPorScore(scoreGravedad: number): string {
    if (scoreGravedad > 80) {
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
    if (scoreGravedad >= 40) {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    }
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  }

  calcularScoreModal(): number {
    const lista: DelitoRegistro[] = this.editandoZona?.delitos || [];
    return lista.reduce((acc, d) => acc + Number(d.categoria_peso || 0), 0);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.api.getZonas();
      this.mapService.syncDatabaseZones(data || []);
      this.zonas.set(this.aplicarEstadoDashboard(data || []));
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalDelito(z: ZonaPatrullaje): void {
    this.zonaParaDelito = z;
    this.nuevoDelitoPeso = 20;
    this.nuevoDelitoTexto = 'Robo con violencia / intimidación';
  }

  onCategoriaDelitoChange(): void {
    const found = this.catalogoDelitos.find((c) => c.peso === Number(this.nuevoDelitoPeso));
    if (found) {
      this.nuevoDelitoTexto = found.descripcion;
    }
  }

  async confirmarNuevoDelito(): Promise<void> {
    if (!this.zonaParaDelito || !this.nuevoDelitoTexto.trim()) return;
    const actualizadas = await this.api.registrarDelitoZona(
      this.zonaParaDelito.id_zona,
      this.nuevoDelitoTexto.trim(),
      Number(this.nuevoDelitoPeso) as PesoSeveridadDelito
    );
    this.mapService.syncDatabaseZones(actualizadas);
    this.zonas.set(this.aplicarEstadoDashboard(actualizadas));
    this.zonaParaDelito = null;
  }

  async quitarDelitoDeZona(idZona: number, delitoId: string): Promise<void> {
    const actualizadas = await this.api.eliminarDelitoZona(idZona, delitoId);
    this.mapService.syncDatabaseZones(actualizadas);
    this.zonas.set(this.aplicarEstadoDashboard(actualizadas));
  }

  onModalDelitoPesoChange(): void {
    const found = this.catalogoDelitos.find((c) => c.peso === Number(this.modalDelitoPeso));
    if (found) {
      this.modalDelitoTexto = found.descripcion;
    }
  }

  agregarDelitoEnModal(): void {
    if (!this.modalDelitoTexto.trim()) return;
    const nuevo: DelitoRegistro = {
      id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      zona_id: String(this.editandoZona.id_zona || 'nueva'),
      tipo_delito: this.modalDelitoTexto.trim(),
      categoria_peso: Number(this.modalDelitoPeso) as PesoSeveridadDelito,
      fecha_hora: new Date().toISOString(),
    };
    this.editandoZona.delitos = [nuevo, ...(this.editandoZona.delitos || [])];
    this.renderCircleOnPicker();
  }

  eliminarDelitoEnModal(index: number): void {
    this.editandoZona.delitos = (this.editandoZona.delitos || []).filter((_: any, i: number) => i !== index);
    this.renderCircleOnPicker();
  }

  private generarVerticesCirculo(lat: number, lng: number, radiusM = 160, puntos = 32): { lat: number; lng: number }[] {
    const r = Math.max(20, Number(radiusM) || 160);
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

  setRadioCirculo(radio: number): void {
    this.editandoZona.radio_m = radio;
    this.onRadioCirculoChange(radio);
  }

  onRadioCirculoChange(nuevoRadio: number): void {
    const r = Math.max(20, Math.min(1000, Math.round(Number(nuevoRadio) || 160)));
    this.editandoZona.radio_m = r;
    const lat = Number(this.editandoZona.lat) || -33.0184;
    const lng = Number(this.editandoZona.lng) || -71.5139;
    this.editandoZona.vertices = this.generarVerticesCirculo(lat, lng, r);
    if (this.pickerCircle && !this.syncingFromCircle) {
      this.pickerCircle.setRadius(r);
    }
  }

  abrirModalNueva(): void {
    const lat = -33.01840;
    const lng = -71.51398;
    const radio = 160;
    this.editandoZona = {
      id_zona: undefined,
      nombre: '',
      direccion: 'Chonta 3544, Miraflores, Viña del Mar',
      lat,
      lng,
      radio_m: radio,
      cantidad_delitos: 2,
      activa: true,
      vertices: this.generarVerticesCirculo(lat, lng, radio),
      delitos: [
        {
          id: `del-${Date.now()}-1`,
          zona_id: 'nueva',
          tipo_delito: 'Robo con violencia / intimidación',
          categoria_peso: 20,
          fecha_hora: new Date().toISOString(),
        },
        {
          id: `del-${Date.now()}-2`,
          zona_id: 'nueva',
          tipo_delito: 'Robo en lugar habitado',
          categoria_peso: 10,
          fecha_hora: new Date().toISOString(),
        },
      ],
    };
    this.showModal = true;
    setTimeout(() => this.initMapPicker(), 150);
  }

  editarZona(z: ZonaPatrullaje): void {
    const lat = Number(z.lat) || -33.01840;
    const lng = Number(z.lng) || -71.51398;
    const radio = Math.max(20, Number(z.radio_m) || 160);
    this.editandoZona = {
      ...z,
      lat,
      lng,
      radio_m: radio,
      vertices: this.generarVerticesCirculo(lat, lng, radio),
      delitos: z.delitos ? [...z.delitos] : [],
    };
    this.showModal = true;
    setTimeout(() => this.initMapPicker(), 150);
  }

  cerrarModal(): void {
    this.showModal = false;
    this.pickerMap = null;
    this.pickerMarker = null;
    this.pickerCircle = null;
  }

  private renderCircleOnPicker(): void {
    if (!this.pickerMap) return;
    const gm = (window as any).google?.maps;
    if (!gm) return;

    if (this.pickerCircle) {
      this.pickerCircle.setMap(null);
      this.pickerCircle = null;
    }

    const lat = Number(this.editandoZona.lat) || -33.0184;
    const lng = Number(this.editandoZona.lng) || -71.5139;
    const radio = Math.max(20, Number(this.editandoZona.radio_m) || 160);
    const clasif = clasificarZonaPorScore(this.calcularScoreModal());

    this.pickerCircle = new gm.Circle({
      map: this.pickerMap,
      center: { lat, lng },
      radius: radio,
      strokeColor: clasif.colorHex,
      strokeOpacity: 0.95,
      strokeWeight: 2.5,
      fillColor: clasif.colorHex,
      fillOpacity: 0.25,
      editable: true,
      draggable: true,
    });

    gm.event.addListener(this.pickerCircle, 'radius_changed', () => {
      if (!this.pickerCircle) return;
      this.syncingFromCircle = true;
      const newRad = Math.max(20, Math.min(1000, Math.round(this.pickerCircle.getRadius())));
      this.editandoZona.radio_m = newRad;
      this.editandoZona.vertices = this.generarVerticesCirculo(
        Number(this.editandoZona.lat),
        Number(this.editandoZona.lng),
        newRad
      );
      this.syncingFromCircle = false;
    });

    gm.event.addListener(this.pickerCircle, 'center_changed', () => {
      if (!this.pickerCircle) return;
      const c = this.pickerCircle.getCenter();
      if (!c) return;
      const nLat = Number(c.lat().toFixed(6));
      const nLng = Number(c.lng().toFixed(6));
      if (Math.abs(nLat - Number(this.editandoZona.lat)) > 0.00001 || Math.abs(nLng - Number(this.editandoZona.lng)) > 0.00001) {
        this.editandoZona.lat = nLat;
        this.editandoZona.lng = nLng;
        this.pickerMarker?.setPosition(c);
        this.editandoZona.vertices = this.generarVerticesCirculo(nLat, nLng, Number(this.editandoZona.radio_m) || 160);
      }
    });
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

    this.renderCircleOnPicker();

    // Clic en el mapa mueve el centro de la circunferencia a ese punto
    this.pickerMap.addListener('click', (e: any) => {
      const lat = Number(e.latLng.lat().toFixed(6));
      const lng = Number(e.latLng.lng().toFixed(6));
      this.actualizarPosicion(lat, lng, true);
      this.editandoZona.vertices = this.generarVerticesCirculo(lat, lng, Number(this.editandoZona.radio_m) || 160);
      this.renderCircleOnPicker();
    });

    // Arrastre del marcador central
    this.pickerMarker.addListener('dragend', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.actualizarPosicion(lat, lng);
      this.editandoZona.vertices = this.generarVerticesCirculo(lat, lng, Number(this.editandoZona.radio_m) || 160);
      this.renderCircleOnPicker();
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
          this.editandoZona.vertices = this.generarVerticesCirculo(lat, lng, Number(this.editandoZona.radio_m) || 160);
          this.renderCircleOnPicker();
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
      this.editandoZona.vertices = this.generarVerticesCirculo(lat, lng, Number(this.editandoZona.radio_m) || 160);
      this.renderCircleOnPicker();
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
        this.editandoZona.vertices = this.generarVerticesCirculo(loc.lat(), loc.lng(), Number(this.editandoZona.radio_m) || 160);
        this.renderCircleOnPicker();
      } else {
        alert('No se pudo encontrar la dirección en Google Maps');
      }
    });
  }

  async guardar(): Promise<void> {
    this.guardando = true;
    try {
      const radioElegido = Math.max(20, Number(this.editandoZona.radio_m) || 160);
      this.editandoZona.radio_m = radioElegido;
      this.editandoZona.vertices = this.generarVerticesCirculo(
        Number(this.editandoZona.lat),
        Number(this.editandoZona.lng),
        radioElegido
      );
      const guardada = await this.api.guardarZona(this.editandoZona);
      const score = guardada.score_gravedad ?? this.calcularScoreModal();

      registerCustomHotspotZone({
        id: guardada.id_zona,
        lat: Number(this.editandoZona.lat),
        lng: Number(this.editandoZona.lng),
        radio_m: radioElegido,
        crimeCount: score > 80 ? 9 : score >= 40 ? 6 : 2,
        name: this.editandoZona.nombre || 'Zona Táctica',
        address: this.editandoZona.direccion || 'Sector Operativo',
        scoreGravedad: score,
        vertices: guardada.vertices,
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

