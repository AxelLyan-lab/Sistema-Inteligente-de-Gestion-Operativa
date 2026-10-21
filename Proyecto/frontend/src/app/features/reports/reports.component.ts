import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RegistroEvidencia, TipoEvidencia } from '../../core/models';

@Component({
  selector:        'app-reports',
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
        <h1 class="text-sigo-text font-bold text-lg">Bandeja de Reportes</h1>
        <p class="text-sigo-muted text-xs">Justificaciones de atraso y evidencias en terreno</p>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <span class="px-3 py-1 bg-sigo-surface2 border border-sigo-border rounded-full text-sigo-muted text-xs">
          {{ evidenciasFiltradas().length }} registros
        </span>
      </div>
    </header>

    <div class="flex-1 p-6">

      <!-- Filtros -->
      <div class="card mb-6 flex flex-wrap items-center gap-4">
        <!-- Tipo de evidencia -->
        <div class="flex items-center gap-2">
          <label class="text-sigo-muted text-sm">Tipo:</label>
          <select id="filter-tipo" class="input-field py-2 text-sm w-52" [(ngModel)]="filtroTipo">
            <option value="">Todos</option>
            <option value="JUSTIFICACION_ATRASO">Justificación de atraso</option>
            <option value="EVIDENCIA_BASICA">Evidencia básica</option>
            <option value="EVIDENCIA_IMPORTANTE">Evidencia importante</option>
          </select>
        </div>

        <!-- Solo obligatorias -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" [(ngModel)]="filtroObligatorias"
            class="w-4 h-4 accent-sigo-accent">
          <span class="text-sigo-muted text-sm">Solo obligatorias</span>
        </label>

        <!-- Buscar por sesión -->
        <div class="flex items-center gap-2 flex-1 max-w-xs">
          <svg class="w-4 h-4 text-sigo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="filter-search" type="text" class="input-field py-2 text-sm"
            placeholder="Buscar por ID sesión..." [(ngModel)]="filtroTexto">
        </div>
      </div>

      <!-- Loading -->
      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-2 border-sigo-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      }

      <!-- Grid de evidencias -->
      @if (!cargando()) {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (ev of evidenciasFiltradas(); track ev.id_evidencia) {
            <div class="card hover:border-sigo-accent/40 transition-all duration-200 cursor-pointer group"
                 (click)="abrirDetalle(ev)">

              <!-- Cabecera -->
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ ev.tipo_evidencia === 'JUSTIFICACION_ATRASO' ? '⚠️' : ev.tipo_evidencia === 'EVIDENCIA_IMPORTANTE' ? '🔴' : '📷' }}</span>
                  <div>
                    <p class="text-sigo-text text-sm font-medium">{{ tipoLabel(ev.tipo_evidencia) }}</p>
                    <p class="text-sigo-muted text-xs">Sesión #{{ ev.id_sesion }}</p>
                  </div>
                </div>
                @if (ev.es_obligatoria) {
                  <span class="px-2 py-0.5 bg-emergencia/10 border border-emergencia/30 rounded text-emergencia text-xs">
                    Obligatoria
                  </span>
                }
              </div>

              <!-- Fotografía preview -->
              @if (ev.url_fotografia) {
                <div class="relative mb-3 rounded-lg overflow-hidden bg-sigo-surface2 h-36
                            group-hover:ring-2 group-hover:ring-sigo-accent/30 transition-all">
                  <img [src]="ev.url_fotografia" alt="Evidencia" class="w-full h-full object-cover">
                  <div class="absolute inset-0 bg-gradient-to-t from-sigo-bg/60 to-transparent"></div>
                  <div class="absolute bottom-2 right-2 p-1.5 bg-sigo-bg/80 rounded-lg
                              opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4 text-sigo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                    </svg>
                  </div>
                </div>
              } @else {
                <div class="mb-3 rounded-lg bg-sigo-surface2 h-12 flex items-center justify-center">
                  <span class="text-sigo-muted text-xs">Sin fotografía</span>
                </div>
              }

              <!-- Descripción -->
              @if (ev.descripcion_texto) {
                <p class="text-sigo-muted text-xs line-clamp-2 mb-3">{{ ev.descripcion_texto }}</p>
              }

              <!-- Footer -->
              <div class="flex items-center justify-between text-xs text-sigo-muted border-t border-sigo-border pt-2 mt-2">
                <span>{{ ev.fecha_subida | date:'dd/MM/yy HH:mm' }}</span>
                @if (ev.id_asignacion) {
                  <span>Asig. #{{ ev.id_asignacion }}</span>
                }
              </div>
            </div>
          } @empty {
            <div class="col-span-full text-center py-16">
              <svg class="w-12 h-12 text-sigo-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                     a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p class="text-sigo-muted">No hay evidencias con los filtros actuales</p>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal de detalle -->
    @if (evidenciaDetalle()) {
      <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
           (click)="evidenciaDetalle.set(null)">
        <div class="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sigo-text font-semibold">
              {{ tipoLabel(evidenciaDetalle()!.tipo_evidencia) }}
            </h3>
            <button (click)="evidenciaDetalle.set(null)" class="text-sigo-muted hover:text-sigo-text">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          @if (evidenciaDetalle()!.url_fotografia) {
            <img [src]="evidenciaDetalle()!.url_fotografia!" alt="Evidencia ampliada"
              class="w-full rounded-lg object-cover max-h-80 mb-4">
          }

          <div class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-sigo-surface2 rounded-lg p-3">
                <p class="text-sigo-muted text-xs mb-1">Sesión</p>
                <p class="text-sigo-text font-mono">#{{ evidenciaDetalle()!.id_sesion }}</p>
              </div>
              <div class="bg-sigo-surface2 rounded-lg p-3">
                <p class="text-sigo-muted text-xs mb-1">Asignación</p>
                <p class="text-sigo-text font-mono">{{ evidenciaDetalle()!.id_asignacion ? '#' + evidenciaDetalle()!.id_asignacion : 'N/A' }}</p>
              </div>
              <div class="bg-sigo-surface2 rounded-lg p-3">
                <p class="text-sigo-muted text-xs mb-1">Fecha de subida</p>
                <p class="text-sigo-text">{{ evidenciaDetalle()!.fecha_subida | date:'dd/MM/yyyy HH:mm:ss' }}</p>
              </div>
              <div class="bg-sigo-surface2 rounded-lg p-3">
                <p class="text-sigo-muted text-xs mb-1">Obligatoria</p>
                <p [class.text-emergencia]="evidenciaDetalle()!.es_obligatoria"
                   [class.text-sigo-muted]="!evidenciaDetalle()!.es_obligatoria">
                  {{ evidenciaDetalle()!.es_obligatoria ? 'Sí' : 'No' }}
                </p>
              </div>
            </div>
            @if (evidenciaDetalle()!.descripcion_texto) {
              <div class="bg-sigo-surface2 rounded-lg p-3">
                <p class="text-sigo-muted text-xs mb-2">Descripción del funcionario</p>
                <p class="text-sigo-text leading-relaxed">{{ evidenciaDetalle()!.descripcion_texto }}</p>
              </div>
            }
          </div>
        </div>
      </div>
    }
  </div>
  `,
})
export class ReportsComponent implements OnInit {
  readonly apiService  = inject(ApiService);
  readonly authService = inject(AuthService);

  readonly cargando         = signal(false);
  readonly evidencias        = signal<RegistroEvidencia[]>([]);
  readonly evidenciaDetalle  = signal<RegistroEvidencia | null>(null);

  filtroTipo        = '';
  filtroObligatorias = false;
  filtroTexto       = '';

  readonly evidenciasFiltradas = computed(() =>
    this.evidencias().filter(ev => {
      const matchTipo = !this.filtroTipo || ev.tipo_evidencia === this.filtroTipo;
      const matchObl  = !this.filtroObligatorias || ev.es_obligatoria;
      const matchText = !this.filtroTexto ||
        ev.id_sesion.toString().includes(this.filtroTexto);
      return matchTipo && matchObl && matchText;
    })
  );

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.apiService.getJustificaciones();
      this.evidencias.set(data);
    } finally {
      this.cargando.set(false);
    }
  }

  tipoLabel(tipo: TipoEvidencia): string {
    const labels: Record<TipoEvidencia, string> = {
      [TipoEvidencia.JUSTIFICACION_ATRASO]:  'Justificación de Atraso',
      [TipoEvidencia.EVIDENCIA_BASICA]:      'Evidencia Básica',
      [TipoEvidencia.EVIDENCIA_IMPORTANTE]:  'Evidencia Importante',
    };
    return labels[tipo] ?? tipo;
  }

  abrirDetalle(ev: RegistroEvidencia): void {
    this.evidenciaDetalle.set(ev);
  }
}
