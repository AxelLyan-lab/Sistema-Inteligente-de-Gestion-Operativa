import {
  Component, OnInit, OnDestroy, AfterViewInit, inject,
  ChangeDetectionStrategy, signal, ViewChild, ElementRef, computed, effect, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardStore, PatrullaFicticia } from './store/dashboard.store';
import { ApiService } from '../../core/services/api.service';
import { MqttService } from '../../core/services/mqtt.service';
import { MapService, HotspotZone, HOTSPOT_ZONES, getRisk, findMatchingHotspotZone } from '../../core/services/map.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { environment } from '../../../environments/environment';
import { SoundService } from '../../core/services/sound.service';
import { MessageBadgeService } from '../../core/services/message-badge.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { DispatchModalComponent } from '../../shared/components/dispatch-modal/dispatch-modal.component';
import { SettingsService } from '../../core/services/settings.service';
import {
  SesionOperativa, AlertaEmergencia, AsignacionTactica,
  ESTADO_CONFIG, EstadoOperativo, EstadoMision, MISION_CONFIG,
  calcularUveSesion, TipoMedio, CONFIG_MEDIOS_UVE,
} from '../../core/models';

export interface TacticalToast {
  id: string;
  type: 'SOS' | 'MENSAJE';
  titulo: string;
  subtitulo: string;
  hora: string;
}

