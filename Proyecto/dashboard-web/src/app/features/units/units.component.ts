import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import {
  SesionOperativa, EstadoOperativo, TipoTransporte,
  ESTADO_CONFIG, EstadoConfig,
} from '../../core/models';

@Component({
  selector:        'app-units',
  standalone:      true,
  imports:         [CommonModule, RouterModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="min-h-screen bg-sigo-bg flex flex-col">

    <!-- Topbar -->
    <header class="bg-sigo-surface border-b border-sigo-border px-6 py-4 flex items-center gap-4">
      <a routerLink="/dashboard" class="text-sigo-muted hover:text-sigo-accent transition-colors mr-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </a>
      <div>
        <h1 class="text-sigo-text font-bold text-lg">Gestión de Unidades</h1>
        <p class="text-sigo-muted text-xs">Historial de sesiones operativas</p>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <span class="px-3 py-1 bg-sigo-surface2 border border-sigo-border rounded-full text-sigo-muted text-xs">
          {{ sesionesFiltradas().length }} sesiones
        </span>
      </div>
    </header>

    <div class="flex-1 p-6">

      <!-- Tarjetas de resumen -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        @for (est of estadosResumen; track est.estado) {
          <div class="card text-center cursor-pointer hover:border-opacity-50 transition-all"
               [style.border-color]="est.config.dotColor + '44'"
               [style.background]="est.config.dotColor + '08'"
               (click)="filtroEstado = filtroEstado === est.estado ? '' : est.estado">
            <div class="text-2xl font-bold mb-1" [style.color]="est.config.dotColor">
              {{ conteo(est.estado) }}
            </div>
            <div class="text-xs text-sigo-muted">{{ est.config.label }}</div>
          </div>
        }
      </div>

      <!-- Filtros -->
      <div class="card mb-4 flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="text-sigo-muted text-sm">Estado:</label>
          <select id="filter-estado" class="input-field py-2 text-sm w-48" [(ngModel)]="filtroEstado">
            <option value="">Todos</option>
            @for (est of estadosResumen; track est.estado) {
              <option [value]="est.estado">{{ est.config.label }}</option>
            }
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sigo-muted text-sm">Transporte:</label>
          <select id="filter-transporte" class="input-field py-2 text-sm w-36" [(ngModel)]="filtroTransporte">
            <option value="">Todos</option>
            <option value="PATRULLA">Patrulla</option>
            <option value="MOTO">Moto</option>
            <option value="BICICLETA">Bicicleta</option>
          </select>
        </div>
        <div class="flex items-center gap-2 flex-1 max-w-xs">
          <svg class="w-4 h-4 text-sigo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="filter-rut" type="text" class="input-field py-2 text-sm"
            placeholder="Buscar por RUT o nombre..." [(ngModel)]="filtroTexto">
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
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-sigo-border text-left">
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">ID</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Conductor</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">IMEI</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Transporte</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Tripulación</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Inicio</th>
                  <th class="px-4 py-3 text-sigo-muted font-medium text-xs uppercase tracking-wider">Cierre</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-sigo-border">
                @for (sesion of sesionesFiltradas(); track sesion.id_sesion) {
                  <tr class="hover:bg-sigo-surface2 transition-colors">
                    <td class="px-4 py-3 text-sigo-muted font-mono text-xs">#{{ sesion.id_sesion }}</td>
                    <td class="px-4 py-3">
                      <div>
                        <p class="text-sigo-text font-medium">
                          {{ sesion.conductor?.nombre_completo ?? sesion.rut_conductor }}
                        </p>
                        <p class="text-sigo-muted text-xs font-mono">{{ sesion.rut_conductor }}</p>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sigo-muted font-mono text-xs">{{ sesion.imei_simcard }}</td>
                    <td class="px-4 py-3">
                      <span class="flex items-center gap-1.5 text-sigo-text">
                        {{ sesion.tipo_transporte === 'PATRULLA' ? '🚓' : sesion.tipo_transporte === 'MOTO' ? '🏍️' : '🚲' }}
                        <span class="text-xs text-sigo-muted">{{ sesion.tipo_transporte }}</span>
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full"
                          [style.background]="estadoConf(sesion.estado_operativo).dotColor"
                          [class.badge-blink]="sesion.estado_operativo === 'OCUPADO_EMERGENCIA'">
                        </span>
                        <span class="text-xs" [style.color]="estadoConf(sesion.estado_operativo).dotColor">
                          {{ estadoConf(sesion.estado_operativo).label }}
                        </span>
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      @if (sesion.tripulacion && sesion.tripulacion.length) {
                        <div class="flex flex-wrap gap-1">
                          @for (t of sesion.tripulacion; track t.id_tripulacion) {
                            <span class="px-1.5 py-0.5 bg-sigo-surface2 border border-sigo-border rounded text-xs text-sigo-muted">
                              {{ t.rut_acompanante }}
                            </span>
                          }
                        </div>
                      } @else {
                        <span class="text-sigo-muted text-xs">—</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-sigo-muted text-xs">
                      {{ sesion.fecha_inicio | date:'dd/MM HH:mm' }}
                    </td>
                    <td class="px-4 py-3 text-sigo-muted text-xs">
                      {{ sesion.fecha_cierre ? (sesion.fecha_cierre | date:'dd/MM HH:mm') : '—' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="px-4 py-12 text-center text-sigo-muted">
                      No hay sesiones con los filtros actuales
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  </div>
  `,
})
export class UnitsComponent implements OnInit {
  readonly apiService = inject(ApiService);

  readonly cargando  = signal(false);
  readonly sesiones  = signal<SesionOperativa[]>([]);

  filtroEstado     = '';
  filtroTransporte = '';
  filtroTexto      = '';

  readonly estadosResumen = Object.values(EstadoOperativo).map(e => ({
    estado: e, config: ESTADO_CONFIG[e],
  }));

  readonly sesionesFiltradas = computed(() =>
    this.sesiones().filter(s => {
      const matchEstado = !this.filtroEstado || s.estado_operativo === this.filtroEstado;
      const matchTrans  = !this.filtroTransporte || s.tipo_transporte === this.filtroTransporte;
      const matchText   = !this.filtroTexto ||
        s.rut_conductor.toLowerCase().includes(this.filtroTexto.toLowerCase()) ||
        (s.conductor?.nombre_completo ?? '').toLowerCase().includes(this.filtroTexto.toLowerCase());
      return matchEstado && matchTrans && matchText;
    })
  );

  conteo      = (estado: EstadoOperativo) => this.sesiones().filter(s => s.estado_operativo === estado).length;
  estadoConf  = (estado: EstadoOperativo): EstadoConfig => ESTADO_CONFIG[estado];

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.apiService.getSesionesActivas();
      this.sesiones.set(data);
    } finally {
      this.cargando.set(false);
    }
  }
}
