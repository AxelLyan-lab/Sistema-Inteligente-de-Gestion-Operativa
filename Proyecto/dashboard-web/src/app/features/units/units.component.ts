import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { DispatchModalComponent } from '../../shared/components/dispatch-modal/dispatch-modal.component';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  SesionOperativa, EstadoOperativo, TipoTransporte,
  ESTADO_CONFIG, EstadoConfig,
} from '../../core/models';

@Component({
  selector:        'app-units',
  standalone:      true,
  imports:         [CommonModule, RouterModule, FormsModule, NavbarComponent, IconComponent, DispatchModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="min-h-screen bg-sigo-bg text-sigo-text flex flex-col select-none">
    <app-navbar></app-navbar>

    <div class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
              <app-icon name="unidades" [size]="18" [stroke]="1.8"></app-icon>
            </div>
            <div>
              <h1 class="text-lg font-bold text-sigo-text">Gestión de Unidades Operativas</h1>
              <p class="text-xs text-sigo-muted">Dotación, tripulación y estado táctico de patrullaje</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="px-3 py-1.5 bg-sigo-surface border border-sigo-border rounded-lg text-sigo-muted text-xs font-medium">
            {{ sesionesFiltradas().length }} sesiones activas
          </span>
          <button (click)="cargar()" class="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
            <app-icon name="mira" [size]="14"></app-icon>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas de resumen -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        @for (est of estadosResumen; track est.estado) {
          <div
            class="card text-center cursor-pointer hover:border-sigo-accent/40 transition-all p-3"
            [class.border-sigo-accent]="filtroEstado() === est.estado"
            (click)="filtroEstado.set(filtroEstado() === est.estado ? '' : est.estado)"
          >
            <div class="text-xl font-bold mb-0.5" [style.color]="est.config.dotColor">
              {{ conteo(est.estado) }}
            </div>
            <div class="text-[11px] text-sigo-muted font-medium">{{ est.config.label }}</div>
          </div>
        }
      </div>

      <!-- Filtros -->
      <div class="card p-3 flex flex-wrap items-center gap-3 text-xs">
        <div class="flex items-center gap-2">
          <label class="text-sigo-muted font-medium">Estado:</label>
          <select
            id="filter-estado"
            class="input-field py-1.5 text-xs w-40"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
          >
            <option value="">Todos</option>
            @for (est of estadosResumen; track est.estado) {
              <option [value]="est.estado">{{ est.config.label }}</option>
            }
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sigo-muted font-medium">Transporte:</label>
          <select
            id="filter-transporte"
            class="input-field py-1.5 text-xs w-32"
            [ngModel]="filtroTransporte()"
            (ngModelChange)="filtroTransporte.set($event)"
          >
            <option value="">Todos</option>
            <option value="PATRULLA">Patrulla</option>
            <option value="MOTO">Moto</option>
            <option value="BICICLETA">Bicicleta</option>
          </select>
        </div>

        <div class="flex items-center gap-2 flex-1 max-w-xs ml-auto">
          <app-icon name="lupa" [size]="14" color="var(--sigo-muted)"></app-icon>
          <input
            id="filter-rut"
            type="text"
            class="input-field py-1.5 text-xs"
            placeholder="Buscar por RUT, nombre o unidad..."
            [ngModel]="filtroTexto()"
            (ngModelChange)="filtroTexto.set($event)"
          />
        </div>
      </div>

      <!-- Loading -->
      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-2 border-sigo-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      }

      <!-- Tabla -->
      @if (!cargando()) {
        <div class="card p-0 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-sigo-border bg-sigo-surface2/60 text-left">
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Unidad</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Conductor</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Tipo</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Misión</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider">Inicio</th>
                  <th class="px-4 py-3 text-sigo-muted font-semibold uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-sigo-border">
                @for (sesion of sesionesFiltradas(); track sesion.id_sesion) {
                  <tr class="hover:bg-sigo-surface2/40 transition-colors">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-sigo-text text-sm">{{ sesion.identificador_unidad }}</span>
                        <span *ngIf="!sesion.es_ficticia" class="text-[10px] text-sigo-muted">#{{ sesion.id_sesion }}</span>
                        <span *ngIf="sesion.es_ficticia" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          RP PRUEBA
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div>
                        <p class="text-sigo-text font-medium">
                          {{ sesion.conductor?.nombre_completo ?? sesion.rut_conductor }}
                        </p>
                        <p class="text-sigo-muted text-[11px] font-mono">
                          {{ sesion.es_ficticia ? 'Simulado / Ficticio' : sesion.rut_conductor }}
                        </p>
                        <!-- Badge de Acompañantes -->
                        <div *ngIf="!sesion.es_ficticia" class="mt-1">
                          <button
                            *ngIf="sesion.tripulacion && sesion.tripulacion.length > 0"
                            (click)="verTripulacion(sesion)"
                            type="button"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sigo-accent/15 text-sigo-accent border border-sigo-accent/30 text-[10px] font-semibold hover:bg-sigo-accent/25 transition-all"
                            title="Haga clic para ver la lista de acompañantes"
                          >
                            <app-icon name="grupo" [size]="11"></app-icon>
                            <span>+{{ sesion.tripulacion.length }} Acompañante{{ sesion.tripulacion.length > 1 ? 's' : '' }}</span>
                          </button>
                          <span
                            *ngIf="!sesion.tripulacion || sesion.tripulacion.length === 0"
                            class="text-[10px] text-sigo-muted"
                          >
                            {{ sesion.tipo_transporte === 'PATRULLA' ? 'Dotación individual (1/3)' : 'Individual (1/1)' }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="flex items-center gap-1.5 text-sigo-text">
                        <app-icon [name]="getTransportIcon(sesion.tipo_transporte)" [size]="16" color="var(--sigo-accent)"></app-icon>
                        <span class="text-[11px] text-sigo-muted">{{ sesion.tipo_transporte }}</span>
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="flex items-center gap-1.5">
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          [style.background]="estadoConf(sesion.estado_operativo).dotColor"
                          [class.badge-blink]="sesion.estado_operativo === 'OCUPADO_EMERGENCIA'"
                        ></span>
                        <span class="text-xs font-semibold" [style.color]="estadoConf(sesion.estado_operativo).dotColor">
                          {{ estadoConf(sesion.estado_operativo).label }}
                        </span>
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span *ngIf="sesion.asignacion_activa" class="text-xs font-medium text-sigo-text">
                        {{ sesion.asignacion_activa.nombre_zona || sesion.asignacion_activa.origen_asignacion }}
                      </span>
                      <span *ngIf="!sesion.asignacion_activa" class="text-sigo-muted text-xs">—</span>
                    </td>
                    <td class="px-4 py-3 text-sigo-muted">
                      {{ sesion.es_ficticia ? 'Sesión Demo' : (sesion.fecha_inicio | date:'dd/MM HH:mm') }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          *ngIf="!sesion.es_ficticia"
                          (click)="verTripulacion(sesion)"
                          class="btn-ghost py-1 px-2 text-[11px] flex items-center gap-1 hover:text-sigo-accent transition-colors"
                          [class.text-sigo-accent]="sesion.tripulacion && sesion.tripulacion.length > 0"
                          title="Ver dotación completa y acompañantes de este servicio"
                        >
                          <app-icon name="grupo" [size]="13"></app-icon>
                          <span>Dotación</span>
                          <span
                            *ngIf="sesion.tripulacion && sesion.tripulacion.length > 0"
                            class="px-1 py-0.2 rounded-full bg-sigo-accent/20 text-sigo-accent text-[9px] font-bold"
                          >
                            +{{ sesion.tripulacion.length }}
                          </span>
                        </button>
                        <button
                          (click)="despachar(sesion)"
                          class="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                          [title]="sesion.es_ficticia ? 'Ver y controlar patrulla en el mapa operacional' : 'Despachar manualmente a una zona focal'"
                        >
                          <app-icon [name]="sesion.es_ficticia ? 'mapa' : 'mira'" [size]="12"></app-icon>
                          <span>{{ sesion.es_ficticia ? 'Ver en Mapa' : 'Despachar' }}</span>
                        </button>
                        <button
                          *ngIf="!sesion.es_ficticia"
                          (click)="irAMensajes(sesion)"
                          class="btn-ghost py-1 px-2 text-[11px]"
                          title="Enviar instrucción táctica"
                        >
                          <app-icon name="mensajes" [size]="12"></app-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="px-4 py-12 text-center text-sigo-muted">
                      No hay unidades operativas con los filtros seleccionados.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Modal Ver Dotación y Acompañantes -->
    <div
      *ngIf="sesionParaTripulacion"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
              <app-icon name="grupo" [size]="18"></app-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-sm text-sigo-text">Dotación Operativa · {{ sesionParaTripulacion.identificador_unidad }}</h3>
                <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sigo-surface border border-sigo-border text-sigo-muted uppercase">
                  {{ sesionParaTripulacion.tipo_transporte }}
                </span>
              </div>
              <p class="text-[11px] text-sigo-muted">Sesión Activa #{{ sesionParaTripulacion.id_sesion }} · Personal asignado a este servicio</p>
            </div>
          </div>
          <button (click)="sesionParaTripulacion = null" class="text-sigo-muted hover:text-sigo-text p-1">
            <app-icon name="cerrar" [size]="16"></app-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <!-- Funcionario a cargo (Conductor Titular) -->
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-sigo-muted block mb-2">
              Funcionario a Cargo / Conductor Titular
            </span>
            <div class="p-3 rounded-xl bg-sigo-surface2/60 border border-sigo-accent/30 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-sigo-accent text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {{ (sesionParaTripulacion.conductor?.nombre_completo || sesionParaTripulacion.rut_conductor).charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h4 class="font-bold text-xs text-sigo-text">
                    {{ sesionParaTripulacion.conductor?.nombre_completo || 'Funcionario Titular' }}
                  </h4>
                  <p class="text-[11px] text-sigo-muted font-mono">
                    {{ sesionParaTripulacion.rut_conductor }} · {{ sesionParaTripulacion.conductor?.grado_cargo || 'Conductor Titular' }}
                  </p>
                </div>
              </div>
              <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sigo-accent/15 text-sigo-accent border border-sigo-accent/30">
                A CARGO
              </span>
            </div>
          </div>

          <!-- Acompañantes asignados -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-sigo-muted">
                Acompañantes Asignados ({{ sesionParaTripulacion.tripulacion?.length || 0 }})
              </span>
              <span
                class="text-[10px] font-semibold"
                [ngClass]="(sesionParaTripulacion.tripulacion?.length || 0) > 0 ? 'text-sigo-accent' : 'text-sigo-muted'"
              >
                {{ sesionParaTripulacion.tipo_transporte === 'PATRULLA' ? 'Máx. 2 acompañantes autorizados' : 'Transporte individual (máx. 0)' }}
              </span>
            </div>

            @if (sesionParaTripulacion.tripulacion && sesionParaTripulacion.tripulacion.length > 0) {
              <div class="space-y-2">
                @for (item of sesionParaTripulacion.tripulacion; track item.id_tripulacion) {
                  <div class="p-3 rounded-xl bg-sigo-surface2/40 border border-sigo-border flex items-center justify-between gap-3 hover:border-sigo-accent/40 transition-all">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-sigo-surface border border-sigo-border text-sigo-text flex items-center justify-center font-bold text-xs">
                        {{ (item.acompanante?.nombre_completo || item.rut_acompanante).charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <h4 class="font-semibold text-xs text-sigo-text">
                          {{ item.acompanante?.nombre_completo || 'Funcionario Acompañante' }}
                        </h4>
                        <p class="text-[11px] text-sigo-muted font-mono">
                          {{ item.rut_acompanante }} · {{ item.acompanante?.grado_cargo || 'Tripulación Operativa' }}
                        </p>
                      </div>
                    </div>
                    <span class="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      EN TURNO
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="p-4 rounded-xl bg-sigo-surface2/30 border border-dashed border-sigo-border text-center space-y-1">
                <app-icon name="grupo" [size]="20" color="var(--sigo-muted)" class="mx-auto block opacity-50"></app-icon>
                <p class="text-xs text-sigo-muted font-medium">Esta unidad opera actualmente con dotación individual.</p>
                <p class="text-[10px] text-sigo-muted opacity-80">
                  {{ sesionParaTripulacion.tipo_transporte === 'PATRULLA' ? 'El conductor puede sumar hasta 2 compañeros desde la app móvil al iniciar turno o en terreno.' : 'Este medio de transporte no admite acompañantes.' }}
                </p>
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-sigo-border bg-sigo-surface2/40 flex items-center justify-between text-xs">
          <span class="text-[11px] text-sigo-muted">
            Dotación total: {{ (sesionParaTripulacion.tripulacion?.length || 0) + 1 }} efectivo(s)
          </span>
          <button (click)="sesionParaTripulacion = null" class="btn-primary text-xs py-1.5 px-4">
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <app-dispatch-modal
      *ngIf="sesionSeleccionadaParaDespacho"
      [sesion]="sesionSeleccionadaParaDespacho"
      (close)="sesionSeleccionadaParaDespacho = null"
      (dispatched)="cargar()"
      (cancelled)="cargar()"
    ></app-dispatch-modal>
  </div>
  `,
})
export class UnitsComponent implements OnInit, OnDestroy {
  private readonly apiService      = inject(ApiService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router          = inject(Router);

  readonly cargando  = signal(false);
  readonly sesiones  = signal<SesionOperativa[]>([]);

  readonly filtroEstado     = signal('');
  readonly filtroTransporte = signal('');
  readonly filtroTexto      = signal('');

  sesionSeleccionadaParaDespacho: SesionOperativa | null = null;
  sesionParaTripulacion: SesionOperativa | null = null;

  private subSesiones?: any;
  private subTripulacion?: any;

  readonly estadosResumen = Object.values(EstadoOperativo).map(e => ({
    estado: e, config: ESTADO_CONFIG[e],
  }));

  readonly sesionesFiltradas = computed(() =>
    this.sesiones().filter(s => {
      const matchEstado = !this.filtroEstado() || s.estado_operativo === this.filtroEstado();
      const matchTrans  = !this.filtroTransporte() || s.tipo_transporte === this.filtroTransporte();
      const matchText   = !this.filtroTexto() ||
        s.rut_conductor.toLowerCase().includes(this.filtroTexto().toLowerCase()) ||
        (s.conductor?.nombre_completo ?? '').toLowerCase().includes(this.filtroTexto().toLowerCase()) ||
        (s.identificador_unidad ?? '').toLowerCase().includes(this.filtroTexto().toLowerCase());
      return matchEstado && matchTrans && matchText;
    })
  );

  conteo     = (estado: EstadoOperativo) => this.sesiones().filter(s => s.estado_operativo === estado).length;
  estadoConf = (estado?: any): EstadoConfig =>
    ESTADO_CONFIG[estado as EstadoOperativo] || ESTADO_CONFIG[EstadoOperativo.DISPONIBLE];

  async ngOnInit(): Promise<void> {
    await this.cargar();

    // Suscribirse a cambios en tiempo real de sesiones y tripulaciones
    this.subSesiones = this.supabaseService.subscribeToSesiones(() => {
      this.cargarSilencioso();
    });

    this.subTripulacion = this.supabaseService.subscribeToTripulacion(() => {
      this.cargarSilencioso();
    });
  }

  ngOnDestroy(): void {
    try {
      this.subSesiones?.unsubscribe?.();
      this.subTripulacion?.unsubscribe?.();
    } catch (e) {
      console.warn('[UnitsComponent] Error during destroy:', e);
    }
  }

  verTripulacion(s: SesionOperativa): void {
    this.sesionParaTripulacion = s;
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      await this.cargarSilencioso();
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarSilencioso(): Promise<void> {
    const data = await this.apiService.getSesionesActivas();

    // Si tenemos el modal de tripulación abierto, refrescar su información
    if (this.sesionParaTripulacion) {
      const actualizada = data.find(s => s.id_sesion === this.sesionParaTripulacion?.id_sesion);
      if (actualizada) {
        this.sesionParaTripulacion = actualizada;
      }
    }

    // Cargar patrullas ficticias / RP de prueba desde localStorage
    let ficticias: any[] = [];
    try {
      const saved = localStorage.getItem('sigo_patrullas_ficticias');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          ficticias = list.map((p: any, idx: number) => ({
            id_sesion: 99000 + idx,
            identificador_unidad: p.nombre || `RP-PRUEBA-${idx + 1}`,
            rut_conductor: 'SIMULADO',
            conductor: {
              rut_usuario: 'SIMULADO',
              nombre_completo: 'Dotación Ficticia',
              rol: 'FUNCIONARIO'
            },
            tipo_transporte: p.tipo || 'PATRULLA',
            estado_operativo: p.estado || 'DISPONIBLE',
            asignacion_activa: p.destinoZone ? {
              id_asignacion: 99000 + idx,
              id_sesion: 99000 + idx,
              nombre_zona: p.destinoZone.name,
              origen_asignacion: p.isManual ? 'MANUAL' : 'ALGORITMO',
              estado: 'EN_CURSO',
              fecha_asignacion: new Date().toISOString()
            } : null,
            fecha_inicio: new Date().toISOString(),
            es_ficticia: true,
            ficticiaRaw: p
          }));
        }
      }
    } catch (e) {
      console.warn('[UnitsComponent] Error leyendo patrullas ficticias:', e);
    }

    this.sesiones.set([...data, ...ficticias]);
  }

  despachar(s: SesionOperativa): void {
    if ((s as any).es_ficticia) {
      this.router.navigate(['/']);
      return;
    }
    this.sesionSeleccionadaParaDespacho = s;
  }

  irAMensajes(s: SesionOperativa): void {
    if ((s as any).es_ficticia) {
      alert('La unidad ' + s.identificador_unidad + ' es un RP de prueba simulado.');
      return;
    }
    this.router.navigate(['/mensajes']);
  }

  getTransportIcon(tipo?: string): string {
    switch (tipo) {
      case 'MOTO': return 'moto';
      case 'BICICLETA': return 'bici';
      case 'INFANTERIA': return 'peaton';
      default: return 'auto';
    }
  }
}