const MAX_PATRULLAS = 6;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NavbarComponent, IconComponent, DispatchModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="h-screen flex flex-col bg-sigo-bg text-sigo-text overflow-hidden select-none">
    <!-- Navbar unificada -->
    <app-navbar></app-navbar>

    <!-- Sub-Barra de Estado Táctico -->
    <div class="flex items-center justify-between px-4 py-2 bg-sigo-surface2/60 border-b border-sigo-border text-xs z-10">
      <!-- Estadísticas de Patrullaje + Widget Balance de Capacidad U.V.E. en Tiempo Real -->
      <div class="flex items-center gap-2 overflow-x-auto">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sigo-accent/15 border border-sigo-accent/40 text-sigo-accent shrink-0">
          <app-icon name="escudo" [size]="13" color="var(--sigo-accent)"></app-icon>
          <span class="font-bold">U.V.E. Total Disponible: {{ store.ofertaTotalUve() | number:'1.2-2' }} U.V.E.</span>
        </div>

        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 shrink-0">
          <span class="w-2 h-2 rounded-full bg-patrullando"></span>
          <span class="text-sigo-muted font-medium">U.V.E. Real de Zonas:</span>
          <span class="font-bold text-sigo-text">{{ uveRequeridaTotalZonas() | number:'1.2-2' }} U.V.E.</span>
          @if (diferenciaGlobalZonas() < -0.001) {
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold shadow-xs">
              Falta {{ diferenciaGlobalZonas() | number:'1.2-2' }} U.V.E.
            </span>
          } @else if (diferenciaGlobalZonas() > 0.001) {
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-extrabold shadow-xs">
              Sobra +{{ diferenciaGlobalZonas() | number:'1.2-2' }} U.V.E.
            </span>
          } @else if (coberturaZonasActivas().length > 0) {
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold shadow-xs">
              Cubierto
            </span>
          }
        </div>

        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 shrink-0">
          <span class="w-2 h-2 rounded-full bg-disponible"></span>
          <span class="text-sigo-muted font-medium">U.V.E. en Reserva:</span>
          <span class="font-bold text-emerald-400">{{ store.uveEnReserva() | number:'1.2-2' }}</span>
        </div>
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sigo-surface border border-sigo-border whitespace-nowrap shrink-0">
          <span class="text-sigo-muted">Móviles:</span>
          <span class="font-bold text-sigo-text">{{ totalDisponibles() }} disp · {{ totalEnRuta() }} ruta · {{ totalPatrullando() }} zona</span>
        </div>
        @if (store.conteoEmergencia() > 0) {
          <div class="flex items-center gap-2 whitespace-nowrap shrink-0">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emergencia/15 border border-emergencia/40 text-emergencia font-bold badge-blink">
              <span class="w-2 h-2 rounded-full bg-emergencia"></span>
              <span>{{ store.conteoEmergencia() }} SOS</span>
            </div>
            @if (soundService.isSosLooping) {
              <button
                (click)="silenciarSirena()"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md cursor-pointer whitespace-nowrap"
                title="Silenciar sirena (la emergencia sigue activa)"
              >
                <app-icon name="alerta" [size]="13"></app-icon>
                <span>Silenciar</span>
              </button>
            } @else {
              <span class="text-[11px] text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <span>🔕 Silenciada</span>
              </span>
            }
          </div>
        }
      </div>

      <!-- Cuenta regresiva de ciclo y Botón SOS -->
      <div class="flex items-center gap-2.5 shrink-0">
        @if (mapService.mapLoaded()) {
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sigo-surface border border-sigo-border text-xs">
            <app-icon name="reloj" [size]="13" color="var(--sigo-accent)"></app-icon>
            <span class="text-sigo-muted font-medium">Rotación zonas:</span>
            @if (modoDespacho() === 'MANUAL') {
              <span class="font-bold text-sigo-muted">Pausada (Manual)</span>
            } @else {
              <span class="font-mono font-bold text-sigo-accent tabular-nums">{{ mapService.cycleCountdown() }}s</span>
            }
          </div>
        }

        <button
          (click)="store.showSOSDrawer.set(!store.showSOSDrawer())"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer"
          [ngClass]="store.tieneEmergenciaActiva() ? 'border-emergencia bg-emergencia text-white font-bold' : 'border-sigo-border text-sigo-muted hover:text-sigo-text'"
        >
          <app-icon name="alerta" [size]="14"></app-icon>
          <span>Panel Refuerzos / SOS</span>
          <span *ngIf="store.tieneEmergenciaActiva()" class="px-1.5 py-0.2 rounded-full bg-white text-emergencia text-[10px] font-bold">
            {{ store.alertasActivasCount() }}
          </span>
        </button>
      </div>
    </div>

    <!-- Contenedor Mapa + Lateral -->
    <div class="flex flex-1 overflow-hidden relative">

      <!-- Controles flotantes sobre el mapa (Capas y Focalizar) -->
      <div class="absolute top-4 left-4 z-10 glass rounded-xl p-3 space-y-2.5 shadow-card max-w-xs">
        <div
          (click)="minimizarCapasTacticas.set(!minimizarCapasTacticas())"
          class="flex items-center justify-between gap-3 cursor-pointer select-none"
          title="Click para minimizar o mostrar el panel táctico"
        >
          <p class="text-sigo-muted text-[10px] font-bold uppercase tracking-wider">Capas Tácticas</p>
          <span class="px-1.5 py-0.5 rounded bg-sigo-surface2 border border-sigo-border text-sigo-muted text-[9px] font-bold hover:text-sigo-text">
            {{ minimizarCapasTacticas() ? 'Mostrar ▼' : 'Minimizar ▲' }}
          </span>
        </div>
        @if (!minimizarCapasTacticas()) {
          <div class="space-y-1.5">
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" [checked]="store.layerHeatmap()" (change)="toggleLayer('heatmap', $any($event.target).checked)" class="rounded" />
            <app-icon name="fuego" [size]="14" color="#dc2626"></app-icon>
            <span class="text-sigo-text">Mapa de Calor (Delitos)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" [checked]="store.layerSimcards()" (change)="toggleLayer('simcards', $any($event.target).checked)" class="rounded" />
            <app-icon name="auto" [size]="14" color="var(--sigo-accent)"></app-icon>
            <span class="text-sigo-text">Unidades Operativas</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" [checked]="store.layerPolygons()" (change)="toggleLayer('polygons', $any($event.target).checked)" class="rounded" />
            <app-icon name="zonas" [size]="14" color="#d97706"></app-icon>
            <span class="text-sigo-text">Zonas y Puntos Críticos</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs border-t border-sigo-border/60 pt-2 mt-1">
            <input type="checkbox" [checked]="mapService.layerFlatMap()" (change)="toggleLayer('flatmap', $any($event.target).checked)" class="rounded" />
            <app-icon name="mapa" [size]="14" color="#94a3b8"></app-icon>
            <span class="text-sigo-text font-semibold">Modo Plano</span>
          </label>
          </div>

        <!-- Prioridad Zonas y Cobertura U.V.E. (Minimalista: primero déficit/exceso, luego cubiertas por riesgo) -->
        @if (coberturaZonasActivas().length > 0) {
          <div class="pt-2 border-t border-sigo-border/60 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-[10px]">
              <span class="text-sigo-muted font-bold uppercase tracking-wider">Prioridad y Cobertura U.V.E.</span>
              <span class="text-sigo-muted font-semibold">{{ coberturaZonasActivas().length }} activas</span>
            </div>

            <div class="space-y-1 max-h-52 overflow-y-auto pr-0.5">
              <div
                *ngFor="let item of coberturaZonasActivas(); trackBy: trackByCoberturaZona"
                (click)="mapService.centerOn(item.zona.lat, item.zona.lng, 16)"
                class="px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors flex items-center justify-between gap-2"
                [ngClass]="
                  item.deficitUve > 0.001
                    ? 'bg-red-500/10 border-red-500/40 hover:border-red-400'
                    : item.excesoUve > 0.001
                      ? 'bg-indigo-500/10 border-indigo-500/40 hover:border-indigo-400'
                      : 'bg-sigo-surface/70 border-sigo-border/70 hover:border-sigo-accent/50'
                "
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full shrink-0" [style.background]="getRiskColor(item.zona.crimeCount)"></span>
                    <span class="font-bold text-sigo-text truncate">{{ item.zona.name }}</span>
                    <span class="text-[9px] text-sigo-muted font-semibold">{{ item.nivelRiesgo }}</span>
                  </div>
                  <div class="text-[9px] text-sigo-muted truncate pl-3.5">
                    {{ item.unidades.length > 0 ? item.resumenUnidades : 'Sin móvil asignado' }}
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  @if (item.deficitUve > 0.001) {
                    <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold text-[9px]">
                      Falta -{{ item.deficitUve | number:'1.2-2' }}
                    </span>
                  } @else if (item.excesoUve > 0.001) {
                    <span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-extrabold text-[9px]">
                      Sobra +{{ item.excesoUve | number:'1.2-2' }}
                    </span>
                  } @else {
                    <span class="px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold text-[9px]">
                      @if (item.nivelRiesgo === 'MEDIO') {
                        {{ item.uveAsignada | number:'1.2-2' }} / 0.45-0.80
                      } @else if (item.nivelRiesgo === 'BAJO') {
                        {{ item.uveAsignada | number:'1.2-2' }} / 0.20-0.30
                      } @else {
                        {{ item.uveAsignada | number:'1.2-2' }}/{{ item.uveRequerida | number:'1.2-2' }}
                      }
                    </span>
                  }
                </div>
              </div>
            </div>
          </div>
        }
        }

      </div>

      <!-- Canvas de Google Maps -->
      <div #mapCanvas id="map-canvas" class="flex-1 relative">
        @if (!mapService.mapLoaded()) {
          <div class="absolute inset-0 flex items-center justify-center bg-sigo-bg z-10">
            <div class="text-center">
              <div class="w-10 h-10 border-2 border-sigo-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sigo-muted text-xs">Cargando mapa operacional de Viña del Mar...</p>
            </div>
          </div>
        }
      </div>

      <!-- Panel Lateral Derecho: Unidades -->
      <aside class="w-80 flex-shrink-0 bg-sigo-surface border-l border-sigo-border flex flex-col overflow-hidden z-10">
        <div class="px-4 py-3 border-b border-sigo-border flex items-center justify-between">
          <div>
            <h2 class="text-sigo-text font-bold text-xs uppercase tracking-wider">Unidades en Servicio</h2>
            <p class="text-sigo-muted text-[11px]">{{ totalUnidadesActivas() }} móviles operativos</p>
          </div>
          <button
            (click)="showAddPatrolModal.set(true)"
            [disabled]="patrullasFicticias().length >= MAX_PATRULLAS"
            class="btn-ghost p-1.5 rounded-lg text-xs"
            title="Agregar patrulla demo simulada"
          >
            <app-icon name="mas" [size]="14"></app-icon>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
          <!-- Patrullas DEMO -->
          @for (p of patrullasFicticias(); track p.id) {
            <div
              class="p-2.5 rounded-xl border border-dashed cursor-pointer transition-all flex items-center justify-between gap-2"
              [class.border-disponible]="p.estado === 'DISPONIBLE'"
              [class.border-en-ruta]="p.estado === 'EN_RUTA'"
              [class.border-patrullando]="p.estado === 'PATRULLANDO'"
              (click)="selectPatrullaFicticia(p)"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div class="w-8 h-8 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent shrink-0">
                  <app-icon [name]="getTransportIcon(p.tipo_medio || p.tipo)" [size]="16"></app-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-xs text-sigo-text truncate">{{ p.nombre }}</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-sigo-accent/15 text-sigo-accent font-extrabold border border-sigo-accent/30 whitespace-nowrap">
                      {{ getFicticiaMedioCode(p) }} · {{ getFicticiaUve(p) | number:'1.2-2' }}
                    </span>
                    @if (p.destinoZone?.id === 9999) {
                      <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold animate-pulse">🚨 SOS</span>
                    } @else if (p.isManual) {
                      <span class="text-[9px] px-1 rounded bg-blue-600 text-white font-bold">MANUAL</span>
                    }
                  </div>
                  <div class="flex items-center gap-1 text-[11px] text-sigo-muted mt-0.5">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="fColor(p.estado)"></span>
                    <span class="whitespace-nowrap">{{ fLabel(p.estado) }}</span>
                    @if (p.destinoZone) {
                      <span class="font-bold text-sigo-text truncate">· {{ p.destinoZone.name }}</span>
                    }
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                @if (p.estado !== 'DISPONIBLE') {
                  <button
                    (click)="$event.stopPropagation(); terminarRondaFicticia(p.id)"
                    class="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer shadow-xs"
                    title="Terminar ronda manualmente y dejar disponible"
                  >
                    Terminar
                  </button>
                }
                <button (click)="$event.stopPropagation(); mapService.centerOn(p.lat, p.lng)" class="text-sigo-muted hover:text-sigo-accent p-1" title="Centrar mapa">
                  <app-icon name="mira" [size]="14"></app-icon>
                </button>
              </div>
            </div>
          }

          <!-- Separador -->
          @if (patrullasFicticias().length > 0 && store.unidades().length > 0) {
            <div class="px-2 py-1">
              <span class="text-[10px] text-sigo-muted uppercase tracking-wider font-semibold">Unidades Reales</span>
            </div>
          }

          <!-- Unidades Reales -->
          @for (unidad of store.unidades(); track unidad.id_sesion) {
            <div
              class="p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
              [ngClass]="store.unidadSeleccionada()?.id_sesion === unidad.id_sesion ? 'bg-sigo-surface2 border-sigo-accent shadow-sm' : 'border-sigo-border'"
              (click)="selectUnidad(unidad)"
            >
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent">
                  <app-icon [name]="getTransportIcon(unidad.tipo_medio || unidad.tipo_transporte)" [size]="16"></app-icon>
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <p class="font-bold text-xs text-sigo-text truncate max-w-[95px]">
                      {{ unidad.identificador_unidad }}
                    </p>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-sigo-accent/15 text-sigo-accent font-extrabold border border-sigo-accent/30">
                      {{ getUnidadUveInfo(unidad).tipoMedio }} · {{ getUnidadUveInfo(unidad).valorUve | number:'1.2-2' }} U.V.E.
                    </span>
                  </div>
                  <p class="text-[10px] text-sigo-muted truncate max-w-[140px]">
                    {{ unidad.conductor?.nombre_completo ?? unidad.rut_conductor }} ({{ getUnidadUveInfo(unidad).dotacionTotal }} func.)
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                @if (dispatchCountdown().has(unidad.id_sesion)) {
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-bold border animate-pulse"
                    [ngClass]="(dispatchCountdown().get(unidad.id_sesion) ?? 0) >= 0 ? 'bg-en-ruta/20 text-en-ruta border-en-ruta/40' : 'bg-red-500/20 text-red-400 border-red-500/40'"
                    [title]="(dispatchCountdown().get(unidad.id_sesion) ?? 0) >= 0 ? 'Tiempo restante de traslado hacia la zona' : 'Demora acumulada respecto al tiempo límite asignado'"
                  >
                    {{ (dispatchCountdown().get(unidad.id_sesion) ?? 0) >= 0
                        ? 'En camino (' + formatDispatchTime(dispatchCountdown().get(unidad.id_sesion)!) + ')'
                        : 'Demora (' + formatDispatchTime(dispatchCountdown().get(unidad.id_sesion)!) + ')' }}
                  </span>
                } @else {
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        [style.background]="estadoConfig(unidad.estado_operativo).dotColor + '22'"
                        [style.color]="estadoConfig(unidad.estado_operativo).dotColor">
                    {{ unidad.estado_operativo === 'PATRULLANDO_ZONA' && getAsignacionActiva(unidad)?.nombre_zona
                        ? 'En zona · ' + getAsignacionActiva(unidad)?.nombre_zona
                        : estadoConfig(unidad.estado_operativo).label }}
                  </span>
                }
                <button (click)="$event.stopPropagation(); centerOnUnit(unidad)" class="text-sigo-muted hover:text-sigo-accent p-1">
                  <app-icon name="mira" [size]="14"></app-icon>
                </button>
              </div>
            </div>
          } @empty {
            @if (patrullasFicticias().length === 0) {
              <div class="py-12 px-4 text-center text-sigo-muted text-xs space-y-1">
                <app-icon name="unidades" [size]="28" [stroke]="1.2"></app-icon>
                <p class="font-semibold text-sigo-text">Sin unidades conectadas</p>
                <p>Las patrullas que inicien sesión desde la app móvil aparecerán aquí.</p>
              </div>
            }
          }
        </div>

        <!-- Modos de Despacho Automático U.V.E. -->
        <div class="p-3 border-t border-sigo-border bg-sigo-surface2/50 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-sigo-muted">
              Control de Despacho
            </span>
            @if (modoDespacho() === 'AUTO') {
              <span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-extrabold">
                AUTOMÁTICO
              </span>
            } @else if (modoDespacho() === 'OPTIMIZADO') {
              <span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-extrabold">
                AUTO OPTIMIZADO
              </span>
            } @else {
              <span class="px-1.5 py-0.5 rounded bg-sigo-surface border border-sigo-border text-sigo-muted text-[9px] font-bold">
                MANUAL
              </span>
            }
          </div>

          @if (propuestaOptimaAuto(); as prop) {
            <div class="p-2 rounded-lg bg-sigo-surface border border-sigo-border/80 text-[10px] space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-sigo-muted">Sobrante / Reserva:</span>
                <span class="font-bold text-emerald-400">
                  {{ prop.sobrantes.length }} móvil(es) · {{ prop.uveSobrante | number:'1.2-2' }} U.V.E.
                </span>
              </div>
              @if (prop.recomendacionUnidad) {
                <div class="p-1.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold text-[9px] leading-snug">
                  ⚠️ Déficit {{ prop.uveFaltante | number:'1.2-2' }} U.V.E.: Se recomienda agregar <strong>{{ prop.recomendacionUnidad }}</strong>
                </div>
              } @else {
                <div class="text-[9px] text-emerald-400 font-semibold">
                  ✓ Cobertura óptima alcanzada con los recursos actuales.
                </div>
              }
            </div>
          }

          @if (confirmandoModo() === null && modoDespacho() === 'MANUAL') {
            <div class="grid grid-cols-2 gap-1.5">
              <button
                (click)="confirmandoModo.set('AUTO')"
                class="py-2 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm"
              >
                ⚡ Automático
              </button>
              <button
                (click)="abrirModalOptimizado()"
                class="py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm"
              >
                🎯 Auto Optimizado
              </button>
            </div>
          } @else if (confirmandoModo() === 'AUTO') {
            <div class="p-2.5 rounded-lg bg-indigo-950/95 border border-indigo-500 space-y-2 text-[10px]">
              <p class="font-bold text-white">¿Confirmar Modo Automático?</p>
              <p class="text-indigo-200 leading-snug">
                Se enviarán TODAS las unidades que iniciaron sesión a las zonas activas según prioridad de riesgo.
              </p>
              <div class="flex items-center gap-2">
                <button
                  (click)="confirmandoModo.set(null)"
                  class="flex-1 py-1.5 rounded bg-sigo-surface border border-sigo-border text-sigo-text font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  (click)="aplicarModoDespacho('AUTO')"
                  class="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          } @else {
            <button
              (click)="desactivarModoAutomatico()"
              class="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
            >
              Desactivar (Volver a Manual)
            </button>
          }
        </div>
      </aside>

      <!-- MODAL CENTRADO: Confirmar Resolución de Emergencia SOS -->
      @if (alertaPorResolver(); as idResolver) {
        <div class="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-sigo-surface border border-sigo-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <app-icon name="check" [size]="18"></app-icon>
              </div>
              <div>
                <h3 class="text-sm font-extrabold text-sigo-text">Confirmar Emergencia Resuelta</h3>
                <p class="text-[11px] text-sigo-muted">Alerta SOS #{{ idResolver }}</p>
              </div>
            </div>
            <p class="text-xs text-sigo-muted leading-relaxed">
              ¿Confirmas que la emergencia ha sido controlada? Se notificará a la unidad solicitante y se liberarán los móviles de apoyo.
            </p>
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-sigo-border">
              <button
                (click)="alertaPorResolver.set(null)"
                class="px-3.5 py-1.5 rounded-lg border border-sigo-border text-xs font-semibold text-sigo-muted hover:text-sigo-text cursor-pointer"
              >
                Cancelar
              </button>
              <button
                (click)="resolverAlerta(idResolver)"
                class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirmar Resuelta
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: Confirmación Avanzada Modo Automático Optimizado -->
      @if (confirmandoModo() === 'OPTIMIZADO') {
        @if (analisisModoOptimizado(); as plan) {
          <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div class="bg-sigo-surface border border-sigo-border rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-sigo-border pb-3">
                <div>
                  <h3 class="text-sm font-extrabold text-sigo-text">🎯 Modo Automático Optimizado (Margen ±{{ plan.toleranciaUve | number:'1.2-2' }} U.V.E.)</h3>
                  <p class="text-[11px] text-sigo-muted">
                    Cálculo optimizado según las {{ plan.kZonas }} zonas configuradas en Ajustes, aprovechando al máximo los recursos activos.
                  </p>
                </div>
                <span class="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                  {{ plan.kZonas }} Zonas Config.
                </span>
              </div>

              @if (avisoCierreSesionOpt(); as baja) {
                <div class="p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-100 text-xs space-y-2 animate-fade-in">
                  <div class="flex items-center justify-between">
                    <span class="font-extrabold text-red-300 uppercase text-[11px]">
                      🚨 Alerta de Algoritmo: Baja de Unidad en Servicio
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                      -{{ baja.uve | number:'1.2-2' }} U.V.E.
                    </span>
                  </div>
                  <p class="text-[11px] leading-snug">
                    El funcionario <b>{{ baja.conductor }}</b> cerró sesión en la unidad <b>{{ baja.unidad }} ({{ baja.tipo }})</b>{{ baja.zona ? ', dejando descubierta la zona ' + baja.zona : '' }}.
                    Elija si desea agregar una unidad de reemplazo o continuar optimizando con los recursos actuales:
                  </p>
                  <div class="flex items-center gap-2 pt-1">
                    <button
                      (click)="continuarOptimizadoConLoQueHay()"
                      class="flex-1 py-1.5 px-2.5 rounded-lg bg-sigo-surface hover:bg-sigo-surface2 border border-red-400/50 text-red-100 font-bold text-[11px] cursor-pointer"
                    >
                      ⚡ Dejar vacío y Optimizar con lo que hay
                    </button>
                    <button
                      (click)="confirmarOptimizadoConDemos()"
                      class="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      🤖 Reemplazar con Unidad Demo
                    </button>
                  </div>
                </div>
              }

              <div class="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
                <!-- 0. Análisis Probabilístico del Catálogo Total de Zonas -->
                <div class="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/40 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <p class="font-bold text-indigo-300 text-[11px] uppercase">
                      📊 Análisis Probabilístico del Catálogo ({{ plan.resumenCatalogo.total }} Zonas Registradas)
                    </p>
                    <span class="text-[10px] text-indigo-200 font-semibold">
                      Rotación de {{ plan.kZonas }} zona(s) por ronda
                    </span>
                  </div>
                  <p class="text-[10px] text-indigo-100/90 leading-snug">
                    Catálogo total: <b>{{ plan.resumenCatalogo.altas }} ALTO</b> ({{ plan.resumenCatalogo.probAlta }}%) ·
                    <b>{{ plan.resumenCatalogo.medias }} MEDIO</b> ({{ plan.resumenCatalogo.probMedia }}%) ·
                    <b>{{ plan.resumenCatalogo.bajas }} BAJO</b> ({{ plan.resumenCatalogo.probBaja }}%).
                    Cupos óptimos por ciclo: <b>{{ plan.resumenCatalogo.cuposTexto }}</b>.
                  </p>
                </div>

                <!-- 1. Asignación Optimizada por Zona Configurada -->
                <div class="p-3 rounded-xl bg-sigo-surface2 border border-sigo-border space-y-1.5">
                  <div class="flex items-center justify-between">
                    <p class="font-bold text-emerald-400 text-[11px] uppercase">✓ Distribución Optimizada en las {{ plan.kZonas }} Zonas</p>
                    <span class="text-[10px] text-sigo-muted">Tolerancia operativa: ±{{ plan.toleranciaUve | number:'1.2-2' }} U.V.E.</span>
                  </div>
                  @for (asig of plan.asignadasPorZona; track asig.zonaNombre) {
                    <div class="flex items-center justify-between text-[11px] text-sigo-text py-1 border-b border-sigo-border/40 last:border-b-0 gap-2">
                      <div>
                        <b>{{ asig.zonaNombre }}</b>
                        <span class="text-[10px] text-sigo-muted ml-1">({{ asig.nivelRiesgo }} · Meta {{ asig.uveRequerida | number:'1.2-2' }} · Máx {{ asig.uveMaxConMargen | number:'1.2-2' }})</span>
                      </div>
                      <span class="font-bold text-sigo-accent text-right">{{ asig.resumenUnidades }}</span>
                    </div>
                  }
                </div>

                <!-- 2. Unidades que NO se usarán (Exceden incluso el margen de +0.45 U.V.E.) -->
                @if (plan.porEliminar.length > 0) {
                  <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/40 space-y-1.5">
                    <p class="font-bold text-red-400 text-[11px] uppercase">🗑️ Unidades que NO se usarán (Superan el margen de +{{ plan.toleranciaUve | number:'1.2-2' }} U.V.E. y se retirarán)</p>
                    @for (u of plan.porEliminar; track u.id) {
                      <div class="flex items-center justify-between text-[11px] text-sigo-text">
                        <span><b>{{ u.nombre }}</b> {{ u.isReal ? '(Quedará en Reserva)' : '(Se eliminará del mapa)' }}</span>
                        <span class="font-bold text-red-300">- {{ u.tipo }} · {{ u.uve | number:'1.2-2' }} U.V.E.</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="p-2.5 rounded-xl bg-sigo-surface2 border border-sigo-border text-emerald-400 text-[11px] font-semibold">
                    ✓ Aprovechamiento del 100%: Todos los recursos actuales caben dentro del margen óptimo (±{{ plan.toleranciaUve | number:'1.2-2' }} U.V.E.).
                  </div>
                }

                <!-- 3. Unidades que FALTAN por Agregar (Con opción de Demo o Manual con Checklist en Vivo) -->
                @if (!esperandoIngresoManualOpt() && plan.porAgregar.length > 0) {
                  <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
                    <p class="font-bold text-amber-400 text-[11px] uppercase">➕ Unidades que Faltan para Cubrir las {{ plan.kZonas }} Zonas</p>
                    @for (item of plan.porAgregar; track item.zonaNombre) {
                      <div class="flex items-center justify-between text-[11px] text-sigo-text">
                        <span>Zona <b>{{ item.zonaNombre }}</b> ({{ item.nivelRiesgo }} · falta {{ item.deficit | number:'1.2-2' }} U.V.E.)</span>
                        <span class="font-bold text-amber-300">+ {{ item.sugerencia }}</span>
                      </div>
                    }
                    <p class="text-[10px] text-amber-200/90 pt-1 border-t border-amber-500/30">
                      Elige cómo deseas incorporar estas unidades faltantes:
                    </p>
                    <div class="grid grid-cols-2 gap-2 pt-1">
                      <button
                        (click)="confirmarOptimizadoConDemos()"
                        class="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer shadow-sm"
                      >
                        🤖 Usar Demo (Agregar y Despachar)
                      </button>
                      <button
                        (click)="iniciarChecklistManualOptimizado()"
                        class="py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer shadow-sm"
                      >
                        📱 Agregar Manual (Esperar Login)
                      </button>
                    </div>
                  </div>
                } @else if (esperandoIngresoManualOpt()) {
                  @if (estadoChecklistManualOpt(); as chk) {
                    <div class="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 space-y-2.5">
                      <div class="flex items-center justify-between">
                        <div>
                          <p class="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                            Checklist en Vivo · Esperando Inicio de Sesión en App Móvil
                          </p>
                          <p class="text-[10px] text-amber-100/80">
                            Avise a los funcionarios que inicien sesión en su teléfono. El sistema marcará automáticamente cada requisito:
                          </p>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[11px]">
                          {{ chk.completados }} / {{ chk.items.length }} Listos
                        </span>
                      </div>

                      <div class="space-y-1.5">
                        @for (req of chk.items; track req.id) {
                          <div
                            class="p-2 rounded-lg border flex items-center justify-between text-[11px] transition-all"
                            [ngClass]="req.cumplido ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200' : 'bg-sigo-surface border-sigo-border text-sigo-muted'"
                          >
                            <div class="flex items-center gap-2">
                              <span
                                class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold"
                                [ngClass]="req.cumplido ? 'bg-emerald-500 text-white' : 'bg-sigo-surface2 border border-sigo-border text-sigo-muted'"
                              >
                                {{ req.cumplido ? '✓' : '⏳' }}
                              </span>
                              <div>
                                <p class="font-bold" [ngClass]="req.cumplido ? 'text-emerald-300' : 'text-sigo-text'">
                                  Zona {{ req.zonaNombre }} ({{ req.nivelRiesgo }}) — Requiere {{ req.sugerencia }}
                                </p>
                                @if (req.cumplido && req.unidadAsignadaNombre) {
                                  <p class="text-[10px] text-emerald-400 font-semibold">
                                    ✓ Cubierto por sesión iniciada: {{ req.unidadAsignadaNombre }}
                                  </p>
                                } @else {
                                  <p class="text-[10px] text-amber-300/80">
                                    Esperando que un funcionario inicie turno con al menos {{ req.deficit | number:'1.2-2' }} U.V.E...
                                  </p>
                                }
                              </div>
                            </div>
                            <span
                              class="px-2 py-0.5 rounded text-[10px] font-bold"
                              [ngClass]="req.cumplido ? 'bg-emerald-600 text-white' : 'bg-amber-500/20 text-amber-300'"
                            >
                              {{ req.cumplido ? 'APROBADO' : 'PENDIENTE' }}
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                } @else {
                  <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                    ✓ Cobertura completa: No se requiere agregar unidades adicionales para las {{ plan.kZonas }} zonas.
                  </div>
                }
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-sigo-border">
                <button
                  (click)="cancelarModalOptimizado()"
                  class="px-4 py-2 rounded-lg border border-sigo-border text-sigo-muted hover:text-sigo-text text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                @if (esperandoIngresoManualOpt()) {
                  <button
                    (click)="confirmarOptimizadoConDemos()"
                    class="px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
                    title="Completar lo que aún falte con unidades Demo y despachar ahora"
                  >
                    Completar Restantes con Demo
                  </button>
                  <button
                    (click)="finalizarChecklistYDespacharOptimizado()"
                    [disabled]="!estadoChecklistManualOpt().todoCumplido"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
                  >
                    ✓ Checklist Completo · Activar y Despachar
                  </button>
                } @else if (plan.porAgregar.length === 0) {
                  <button
                    (click)="confirmarOptimizadoConDemos()"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirmar y Despachar Unidades
                  </button>
                }
              </div>
            </div>
          </div>
        }
      }

      <!-- DRAWER: Detalle de Unidad Real con Acciones de Despacho y Mensaje -->
      @if (store.unidadSeleccionada(); as unidad) {
        <div class="absolute bottom-0 left-0 right-80 glass border-t border-sigo-border p-4 z-20 animate-slide-in-l">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-sigo-surface2 border border-sigo-border flex items-center justify-center text-sigo-accent">
                  <app-icon [name]="getTransportIcon(unidad.tipo_transporte)" [size]="18"></app-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-sm text-sigo-text">{{ unidad.identificador_unidad }}</h3>
                    @if (dispatchCountdown().has(unidad.id_sesion)) {
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-en-ruta/20 text-en-ruta border border-en-ruta/40 animate-pulse">
                        En camino ({{ dispatchCountdown().get(unidad.id_sesion) }}s)
                      </span>
                    } @else {
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            [style.background]="estadoConfig(unidad.estado_operativo).dotColor + '22'"
                            [style.color]="estadoConfig(unidad.estado_operativo).dotColor">
                        {{ unidad.estado_operativo === 'PATRULLANDO_ZONA' && getAsignacionActiva(unidad)?.nombre_zona
                            ? 'En zona · ' + getAsignacionActiva(unidad)?.nombre_zona
                            : estadoConfig(unidad.estado_operativo).label }}
                      </span>
                    }
                  </div>
                  <p class="text-xs text-sigo-muted">
                    Conductor: <b>{{ unidad.conductor?.nombre_completo ?? unidad.rut_conductor }}</b>
                    · Sesión #{{ unidad.id_sesion }}
                  </p>
                </div>
              </div>

              <div *ngIf="getAsignacionActiva(unidad) as asigActiva" class="text-xs text-sigo-muted bg-sigo-surface2/60 p-2 rounded-lg border border-sigo-border flex items-center gap-3">
                <span>Misión activa: <b class="text-sigo-text">{{ asigActiva.nombre_zona || 'Sector asignado' }}</b></span>
                <span>Radio: <b class="text-sigo-accent">{{ asigActiva.radio_m }}m</b></span>
                <span>Estado: <b class="text-sigo-text">{{ asigActiva.estado_mision }}</b></span>
              </div>
            </div>

            <!-- Botones de Acción Táctica -->
            <div class="flex items-center gap-2">
              <button
                *ngIf="getAsignacionActiva(unidad) || unidad.estado_operativo === 'PATRULLANDO_ZONA' || unidad.estado_operativo === 'EN_RUTA_HOTSPOT'"
                (click)="finalizarRondaDirecto(unidad)"
                class="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Finalizar misión y dejar patrulla Disponible"
              >
                <app-icon name="cerrar" [size]="14"></app-icon>
                <span>Finalizar Ronda</span>
              </button>

              <button
                (click)="abrirDespachoManual(unidad)"
                class="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                title="Despachar manualmente a cualquier zona registrada"
              >
                <app-icon name="mira" [size]="14"></app-icon>
                <span>Despachar a Zona</span>
              </button>

              <button
                (click)="irAMensajes()"
                class="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"
                title="Abrir chat táctico con esta patrulla"
              >
                <app-icon name="mensajes" [size]="14"></app-icon>
                <span>Instrucción / Mensaje</span>
              </button>

              <button (click)="centerOnUnit(unidad)" class="btn-ghost p-2" title="Centrar mapa">
                <app-icon name="mira" [size]="16"></app-icon>
              </button>
              <button (click)="store.seleccionarUnidad(null)" class="btn-ghost p-2" title="Cerrar panel">
                <app-icon name="cerrar" [size]="16"></app-icon>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- DRAWER: Detalle Patrulla DEMO -->
      @if (patrullaFicticiaSeleccionada(); as p) {
        <div class="absolute bottom-0 left-0 right-80 glass border-t border-sigo-border p-4 z-20 animate-slide-in-l">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-sigo-surface2 border border-sigo-border flex items-center justify-center text-sigo-accent">
                  <app-icon [name]="p.tipo === 'MOTO' ? 'moto' : p.tipo === 'BICICLETA' ? 'bici' : 'auto'" [size]="18"></app-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-sm text-sigo-text">{{ p.nombre }}</h3>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sigo-surface2 text-sigo-muted border border-sigo-border">
                      SIMULACIÓN DEMO
                    </span>
                    @if (p.destinoZone?.id === 9999) {
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse">
                        🚨 Refuerzo Táctico SOS (Código Rojo)
                      </span>
                    } @else if (p.isManual) {
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        ✋ Despacho Manual
                      </span>
                    } @else {
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        🤖 Asignación Auto (Algoritmo)
                      </span>
                    }
                  </div>
                  <p class="text-xs text-sigo-muted">
                    Estado: <b [style.color]="fColor(p.estado)">{{ fLabel(p.estado) }}</b>
                    @if (p.destinoZone) {
                      · Destino: <b class="text-sigo-text">{{ p.destinoZone.name }}</b> ({{ p.destinoZone.address }})
                    }
                  </p>
                </div>
              </div>
            </div>

            <!-- Botones de Acción Táctica Patrulla DEMO -->
            <div class="flex items-center gap-2">
              @if (p.isManual) {
                <button
                  (click)="restablecerAutoPatrullaFicticia(p)"
                  class="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
                  title="Volver a modo de asignación automática por rotación"
                >
                  <app-icon name="check" [size]="14"></app-icon>
                  <span>Volver a Auto</span>
                </button>
              }

              <button
                (click)="abrirModalDespachoFicticia(p)"
                class="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer"
                title="Despachar manualmente esta patrulla demo a una zona seleccionada"
              >
                <app-icon name="mira" [size]="14"></app-icon>
                <span>Despachar a Zona</span>
              </button>

              <button (click)="mapService.centerOn(p.lat, p.lng)" class="btn-ghost p-2" title="Centrar mapa">
                <app-icon name="mira" [size]="16"></app-icon>
              </button>
              <button (click)="eliminarPatrullaFicticia(p)" class="btn-ghost text-xs text-emergencia p-2" title="Eliminar patrulla">
                <app-icon name="basura" [size]="16"></app-icon>
              </button>
              <button (click)="patrullaFicticiaSeleccionada.set(null)" class="btn-ghost p-2" title="Cerrar panel">
                <app-icon name="cerrar" [size]="16"></app-icon>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- PANEL COMPACTO: Alertas SOS (Despacho Automático según Configuración U.V.E.) -->
      @if (store.showSOSDrawer()) {
        <div class="absolute top-3 right-[21rem] max-h-[72vh] w-80 bg-sigo-surface/95 backdrop-blur-md border border-emergencia/50 rounded-2xl flex flex-col z-30 animate-slide-in-r shadow-2xl overflow-hidden">
          <!-- Cabecera del Drawer -->
          <div class="p-3 bg-emergencia/10 border-b border-emergencia/30 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emergencia badge-blink"></span>
              <h3 class="text-emergencia font-bold text-xs uppercase tracking-wider">Centro de Emergencias SOS</h3>
            </div>
            <button (click)="store.showSOSDrawer.set(false)" class="text-sigo-muted hover:text-sigo-text p-1">
              <app-icon name="cerrar" [size]="16"></app-icon>
            </button>
          </div>

          <!-- Banner de Sirena / Recibido -->
          @if (soundService.isSosLooping) {
            <div class="p-2.5 bg-red-600 text-white flex items-center justify-between text-xs font-semibold shadow-inner">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>Sirena Sonora Activa</span>
              </div>
              <button
                (click)="silenciarSirena()"
                class="px-2.5 py-1 rounded bg-white text-red-600 font-bold hover:bg-red-50 text-[11px] shadow-xs cursor-pointer"
              >
                RECIBIDO (Silenciar)
              </button>
            </div>
          }

          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            @for (alerta of store.alertasSOS(); track alerta.id_emergencia) {
              <div
                class="card p-3 border-l-4 rounded-xl space-y-2.5"
                [class.border-emergencia]="alerta.estado === 'ACTIVA'"
                [class.border-sigo-border]="alerta.estado === 'RESUELTA'"
              >
                <!-- Info Alerta -->
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-xs text-sigo-text">Móvil Solicitante: #{{ alerta.id_sesion_solicitante }}</span>
                    </div>
                    <p class="text-[11px] text-sigo-muted">{{ alerta.fecha_alerta | date:'dd/MM/yyyy HH:mm:ss' }}</p>
                  </div>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded font-bold"
                    [ngClass]="alerta.estado === 'ACTIVA' ? 'bg-emergencia text-white badge-blink' : 'bg-sigo-surface2 text-sigo-muted'"
                  >
                    {{ alerta.estado }}
                  </span>
                </div>

                <!-- Panel de Despacho Automático por U.V.E. Configurada -->
                @if (alerta.estado === 'ACTIVA') {
                  <div class="p-2.5 rounded-lg bg-sigo-surface2/70 border border-sigo-border space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold text-sigo-text uppercase tracking-wide flex items-center gap-1">
                        <app-icon name="unidades" [size]="13" color="var(--sigo-accent)"></app-icon>
                        Despacho Automático SOS
                      </span>
                      <span class="text-[10px] text-red-400 font-extrabold">
                        Meta: {{ settingsService.uveSosObjetivo() | number:'1.2-2' }} U.V.E.
                      </span>
                    </div>

                    <div class="space-y-1 max-h-28 overflow-y-auto">
                      @for (cand of getPreseleccionRefuerzoUve(alerta); track cand.id) {
                        <div class="flex items-center justify-between px-2 py-1 rounded bg-sigo-surface border border-sigo-border text-[10px]">
                          <span class="font-bold text-sigo-text">{{ cand.nombre }} [{{ cand.tipoMedio }}]</span>
                          <span class="text-sigo-accent font-bold">{{ cand.valorUve | number:'1.2-2' }} U.V.E. · ETA {{ cand.etaMinutos }} min</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Acciones Base: Centrar y Resolver -->
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-sigo-border">
                  <button (click)="centerOnAlerta(alerta)" class="btn-ghost text-[11px] py-1 px-2.5 flex items-center gap-1">
                    <app-icon name="mira" [size]="13"></app-icon>
                    <span>Centrar Mapa</span>
                  </button>
                  @if (alerta.estado === 'ACTIVA') {
                    <button
                      (click)="alertaPorResolver.set(alerta.id_emergencia)"
                      class="btn-primary text-[11px] py-1 px-3 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 flex items-center gap-1 cursor-pointer"
                      title="Marcar emergencia resuelta y archivar alerta"
                    >
                      <app-icon name="check" [size]="13"></app-icon>
                      <span>Emergencia Resuelta</span>
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <div class="py-8 px-3 text-center text-sigo-muted text-xs space-y-3">
                <p>No hay alertas de emergencia activas en este momento.</p>
                <button
                  type="button"
                  (click)="simularAlertaSosUve()"
                  class="btn-primary text-xs py-2 px-3 bg-red-600 hover:bg-red-500 border-red-500 mx-auto flex items-center gap-1.5 cursor-pointer"
                >
                  <app-icon name="alerta" [size]="14"></app-icon>
                  <span>Simular Solicitud de Refuerzo U.V.E.</span>
                </button>
              </div>
            }

            <!-- Historial del último despacho por U.V.E. -->
            @if (ultimoDespachoUve(); as desp) {
              <div class="p-3 rounded-xl bg-sigo-surface2 border border-sigo-accent/40 space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sigo-accent uppercase text-[10px]">Último Despacho Algorítmico U.V.E.</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Cubierto: {{ desp.uveCubierta | number:'1.2-2' }} / {{ desp.uveDemandada | number:'1.2-2' }} U.V.E.
                  </span>
                </div>
                <div class="space-y-1">
                  @for (u of desp.unidades; track u.id) {
                    <div class="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-sigo-surface border border-sigo-border">
                      <span class="font-semibold text-sigo-text">{{ u.nombre }} [{{ u.tipoMedio }}]</span>
                      <span class="text-sigo-accent font-bold">{{ u.valorUve | number:'1.2-2' }} U.V.E. · ETA {{ u.etaMinutos }} min</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Notificaciones Flotantes Tácticas (Toasts) con Sonido -->
    <div class="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      @for (t of toasts(); track t.id) {
        <div
          class="pointer-events-auto p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 animate-slide-in-r transition-all"
          [ngClass]="t.type === 'SOS' ? 'bg-red-950/95 border-red-500 text-white shadow-red-950/50' : 'bg-sigo-surface/95 border-sigo-accent text-sigo-text shadow-sigo-accent/20'"
        >
          <div class="p-2 rounded-xl flex-shrink-0" [ngClass]="t.type === 'SOS' ? 'bg-red-600/30 text-red-400' : 'bg-sigo-accent/20 text-sigo-accent'">
            <app-icon [name]="t.type === 'SOS' ? 'alerta' : 'mensajes'" [size]="20"></app-icon>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h4 class="font-bold text-xs uppercase tracking-wide truncate" [ngClass]="t.type === 'SOS' ? 'text-red-300' : 'text-sigo-accent'">
                {{ t.titulo }}
              </h4>
              <span class="text-[10px] opacity-70">{{ t.hora }}</span>
            </div>
            <p class="text-xs font-medium mt-0.5 line-clamp-2 leading-relaxed" [ngClass]="t.type === 'SOS' ? 'text-red-100' : 'text-sigo-text'">
              {{ t.subtitulo }}
            </p>
          </div>
          <button (click)="cerrarToast(t.id)" class="text-sigo-muted hover:text-white p-1 flex-shrink-0">
            <app-icon name="cerrar" [size]="14"></app-icon>
          </button>
        </div>
      }
    </div>

    <!-- Modal para Agregar Patrulla Demo -->
    <div *ngIf="showAddPatrolModal()" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-xs">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-sigo-text">Agregar Patrulla de Simulación</h3>
          <button (click)="showAddPatrolModal.set(false)" class="text-sigo-muted hover:text-sigo-text">
            <app-icon name="cerrar" [size]="16"></app-icon>
          </button>
        </div>
        <div>
          <label class="block text-sigo-muted font-medium mb-1">Identificador</label>
          <input type="text" [(ngModel)]="newPatrolForm.nombre" placeholder="Ej: FZ-101, RP-990" class="input-field" />
        </div>
        <div>
          <label class="block text-sigo-muted font-medium mb-1">Medio Operativo y Capacidad U.V.E.</label>
          <select [(ngModel)]="newPatrolForm.tipo_medio" class="input-field font-semibold">
            <option value="RPT">RPT — Radiopatrulla 3 tripulantes (1.00 U.V.E.)</option>
            <option value="RPD">RPD — Radiopatrulla 2 tripulantes (0.80 U.V.E.)</option>
            <option value="FZ">FZ — Furgón Z mín. 2 tripulantes (1.00 U.V.E.)</option>
            <option value="MTT">MTT — Moto Todo Terreno individual (0.45 U.V.E.)</option>
            <option value="CB">CB — Carabinero en Bicicleta (0.30 U.V.E.)</option>
            <option value="INF">INF — Carabinero a pie / Infantería (0.20 U.V.E.)</option>
          </select>
        </div>
        <div class="pt-2 flex justify-end gap-2">
          <button (click)="showAddPatrolModal.set(false)" class="btn-ghost">Cancelar</button>
          <button (click)="agregarPatrullaFicticia()" [disabled]="!newPatrolForm.nombre.trim()" class="btn-primary">Añadir</button>
        </div>
      </div>
    </div>

    <!-- Modal de Despacho Manual hacia la unidad seleccionada -->
    <app-dispatch-modal
      *ngIf="unidadParaDespachoManual"
      [sesion]="unidadParaDespachoManual"
      (close)="unidadParaDespachoManual = null"
      (dispatched)="onDespachoRealizado()"
      (cancelled)="onDespachoCancelado($event)"
    ></app-dispatch-modal>

    <!-- Modal de Despacho Manual para Patrulla DEMO -->
    <div *ngIf="patrullaParaDespachoFicticia" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 text-xs">
        <div class="flex items-center justify-between border-b border-sigo-border pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
              <app-icon name="mira" [size]="18"></app-icon>
            </div>
            <div>
              <h3 class="font-bold text-sm text-sigo-text">Despacho Manual · {{ patrullaParaDespachoFicticia.nombre }}</h3>
              <p class="text-[11px] text-sigo-muted">Asignar sector de patrullaje táctico de destino</p>
            </div>
          </div>
          <button (click)="patrullaParaDespachoFicticia = null" class="text-sigo-muted hover:text-sigo-text p-1">
            <app-icon name="cerrar" [size]="16"></app-icon>
          </button>
        </div>

        <div class="space-y-3">
          <div class="p-2 rounded-lg bg-sigo-surface2 border border-sigo-border flex items-center justify-between text-[11px]">
            <span class="text-sigo-muted">Capacidad U.V.E. del recurso:</span>
            <span class="font-extrabold text-sigo-accent">
              {{ getFicticiaMedioCode(patrullaParaDespachoFicticia) }} · {{ getFicticiaUve(patrullaParaDespachoFicticia) | number:'1.2-2' }} U.V.E.
            </span>
          </div>

          <div>
            <label class="block text-sigo-muted font-medium mb-1.5">Zonas Tácticas Ordenadas por Prioridad de Gravedad</label>
            <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              @for (z of getZonesSortedByPriority(); track z.id) {
                <div
                  (click)="zonaFicticiaSeleccionada = z"
                  class="p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
                  [ngClass]="zonaFicticiaSeleccionada?.id === z.id ? 'bg-sigo-accent/15 border-sigo-accent text-sigo-text font-bold shadow-xs' : 'bg-sigo-surface2/60 border-sigo-border text-sigo-muted hover:border-sigo-accent/50'"
                >
                  <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="getRiskColor(z.crimeCount)"></span>
                    <div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs text-sigo-text font-bold">{{ z.name }}</span>
                        <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                              [style.color]="getRiskColor(z.crimeCount)"
                              [style.background]="getRiskColor(z.crimeCount) + '22'">
                          {{ getZoneRiskLevel(z) }} · {{ getZoneScore(z) }} pts
                        </span>
                        <span class="text-[9px] px-1.5 py-0.2 rounded bg-sigo-surface border border-sigo-border text-sigo-accent font-extrabold">
                          Req: {{ getZoneRequiredUve(z) | number:'1.2-2' }} U.V.E.
                        </span>
                      </div>
                      <p class="text-[10px] text-sigo-muted truncate max-w-[240px]">{{ z.address }}</p>
                    </div>
                  </div>
                  <div *ngIf="zonaFicticiaSeleccionada?.id === z.id" class="w-4 h-4 rounded-full bg-sigo-accent text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                </div>
              }
            </div>
          </div>

          @if (zonaFicticiaSeleccionada && (getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia)) + 0.001 < getZoneRequiredUve(zonaFicticiaSeleccionada)) {
            <div class="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-[11px] space-y-1">
              <div class="flex items-center justify-between font-bold text-amber-300">
                <span>⚠️ Advertencia: Seguridad Baja en {{ zonaFicticiaSeleccionada.name }}</span>
                <span>{{ (getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia)) | number:'1.2-2' }} / {{ getZoneRequiredUve(zonaFicticiaSeleccionada) | number:'1.2-2' }} U.V.E.</span>
              </div>
              <p class="text-[10px] text-amber-100/90 leading-snug">
                Esta zona de riesgo <b>{{ getZoneRiskLevel(zonaFicticiaSeleccionada) }}</b> requiere mínimo <b>{{ getZoneRequiredUve(zonaFicticiaSeleccionada) | number:'1.2-2' }} U.V.E.</b> Se recomienda combinar otro servicio adicional para cubrir el déficit de <b>{{ (getZoneRequiredUve(zonaFicticiaSeleccionada) - (getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia))) | number:'1.2-2' }} U.V.E.</b>
              </p>
            </div>
          } @else if (zonaFicticiaSeleccionada && (getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia)) > getZoneMaxUve(zonaFicticiaSeleccionada) + 0.001) {
            <div class="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-500/70 text-indigo-100 text-[11px] space-y-1">
              <div class="flex items-center justify-between font-bold text-indigo-200">
                <span>⚡ Advertencia: Malgasto de Recurso en {{ zonaFicticiaSeleccionada.name }}</span>
                <span>{{ (getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia)) | number:'1.2-2' }} / {{ getZoneMaxUve(zonaFicticiaSeleccionada) | number:'1.2-2' }} U.V.E.</span>
              </div>
              <p class="text-[10px] text-indigo-100/90 leading-snug">
                Esta zona de riesgo <b>{{ getZoneRiskLevel(zonaFicticiaSeleccionada) }}</b> admite máximo <b>{{ getZoneMaxUve(zonaFicticiaSeleccionada) | number:'1.2-2' }} U.V.E.</b> Con las unidades ya asignadas, el total excede en <b>+{{ ((getZoneAssignedUve(zonaFicticiaSeleccionada, patrullaParaDespachoFicticia.id) + getFicticiaUve(patrullaParaDespachoFicticia)) - getZoneMaxUve(zonaFicticiaSeleccionada)) | number:'1.2-2' }} U.V.E.</b>; se recomienda reservar este recurso para otra zona.
              </p>
            </div>
          }
        </div>

        <div class="pt-2 flex items-center justify-end gap-2 border-t border-sigo-border">
          <button (click)="patrullaParaDespachoFicticia = null" class="btn-ghost">Cancelar</button>
          <button
            (click)="confirmarDespachoFicticiaManual()"
            [disabled]="!zonaFicticiaSeleccionada"
            class="btn-primary flex items-center gap-1.5"
          >
            <app-icon name="enviar" [size]="14"></app-icon>
            <span>Despachar Ahora</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapCanvas') mapCanvasRef!: ElementRef<HTMLDivElement>;

  readonly MAX_PATRULLAS = MAX_PATRULLAS;
  readonly store = inject(DashboardStore);
  readonly apiService = inject(ApiService);
  readonly mqttService = inject(MqttService);
  readonly mapService = inject(MapService);
  readonly authService = inject(AuthService);
  readonly supabase = inject(SupabaseService);
  readonly soundService = inject(SoundService);
  readonly messageBadge = inject(MessageBadgeService);
  readonly settingsService = inject(SettingsService);
  readonly router = inject(Router);

  readonly recursosSos = computed(() => this.settingsService.recursosSos());
  readonly modoDespachoSos = signal<'AUTO' | 'MANUAL'>('AUTO');
  readonly unidadesSeleccionadasSos = signal<string[]>([]);
  readonly despachandoSos = signal(false);
  readonly uveDemandaSos = signal<number>(1.0);
  readonly kRotacionDashboard = signal<number>(3);
  readonly ultimoDespachoUve = signal<{
    uveDemandada: number;
    uveCubierta: number;
    unidades: Array<{ id: string; nombre: string; tipoMedio: string; valorUve: number; etaMinutos: number }>;
  } | null>(null);

  readonly toasts = signal<TacticalToast[]>([]);

  mostrarToast(toast: Omit<TacticalToast, 'id' | 'hora'>): void {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nuevo: TacticalToast = { ...toast, id, hora };
    this.toasts.update(list => [nuevo, ...list.slice(0, 4)]);
    setTimeout(() => {
      this.cerrarToast(id);
    }, 8000);
  }

  cerrarToast(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  readonly totalDisponibles = computed(() =>
    this.store.conteoDisponibles() + this.patrullasFicticias().filter(p => p.estado === 'DISPONIBLE').length
  );
  readonly totalEnRuta = computed(() =>
    this.store.conteoEnRuta() + this.patrullasFicticias().filter(p => p.estado === 'EN_RUTA').length
  );
  readonly totalPatrullando = computed(() =>
    this.store.conteoPatrullando() + this.patrullasFicticias().filter(p => p.estado === 'PATRULLANDO').length
  );

  readonly patrullasFicticias = this.store.patrullasFicticias;
  readonly patrullaFicticiaSeleccionada = this.store.patrullaFicticiaSeleccionada;
  readonly showAddPatrolModal = signal(false);

  readonly allHotspotZones = HOTSPOT_ZONES;
  patrullaParaDespachoFicticia: PatrullaFicticia | null = null;
  zonaFicticiaSeleccionada: HotspotZone | null = null;

  getRiskColor(c: number): string { return getRisk(c).color; }

  unidadParaDespachoManual: SesionOperativa | null = null;

  newPatrolForm: { nombre: string; tipo_medio: TipoMedio } = {
    nombre: '', tipo_medio: 'RPT',
  };

  getUnidadUveInfo(u: SesionOperativa) {
    return calcularUveSesion(u);
  }

  getFicticiaMedioCode(p: PatrullaFicticia): TipoMedio {
    if (p.tipo_medio) return p.tipo_medio;
    const raw = (p.tipo || 'RPD').toUpperCase();
    if (raw === 'FZ' || raw === 'FURGON_Z') return 'FZ';
    if (raw === 'RPT') return 'RPT';
    if (raw === 'RPD' || raw === 'PATRULLA') return 'RPD';
    if (raw === 'MTT' || raw === 'MOTO') return 'MTT';
    if (raw === 'CB' || raw === 'BICICLETA') return 'CB';
    return 'INF';
  }

  getFicticiaUve(p: PatrullaFicticia): number {
    if (p.valor_uve != null) return Number(p.valor_uve);
    const code = this.getFicticiaMedioCode(p);
    return CONFIG_MEDIOS_UVE[code].valorUve;
  }

  getZoneScore(z: HotspotZone): number {
    return z.scoreGravedad != null ? Number(z.scoreGravedad) : z.crimeCount * 10;
  }

  getZoneRiskLevel(z: HotspotZone): 'ALTO' | 'MEDIO' | 'BAJO' {
    if (z.nivelRiesgo) return z.nivelRiesgo;
    const s = this.getZoneScore(z);
    if (s > 80 || z.crimeCount >= 7) return 'ALTO';
    if (s >= 45 || z.crimeCount >= 4) return 'MEDIO';
    return 'BAJO';
  }

  getZoneRequiredUve(z: HotspotZone): number {
    if (z.uveObjetivoMin != null) return Number(z.uveObjetivoMin);
    const r = this.getZoneRiskLevel(z);
    return r === 'ALTO' ? 1.00 : r === 'MEDIO' ? 0.45 : 0.20;
  }

  getZoneMaxUve(z: HotspotZone): number {
    if (z.uveObjetivoMax != null) return Number(z.uveObjetivoMax);
    const r = this.getZoneRiskLevel(z);
    return r === 'ALTO' ? 1.00 : r === 'MEDIO' ? 0.80 : 0.30;
  }

  getZoneAssignedUve(z: HotspotZone, excludePatrolId?: string): number {
    let total = 0;
    for (const u of this.store.unidades()) {
      if (this._isRealUnitInZone(u, z)) {
        total += this.getUnidadUveInfo(u).valorUve;
      }
    }
    for (const p of this.patrullasFicticias()) {
      if (p.id !== excludePatrolId && p.estado !== 'DISPONIBLE' && p.destinoZone?.id === z.id) {
        total += this.getFicticiaUve(p);
      }
    }
    return Number(total.toFixed(2));
  }

  getZonesSortedByPriority(): HotspotZone[] {
    return [...this.allHotspotZones].sort((a, b) => this.getZoneScore(b) - this.getZoneScore(a));
  }

  private _isRealUnitInZone(u: SesionOperativa, z: HotspotZone): boolean {
    if (u.estado_operativo === EstadoOperativo.INACTIVO || (u as any).fecha_cierre) return false;
    const asig = this.getAsignacionActiva(u);
    if (!asig) return false;
    const matched = findMatchingHotspotZone(asig);
    if (matched && matched.id === z.id) return true;
    if (asig.centro_lat != null && asig.centro_lng != null) {
      if (this.calcularDistanciaKm(asig.centro_lat, asig.centro_lng, z.lat, z.lng) <= 0.25) {
        return true;
      }
    }
    return false;
  }

  readonly coberturaZonasActivas = computed(() => {
    const activeZones = [...this.mapService.activeZones()].sort(
      (a, b) => this.getZoneScore(b) - this.getZoneScore(a)
    );
    const unidadesReales = this.store.unidades();
    const ficticias = this.patrullasFicticias();

    return activeZones.map(z => {
      const unidades: Array<{
        id: string;
        nombre: string;
        tipoMedio: TipoMedio;
        valorUve: number;
      }> = [];

      for (const u of unidadesReales) {
        if (this._isRealUnitInZone(u, z)) {
          const uveInfo = this.getUnidadUveInfo(u);
          unidades.push({
            id: `real-${u.id_sesion}`,
            nombre: u.identificador_unidad || `Móvil #${u.id_sesion}`,
            tipoMedio: uveInfo.tipoMedio,
            valorUve: uveInfo.valorUve,
          });
        }
      }

      for (const p of ficticias) {
        if (p.estado !== 'DISPONIBLE' && p.destinoZone?.id === z.id) {
          unidades.push({
            id: `demo-${p.id}`,
            nombre: p.nombre,
            tipoMedio: this.getFicticiaMedioCode(p),
            valorUve: this.getFicticiaUve(p),
          });
        }
      }

      const uveRequerida = this.getZoneRequiredUve(z);
      const nivelRiesgo = this.getZoneRiskLevel(z);
      // En zona de riesgo ALTO, si se cumple con la combinación válida RPD (0.80) + MTT (0.45) = 1.25 U.V.E.,
      // se acepta como cobertura válida (hasta 1.25 U.V.E.) sin marcar "Sobra +0.25"
      const esComboAltoRpdMtt =
        nivelRiesgo === 'ALTO' &&
        unidades.length === 2 &&
        unidades.some(u => u.tipoMedio === 'RPD') &&
        unidades.some(u => u.tipoMedio === 'MTT');
      const uveMaxPermitida = esComboAltoRpdMtt ? 1.25 : this.getZoneMaxUve(z);
      const uveAsignada = Number(unidades.reduce((acc, item) => acc + item.valorUve, 0).toFixed(2));
      const deficitUve = Math.max(0, Number((uveRequerida - uveAsignada).toFixed(2)));
      const excesoUve = Math.max(0, Number((uveAsignada - uveMaxPermitida).toFixed(2)));
      const score = this.getZoneScore(z);
      const serviciosCombinados = unidades.length > 1;
      // Advertencia de seguridad baja cuando el(los) servicio(s) enviados a la zona no alcanzan el U.V.E. requerido
      // o cuando hay unidades operativas en el sistema pero una zona activa quedó con U.V.E. insuficiente
      const tieneRecursosSistema =
        unidadesReales.filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO).length + ficticias.length > 0;
      const seguridadBaja =
        deficitUve > 0.001 && (unidades.length > 0 || tieneRecursosSistema);

      const resumenUnidades = unidades
        .map(u => u.nombre)
        .join(' + ');

      return {
        zona: z,
        score,
        nivelRiesgo,
        uveRequerida,
        uveAsignada,
        deficitUve,
        excesoUve,
        unidades,
        resumenUnidades,
        serviciosCombinados,
        seguridadBaja,
      };
    }).sort((a, b) => b.score - a.score || a.zona.id - b.zona.id);
  });

  trackByCoberturaZona(_index: number, item: { zona: HotspotZone }): number {
    return item.zona.id;
  }

  readonly zonasConSeguridadBaja = computed(() =>
    this.coberturaZonasActivas().filter(item => item.seguridadBaja)
  );

  readonly zonasConDeficitUve = computed(() =>
    this.coberturaZonasActivas().filter(item => item.deficitUve > 0.001)
  );

  readonly zonasConExcesoUve = computed(() =>
    this.coberturaZonasActivas().filter(item => item.excesoUve > 0.001)
  );

  readonly totalDeficitUveZonas = computed(() =>
    Number(
      this.coberturaZonasActivas()
        .reduce((acc, item) => acc + item.deficitUve, 0)
        .toFixed(2)
    )
  );

  readonly totalExcesoUveZonas = computed(() =>
    Number(
      this.coberturaZonasActivas()
        .reduce((acc, item) => acc + item.excesoUve, 0)
        .toFixed(2)
    )
  );

  readonly uveRequeridaTotalZonas = computed(() =>
    Number(
      this.coberturaZonasActivas()
        .reduce((acc, item) => acc + item.uveRequerida, 0)
        .toFixed(2)
    )
  );

  readonly diferenciaGlobalZonas = computed(() =>
    Number((this.store.ofertaTotalUve() - this.uveRequeridaTotalZonas()).toFixed(2))
  );

  readonly balanceGlobalUve = computed(() =>
    Number((this.store.ofertaTotalUve() - this.uveRequeridaTotalZonas()).toFixed(2))
  );

  readonly minimizarAdvertenciaSeguridad = signal<boolean>(false);
  readonly minimizarBalanceRecurso = signal<boolean>(false);
  readonly minimizarCapasTacticas = signal<boolean>(false);
  // Modo de despacho persistido: sobrevive a recargas / cierre del navegador
  readonly modoDespacho = signal<'MANUAL' | 'AUTO' | 'OPTIMIZADO'>(
    (() => {
      const v = localStorage.getItem('sigo_modo_despacho');
      return v === 'AUTO' || v === 'OPTIMIZADO' ? v : 'MANUAL';
    })()
  );
  readonly alertaPorResolver = signal<number | null>(null);

  /** Fuente única de verdad: hay modo automático solo si el operador activó AUTO u OPTIMIZADO */
  isAutoMode(): boolean {
    return this.modoDespacho() !== 'MANUAL';
  }

  private _setModo(modo: 'MANUAL' | 'AUTO' | 'OPTIMIZADO'): void {
    this.modoDespacho.set(modo);
    localStorage.setItem('sigo_modo_despacho', modo);
    this.mapService.autoRotationEnabled.set(modo !== 'MANUAL');
  }
  readonly confirmandoModo = signal<'AUTO' | 'OPTIMIZADO' | null>(null);

  private sugerirUnidadPorDeficit(deficit: number): string {
    if (deficit <= 0.001) return '';
    if (deficit <= 0.30) return 'Infantería a pie o Bicicleta (0.20 - 0.30 U.V.E.)';
    if (deficit <= 0.80) return 'Patrulla con 1-2 tripulantes o Moto (0.45 - 0.80 U.V.E.)';
    return 'Furgón Z o Patrulla con 3 tripulantes (1.00 U.V.E.)';
  }

  private readonly TOLERANCIA_OPTIMIZADO_UVE = 0.45;

  readonly esperandoIngresoManualOpt = signal<boolean>(false);
  readonly avisoCierreSesionOpt = signal<{
    conductor: string;
    unidad: string;
    tipo: string;
    uve: number;
    zona?: string;
  } | null>(null);
  readonly baselineSesionesIdsOpt = signal<Set<number>>(new Set());
  readonly checklistRequisitosOpt = signal<Array<{
    id: string;
    zona: HotspotZone;
    zonaNombre: string;
    nivelRiesgo: string;
    deficit: number;
    tipoMedio: TipoMedio;
    valorUve: number;
    sugerencia: string;
  }>>([]);

  private sugerirUnidadPorZonaYDeficit(nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO', deficit: number, tieneRpd: boolean = false, tieneMtt: boolean = false): {
    tipoMedio: TipoMedio;
    valorUve: number;
    sugerencia: string;
  } {
    if (nivelRiesgo === 'ALTO') {
      // Riesgo ALTO: Furgón Z o Patrulla con 3 tripulantes (1.00), o combinación Patrulla 1-2 tripulantes + Moto
      if (tieneRpd && !tieneMtt) {
        return {
          tipoMedio: 'MTT',
          valorUve: CONFIG_MEDIOS_UVE.MTT.valorUve,
          sugerencia: 'Moto (0.45 U.V.E. para complementar Patrulla con 1-2 tripulantes)',
        };
      }
      if (tieneMtt && !tieneRpd) {
        return {
          tipoMedio: 'RPD',
          valorUve: CONFIG_MEDIOS_UVE.RPD.valorUve,
          sugerencia: 'Patrulla con 1-2 tripulantes (0.80 U.V.E. para complementar Moto)',
        };
      }
      return {
        tipoMedio: 'FZ',
        valorUve: CONFIG_MEDIOS_UVE.FZ.valorUve,
        sugerencia: 'Furgón Z o Patrulla con 3 tripulantes (1.00 U.V.E.)',
      };
    }

    if (nivelRiesgo === 'MEDIO') {
      // Riesgo MEDIO: Patrulla con 1-2 tripulantes o Moto
      return {
        tipoMedio: 'MTT',
        valorUve: CONFIG_MEDIOS_UVE.MTT.valorUve,
        sugerencia: 'Patrulla con 1-2 tripulantes o Moto (0.45 - 0.80 U.V.E.)',
      };
    }

    // Riesgo BAJO: Infantería a pie o Bicicleta
    if (deficit > 0.201) {
      return {
        tipoMedio: 'CB',
        valorUve: CONFIG_MEDIOS_UVE.CB.valorUve,
        sugerencia: 'Infantería a pie o Bicicleta (0.20 - 0.30 U.V.E.)',
      };
    }
    return {
      tipoMedio: 'INF',
      valorUve: CONFIG_MEDIOS_UVE.INF.valorUve,
      sugerencia: 'Infantería a pie o Bicicleta (0.20 - 0.30 U.V.E.)',
    };
  }

  abrirModalOptimizado(): void {
    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    // Sincronizar las zonas activas del mapa con la cantidad configurada en Ajustes
    this.mapService.syncCycleState();
    this.confirmandoModo.set('OPTIMIZADO');
  }

  cancelarModalOptimizado(): void {
    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    this.confirmandoModo.set(null);
  }

  /**
   * Opción cuando un usuario real cierra sesión y el operador decide NO agregar reemplazo:
   * cierra la alerta y deja que el sistema redistribuya y optimice automáticamente con las unidades que quedaron.
   */
  continuarOptimizadoConLoQueHay(): void {
    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    this.confirmandoModo.set(null);
    this._rebalanceAutoPatrols(false);
  }

  notificarBajaUnidadReal(unidadCerrada: SesionOperativa): void {
    const info = this.getUnidadUveInfo(unidadCerrada);
    const asig = this.getAsignacionActiva(unidadCerrada);
    const nombreConductor = unidadCerrada.conductor?.nombre_completo || unidadCerrada.rut_conductor || 'Funcionario';
    const nombreUnidad = unidadCerrada.identificador_unidad || `Móvil #${unidadCerrada.id_sesion}`;
    const nombreZona = asig?.nombre_zona || undefined;

    this.mostrarToast({
      type: 'SOS',
      titulo: `⚠️ Baja en Servicio: ${nombreUnidad}`,
      subtitulo: `${nombreConductor} cerró sesión (${info.tipoMedio} · -${info.valorUve.toFixed(2)} U.V.E.). Evaluando cobertura...`,
    });

    // Si estamos en modo AUTO u OPTIMIZADO, verificar si el cierre dejó déficit en las zonas configuradas
    if (this.isAutoMode()) {
      setTimeout(() => {
        const plan = this.analisisModoOptimizado();
        if (plan.porAgregar.length > 0) {
          this.avisoCierreSesionOpt.set({
            conductor: nombreConductor,
            unidad: nombreUnidad,
            tipo: info.tipoMedio,
            uve: info.valorUve,
            zona: nombreZona,
          });
          this.confirmandoModo.set('OPTIMIZADO');
          this.iniciarChecklistManualOptimizado();
        } else {
          this._rebalanceAutoPatrols(false);
        }
      }, 150);
    }
  }

  iniciarChecklistManualOptimizado(): void {
    const plan = this.analisisModoOptimizado();
    const idsActuales = new Set(
      this.store.unidades()
        .filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre)
        .map(u => u.id_sesion)
    );
    this.baselineSesionesIdsOpt.set(idsActuales);
    this.checklistRequisitosOpt.set(
      plan.porAgregar.map((item, idx) => ({
        id: `req-${idx}-${item.zonaNombre}`,
        ...item,
      }))
    );
    this.esperandoIngresoManualOpt.set(true);
  }

  readonly estadoChecklistManualOpt = computed(() => {
    const reqs = this.checklistRequisitosOpt();
    const baseline = this.baselineSesionesIdsOpt();
    // Nuevas sesiones reales que iniciaron sesión después de abrir el checklist
    const nuevasUnidades = this.store.unidades()
      .filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre && !baseline.has(u.id_sesion))
      .map(u => {
        const info = this.getUnidadUveInfo(u);
        return {
          id_sesion: u.id_sesion,
          nombre: `${u.identificador_unidad || 'Móvil #' + u.id_sesion} (${info.tipoMedio} · ${info.valorUve.toFixed(2)} U.V.E.)`,
          uve: info.valorUve,
          usada: false,
        };
      });

    const items = reqs.map(r => {
      // Buscar una nueva unidad real iniciada que cubra el requisito (con margen de tolerancia)
      const match = nuevasUnidades.find(
        nu => !nu.usada && nu.uve + 0.15 >= r.deficit
      ) ?? nuevasUnidades.find(nu => !nu.usada);

      if (match) {
        match.usada = true;
        return {
          ...r,
          cumplido: true,
          unidadAsignadaNombre: match.nombre,
        };
      }
      return {
        ...r,
        cumplido: false,
        unidadAsignadaNombre: null as string | null,
      };
    });

    const completados = items.filter(i => i.cumplido).length;
    return {
      items,
      completados,
      todoCumplido: items.length > 0 && completados === items.length,
    };
  });

  /**
   * Calcula la distribución óptima de TODAS las unidades (Reales + Demo) sobre las kZonas
   * configuradas por el operador en Ajustes.
   *
   * Nota clave de estabilidad entre rondas:
   * - En cada rotación de ciclo, `pickZonesForCycle` siempre elige la misma estructura de niveles de riesgo
   *   según `kZonas` (`poolPriority = [ALTO, MEDIO, BAJO, ALTO, MEDIO]`), por lo que la flota propuesta al
   *   inicio (Ronda 1) sirve exactamente para TODAS las rotaciones siguientes sin agregar ni eliminar unidades.
   * - Si el operador decidió operar con menos unidades ("optimizar con lo que hay"), después de asignar las
   *   compatibilidades exactas por nivel de riesgo, cualquier unidad restante se asigna a las zonas que aún
   *   estén vacías respetando Mayor U.V.E. -> Mayor Riesgo y Menor U.V.E. -> Menor Riesgo.
   */
  private _calcularDistribucionUnificada(modo: 'AUTO' | 'OPTIMIZADO', estrictoInicial: boolean = false) {
    const kZonas = this.settingsService.cantidadZonasRotacion();
    // Suscribirse reactivamente al catálogo total de zonas (para recalcular si se agregan o editan zonas nuevas)
    const catalogoTotal = this.mapService.catalogZonesSignal();
    const activeMapZones = this.mapService.activeZones();
    // IMPORTANTE: En Modo Manual o al abrir el modal de confirmación de Auto Optimizado,
    // evaluar SIEMPRE las K zonas probabilísticas del ciclo (`getTargetZonesForAutoPreview()`)
    // y no las top-K estáticas de `allHotspotZones`
    const zonasBase =
      this.isAutoMode() && activeMapZones.length === kZonas
        ? [...activeMapZones]
        : this.mapService.getTargetZonesForAutoPreview();

    // Ordenar las K zonas seleccionadas de mayor a menor riesgo
    const zonasObjetivo = [...zonasBase]
      .sort((a, b) => this.getZoneScore(b) - this.getZoneScore(a) || a.id - b.id)
      .slice(0, kZonas);

    const altasCat = catalogoTotal.filter(z => this.getZoneRiskLevel(z) === 'ALTO').length;
    const mediasCat = catalogoTotal.filter(z => this.getZoneRiskLevel(z) === 'MEDIO').length;
    const bajasCat = catalogoTotal.filter(z => this.getZoneRiskLevel(z) === 'BAJO').length;
    const totalCat = Math.max(1, catalogoTotal.length);
    const slotsOptimos = this.mapService.getOptimalRiskSlotsForCount(kZonas, catalogoTotal);
    const cAltas = slotsOptimos.filter(s => s === 'ALTO').length;
    const cMedias = slotsOptimos.filter(s => s === 'MEDIO').length;
    const cBajas = slotsOptimos.filter(s => s === 'BAJO').length;
    const resumenCatalogo = {
      total: catalogoTotal.length,
      altas: altasCat,
      medias: mediasCat,
      bajas: bajasCat,
      probAlta: Math.round((altasCat / totalCat) * 100),
      probMedia: Math.round((mediasCat / totalCat) * 100),
      probBaja: Math.round((bajasCat / totalCat) * 100),
      cuposTexto: [
        cAltas > 0 ? `${cAltas} ALTO` : '',
        cMedias > 0 ? `${cMedias} MEDIO` : '',
        cBajas > 0 ? `${cBajas} BAJO` : '',
      ].filter(Boolean).join(' + '),
    };

    const realesPool = this.store.unidades()
      .filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre)
      .map(u => {
        const info = this.getUnidadUveInfo(u);
        return {
          id: `real-${u.id_sesion}`,
          nombre: `${u.identificador_unidad || 'Móvil #' + u.id_sesion}`,
          tipo: info.tipoMedio,
          uve: info.valorUve,
          isReal: true as const,
          unidadReal: u,
          patrulla: null as PatrullaFicticia | null,
          asignada: false,
        };
      });

    const demosPool = this.patrullasFicticias().map(p => ({
      id: p.id,
      nombre: p.nombre,
      tipo: this.getFicticiaMedioCode(p),
      uve: this.getFicticiaUve(p),
      isReal: false as const,
      unidadReal: null as SesionOperativa | null,
      patrulla: p,
      asignada: false,
    }));

    // Ordenar unidades de MAYOR a MENOR U.V.E. (en empate, priorizar unidad Real)
    const pool = [...realesPool, ...demosPool].sort((a, b) => {
      if (Math.abs(b.uve - a.uve) > 0.001) return b.uve - a.uve;
      if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    const tol = this.TOLERANCIA_OPTIMIZADO_UVE; // 0.45 U.V.E.

    const estadoZonas = zonasObjetivo.map(z => {
      const nivel = this.getZoneRiskLevel(z);
      return {
        zona: z,
        nivel,
        reqMin: this.getZoneRequiredUve(z),
        reqMax: this.getZoneMaxUve(z),
        maxConMargen: Number((this.getZoneMaxUve(z) + tol).toFixed(2)),
        cubierta: 0,
        unidades: [] as typeof pool,
      };
    });

    const reqTotalZonas = Number(
      estadoZonas.reduce((acc, ez) => acc + ez.reqMin, 0).toFixed(2)
    );

    // ── 1. Asignar ZONAS DE RIESGO ALTO (Solo FZ / RPT [1.00], o bien RPD [0.80] + MTT [0.45]) ──
    for (const ez of estadoZonas.filter(x => x.nivel === 'ALTO')) {
      const restantes = pool.filter(x => !x.asignada);
      const unidadAltaExacta = restantes.find(r => r.tipo === 'FZ' || r.tipo === 'RPT');
      if (unidadAltaExacta) {
        unidadAltaExacta.asignada = true;
        ez.unidades.push(unidadAltaExacta);
        ez.cubierta = Number(unidadAltaExacta.uve.toFixed(2));
        continue;
      }

      // Complemento RPD (0.80) + MTT (0.45) = 1.25 U.V.E.
      const unidadRpd = restantes.find(r => r.tipo === 'RPD');
      if (unidadRpd) {
        unidadRpd.asignada = true;
        ez.unidades.push(unidadRpd);
        ez.cubierta = Number((ez.cubierta + unidadRpd.uve).toFixed(2));

        const unidadMtt = pool.find(r => !r.asignada && r.tipo === 'MTT');
        if (unidadMtt) {
          unidadMtt.asignada = true;
          ez.unidades.push(unidadMtt);
          ez.cubierta = Number((ez.cubierta + unidadMtt.uve).toFixed(2));
        }
        continue;
      }

      const unidadMttSola = restantes.find(r => r.tipo === 'MTT');
      if (unidadMttSola) {
        unidadMttSola.asignada = true;
        ez.unidades.push(unidadMttSola);
        ez.cubierta = Number(unidadMttSola.uve.toFixed(2));
      }
    }

    // ── 2. Asignar ZONAS DE RIESGO MEDIO (Solo MTT [0.45] o RPD [0.80]; NUNCA CB ni INF) ──
    for (const ez of estadoZonas.filter(x => x.nivel === 'MEDIO')) {
      const restantes = pool.filter(x => !x.asignada);
      const candidataMedia = restantes.find(r => r.tipo === 'RPD' || r.tipo === 'MTT');
      if (candidataMedia) {
        candidataMedia.asignada = true;
        ez.unidades.push(candidataMedia);
        ez.cubierta = Number(candidataMedia.uve.toFixed(2));
      }
    }

    // ── 3. Asignar ZONAS DE RIESGO BAJO (CB [0.30] o INF [0.20]) ──
    for (const ez of estadoZonas.filter(x => x.nivel === 'BAJO')) {
      const restantes = pool.filter(x => !x.asignada);
      const candidataBaja = restantes.find(r => r.tipo === 'CB' || r.tipo === 'INF');
      if (candidataBaja) {
        candidataBaja.asignada = true;
        ez.unidades.push(candidataBaja);
        ez.cubierta = Number(candidataBaja.uve.toFixed(2));
      }
    }

    // ── 4. En operación continua (cuando ya comenzó la ronda y el sistema trabaja solo con lo que hay):
    // Si alguna zona quedó vacía y todavía hay unidades sin asignar, utilizar lo que hay respetando la jerarquía
    // (sin meter CB/INF en MEDIO ni ALTO) para que ninguna unidad quede en espera.
    if (!estrictoInicial) {
      for (const ez of estadoZonas.filter(x => x.unidades.length === 0)) {
        const restantes = pool.filter(x => !x.asignada);
        if (restantes.length === 0) break;
        const compatibles = ez.nivel === 'BAJO'
          ? restantes
          : restantes.filter(r => r.tipo !== 'CB' && r.tipo !== 'INF');
        // Si es zona BAJA tomar la de menor U.V.E.; si es MAYOR tomar la de mayor U.V.E.
        const elegida = ez.nivel === 'BAJO'
          ? compatibles[compatibles.length - 1]
          : compatibles[0];
        if (elegida) {
          elegida.asignada = true;
          ez.unidades.push(elegida);
          ez.cubierta = Number(elegida.uve.toFixed(2));
        }
      }
    }

    const totalAsignado = Number(
      estadoZonas.reduce((acc, ez) => acc + ez.cubierta, 0).toFixed(2)
    );

    return {
      kZonas,
      toleranciaUve: tol,
      reqTotalZonas,
      totalAsignado,
      estadoZonas,
      pool,
      resumenCatalogo,
    };
  }

  readonly analisisModoOptimizado = computed(() => {
    const calc = this._calcularDistribucionUnificada('OPTIMIZADO', true);
    const porAgregar: Array<{
      zona: HotspotZone;
      zonaNombre: string;
      nivelRiesgo: string;
      deficit: number;
      tipoMedio: TipoMedio;
      valorUve: number;
      sugerencia: string;
    }> = [];

    const asignadasPorZona: Array<{
      zonaNombre: string;
      nivelRiesgo: string;
      uveRequerida: number;
      uveMaxConMargen: number;
      resumenUnidades: string;
    }> = [];

    for (const ez of calc.estadoZonas) {
      const nombres = ez.unidades.map(u => `${u.nombre} (${u.uve.toFixed(2)})`);
      const deficitZona = Math.max(0, Number((ez.reqMin - ez.cubierta).toFixed(2)));
      const tieneRpd = ez.unidades.some(u => u.tipo === 'RPD');
      const tieneMtt = ez.unidades.some(u => u.tipo === 'MTT');

      // En ALTO: si tiene RPD (0.80) sin MTT, falta complementar con MTT (0.45); si está vacía, falta FZ/RPT (1.00).
      // En MEDIO: si está vacía, falta MTT (0.45) o RPD (0.80).
      // En BAJO: si está vacía, falta INF (0.20) o CB (0.30).
      if (deficitZona > 0.001) {
        const rec = this.sugerirUnidadPorZonaYDeficit(ez.nivel, deficitZona, tieneRpd, tieneMtt);
        porAgregar.push({
          zona: ez.zona,
          zonaNombre: ez.zona.name,
          nivelRiesgo: ez.nivel,
          deficit: deficitZona,
          tipoMedio: rec.tipoMedio,
          valorUve: rec.valorUve,
          sugerencia: rec.sugerencia,
        });
        nombres.push(`+ Falta ${rec.tipoMedio} (${rec.valorUve.toFixed(2)})`);
      }

      asignadasPorZona.push({
        zonaNombre: ez.zona.name,
        nivelRiesgo: ez.nivel,
        uveRequerida: ez.reqMin,
        uveMaxConMargen: ez.maxConMargen,
        resumenUnidades: nombres.join(' + ') || 'Sin unidad compatible',
      });
    }

    const porEliminar = calc.pool.filter(x => !x.asignada);
    return {
      kZonas: calc.kZonas,
      toleranciaUve: calc.toleranciaUve,
      resumenCatalogo: calc.resumenCatalogo,
      asignadasPorZona,
      porAgregar,
      porEliminar,
    };
  });

  readonly propuestaOptimaAuto = computed(() => {
    const calc = this._calcularDistribucionUnificada(this.modoDespacho() === 'AUTO' ? 'AUTO' : 'OPTIMIZADO');
    let uveFaltante = 0;
    let primeraRecomendacion = '';

    const asignaciones = calc.estadoZonas.map(ez => {
      const def = Math.max(0, Number((ez.reqMin - ez.cubierta).toFixed(2)));
      if (def > 0.001) {
        uveFaltante = Number((uveFaltante + def).toFixed(2));
        if (!primeraRecomendacion) {
          const tieneRpd = ez.unidades.some(u => u.tipo === 'RPD');
          const tieneMtt = ez.unidades.some(u => u.tipo === 'MTT');
          primeraRecomendacion = this.sugerirUnidadPorZonaYDeficit(ez.nivel, def, tieneRpd, tieneMtt).sugerencia;
        }
      }
      return {
        zona: ez.zona,
        unidades: ez.unidades,
        uveRequerida: ez.reqMin,
        uveCubierta: ez.cubierta,
      };
    });

    const sobrantes = calc.pool.filter(item => !item.asignada);
    const uveSobrante = Number(
      sobrantes.reduce((acc, item) => acc + item.uve, 0).toFixed(2)
    );

    return {
      asignaciones,
      sobrantes,
      uveSobrante,
      uveFaltante,
      recomendacionUnidad: primeraRecomendacion,
    };
  });

  private _lastAutoRealDispatchMap = new Map<number, number>();

  private async _autoDispatchRealUnits(asignacionesReales: Map<number, HotspotZone>, modo: 'AUTO' | 'OPTIMIZADO'): Promise<void> {
    const unidadesActivas = this.store.unidades().filter(
      u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre
    );

    let huboCambios = false;

    for (const u of unidadesActivas) {
      if (u.estado_operativo === EstadoOperativo.OCUPADO_EMERGENCIA) continue;

      const targetZone = asignacionesReales.get(u.id_sesion);
      const asigActual = this.getAsignacionActiva(u);
      const matchedZoneActual = asigActual ? findMatchingHotspotZone(asigActual) : null;

      if (targetZone) {
        if (matchedZoneActual?.id === targetZone.id || this._lastAutoRealDispatchMap.get(u.id_sesion) === targetZone.id) {
          continue;
        }
        this._lastAutoRealDispatchMap.set(u.id_sesion, targetZone.id);
        try {
          await this.apiService.despacharManual({
            id_sesion: u.id_sesion,
            lat: targetZone.lat,
            lng: targetZone.lng,
            radio_m: targetZone.radio_m || 160,
            id_zona: targetZone.id,
            nombre_zona: targetZone.name,
            instrucciones: `Despacho ${modo === 'OPTIMIZADO' ? 'Auto-Optimizado' : 'Automático'} U.V.E. hacia ${targetZone.name} (${targetZone.address}).`,
          });
          this.iniciarCuentaRegresivaDespacho(u.id_sesion);
          huboCambios = true;
        } catch (err) {
          console.warn('[AutoDispatchReal] Error despachando unidad real:', err);
        }
      } else if (modo === 'OPTIMIZADO' && asigActual && asigActual.origen_asignacion !== 'REFUERZO_SOS') {
        this._lastAutoRealDispatchMap.delete(u.id_sesion);
        try {
          await this.apiService.cancelarAsignacion(asigActual.id_asignacion, u.id_sesion);
          huboCambios = true;
        } catch { }
      }
    }

    if (huboCambios) {
      const [freshAsigs, freshSesiones] = await Promise.all([
        this.apiService.getAsignacionesActivas().catch(() => []),
        this.apiService.getSesionesActivas().catch(() => []),
      ]);
      if (freshAsigs) {
        this.store.setAsignaciones(freshAsigs);
        freshAsigs.forEach(a => this.mapService.upsertPolygon(a));
      }
      if (freshSesiones && freshSesiones.length > 0) {
        this.store.setUnidades(freshSesiones);
        freshSesiones.forEach(s => this.mapService.upsertUnitMarker(s));
      }
      this.updateAllDispatchCountdowns();
    }
  }

  private _eliminarUnidadesSobrantesOptimizado(): void {
    const plan = this.analisisModoOptimizado();
    for (const sobrante of plan.porEliminar) {
      if (!sobrante.isReal && sobrante.patrulla) {
        this._clearTimers(sobrante.patrulla.id);
        this.mapService.removeFicticiaMarker(sobrante.patrulla.id);
        this.patrullasFicticias.update(list => list.filter(x => x.id !== sobrante.patrulla!.id));
        fetch(`${environment.apiBaseUrl}/tactico/patrullas/${encodeURIComponent(sobrante.patrulla.id)}`, {
          method: 'DELETE',
        }).catch(() => { });
        if (this.patrullaFicticiaSeleccionada()?.id === sobrante.patrulla.id) {
          this.patrullaFicticiaSeleccionada.set(null);
        }
      } else if (sobrante.isReal && sobrante.unidadReal) {
        const asig = this.getAsignacionActiva(sobrante.unidadReal);
        if (asig) {
          this.apiService.cancelarAsignacion(asig.id_asignacion, sobrante.unidadReal.id_sesion).catch(() => { });
        }
      }
    }
  }

  /**
   * Opción 1: Usar Demo -> Elimina sobrantes, crea unidades Demo para lo que falta
   * y las despacha de inmediato a su zona (nunca quedan esperando en Disponible).
   */
  confirmarOptimizadoConDemos(): void {
    this._eliminarUnidadesSobrantesOptimizado();
    const plan = this.analisisModoOptimizado();
    const nuevasAsignacionesDirectas = new Map<string, HotspotZone>();

    plan.porAgregar.forEach((faltante, idx) => {
      const medio = faltante.tipoMedio;
      const cfg = CONFIG_MEDIOS_UVE[medio];
      const tipoCompat =
        medio === 'FZ'
          ? 'FURGON_Z'
          : medio === 'MTT'
            ? 'MOTO'
            : medio === 'CB'
              ? 'BICICLETA'
              : medio === 'INF'
                ? 'INFANTERIA'
                : 'PATRULLA';
      const dotacionTotal = medio === 'RPT' ? 3 : medio === 'FZ' || medio === 'RPD' ? 2 : 1;
      const lat = -33.0235 + idx * 0.002;
      const lng = -71.5510 + idx * 0.002;

      const nuevaPatrulla: PatrullaFicticia = {
        id: crypto.randomUUID(),
        nombre: `Móvil ${medio}`,
        tipo: tipoCompat,
        tipo_medio: medio,
        valor_uve: cfg.valorUve,
        dotacion_total: dotacionTotal,
        estado: 'EN_RUTA',
        destinoZone: faltante.zona,
        isManual: false,
        lat,
        lng,
      };

      this.mapService.addFicticiaMarker(
        nuevaPatrulla.id,
        nuevaPatrulla.lat,
        nuevaPatrulla.lng,
        medio,
        'EN_RUTA',
        cfg.valorUve,
        dotacionTotal
      );
      this.patrullasFicticias.update(list => [...list, nuevaPatrulla]);
      nuevasAsignacionesDirectas.set(nuevaPatrulla.id, faltante.zona);

      fetch(`${environment.apiBaseUrl}/tactico/patrullas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: nuevaPatrulla.id,
          nombre: nuevaPatrulla.nombre,
          tipo_medio: medio,
          valor_uve: cfg.valorUve,
          dotacion_total: dotacionTotal,
          estado: 'EN_RUTA',
          lat: nuevaPatrulla.lat,
          lng: nuevaPatrulla.lng,
          destino_zona_id: faltante.zona.id,
          destino_zona_json: faltante.zona,
          is_manual: false,
          angulo_orbita: 0,
        }),
      }).catch(() => { });
    });

    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    this.aplicarModoDespacho('OPTIMIZADO', nuevasAsignacionesDirectas);
  }

  /**
   * Opción 2: Cuando el checklist en vivo de usuarios reales que iniciaron sesión se completa,
   * elimina sobrantes y despacha a todas las unidades (incluyendo las recién iniciadas).
   */
  finalizarChecklistYDespacharOptimizado(): void {
    this._eliminarUnidadesSobrantesOptimizado();
    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    this.aplicarModoDespacho('OPTIMIZADO');
  }

  aplicarModoDespacho(modo: 'AUTO' | 'OPTIMIZADO', forcedDemoTargets?: Map<string, HotspotZone>): void {
    this.confirmandoModo.set(null);
    this._lastAutoRealDispatchMap.clear();
    this._setModo(modo);

    this.store.patrullasFicticias.update(list =>
      list.map(p => (p.destinoZone?.id === 9999 ? p : { ...p, isManual: false }))
    );

    const previewZones = this.mapService.getTargetZonesForAutoPreview();

    fetch(`${environment.apiBaseUrl}/tactico/modo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modo_despacho: modo,
        k_zonas: this.settingsService.cantidadZonasRotacion(),
        intervalo_rotacion_seg: this.settingsService.intervaloRotacionSeg(),
        tiempo_llegada_min: this.settingsService.tiempoLlegadaMin(),
        zonas_activas_ids: previewZones.map(z => z.id),
      }),
    })
      .then(() => this._pullTacticoStateFromBackend())
      .catch(() => { });

    this._rebalanceAutoPatrols(false, forcedDemoTargets);
  }

  async desactivarModoAutomatico(): Promise<void> {
    this.confirmandoModo.set(null);
    this.avisoCierreSesionOpt.set(null);
    this.esperandoIngresoManualOpt.set(false);
    this.checklistRequisitosOpt.set([]);
    this._lastAutoRealDispatchMap.clear();
    this._setModo('MANUAL');

    // 1. Detener y dejar Disponibles las patrullas demo
    this.patrullasFicticias().forEach(p => {
      this._clearTimers(p.id);
      this.mapService.updateFicticiaMarkerColor(p.id, 'DISPONIBLE');
    });
    this.store.resetDemoPatrolsToAvailable();

    // 2. Finalizar automáticamente las misiones activas de TODAS las unidades reales en la base de datos
    //    para que en la App Móvil desaparezca de inmediato el destino y queden Disponibles
    const unidadesReales = this.store.unidades();
    const promesasCancelacion: Promise<any>[] = [];

    for (const u of unidadesReales) {
      const asig = this.getAsignacionActiva(u) || u.asignacion_activa;
      const tieneMision =
        asig ||
        u.estado_operativo === EstadoOperativo.EN_RUTA_HOTSPOT ||
        u.estado_operativo === EstadoOperativo.PATRULLANDO_ZONA;

      if (tieneMision) {
        const idAsig = asig?.id_asignacion ?? null;
        promesasCancelacion.push(
          this.apiService.cancelarAsignacion(idAsig, u.id_sesion).catch(() => { })
        );
        if (asig) {
          this._releaseMissionZone(asig);
        }
      }
    }

    // Limpiar inmediatamente el estado local en el Dashboard y en el Mapa
    this.store.asignaciones.set([]);
    this.dispatchCountdown.set(new Map());
    this.store.unidades.update(lista =>
      lista.map(u => {
        const updated: SesionOperativa = {
          ...u,
          asignacion_activa: null as any,
          estado_operativo:
            u.estado_operativo === EstadoOperativo.OCUPADO_EMERGENCIA
              ? u.estado_operativo
              : EstadoOperativo.DISPONIBLE,
        };
        this.mapService.upsertUnitMarker(updated);
        return updated;
      })
    );

    this.mapService.clearManualActiveZones();
    this.mapService.syncCycleState();

    fetch(`${environment.apiBaseUrl}/tactico/modo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo_despacho: 'MANUAL' }),
    }).catch(() => { });

    if (promesasCancelacion.length > 0) {
      await Promise.all(promesasCancelacion);
      const [freshAsigs, freshSesiones] = await Promise.all([
        this.apiService.getAsignacionesActivas().catch(() => []),
        this.apiService.getSesionesActivas().catch(() => []),
      ]);
      this.store.setAsignaciones(freshAsigs);
      if (freshSesiones.length > 0) {
        this.store.setUnidades(freshSesiones);
        freshSesiones.forEach(s => this.mapService.upsertUnitMarker(s));
      }
      this.reconcileActiveManualZones();
    }
  }

  terminarRondaFicticia(patrolId: string): void {
    const p = this.patrullasFicticias().find(x => x.id === patrolId);
    const zoneId = p?.destinoZone?.id;

    // Detener movimiento y marcar como DISPONIBLE (icono verde)
    this._clearTimers(patrolId);
    this._patch(patrolId, { estado: 'DISPONIBLE', destinoZone: undefined, isManual: false });
    this.mapService.updateFicticiaMarkerColor(patrolId, 'DISPONIBLE');

    // Liberar el círculo de la zona si ya no queda ninguna otra unidad en ella
    if (zoneId != null) {
      const quedan = this.patrullasFicticias().some(
        x => x.id !== patrolId && x.estado !== 'DISPONIBLE' && x.destinoZone?.id === zoneId
      );
      if (!quedan && !this.isAutoMode()) {
        this.mapService.releaseActiveZone(zoneId);
      }
    }
    this.mapService.syncCycleState();
    fetch(`${environment.apiBaseUrl}/tactico/patrullas/${encodeURIComponent(patrolId)}/terminar`, {
      method: 'POST',
    }).catch(() => { });
  }

  async dispararRotacionZonas(k: number): Promise<void> {
    this.kRotacionDashboard.set(k);
    const res = await this.apiService.seleccionarZonasRotativas(k);
    this.mapService.syncDatabaseZones(res.todas_las_zonas);
    this.mapService.activateRotatedZonesOnMap(res.zonas_seleccionadas.map(z => z.id_zona));
    this.mostrarToast({
      type: 'MENSAJE',
      titulo: `Rotación Anti-Fijación (K=${k})`,
      subtitulo: `Zonas asignadas: ${res.zonas_seleccionadas.map(z => z.nombre).join(', ')} · Demanda: ${res.uve_objetivo_total_min.toFixed(2)}-${res.uve_objetivo_total_max.toFixed(2)} U.V.E.`,
    });
  }

  simularAlertaSosUve(): void {
    const nuevaAlerta: AlertaEmergencia = {
      id_emergencia: Math.floor(Date.now() / 1000),
      id_sesion_solicitante: this.store.unidades()[0]?.id_sesion ?? 101,
      lat: -33.01533,
      lng: -71.55008,
      estado: 'ACTIVA',
      fecha_alerta: new Date().toISOString(),
    };
    this.store.agregarAlertaSOS(nuevaAlerta);
    this.mapService.addSOSMarker(nuevaAlerta.id_emergencia, nuevaAlerta.lat!, nuevaAlerta.lng!);
    this.mostrarToast({
      type: 'SOS',
      titulo: 'Solicitud de Refuerzo U.V.E.',
      subtitulo: 'Alerta de prueba generada en 8 Norte / Av. Libertad. Selecciona la U.V.E. requerida para despachar.',
    });
  }

  readonly totalUnidadesActivas = computed(() =>
    this.store.totalActivas() + this.patrullasFicticias().length
  );

  readonly dispatchCountdown = signal<Map<number, number>>(new Map());
  private dispatchIntervals: Map<number, any> = new Map();
  private etaGlobalTimer: any = null;

  private realtimeSubs: any[] = [];
  private pollingTimer: any = null;
  private gpsTimer: any = null;
  private moveTimers = new Map<string, any[]>();

  estadoConfig = (e: EstadoOperativo) => ESTADO_CONFIG[e];
  misionConfig = (e: EstadoMision) => MISION_CONFIG[e];

  getAsignacionActiva(unidad: SesionOperativa): AsignacionTactica | null {
    if (unidad.asignacion_activa && !['COMPLETADA', 'CANCELADA'].includes(unidad.asignacion_activa.estado_mision)) {
      return unidad.asignacion_activa;
    }
    const asignaciones = this.store.asignaciones();
    return asignaciones.find(
      a => a.id_sesion === unidad.id_sesion &&
        !['COMPLETADA', 'CANCELADA'].includes(a.estado_mision)
    ) ?? null;
  }

  fColor(e: PatrullaFicticia['estado']) {
    return e === 'DISPONIBLE' ? '#80B918' : e === 'EN_RUTA' ? '#2563eb' : '#d97706';
  }
  fLabel(e: PatrullaFicticia['estado']) {
    return e === 'DISPONIBLE' ? 'Disponible' : e === 'EN_RUTA' ? 'En Ruta' : 'Patrullando';
  }

  constructor() {
    effect(() => {
      const isAuto = this.modoDespacho() !== 'MANUAL';
      untracked(() => {
        if (!isAuto) {
          const patrullas = this.patrullasFicticias();
          if (patrullas.length > 0) {
            patrullas.forEach(p => {
              if (!p.isManual && (p.estado !== 'DISPONIBLE' || p.destinoZone)) {
                this._clearTimers(p.id);
                this._patch(p.id, { estado: 'DISPONIBLE', destinoZone: undefined });
                this.mapService.updateFicticiaMarkerColor(p.id, 'DISPONIBLE');
              }
            });
          }
        }
      });
    }, { allowSignalWrites: true });
  }

  private _rebalanceAutoPatrols(snapImmediately: boolean = false, forcedDemoTargets?: Map<string, HotspotZone>): void {
    if (!this.isAutoMode()) return;
    const zones = this.mapService.activeZones();
    if (zones.length === 0) return;

    const modo = this.modoDespacho() as 'AUTO' | 'OPTIMIZADO';
    // IMPORTANTE: En las rotaciones de ciclo NO se agregan ni se eliminan unidades automáticamente.
    // La flota se fija únicamente en la Primera Ronda cuando el operador confirma el Modo Optimizado
    // (o cuando decide reemplazar una baja por cierre de sesión), y a partir de ahí el sistema
    // trabaja solo manteniendo exactamente las mismas unidades en todas las rotaciones.
    const prop = this.propuestaOptimaAuto();

    const demoAssignments = new Map<string, HotspotZone>();
    const realAssignments = new Map<number, HotspotZone>();

    for (const a of prop.asignaciones) {
      for (const u of a.unidades) {
        if (u.isReal && u.unidadReal) {
          realAssignments.set(u.unidadReal.id_sesion, a.zona);
        } else if (!u.isReal && u.patrulla) {
          demoAssignments.set(u.patrulla.id, a.zona);
        }
      }
    }

    // Garantizar que cualquier unidad recién agregada al activar el modo OPTIMIZADO vaya directo a su zona objetivo
    if (forcedDemoTargets) {
      for (const [id, z] of forcedDemoTargets.entries()) {
        demoAssignments.set(id, z);
      }
    }

    // Distribuir cualquier unidad restante hacia las zonas compatibles sin dejarla quieta en Disponible
    if (prop.asignaciones.length > 0) {
      prop.sobrantes.forEach((item, idx) => {
        const esBaja = item.tipo === 'CB' || item.tipo === 'INF';
        const asigCompatible = esBaja
          ? (prop.asignaciones.find(a => this.getZoneRiskLevel(a.zona) === 'BAJO') ?? prop.asignaciones[prop.asignaciones.length - 1])
          : prop.asignaciones[idx % prop.asignaciones.length];
        const zonaDestino = asigCompatible.zona;
        if (item.isReal && item.unidadReal) {
          if (!realAssignments.has(item.unidadReal.id_sesion)) {
            realAssignments.set(item.unidadReal.id_sesion, zonaDestino);
          }
        } else if (!item.isReal && item.patrulla) {
          if (!demoAssignments.has(item.patrulla.id)) {
            demoAssignments.set(item.patrulla.id, zonaDestino);
          }
        }
      });
    }

    // El despacho automático de unidades reales ahora se ejecuta 100% en el Motor Táctico 24/7 del servidor
    // para evitar que dos pestañas o dispositivos distintos compitan enviando despachos duplicados.
  }

  ngOnInit(): void { }

  async ngAfterViewInit(): Promise<void> {
    await this.mapService.initMap(this.mapCanvasRef.nativeElement);
    this.mapService.getActiveManualZones = () => this.getActiveManualZoneIds();
    this.mapService.onMarkerClick = (idSesion) => {
      const unidad = this.store.unidades().find(u => u.id_sesion === idSesion);
      if (unidad) this.store.seleccionarUnidad(unidad);
    };

    this.mapService.onFicticiaClick = (id) => {
      const p = this.patrullasFicticias().find(item => item.id === id);
      if (p) this.selectPatrullaFicticia(p);
    };

    // Re-dibujar inmediatamente las unidades ya cacheadas en el store al volver desde otra pestaña
    this.store.unidades().forEach(s => this.mapService.upsertUnitMarker(s));
    this.store.asignaciones().forEach(a => this.mapService.upsertPolygon(a));
    this.patrullasFicticias().forEach(p => {
      const medio = this.getFicticiaMedioCode(p);
      this.mapService.upsertFicticiaMarker(p.id, p.lat, p.lng, medio, p.estado, this.getFicticiaUve(p), p.dotacion_total ?? 2);
    });

    // Sincronizar inmediatamente desde el Motor Táctico 24/7 del servidor (única fuente de verdad para todos los dispositivos y pestañas)
    await this._pullTacticoStateFromBackend();
    this.tacticalSyncTimer = setInterval(() => {
      this._pullTacticoStateFromBackend();
    }, 1000);

    const [sesiones, hotspots, asignaciones, alertas, posiciones, zonas] = await Promise.all([
      this.apiService.getSesionesActivas().catch(() => []),
      this.apiService.getHotspots().catch(() => []),
      this.apiService.getAsignacionesActivas().catch(() => []),
      this.apiService.getAlertasActivas().catch(() => []),
      this.supabase.getUltimasPosiciones().catch(() => []),
      this.apiService.getZonas().catch(() => []),
    ]);

    const posMap = new Map(posiciones.map(p => [p.id_sesion, p]));
    const asigActivaPorSesion = new Map(
      asignaciones
        .filter(a => a.estado_mision !== 'COMPLETADA' && a.estado_mision !== 'CANCELADA')
        .map(a => [a.id_sesion, a])
    );
    const sesionesConPos = sesiones.map(s => {
      const pos = posMap.get(s.id_sesion);
      const asig = asigActivaPorSesion.get(s.id_sesion);
      let estado = s.estado_operativo;
      if (asig && estado === EstadoOperativo.DISPONIBLE) {
        estado = asig.estado_mision === 'PATRULLANDO'
          ? EstadoOperativo.PATRULLANDO_ZONA
          : EstadoOperativo.EN_RUTA_HOTSPOT;
      }
      return {
        ...s,
        estado_operativo: estado,
        ...(pos ? { coordenadas_rt: { lat: pos.latitud, lng: pos.longitud } } : {}),
      };
    });

    this.store.setUnidades(sesionesConPos);
    this.store.setAsignaciones(asignaciones);
    this.store.alertasSOS.set(alertas as AlertaEmergencia[]);

    this.mapService.renderHeatmap(hotspots);
    this.mapService.renderPatrolZones(zonas);
    sesionesConPos.forEach(s => this.mapService.upsertUnitMarker(s));
    asignaciones.forEach(a => this.mapService.upsertPolygon(a));
    this.reconcileActiveManualZones();

    // Rebalancear una vez sincronizadas las zonas calibradas desde la BD
    if (this.isAutoMode()) {
      this._rebalanceAutoPatrols(true);
    }

    alertas.filter(a => a.estado === 'ACTIVA').forEach(a => {
      let lat = a.lat;
      let lng = a.lng;
      if (!lat && typeof a.geom_emergencia === 'string') {
        const pt = this.supabase.parseEwkbPoint(a.geom_emergencia);
        if (pt) { lat = pt.lat; lng = pt.lng; }
      } else if (!lat && (a.geom_emergencia as any)?.coordinates) {
        lat = (a.geom_emergencia as any).coordinates[1];
        lng = (a.geom_emergencia as any).coordinates[0];
      }
      if (lat && lng) this.mapService.addSOSMarker(a.id_emergencia, lat, lng);
    });

    this.mqttService.connect();
    this.mqttService.subscribeToAllUnits((payload) => {
      if (this.mapService.updateUnitPosition(payload.imei, payload.lat, payload.lng)) {
        this.store.updateGpsUnidad(payload);
      }
    });

    // Realtime Sesiones
    const sesionSub = this.supabase.subscribeToSesiones(async (event) => {
      const row = event.new ?? event.old;
      if (!row) return;
      const idSesion: number = row.id_sesion;

      if (event.eventType === 'INSERT') {
        if (!row.imei_simcard?.startsWith('DEMO-') && !row.fecha_cierre) {
          try {
            const sesionCompleta = await this.apiService.getSesionDetalle(idSesion);
            const existente = this.store.unidades().find(u => u.id_sesion === idSesion);
            if (!existente) {
              this.store.unidades.update(lista => [...lista, sesionCompleta]);
              this.mapService.upsertUnitMarker(sesionCompleta);
            }
          } catch (err) {
            console.warn('[Realtime] Error cargando sesión nueva:', err);
          }
        }
      } else if (event.eventType === 'UPDATE') {
        if (row.fecha_cierre) {
          const unidadCerrada = this.store.unidades().find(u => u.id_sesion === idSesion);
          this.store.unidades.update(lista => lista.filter(u => u.id_sesion !== idSesion));
          this.mapService.removeUnitMarkerById?.(idSesion);
          if (unidadCerrada) {
            this.notificarBajaUnidadReal(unidadCerrada);
          }
        } else {
          this.store.updateEstadoUnidad(idSesion, row.estado_operativo);
          const existing = this.store.unidades().find(u => u.id_sesion === idSesion);
          if (existing) {
            if (row.estado_operativo === 'PATRULLANDO_ZONA' && existing.asignacion_activa) {
              existing.asignacion_activa.estado_mision = EstadoMision.PATRULLANDO;
            }
            this.mapService.upsertUnitMarker({ ...existing, estado_operativo: row.estado_operativo });
          } else {
            // Sesión reactivada (desbloqueo de teléfono)
            try {
              const sesionCompleta = await this.apiService.getSesionDetalle(idSesion);
              const pos = await this.supabase.getUltimaPosicion(idSesion).catch(() => null);
              if (pos) {
                sesionCompleta.coordenadas_rt = { lat: pos.latitud, lng: pos.longitud };
              }
              this.store.unidades.update(lista => [...lista.filter(u => u.id_sesion !== idSesion), sesionCompleta]);
              this.mapService.upsertUnitMarker(sesionCompleta);
            } catch (err) {
              console.warn('[Realtime] Error reactivando sesión:', err);
            }
          }
        }
      }
    });

    // Realtime Telemetría
    const telemetriaSub = this.supabase.subscribeToTelemetria(async (telPayload) => {
      const { id_sesion, lat, lng } = telPayload;
      if (!lat || !lng) return;

      const existing = this.store.unidades().find(u => u.id_sesion === id_sesion);
      if (existing) {
        const updated = { ...existing, coordenadas_rt: { lat, lng } };
        this.store.unidades.update(lista =>
          lista.map(u => u.id_sesion === id_sesion ? updated : u)
        );
        this.mapService.upsertUnitMarker(updated);
      } else {
        // La unidad no estaba en store (teléfono se reactivó tras suspensión)
        try {
          const sesionCompleta = await this.apiService.getSesionDetalle(id_sesion);
          if (sesionCompleta && !sesionCompleta.fecha_cierre) {
            sesionCompleta.coordenadas_rt = { lat, lng };
            this.store.unidades.update(lista => [...lista.filter(u => u.id_sesion !== id_sesion), sesionCompleta]);
            this.mapService.upsertUnitMarker(sesionCompleta);
          }
        } catch (e) {
          console.warn('[telemetriaSub] Error cargando sesión reactivada:', e);
        }
      }
    });

    // Realtime Alertas SOS
    const alertaSub = this.supabase.subscribeToAlertas((event) => {
      if (event.new) {
        const nueva = event.new as any;
        if (nueva.estado === 'ACTIVA') {
          this.store.agregarAlertaSOS(nueva);
          this.store.showSOSDrawer.set(true);
          this.soundService.startSosAlarmLoop();
          this.mostrarToast({
            type: 'SOS',
            titulo: '¡Alerta de Refuerzos SOS!',
            subtitulo: `Móvil #${nueva.id_sesion_solicitante} ha emitido un pedido de auxilio urgente en terreno.`,
          });
          const coords = this.getAlertaCoords(nueva);
          this.mapService.addSOSMarker(nueva.id_emergencia, coords.lat, coords.lng);
          // Despacho automático inmediato según la U.V.E. configurada en el panel de Configuración
          this.uveDemandaSos.set(this.settingsService.uveSosObjetivo());
          this.despacharRefuerzosAuto(nueva);
        } else if (nueva.estado === 'RESUELTA') {
          this.store.resolverAlertaSOS(nueva.id_emergencia);
          this.mapService.removeSOSMarker(nueva.id_emergencia);
          if (nueva.id_sesion_solicitante) {
            this.store.updateEstadoUnidad(nueva.id_sesion_solicitante, EstadoOperativo.DISPONIBLE);
            const u = this.store.unidades().find(x => x.id_sesion === nueva.id_sesion_solicitante);
            if (u) {
              const updated = { ...u, estado_operativo: EstadoOperativo.DISPONIBLE };
              this.store.unidades.update(l => l.map(x => x.id_sesion === nueva.id_sesion_solicitante ? updated : x));
              this.mapService.upsertUnitMarker(updated);
            }
          }
          if (this.store.alertasActivasCount() === 0) {
            this.soundService.stopSosAlarm();
            this.store.showSOSDrawer.set(false);
          }
        }
      }
    });

    // Realtime Mensajes Tácticos desde patrullas
    const mensajeSub = this.supabase.subscribeToMensajes((event) => {
      const row = event?.new;
      if (row && row.remitente === 'FUNCIONARIO' && event.eventType === 'INSERT') {
        this.messageBadge.markUnread();
        const textoMsg = (row.texto || '').startsWith('[AUDIO]')
          ? '🎙️ Nota de voz táctica enviada por funcionario'
          : row.texto;
        this.mostrarToast({
          type: 'MENSAJE',
          titulo: `Mensaje de Móvil #${row.id_sesion}`,
          subtitulo: textoMsg || 'Nuevo reporte recibido en terreno.',
        });
      }
    });

    // Realtime Asignaciones Tácticas
    const asignacionSub = this.supabase.subscribeToAsignaciones((event: any) => {
      const row = event.new ?? event.old;
      if (!row) return;
      if (row.estado_mision === 'COMPLETADA' || row.estado_mision === 'CANCELADA') {
        this.store.asignaciones.update(list => list.filter(a => a.id_asignacion !== row.id_asignacion));
        if (row.id_sesion) {
          this.dispatchCountdown.update(m => {
            const next = new Map(m);
            next.delete(row.id_sesion);
            return next;
          });
          const u = this.store.unidades().find(x => x.id_sesion === row.id_sesion);
          if (u) {
            const updated = { ...u, asignacion_activa: null as any, estado_operativo: EstadoOperativo.DISPONIBLE };
            this.store.unidades.update(l => l.map(x => x.id_sesion === row.id_sesion ? updated : x));
            this.mapService.upsertUnitMarker(updated);
            if (this.store.unidadSeleccionada()?.id_sesion === row.id_sesion) {
              this.store.seleccionarUnidad(updated);
            }
          }
        }
        this._releaseMissionZone(row);
      } else if (event.eventType === 'INSERT' || event.eventType === 'UPDATE') {
        this.apiService.getAsignacionesActivas().then(asigs => {
          this.store.setAsignaciones(asigs);
          asigs.forEach(a => this.mapService.upsertPolygon(a));
        }).catch(() => { });
      }
    });

    this.realtimeSubs.push(sesionSub, telemetriaSub, alertaSub, mensajeSub, asignacionSub);

    // Polling de sincronización periódica (sin duplicar getZonas ni refreshPositions, ni sobrescribir asignaciones durante una transición vacía)
    const refreshDashboard = async () => {
      try {
        const [sesiones, posiciones, asignaciones] = await Promise.all([
          this.apiService.getSesionesActivas().catch(() => null),
          this.supabase.getUltimasPosiciones().catch(() => []),
          this.apiService.getAsignacionesActivas().catch(() => null),
        ]);
        if (Array.isArray(asignaciones)) {
          // Evitar sobrescribir el estado global con un arreglo vacío transitorio mientras sigo-api está rotando o insertando la nueva asignación
          const isRotating = this.isAutoMode() && asignaciones.length === 0 && this.store.asignaciones().length > 0 && this.store.unidades().length > 0;
          if (!isRotating) {
            const prevAsigs = this.store.asignaciones();
            const newIds = new Set(asignaciones.map(a => a.id_asignacion));
            for (const prev of prevAsigs) {
              if (!newIds.has(prev.id_asignacion)) {
                this._releaseMissionZone(prev);
              }
            }
            this.store.setAsignaciones(asignaciones);
            asignaciones.forEach(a => this.mapService.upsertPolygon(a));
            if (!this.isAutoMode()) {
              this.reconcileActiveManualZones();
            }
          }
        }
        if (!sesiones) return;

        const posMap = new Map(posiciones.map(p => [p.id_sesion, p]));
        const sesionMap = new Map(sesiones.map(s => [s.id_sesion, s]));
        const sesionesConPos = sesiones.map(s => {
          const pos = posMap.get(s.id_sesion);
          const prev = this.store.unidades().find(u => u.id_sesion === s.id_sesion);
          return pos
            ? { ...s, coordenadas_rt: { lat: pos.latitud, lng: pos.longitud } }
            : (prev?.coordenadas_rt ? { ...s, coordenadas_rt: prev.coordenadas_rt } : s);
        });

        const idsActuales = new Set(this.store.unidades().map(u => u.id_sesion));
        const nuevas = sesionesConPos.filter(s => !idsActuales.has(s.id_sesion));
        if (nuevas.length > 0) {
          this.store.unidades.update(lista => [...lista, ...nuevas]);
          nuevas.forEach(s => this.mapService.upsertUnitMarker(s));
        }

        const idsNuevos = new Set(sesiones.map(s => s.id_sesion));
        const cerradas = this.store.unidades().filter(u => !idsNuevos.has(u.id_sesion));
        if (cerradas.length > 0) {
          cerradas.forEach(u => this.mapService.removeUnitMarkerById?.(u.id_sesion));
          this.store.unidades.update(lista => lista.filter(u => idsNuevos.has(u.id_sesion)));
          cerradas.forEach(u => this.notificarBajaUnidadReal(u));
        }

        const selId = this.store.unidadSeleccionada()?.id_sesion;

        const asigsActivas = this.store.asignaciones().filter(
          a => a.estado_mision !== 'COMPLETADA' && a.estado_mision !== 'CANCELADA'
        );
        const asigMap = new Map(asigsActivas.map(a => [a.id_sesion, a]));

        this.store.unidades.update(lista => lista.map(u => {
          const fresh = sesionMap.get(u.id_sesion);
          const pos = posMap.get(u.id_sesion);
          const base = fresh ? { ...u, ...fresh } : u;
          const asig = asigMap.get(u.id_sesion) ?? u.asignacion_activa;
          let estado = base.estado_operativo;
          if (asig && estado === EstadoOperativo.DISPONIBLE) {
            estado = asig.estado_mision === 'PATRULLANDO'
              ? EstadoOperativo.PATRULLANDO_ZONA
              : EstadoOperativo.EN_RUTA_HOTSPOT;
          }
          const updated = {
            ...base,
            asignacion_activa: asig ?? base.asignacion_activa,
            estado_operativo: estado,
            ...(pos ? { coordenadas_rt: { lat: pos.latitud, lng: pos.longitud } } : {}),
          };
          this.mapService.upsertUnitMarker(updated);
          if (selId === u.id_sesion) {
            this.store.seleccionarUnidad(updated);
          }
          return updated;
        }));

        this.updateAllDispatchCountdowns();
      } catch (err) {
        console.warn('[Polling] Error:', err);
      }
    };

    refreshDashboard();
    this.pollingTimer = setInterval(refreshDashboard, 3000);

    // Cronómetro global de traslado y arribo a zonas para unidades en camino
    this.updateAllDispatchCountdowns();
    this.etaGlobalTimer = setInterval(() => this.updateAllDispatchCountdowns(), 1000);
  }

  ngOnDestroy(): void {
    this.soundService.stopSosAlarm();
    this.mqttService.disconnect();
    this.realtimeSubs.forEach(s => s.unsubscribe?.());
    this.moveTimers.forEach(timers => timers.forEach(t => clearInterval(t)));
    this.dispatchIntervals.forEach(t => clearInterval(t));
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.tacticalSyncTimer) clearInterval(this.tacticalSyncTimer);
    if (this.gpsTimer) clearInterval(this.gpsTimer);
    if (this.etaGlobalTimer) clearInterval(this.etaGlobalTimer);
    this.mapService.destroy();
  }

  toggleLayer(layer: 'heatmap' | 'simcards' | 'polygons' | 'flatmap', visible: boolean): void {
    this.mapService.toggleLayer(layer, visible);
    switch (layer) {
      case 'heatmap': this.store.layerHeatmap.set(visible); break;
      case 'simcards': this.store.layerSimcards.set(visible); break;
      case 'polygons': this.store.layerPolygons.set(visible); break;
    }
  }


  selectUnidad(unidad: SesionOperativa): void {
    this.patrullaFicticiaSeleccionada.set(null);
    this.store.seleccionarUnidad(unidad);
  }

  selectPatrullaFicticia(p: PatrullaFicticia): void {
    this.store.seleccionarUnidad(null);
    const cur = this.patrullaFicticiaSeleccionada();
    this.patrullaFicticiaSeleccionada.set(cur?.id === p.id ? null : p);
  }

  centerOnUnit(unidad: SesionOperativa): void {
    const coords = unidad.coordenadas_rt;
    if (coords) this.mapService.centerOn(coords.lat, coords.lng);
  }

  centerOnAlerta(alerta: AlertaEmergencia): void {
    let lat = alerta.lat;
    let lng = alerta.lng;
    if (!lat && typeof alerta.geom_emergencia === 'string') {
      const pt = this.supabase.parseEwkbPoint(alerta.geom_emergencia);
      if (pt) { lat = pt.lat; lng = pt.lng; }
    } else if (!lat && (alerta.geom_emergencia as any)?.coordinates) {
      lat = (alerta.geom_emergencia as any).coordinates[1];
      lng = (alerta.geom_emergencia as any).coordinates[0];
    }
    if (lat && lng) this.mapService.centerOn(lat, lng, 16);
    this.store.showSOSDrawer.set(false);
  }

  abrirDespachoManual(unidad: SesionOperativa): void {
    this.unidadParaDespachoManual = unidad;
  }

  irAMensajes(): void {
    this.router.navigate(['/mensajes']);
  }

  async onDespachoRealizado(): Promise<void> {
    const sesion = this.unidadParaDespachoManual;
    this.unidadParaDespachoManual = null;
    const asignaciones = await this.apiService.getAsignacionesActivas().catch(() => []);
    this.store.setAsignaciones(asignaciones);
    asignaciones.forEach(a => this.mapService.upsertPolygon(a));
    const sesiones = await this.apiService.getSesionesActivas().catch(() => []);
    if (sesiones.length > 0) this.store.setUnidades(sesiones);

    if (sesion) {
      const asig = asignaciones.find(a =>
        a.id_sesion === sesion.id_sesion &&
        a.estado_mision !== EstadoMision.COMPLETADA &&
        a.estado_mision !== EstadoMision.CANCELADA
      );
      if (asig) {
        this.iniciarCuentaRegresivaDespacho(sesion.id_sesion);
      }
    }
  }

  async onDespachoCancelado(asigFromModal?: any): Promise<void> {
    const sesion = this.unidadParaDespachoManual;
    this.unidadParaDespachoManual = null;
    const asig = asigFromModal || (sesion ? this.getAsignacionActiva(sesion) : null) || sesion?.asignacion_activa;

    if (sesion) {
      this.store.asignaciones.update(lista =>
        lista.filter(a => a.id_sesion !== sesion.id_sesion)
      );
      this.dispatchCountdown.update(map => {
        const next = new Map(map);
        next.delete(sesion.id_sesion);
        return next;
      });
      const updated: SesionOperativa = {
        ...sesion,
        asignacion_activa: null as any,
        estado_operativo: EstadoOperativo.DISPONIBLE,
      };
      this.store.unidades.update(lista =>
        lista.map(u => u.id_sesion === sesion.id_sesion ? updated : u)
      );
      this.store.seleccionarUnidad(updated);
      this.mapService.upsertUnitMarker(updated);
    }

    if (asig) {
      this._releaseMissionZone(asig);
    } else {
      this.reconcileActiveManualZones();
    }

    const asignaciones = await this.apiService.getAsignacionesActivas().catch(() => []);
    this.store.setAsignaciones(asignaciones);
    const sesiones = await this.apiService.getSesionesActivas().catch(() => []);
    if (sesiones.length > 0) this.store.setUnidades(sesiones);
    this.reconcileActiveManualZones();
  }

  iniciarCuentaRegresivaDespacho(idSesion: number): void {
    // Poner inmediatamente en "En camino" (EN_RUTA_HOTSPOT)
    this.store.updateEstadoUnidad(idSesion, EstadoOperativo.EN_RUTA_HOTSPOT);
    this.updateAllDispatchCountdowns();
  }

  updateAllDispatchCountdowns(): void {
    const unidades = this.store.unidades();
    const asignaciones = this.store.asignaciones();
    const limitMin = this.settingsService.tiempoLlegadaMin();
    const nextMap = new Map<number, number>();

    for (const u of unidades) {
      if (u.estado_operativo === EstadoOperativo.EN_RUTA_HOTSPOT) {
        const asig = u.asignacion_activa || asignaciones.find(
          a => a.id_sesion === u.id_sesion &&
            a.estado_mision !== EstadoMision.COMPLETADA &&
            a.estado_mision !== EstadoMision.CANCELADA &&
            !a.hora_ingreso_zona
        );

        if (asig && asig.hora_despacho) {
          let asigLimitMin = limitMin;
          if (asig.instrucciones?.includes('Código Rojo')) {
            const match = asig.instrucciones.match(/\[ETA:(\d+)\]/);
            if (match) asigLimitMin = parseInt(match[1], 10);
          }

          const raw = asig.hora_despacho;
          const iso = raw.endsWith('Z') || raw.includes('+') ? raw : raw + 'Z';
          const startMs = new Date(iso).getTime();
          const targetMs = startMs + asigLimitMin * 60 * 1000;
          const remSecs = Math.round((targetMs - Date.now()) / 1000);
          nextMap.set(u.id_sesion, remSecs);
        }
      }
    }

    this.dispatchCountdown.set(nextMap);
  }

  formatDispatchTime(secs: number): string {
    const isNegative = secs < 0;
    const abs = Math.abs(secs);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    if (isNegative) {
      return `+${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  agregarPatrullaFicticia(): void {
    if (!this.newPatrolForm.nombre.trim()) return;
    if (this.patrullasFicticias().length >= MAX_PATRULLAS) return;

    const offset = this.patrullasFicticias().length;
    const lat = -33.0245 + (offset - 1) * 0.004;
    const lng = -71.5518 + (offset - 1) * 0.003;
    const medio = this.newPatrolForm.tipo_medio || 'RPT';
    const cfg = CONFIG_MEDIOS_UVE[medio];
    const tipoCompat =
      medio === 'FZ'
        ? 'FURGON_Z'
        : medio === 'MTT'
          ? 'MOTO'
          : medio === 'CB'
            ? 'BICICLETA'
            : medio === 'INF'
              ? 'INFANTERIA'
              : 'PATRULLA';
    const dotacionTotal = medio === 'RPT' ? 3 : medio === 'FZ' || medio === 'RPD' ? 2 : 1;

    const p: PatrullaFicticia = {
      id: crypto.randomUUID(),
      nombre: this.newPatrolForm.nombre.trim(),
      tipo: tipoCompat,
      tipo_medio: medio,
      valor_uve: cfg.valorUve,
      dotacion_total: dotacionTotal,
      estado: 'DISPONIBLE',
      lat, lng,
    };

    this.mapService.addFicticiaMarker(p.id, p.lat, p.lng, medio, 'DISPONIBLE', cfg.valorUve, dotacionTotal);
    this.patrullasFicticias.update(list => [...list, p]);
    this.newPatrolForm = { nombre: '', tipo_medio: 'RPT' };
    this.showAddPatrolModal.set(false);
    this.patrullaFicticiaSeleccionada.set(p);

    fetch(`${environment.apiBaseUrl}/tactico/patrullas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        nombre: p.nombre,
        tipo_medio: medio,
        valor_uve: cfg.valorUve,
        dotacion_total: dotacionTotal,
        estado: 'DISPONIBLE',
        lat: p.lat,
        lng: p.lng,
        destino_zona_id: null,
        destino_zona_json: null,
        is_manual: false,
        angulo_orbita: 0,
      }),
    }).catch(() => { });

    this._rebalanceAutoPatrols();
  }

  eliminarPatrullaFicticia(p: PatrullaFicticia): void {
    this._deletedPatrolIds.add(p.id);
    this._clearTimers(p.id);
    this.mapService.removeFicticiaMarker(p.id);
    this.patrullasFicticias.update(list => list.filter(x => x.id !== p.id));
    fetch(`${environment.apiBaseUrl}/tactico/patrullas/${encodeURIComponent(p.id)}`, {
      method: 'DELETE',
    }).catch(() => { });
    if (this.patrullaFicticiaSeleccionada()?.id === p.id) {
      this.patrullaFicticiaSeleccionada.set(null);
    }
    this._rebalanceAutoPatrols();
  }

  silenciarSirena(): void {
    this.soundService.stopSosAlarm();
    this.mostrarToast({
      type: 'SOS',
      titulo: 'Sirena Silenciada',
      subtitulo: 'Sirena acústica silenciada por el operador. La emergencia continúa activa.',
    });
  }

  getAlertaCoords(alerta: AlertaEmergencia): { lat: number; lng: number } {
    let lat = alerta.lat;
    let lng = alerta.lng;
    const geom: any = alerta.geom_emergencia;

    if (!lat || !lng) {
      if (typeof geom === 'string') {
        const ewktMatch = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (ewktMatch) {
          lng = parseFloat(ewktMatch[1]);
          lat = parseFloat(ewktMatch[2]);
        } else {
          const pt = this.supabase.parseEwkbPoint(geom);
          if (pt) { lat = pt.lat; lng = pt.lng; }
        }
      } else if (geom?.coordinates) {
        lat = geom.coordinates[1];
        lng = geom.coordinates[0];
      }
    }

    if (!lat || !lng) {
      const solicitante = this.store.unidades().find(u => u.id_sesion === alerta.id_sesion_solicitante);
      if (solicitante?.coordenadas_rt) {
        lat = solicitante.coordenadas_rt.lat;
        lng = solicitante.coordenadas_rt.lng;
      }
    }

    return { lat: lat || -33.0245, lng: lng || -71.5518 };
  }

  calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getCandidatosRefuerzo(alerta: AlertaEmergencia) {
    const coords = this.getAlertaCoords(alerta);
    const VEL_KMH: Record<string, number> = {
      RPT: 50,
      RPD: 50,
      FZ: 45,
      MTT: 55,
      CB: 20,
      INF: 5,
    };

    const result: Array<{
      id: string;
      idReal?: number;
      demoId?: string;
      nombre: string;
      tipo: string;
      tipoMedio: TipoMedio;
      valorUve: number;
      isDemo: boolean;
      lat: number;
      lng: number;
      distanciaKm: number;
      etaMinutos: number;
    }> = [];

    for (const u of this.store.unidades()) {
      if (u.id_sesion === alerta.id_sesion_solicitante) continue;
      if (u.estado_operativo === EstadoOperativo.INACTIVO || (u as any).fecha_cierre) continue;
      const pos = u.coordenadas_rt;
      const lat = pos?.lat ?? -33.0245;
      const lng = pos?.lng ?? -71.5518;
      const dist = this.calcularDistanciaKm(coords.lat, coords.lng, lat, lng);
      const uveInfo = calcularUveSesion(u);
      const vel = VEL_KMH[uveInfo.tipoMedio] || 45;
      const eta = Math.max(1, Number(((dist / vel) * 60).toFixed(1)));
      result.push({
        id: `real-${u.id_sesion}`,
        idReal: u.id_sesion,
        nombre: u.identificador_unidad || `Móvil #${u.id_sesion}`,
        tipo: u.tipo_transporte || 'PATRULLA',
        tipoMedio: uveInfo.tipoMedio,
        valorUve: uveInfo.valorUve,
        isDemo: false,
        lat,
        lng,
        distanciaKm: dist,
        etaMinutos: eta,
      });
    }

    for (const p of this.patrullasFicticias()) {
      const dist = this.calcularDistanciaKm(coords.lat, coords.lng, p.lat, p.lng);
      const tipoMedio = this.getFicticiaMedioCode(p);
      const valorUve = this.getFicticiaUve(p);
      const vel = VEL_KMH[tipoMedio] || 45;
      const eta = Math.max(1, Number(((dist / vel) * 60).toFixed(1)));
      result.push({
        id: `demo-${p.id}`,
        demoId: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        tipoMedio,
        valorUve,
        isDemo: true,
        lat: p.lat,
        lng: p.lng,
        distanciaKm: dist,
        etaMinutos: eta,
      });
    }

    // Ordenar por menor ETA y, en caso de empate, mayor aporte U.V.E.
    return result.sort((a, b) => a.etaMinutos - b.etaMinutos || b.valorUve - a.valorUve);
  }

  getPreseleccionRefuerzoUve(alerta: AlertaEmergencia) {
    const candidatos = this.getCandidatosRefuerzo(alerta)
      .filter(c => c.tipoMedio !== 'CB' && c.tipoMedio !== 'INF')
      .sort((a, b) => {
        const aEsMoto = a.tipoMedio === 'MTT' ? 1 : 0;
        const bEsMoto = b.tipoMedio === 'MTT' ? 1 : 0;
        if (aEsMoto !== bEsMoto) return aEsMoto - bEsMoto;
        return a.etaMinutos - b.etaMinutos;
      });
    const metaSos = this.settingsService.uveSosObjetivo();
    const seleccionadas: typeof candidatos = [];
    let acumulada = 0;
    // Puede faltar un poco de U.V.E., pero nunca pasarse/sobrar respecto a metaSos
    for (const c of candidatos) {
      if (acumulada + c.valorUve <= metaSos + 0.001) {
        seleccionadas.push(c);
        acumulada = Number((acumulada + c.valorUve).toFixed(2));
        if (Math.abs(acumulada - metaSos) <= 0.001) break;
      }
    }
    return seleccionadas;
  }

  toggleUnidadSos(id: string): void {
    const limit = this.settingsService.recursosSos();
    const list = this.unidadesSeleccionadasSos();
    if (list.includes(id)) {
      this.unidadesSeleccionadasSos.set(list.filter(x => x !== id));
    } else {
      if (list.length >= limit) {
        this.mostrarToast({
          type: 'MENSAJE',
          titulo: 'Límite de Recursos',
          subtitulo: `La configuración actual permite seleccionar máximo ${limit} recursos para SOS.`,
        });
        return;
      }
      this.unidadesSeleccionadasSos.set([...list, id]);
    }
  }

  isUnidadSosSeleccionada(id: string): boolean {
    return this.unidadesSeleccionadasSos().includes(id);
  }

  async despacharRefuerzosAuto(alerta: AlertaEmergencia): Promise<void> {
    const elegidas = this.getPreseleccionRefuerzoUve(alerta);
    if (elegidas.length === 0) {
      alert('No hay unidades operativas disponibles para despachar como refuerzo.');
      return;
    }
    const metaSos = this.settingsService.uveSosObjetivo();
    const coords = this.getAlertaCoords(alerta);
    this.apiService.despacharRefuerzosUve(
      alerta.id_sesion_solicitante,
      metaSos,
      coords.lat,
      coords.lng,
      this.store.unidades()
    ).catch(() => { });

    const uveCubierta = Number(elegidas.reduce((acc, e) => acc + e.valorUve, 0).toFixed(2));
    this.ultimoDespachoUve.set({
      uveDemandada: metaSos,
      uveCubierta,
      unidades: elegidas.map(e => ({
        id: e.id,
        nombre: e.nombre,
        tipoMedio: e.tipoMedio,
        valorUve: e.valorUve,
        etaMinutos: e.etaMinutos,
      })),
    });

    await this._ejecutarDespachoRefuerzos(alerta, elegidas);
  }

  async despacharRefuerzosManual(alerta: AlertaEmergencia): Promise<void> {
    const seleccionadosIds = new Set(this.unidadesSeleccionadasSos());
    const candidatos = this.getCandidatosRefuerzo(alerta);
    const elegidas = candidatos.filter(c => seleccionadosIds.has(c.id));
    if (elegidas.length === 0) {
      alert('Seleccione al menos una unidad para despachar.');
      return;
    }
    await this._ejecutarDespachoRefuerzos(alerta, elegidas);
  }

  private async _ejecutarDespachoRefuerzos(alerta: AlertaEmergencia, elegidas: any[]): Promise<void> {
    this.despachandoSos.set(true);
    const coords = this.getAlertaCoords(alerta);
    const nombresDespachados: string[] = [];

    try {
      let despachadosReales = false;

      for (const item of elegidas) {
        nombresDespachados.push(item.nombre);
        if (item.isDemo && item.demoId) {
          const demo = this.patrullasFicticias().find(p => p.id === item.demoId);
          if (demo) {
            const sosZona = {
              id: 9999,
              name: `🚨 SOS #${alerta.id_sesion_solicitante}`,
              address: 'Alerta SOS',
              lat: coords.lat,
              lng: coords.lng,
              radio_m: 120,
              scoreGravedad: 100,
              nivelRiesgo: 'ALTO' as const,
              uveObjetivoMin: 1.0,
            };
            this._dispatchToCoords(demo, coords.lat, coords.lng, `🚨 SOS #${alerta.id_sesion_solicitante}`);
            fetch(`${environment.apiBaseUrl}/tactico/patrullas/${encodeURIComponent(demo.id)}/despachar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ zona: sosZona }),
            }).catch(() => { });
          }
        } else if (item.idReal) {
          try {
            await this.apiService.despacharManual({
              id_sesion: item.idReal,
              lat: coords.lat,
              lng: coords.lng,
              radio_m: 50,
              nombre_zona: `REFUERZO SOS - Móvil #${alerta.id_sesion_solicitante}`,
              instrucciones: `Código Rojo: Desplazamiento urgente de apoyo a emergencia activa.`,
            });
            this.iniciarCuentaRegresivaDespacho(item.idReal);
            despachadosReales = true;
          } catch (e: any) {
            console.error('[SOS Dispatch Real] Error despachando unidad real:', e);
            alert(`Error al despachar ${item.nombre}: ` + (e.message || 'Error desconocido'));
          }
        }
      }

      if (despachadosReales) {
        const [freshAsigs, freshSesiones] = await Promise.all([
          this.apiService.getAsignacionesActivas().catch(() => []),
          this.apiService.getSesionesActivas().catch(() => []),
        ]);
        if (freshAsigs.length > 0) {
          this.store.setAsignaciones(freshAsigs);
          freshAsigs.forEach(a => this.mapService.upsertPolygon(a));
        }
        if (freshSesiones.length > 0) {
          this.store.setUnidades(freshSesiones);
          freshSesiones.forEach(s => this.mapService.upsertUnitMarker(s));
        }
        this.updateAllDispatchCountdowns();
      }

      // Centrar el mapa en la emergencia con las patrullas convergiendo
      this.mapService.centerOn(coords.lat, coords.lng, 15);

      this.unidadesSeleccionadasSos.set([]);
      this.mostrarToast({
        type: 'SOS',
        titulo: 'Refuerzos Despachados',
        subtitulo: `${elegidas.length} unidad(es) convergiendo en código rojo: ${nombresDespachados.join(', ')}`,
      });
    } finally {
      this.despachandoSos.set(false);
    }
  }

  private _dispatchToCoords(patrulla: PatrullaFicticia, targetLat: number, targetLng: number, name: string): void {
    this._clearTimers(patrulla.id);
    const current = this.patrullasFicticias().find(p => p.id === patrulla.id);
    if (!current) return;

    const startLat = current.lat;
    const startLng = current.lng;

    const mockZone: HotspotZone = {
      id: 9999,
      name,
      address: 'Sitio de Suceso SOS',
      lat: targetLat,
      lng: targetLng,
      crimeCount: 10,
    };

    // isManual: true evita que el bucle rotativo de zonas cancele la misión hacia la emergencia
    this._patch(patrulla.id, { isManual: true, estado: 'EN_RUTA', destinoZone: mockZone });
    this.mapService.updateFicticiaMarkerColor(patrulla.id, 'EN_RUTA');

    const STEPS = 25;
    const DELAY = 350;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const t = this._ease(step / STEPS);
      const lat = startLat + (targetLat - startLat) * t;
      const lng = startLng + (targetLng - startLng) * t;

      this.mapService.moveFicticiaMarker(patrulla.id, lat, lng);
      this._patch(patrulla.id, { lat, lng });

      if (step >= STEPS) {
        clearInterval(timer);
        this._patch(patrulla.id, { lat: targetLat, lng: targetLng, estado: 'PATRULLANDO' });
        this.mapService.updateFicticiaMarkerColor(patrulla.id, 'PATRULLANDO');
        this.mapService.moveFicticiaMarker(patrulla.id, targetLat, targetLng);
      }
    }, DELAY);

    this._storeTimer(patrulla.id, timer);
  }

  async resolverAlerta(id: number): Promise<void> {
    this.alertaPorResolver.set(null);
    const alerta = this.store.alertasSOS().find(a => a.id_emergencia === id);
    const idSesion = alerta?.id_sesion_solicitante;

    await this.apiService.resolverAlerta(id, idSesion).catch(() => { });
    this.mapService.removeSOSMarker(id);
    this.store.resolverAlertaSOS(id);
    this.ultimoDespachoUve.set(null);

    // Liberar patrullas que estaban atendiendo el SOS (destinoZone.id === 9999)
    for (const p of this.patrullasFicticias()) {
      if (p.destinoZone?.id === 9999) {
        this.terminarRondaFicticia(p.id);
      }
    }

    if (idSesion) {
      this.store.updateEstadoUnidad(idSesion, EstadoOperativo.DISPONIBLE);
      const u = this.store.unidades().find(x => x.id_sesion === idSesion);
      if (u) {
        const updated = { ...u, estado_operativo: EstadoOperativo.DISPONIBLE };
        this.store.unidades.update(l => l.map(x => x.id_sesion === idSesion ? updated : x));
        this.mapService.upsertUnitMarker(updated);
        if (this.store.unidadSeleccionada()?.id_sesion === idSesion) {
          this.store.seleccionarUnidad(updated);
        }
      }
    }

    // Cancelar refuerzos SOS asignados
    const asigsRefuerzo = this.store.asignaciones().filter(a =>
      a.nombre_zona?.includes(`REFUERZO SOS`) ||
      (idSesion && a.nombre_zona?.includes(`Móvil #${idSesion}`))
    );
    for (const ar of asigsRefuerzo) {
      await this.apiService.cancelarAsignacion(ar.id_asignacion, ar.id_sesion).catch(() => { });
      this.store.asignaciones.update(list => list.filter(a => a.id_asignacion !== ar.id_asignacion));
      this._releaseMissionZone(ar);
      this.store.updateEstadoUnidad(ar.id_sesion, EstadoOperativo.DISPONIBLE);
      const ru = this.store.unidades().find(x => x.id_sesion === ar.id_sesion);
      if (ru) {
        const updated = { ...ru, asignacion_activa: null as any, estado_operativo: EstadoOperativo.DISPONIBLE };
        this.store.unidades.update(l => l.map(x => x.id_sesion === ar.id_sesion ? updated : x));
        this.mapService.upsertUnitMarker(updated);
      }
    }

    // Reincorporar patrullas demo que acudieron al auxilio SOS
    this.patrullasFicticias().forEach(p => {
      if (p.destinoZone?.id === 9999) {
        this.restablecerAutoPatrullaFicticia(p);
      }
    });

    if (this.store.alertasActivasCount() === 0) {
      this.soundService.stopSosAlarm();
      this.store.showSOSDrawer.set(false);
    }

    this.mostrarToast({
      type: 'SOS',
      titulo: 'Emergencia Resuelta',
      subtitulo: `La alerta #${id} ha sido resuelta y archivada.`,
    });
  }

  private _releaseMissionZone(asig: any): void {
    if (!asig) return;
    if (asig.id_asignacion) {
      this.mapService.removePolygon(asig.id_asignacion);
    }
    const matchedHotspot = findMatchingHotspotZone(asig);
    if (matchedHotspot) {
      this.mapService.releaseActiveZone(matchedHotspot.id);
    }
    this.reconcileActiveManualZones();
  }

  getActiveManualZoneIds(): Set<number> {
    const activeIds = new Set<number>();

    // Si estamos en modo Automático u Optimizado, la selección de zonas activas la controla
    // exclusivamente el ciclo rotativo (evita que despachos anteriores se sumen y dupliquen la cantidad de zonas)
    if (this.isAutoMode()) {
      return activeIds;
    }

    // 1. Asignaciones reales activas del store (solo en Modo Manual)
    const asignaciones = this.store.asignaciones();
    for (const a of asignaciones) {
      if (a.estado_mision !== 'COMPLETADA' && a.estado_mision !== 'CANCELADA') {
        const matched = findMatchingHotspotZone(a);
        if (matched) {
          activeIds.add(matched.id);
        }
      }
    }

    // 2. Unidades reales con asignación activa o en ruta/patrullaje
    for (const u of this.store.unidades()) {
      const asig = this.getAsignacionActiva(u);
      if (asig && asig.estado_mision !== 'COMPLETADA' && asig.estado_mision !== 'CANCELADA') {
        const matched = findMatchingHotspotZone(asig);
        if (matched) {
          activeIds.add(matched.id);
        }
      }
    }

    // 3. Patrullas ficticias con despacho manual activo
    for (const p of this.patrullasFicticias()) {
      if (p.isManual && p.estado !== 'DISPONIBLE' && p.destinoZone) {
        activeIds.add(p.destinoZone.id);
      }
    }

    return activeIds;
  }

  reconcileActiveManualZones(): void {
    const activeIds = this.getActiveManualZoneIds();
    this.mapService.reconcileManualActiveZones(activeIds);
  }

  async finalizarRondaDirecto(unidad: SesionOperativa): Promise<void> {
    try {
      const asig = this.getAsignacionActiva(unidad) || unidad.asignacion_activa;
      const idAsig = asig?.id_asignacion ?? unidad.asignacion_activa?.id_asignacion ?? null;

      await this.apiService.cancelarAsignacion(
        idAsig,
        unidad.id_sesion
      );

      // 1. Limpiar del store de asignaciones PRIMERO para que getAsignacionActiva y getActiveManualZoneIds no lo vean
      this.store.asignaciones.update(lista =>
        lista.filter(a => a.id_sesion !== unidad.id_sesion && (idAsig == null || a.id_asignacion !== idAsig))
      );

      // 2. Limpiar cronómetro de traslado
      this.dispatchCountdown.update(map => {
        const next = new Map(map);
        next.delete(unidad.id_sesion);
        return next;
      });

      // 3. Actualizar unidad a DISPONIBLE de inmediato
      this.store.updateEstadoUnidad(unidad.id_sesion, EstadoOperativo.DISPONIBLE);
      const updated: SesionOperativa = {
        ...unidad,
        asignacion_activa: null as any,
        estado_operativo: EstadoOperativo.DISPONIBLE,
      };
      this.store.unidades.update(lista =>
        lista.map(u => u.id_sesion === unidad.id_sesion ? updated : u)
      );
      this.store.seleccionarUnidad(updated);
      this.mapService.upsertUnitMarker(updated);

      // 4. Liberar la zona táctica y retirar circunferencia en el mapa INMEDIATAMENTE
      if (asig) {
        this._releaseMissionZone(asig);
      } else {
        this.reconcileActiveManualZones();
      }

      // 5. Refrescar asignaciones activas desde la API y reconciliar zonas manuales
      const freshAsigs = await this.apiService.getAsignacionesActivas().catch(() => []);
      this.store.setAsignaciones(freshAsigs);
      this.reconcileActiveManualZones();

      this.mostrarToast({
        type: 'MENSAJE',
        titulo: 'Ronda Finalizada',
        subtitulo: `La unidad ${unidad.identificador_unidad} ha quedado en estado DISPONIBLE.`,
      });
    } catch (e: any) {
      alert('Error al finalizar la ronda: ' + (e.message || 'Error desconocido'));
    }
  }

  getTransportIcon(tipo?: string): string {
    switch (tipo) {
      case 'FURGON_Z':
      case 'FZ':
        return 'furgon';
      case 'MOTO':
      case 'MTT':
        return 'moto';
      case 'BICICLETA':
      case 'CB':
        return 'bici';
      case 'INFANTERIA':
      case 'INF':
        return 'peaton';
      default:
        return 'auto';
    }
  }

  abrirModalDespachoFicticia(p: PatrullaFicticia): void {
    this.patrullaParaDespachoFicticia = p;
    const sorted = this.getZonesSortedByPriority();
    this.zonaFicticiaSeleccionada = sorted[0] ?? null;
  }

  confirmarDespachoFicticiaManual(): void {
    const p = this.patrullaParaDespachoFicticia;
    const z = this.zonaFicticiaSeleccionada;
    if (!p || !z) return;

    this._patch(p.id, { isManual: true, estado: 'EN_RUTA', destinoZone: z });
    this.mapService.ensureActiveZone(z);
    this.mapService.updateFicticiaMarkerColor(p.id, 'EN_RUTA');
    this.patrullaParaDespachoFicticia = null;
    fetch(`${environment.apiBaseUrl}/tactico/patrullas/${encodeURIComponent(p.id)}/despachar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zona: z }),
    })
      .then(() => this._pullTacticoStateFromBackend())
      .catch(() => { });
    this.mostrarToast({
      type: 'MENSAJE',
      titulo: 'Patrulla Demo Despachada',
      subtitulo: `${p.nombre} en ruta manual hacia ${z.name} (${z.address}).`,
    });
  }

  restablecerAutoPatrullaFicticia(p: PatrullaFicticia): void {
    this._patch(p.id, { isManual: false });
    this._rebalanceAutoPatrols();
    this.mostrarToast({
      type: 'MENSAJE',
      titulo: 'Modo Automático Reanudado',
      subtitulo: `${p.nombre} reincorporada a la asignación por prioridad y U.V.E.`,
    });
  }

  private tacticalSyncTimer: any = null;
  private _deletedPatrolIds = new Set<string>();
  private _lastServerZoneKey = '';
  private _lastRealesSyncKey = '';

  private async _syncRealesToBackend(): Promise<void> {
    try {
      const reales = this.store.unidades()
        .filter(u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre)
        .map(u => {
          const info = this.getUnidadUveInfo(u);
          const asig = this.getAsignacionActiva(u);
          const matched = asig ? findMatchingHotspotZone(asig) : null;
          return {
            id_sesion: u.id_sesion,
            tipo_medio: info.tipoMedio,
            valor_uve: info.valorUve,
            destino_zona_id: matched?.id ?? null,
          };
        });
      const key = JSON.stringify(reales);
      if (key === this._lastRealesSyncKey) return;
      this._lastRealesSyncKey = key;
      await fetch(`${environment.apiBaseUrl}/tactico/reales-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reales }),
      });
    } catch { }
  }

  private async _pullTacticoStateFromBackend(): Promise<void> {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/tactico/estado`);
      if (!res.ok) return;
      const data = await res.json();

      const serverModo = (data.modo_despacho as 'MANUAL' | 'AUTO' | 'OPTIMIZADO') || 'MANUAL';
      const serverK = Number(data.k_zonas) || 3;
      const serverIntervalo = Number(data.intervalo_rotacion_seg) || 120;
      const serverZoneIds: number[] = Array.isArray(data.zonas_activas_ids) ? data.zonas_activas_ids : [];
      const serverRemaining = Number(data.segundos_restantes) || 0;

      if (this.modoDespacho() !== serverModo) {
        this._setModo(serverModo);
      }
      if (this.settingsService.cantidadZonasRotacion() !== serverK) {
        this.settingsService.cantidadZonasRotacion.set(serverK);
      }
      if (this.settingsService.intervaloRotacionSeg() !== serverIntervalo) {
        this.settingsService.intervaloRotacionSeg.set(serverIntervalo);
      }
      const serverEta = Number(data.tiempo_llegada_min) || 15;
      const localEtaSaved = Number(localStorage.getItem('sigo_tiempo_llegada_min'));
      if (localEtaSaved >= 1 && localEtaSaved <= 120) {
        if (this.settingsService.tiempoLlegadaMin() !== localEtaSaved) {
          this.settingsService.tiempoLlegadaMin.set(localEtaSaved);
        }
        if (serverEta !== localEtaSaved) {
          this.settingsService.syncTacticoConfig(
            this.settingsService.cantidadZonasRotacion(),
            this.settingsService.intervaloRotacionSeg(),
            localEtaSaved
          );
        }
      } else if (this.settingsService.tiempoLlegadaMin() !== serverEta) {
        this.settingsService.tiempoLlegadaMin.set(serverEta);
      }

      this.mapService.applyServerCycleState(
        serverModo,
        serverZoneIds,
        serverRemaining,
        Array.isArray(data.zonas_catalogo) ? data.zonas_catalogo : undefined
      );

      // Si cambió la rotación de zonas en el servidor y estamos en AUTO/OPTIMIZADO, actualizar estado local sin re-despachar desde el navegador
      const zoneKey = `${serverModo}:${serverZoneIds.join(',')}`;
      if (serverModo !== 'MANUAL' && serverZoneIds.length > 0 && zoneKey !== this._lastServerZoneKey) {
        this._lastServerZoneKey = zoneKey;
      } else if (serverModo === 'MANUAL') {
        this._lastServerZoneKey = '';
      }

      if (Array.isArray(data.patrullas)) {
        const currentList = this.patrullasFicticias();
        const serverIds = new Set<string>(data.patrullas.map((sp: any) => String(sp.id)));

          // Protección anti-borrado: si el servidor devuelve menos patrullas de las que conozco localmente
          // (instancia reiniciada / estado vacío) NO se borran del mapa: se re-siembran en el servidor.
          const faltantes = currentList.filter(lp => !serverIds.has(lp.id) && !this._deletedPatrolIds.has(lp.id));
          for (const lp of faltantes) {
            const medioSeed = this.getFicticiaMedioCode(lp);
            fetch(`${environment.apiBaseUrl}/tactico/patrullas`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: lp.id,
                nombre: lp.nombre,
                tipo_medio: medioSeed,
                valor_uve: this.getFicticiaUve(lp),
                dotacion_total: lp.dotacion_total ?? 2,
                estado: 'DISPONIBLE',
                lat: lp.lat,
                lng: lp.lng,
                destino_zona_id: null,
                destino_zona_json: null,
                is_manual: false,
                angulo_orbita: 0,
              }),
            }).catch(() => { });
            this.mapService.upsertFicticiaMarker(lp.id, lp.lat, lp.lng, medioSeed, lp.estado, this.getFicticiaUve(lp), lp.dotacion_total ?? 2);
          }
          if (faltantes.length > 0 && data.patrullas.length === 0) {
            return;
          }

          const syncedList: PatrullaFicticia[] = data.patrullas.map((sp: any) => {
            const medio = (sp.tipo_medio || 'RPD') as TipoMedio;
            const tipoCompat =
              medio === 'FZ'
                ? 'FURGON_Z'
                : medio === 'MTT'
                  ? 'MOTO'
                  : medio === 'CB'
                    ? 'BICICLETA'
                    : medio === 'INF'
                      ? 'INFANTERIA'
                      : 'PATRULLA';
            const dotacion = Number(sp.dotacion_total) || (medio === 'RPT' ? 3 : medio === 'FZ' || medio === 'RPD' ? 2 : 1);
            const uve = Number(sp.valor_uve) || CONFIG_MEDIOS_UVE[medio]?.valorUve || 0.8;
            const estado = (sp.estado as 'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO') || 'DISPONIBLE';
            const lat = Number(sp.lat) || -33.0235;
            const lng = Number(sp.lng) || -71.5510;

            let destinoZone: HotspotZone | undefined = undefined;
            if (sp.destino_zona_id != null) {
              destinoZone =
                HOTSPOT_ZONES.find(z => z.id === Number(sp.destino_zona_id)) ??
                (sp.destino_zona_json
                  ? {
                    id: Number(sp.destino_zona_json.id),
                    name: sp.destino_zona_json.name || 'Zona',
                    address: sp.destino_zona_json.address || 'Sector Táctico',
                    lat: Number(sp.destino_zona_json.lat),
                    lng: Number(sp.destino_zona_json.lng),
                    radio_m: Number(sp.destino_zona_json.radio_m) || 160,
                    crimeCount: Number(sp.destino_zona_json.crimeCount) || 6,
                    scoreGravedad: Number(sp.destino_zona_json.scoreGravedad) || 45,
                    nivelRiesgo: sp.destino_zona_json.nivelRiesgo || 'MEDIO',
                    uveObjetivoMin: Number(sp.destino_zona_json.uveObjetivoMin) || 0.45,
                  }
                  : undefined);
            }

            // Cancelar cualquier timer local residual: el servidor 24/7 mueve las coordenadas en tiempo real
            this._clearTimers(sp.id);

            // Siempre usar upsertFicticiaMarker para recrear el marcador tras recargar o cambiar de pestaña
            this.mapService.upsertFicticiaMarker(sp.id, lat, lng, medio, estado, uve, dotacion);

            if (sp.is_manual && destinoZone && serverModo === 'MANUAL') {
              this.mapService.ensureActiveZone(destinoZone);
            }

            return {
              id: String(sp.id),
              nombre: sp.nombre,
              tipo: tipoCompat,
              tipo_medio: medio,
              valor_uve: uve,
              dotacion_total: dotacion,
              estado,
              lat,
              lng,
              destinoZone,
              isManual: Boolean(sp.is_manual),
            };
          });

          const prevSig = currentList.map(x => `${x.id}:${x.estado}:${x.lat}:${x.lng}:${x.destinoZone?.id}`).join('|');
          const nextSig = syncedList.map(x => `${x.id}:${x.estado}:${x.lat}:${x.lng}:${x.destinoZone?.id}`).join('|');
          if (prevSig !== nextSig) {
            this.patrullasFicticias.set(syncedList);
            const sel = this.patrullaFicticiaSeleccionada();
            if (sel) {
              const updatedSel = syncedList.find(x => x.id === sel.id) ?? null;
              this.patrullaFicticiaSeleccionada.set(updatedSel);
            }
          }
        }
      } catch { }
    }

  private async _syncTacticoBackend(): Promise<void> {
    await this._pullTacticoStateFromBackend();
  }

  private _dispatchToZone(patrulla: PatrullaFicticia, zone: HotspotZone): void {
    this._clearTimers(patrulla.id);
    const current = this.patrullasFicticias().find(p => p.id === patrulla.id);
    if (!current) return;

    const startLat = current.lat;
    const startLng = current.lng;

    this._patch(patrulla.id, { estado: 'EN_RUTA', destinoZone: zone });
    this.mapService.updateFicticiaMarkerColor(patrulla.id, 'EN_RUTA');

    // Asegurar que la zona de patrullaje tenga activo su mapa de calor solo si es manual
    if (patrulla.isManual) {
      this.mapService.ensureActiveZone(zone);
    }

    const STEPS = 20;
    const DELAY = 500;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const t = this._ease(step / STEPS);
      const lat = startLat + (zone.lat - startLat) * t;
      const lng = startLng + (zone.lng - startLng) * t;

      this.mapService.moveFicticiaMarker(patrulla.id, lat, lng);
      this._patch(patrulla.id, { lat, lng });

      if (step >= STEPS) {
        clearInterval(timer);
        this._patch(patrulla.id, { lat: zone.lat, lng: zone.lng, estado: 'PATRULLANDO' });
        this.mapService.updateFicticiaMarkerColor(patrulla.id, 'PATRULLANDO');
        this.mapService.moveFicticiaMarker(patrulla.id, zone.lat, zone.lng);

        // Iniciar patrullaje táctico en órbita alrededor de la zona de calor
        this._iniciarRondaPatrullaje(patrulla.id, zone);
      }
    }, DELAY);

    this._storeTimer(patrulla.id, timer);
  }

  private _iniciarRondaPatrullaje(patrullaId: string, zone: HotspotZone): void {
    this._clearTimers(patrullaId);
    // Desfase angular cuando se mezclan/combinan múltiples servicios en la misma zona
    const sameZonePatrols = this.patrullasFicticias().filter(
      x => x.destinoZone?.id === zone.id
    );
    const idxInZone = Math.max(0, sameZonePatrols.findIndex(x => x.id === patrullaId));
    const countInZone = Math.max(1, sameZonePatrols.length);
    let angle = (idxInZone * 2 * Math.PI) / countInZone;

    const radioM = zone.radio_m || 160;
    const orbitMeters = Math.max(30, radioM * 0.65);
    const radiusLat = orbitMeters / 111320;
    const radiusLng = orbitMeters / (111320 * Math.cos((zone.lat * Math.PI) / 180));

    const patrolTimer = setInterval(() => {
      const p = this.patrullasFicticias().find(x => x.id === patrullaId);
      if (!p || p.estado !== 'PATRULLANDO') {
        clearInterval(patrolTimer);
        return;
      }
      angle += 0.08;
      const lat = zone.lat + Math.sin(angle) * radiusLat;
      const lng = zone.lng + Math.cos(angle) * radiusLng;

      this.mapService.moveFicticiaMarker(patrullaId, lat, lng);
      this._patch(patrullaId, { lat, lng });
    }, 1000);

    this._storeTimer(patrullaId, patrolTimer);
  }

  private _patch(id: string, patch: Partial<PatrullaFicticia>): void {
    this.patrullasFicticias.update(list => list.map(p => p.id === id ? { ...p, ...patch } : p));
    const sel = this.patrullaFicticiaSeleccionada();
    if (sel?.id === id) this.patrullaFicticiaSeleccionada.update(p => p ? { ...p, ...patch } : null);
  }

  private _storeTimer(id: string, t: any): void {
    if (!this.moveTimers.has(id)) this.moveTimers.set(id, []);
    this.moveTimers.get(id)!.push(t);
  }

  private _clearTimers(id: string): void {
    (this.moveTimers.get(id) ?? []).forEach(t => clearInterval(t));
    this.moveTimers.set(id, []);
  }

  private _ease(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private _getOccupiedZoneIds(): Set<number> {
    const occupied = new Set<number>();
    const unidadesReales = this.store.unidades().filter(
      u => u.estado_operativo !== EstadoOperativo.INACTIVO
    );

    for (const u of unidadesReales) {
      for (const z of HOTSPOT_ZONES) {
        if (this._isRealUnitInZone(u, z)) {
          occupied.add(z.id);
        }
      }
    }
    return occupied;
  }

  /**
   * Asigna recursos según prioridad de gravedad delictual y capacidad U.V.E.:
   * 1. Ordena las zonas activas de mayor a menor riesgo (ALTO [1.00 U.V.E.] -> MEDIO [0.45 U.V.E.] -> BAJO [0.20 U.V.E.]).
   * 2. Ordena los recursos disponibles de mayor a menor U.V.E. (RPT/FZ 1.00 -> RPD 0.80 -> MTT 0.45 -> CB 0.30 -> INF 0.20).
   * 3. Fase 1 (Prioridad Primaria): envía el recurso de mayor U.V.E. a la zona de mayor prioridad que aún requiera cobertura,
   *    evitando que una patrulla vaya a una zona sin riesgo mientras una bicicleta va a una de alto riesgo.
   * 4. Fase 2 (Mezcla/Combinación de Servicios): si quedan recursos disponibles y alguna zona prioritaria aún no alcanza
   *    el puntaje U.V.E. requerido (ej. una zona ALTO tiene RPD 0.80 y necesita +0.20 U.V.E.), combina servicios adicionales
   *    en esa misma zona hasta cubrir el umbral U.V.E. necesario.
   */
  private _assignZones(
    patrullas: PatrullaFicticia[],
    zones: HotspotZone[]
  ): Map<string, HotspotZone> {
    if (patrullas.length === 0 || zones.length === 0) return new Map();

    // 1. Ordenar todas las zonas activas por prioridad de riesgo descendente (ej. 85 pts -> 45 pts -> 13 pts)
    const sortedZones = [...zones].sort(
      (a, b) => this.getZoneScore(b) - this.getZoneScore(a) || a.id - b.id
    );

    // 2. Calcular U.V.E. base ya aportada en cada zona por unidades reales con misión activa o patrullas manuales
    const uvePorZona = new Map<number, number>();
    const unidadesReales = this.store.unidades().filter(
      u => u.estado_operativo !== EstadoOperativo.INACTIVO && !(u as any).fecha_cierre
    );
    const manualFicticias = this.patrullasFicticias().filter(
      p => p.isManual && p.estado !== 'DISPONIBLE' && p.destinoZone
    );

    for (const z of sortedZones) {
      let baseUve = 0;
      for (const u of unidadesReales) {
        if (this._isRealUnitInZone(u, z)) {
          baseUve += this.getUnidadUveInfo(u).valorUve;
        }
      }
      for (const mp of manualFicticias) {
        if (mp.destinoZone?.id === z.id) {
          baseUve += this.getFicticiaUve(mp);
        }
      }
      uvePorZona.set(z.id, Number(baseUve.toFixed(2)));
    }

    // 3. Ordenar patrullas disponibles estrictamente de mayor U.V.E. a menor U.V.E.
    const poolPatrols = [...patrullas].sort(
      (a, b) => this.getFicticiaUve(b) - this.getFicticiaUve(a) || a.id.localeCompare(b.id)
    );
    const assignments = new Map<string, HotspotZone>();

    // FASE 1: Asignación primaria estricta de mayor prioridad de zona a mayor U.V.E. disponible
    // (Ej.: 85 pts recibe RPD 0.80, 45 pts recibe RPD 0.80, 13 pts recibe MTT 0.45)
    for (const zone of sortedZones) {
      if (poolPatrols.length === 0) break;
      const uveActual = uvePorZona.get(zone.id) ?? 0;
      const bestPatrol = poolPatrols.shift()!;
      assignments.set(bestPatrol.id, zone);
      const nuevoTotal = Number((uveActual + this.getFicticiaUve(bestPatrol)).toFixed(2));
      uvePorZona.set(zone.id, nuevoTotal);
    }

    // FASE 2: Mezcla / Combinación de servicios para alcanzar el puntaje U.V.E. requerido por zona,
    // priorizando siempre las zonas de mayor gravedad que aún tengan déficit de U.V.E.
    while (poolPatrols.length > 0) {
      const zoneConDeficit = sortedZones.find(z => {
        const actual = uvePorZona.get(z.id) ?? 0;
        const req = this.getZoneRequiredUve(z);
        return actual + 0.001 < req;
      });

      if (!zoneConDeficit) break;

      const actual = uvePorZona.get(zoneConDeficit.id) ?? 0;
      const deficit = Number((this.getZoneRequiredUve(zoneConDeficit) - actual).toFixed(2));

      // Elegir el recurso disponible de mayor U.V.E. (o el que cubra el déficit de forma óptima)
      const nextPatrol = poolPatrols.shift()!;
      assignments.set(nextPatrol.id, zoneConDeficit);
      uvePorZona.set(
        zoneConDeficit.id,
        Number((actual + this.getFicticiaUve(nextPatrol)).toFixed(2))
      );
    }

    // FASE 3: Si todas las zonas activas ya alcanzaron el 100% de su U.V.E. requerida y aún sobran recursos,
    // reforzar siguiendo el orden de prioridad de mayor a menor riesgo
    let surplusIdx = 0;
    while (poolPatrols.length > 0) {
      const extraPatrol = poolPatrols.shift()!;
      const targetZone = sortedZones[surplusIdx % sortedZones.length];
      assignments.set(extraPatrol.id, targetZone);
      const actual = uvePorZona.get(targetZone.id) ?? 0;
      uvePorZona.set(targetZone.id, Number((actual + this.getFicticiaUve(extraPatrol)).toFixed(2)));
      surplusIdx++;
    }

    return assignments;
  }
}
