import {
  Component, OnInit, OnDestroy, AfterViewInit, inject,
  ChangeDetectionStrategy, signal, ViewChild, ElementRef, computed, effect, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardStore } from './store/dashboard.store';
import { ApiService } from '../../core/services/api.service';
import { MqttService } from '../../core/services/mqtt.service';
import { MapService } from '../../core/services/map.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  SesionOperativa, AlertaEmergencia, AsignacionTactica,
  ESTADO_CONFIG, EstadoOperativo, EstadoMision, MISION_CONFIG,
} from '../../core/models';
import { HotspotZone } from '../../core/services/map.service';

// ─── Patrulla ficticia local ──────────────────────────────────────────────────
export interface PatrullaFicticia {
  id:        string;
  nombre:    string;
  tipo:      'PATRULLA' | 'MOTO' | 'BICICLETA';
  estado:    'DISPONIBLE' | 'EN_RUTA' | 'PATRULLANDO';
  lat:       number;
  lng:       number;
  destinoZone?: HotspotZone;
}

const MAX_PATRULLAS = 3;

@Component({
  selector:        'app-dashboard',
  standalone:      true,
  imports:         [CommonModule, RouterModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="h-screen flex flex-col bg-sigo-bg overflow-hidden">

    <!-- ═══════════════ TOPBAR ═══════════════ -->
    <header class="flex items-center gap-4 px-4 py-3 bg-sigo-surface border-b border-sigo-border
                   flex-shrink-0 z-20">
      <!-- Logo -->
      <div class="flex items-center gap-2 mr-4">
        <div class="w-8 h-8 rounded-lg bg-sigo-accent/10 border border-sigo-accent/30
                    flex items-center justify-center">
          <svg class="w-4 h-4 text-sigo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955
                 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29
                 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <span class="font-bold text-sigo-text text-sm hidden md:block">S.I.G.O.</span>
      </div>

      <!-- Contadores de estado -->
      <div class="flex items-center gap-3 flex-1">
        <div class="stat-chip bg-disponible/10 border-disponible/30 text-disponible">
          <span class="w-2 h-2 rounded-full bg-disponible"></span>
          {{ totalDisponibles() }} Disponible
        </div>
        <div class="stat-chip bg-en-ruta/10 border-en-ruta/30 text-en-ruta">
          <span class="w-2 h-2 rounded-full bg-en-ruta"></span>
          {{ totalEnRuta() }} En ruta
        </div>
        <div class="stat-chip bg-patrullando/10 border-patrullando/30 text-patrullando">
          <span class="w-2 h-2 rounded-full bg-patrullando"></span>
          {{ totalPatrullando() }} Patrullando
        </div>
        @if (store.conteoEmergencia() > 0) {
          <div class="stat-chip bg-emergencia/10 border-emergencia/30 text-emergencia badge-blink">
            <span class="w-2 h-2 rounded-full bg-emergencia"></span>
            {{ store.conteoEmergencia() }} EMERGENCIA
          </div>
        }
      </div>

      <!-- Nav: solo Mapa -->
      <nav class="hidden lg:flex items-center gap-1">
        <a routerLink="/dashboard" routerLinkActive="nav-active" class="nav-link">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7
                 m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0
                 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          Mapa
        </a>
      </nav>

      <!-- Derecha: countdown + alertas + usuario -->
      <div class="flex items-center gap-3 ml-2">
        @if (mapService.mapLoaded()) {
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sigo-surface2
                      border border-sigo-border text-xs select-none"
               title="Tiempo para siguiente rotación de zonas">
            <svg class="w-3.5 h-3.5 text-sigo-accent flex-shrink-0"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0"/>
            </svg>
            <span class="font-mono font-semibold tabular-nums"
                  [class.text-sigo-accent]="mapService.cycleCountdown() > 5"
                  [class.text-emergencia]="mapService.cycleCountdown() <= 5">
              {{ mapService.cycleCountdown() }}s
            </span>
            @if (mapService.cycleCountdown() <= 5) {
              <span class="w-1.5 h-1.5 rounded-full bg-emergencia badge-blink"></span>
            }
            <span class="text-sigo-muted hidden sm:block">zona</span>
          </div>
        }

        <button id="btn-alertas-sos"
          (click)="store.showSOSDrawer.set(!store.showSOSDrawer())"
          class="relative p-2 rounded-lg hover:bg-sigo-surface2 transition-colors"
          [class.text-emergencia]="store.tieneEmergenciaActiva()"
          [class.text-sigo-muted]="!store.tieneEmergenciaActiva()">
          @if (store.tieneEmergenciaActiva()) {
            <span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emergencia rounded-full
                         text-white text-xs flex items-center justify-center badge-blink">
              {{ store.alertasActivasCount() }}
            </span>
          }
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </button>

        <button id="btn-logout" (click)="logout()"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sigo-surface2
                 border border-sigo-border hover:border-emergencia/50 transition-colors text-sm">
          <span class="text-sigo-muted">{{ (authService.currentUser()?.nombre_completo ?? 'Usuario').split(' ')[0] }}</span>
          <svg class="w-4 h-4 text-sigo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- ═══════════════ CUERPO PRINCIPAL ═══════════════ -->
    <div class="flex flex-1 overflow-hidden relative">

      <!-- Toggle de capas -->
      <div class="absolute top-4 left-4 z-10 glass rounded-xl p-3 space-y-2 shadow-card">
        <p class="text-sigo-muted text-xs font-medium uppercase tracking-wider mb-2">Capas</p>
        <label class="layer-toggle" [class.active]="store.layerHeatmap()">
          <input type="checkbox" class="sr-only" [checked]="store.layerHeatmap()"
            (change)="toggleLayer('heatmap', $any($event.target).checked)">
          <span class="w-8 h-4 rounded-full transition-colors"
            [class.bg-sigo-accent]="store.layerHeatmap()" [class.bg-sigo-border]="!store.layerHeatmap()">
            <span class="block w-3 h-3 bg-white rounded-full mt-0.5 transition-transform"
              [style.transform]="store.layerHeatmap() ? 'translateX(18px)' : 'translateX(2px)'"></span>
          </span>
          <span class="text-xs text-sigo-text">🔥 Mapa de Calor</span>
        </label>
        <label class="layer-toggle" [class.active]="store.layerSimcards()">
          <input type="checkbox" class="sr-only" [checked]="store.layerSimcards()"
            (change)="toggleLayer('simcards', $any($event.target).checked)">
          <span class="w-8 h-4 rounded-full transition-colors"
            [class.bg-sigo-accent]="store.layerSimcards()" [class.bg-sigo-border]="!store.layerSimcards()">
            <span class="block w-3 h-3 bg-white rounded-full mt-0.5 transition-transform"
              [style.transform]="store.layerSimcards() ? 'translateX(18px)' : 'translateX(2px)'"></span>
          </span>
          <span class="text-xs text-sigo-text">🚓 Unidades</span>
        </label>
        <label class="layer-toggle" [class.active]="store.layerPolygons()">
          <input type="checkbox" class="sr-only" [checked]="store.layerPolygons()"
            (change)="toggleLayer('polygons', $any($event.target).checked)">
          <span class="w-8 h-4 rounded-full transition-colors"
            [class.bg-sigo-accent]="store.layerPolygons()" [class.bg-sigo-border]="!store.layerPolygons()">
            <span class="block w-3 h-3 bg-white rounded-full mt-0.5 transition-transform"
              [style.transform]="store.layerPolygons() ? 'translateX(18px)' : 'translateX(2px)'"></span>
          </span>
          <span class="text-xs text-sigo-text">📍 Zonas</span>
        </label>
      </div>

      <!-- MAPA -->
      <div #mapCanvas id="map-canvas" class="flex-1 relative">
        @if (!mapService.mapLoaded()) {
          <div class="absolute inset-0 flex items-center justify-center bg-sigo-bg z-10">
            <div class="text-center">
              <div class="w-12 h-12 border-2 border-sigo-accent border-t-transparent
                          rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-sigo-muted text-sm">Cargando mapa operacional...</p>
            </div>
          </div>
        }
      </div>

      <!-- PANEL LATERAL DERECHO -->
      <aside class="w-80 flex-shrink-0 bg-sigo-surface border-l border-sigo-border
                    flex flex-col overflow-hidden z-10">

        <!-- Header -->
        <div class="px-4 py-3 border-b border-sigo-border flex items-center justify-between">
          <div>
            <h2 class="text-sigo-text font-semibold text-sm">Unidades Activas</h2>
            <p class="text-sigo-muted text-xs">{{ totalUnidadesActivas() }} en servicio</p>
          </div>
          <!-- Botón + (máx 3 patrullas) -->
          <button
            id="btn-agregar-patrulla"
            (click)="showAddPatrolModal.set(true)"
            [disabled]="patrullasFicticias().length >= MAX_PATRULLAS"
            class="w-8 h-8 rounded-full border flex items-center justify-center transition-all"
            [class.text-sigo-accent]="patrullasFicticias().length < MAX_PATRULLAS"
            [class.border-sigo-accent]="patrullasFicticias().length < MAX_PATRULLAS"
            [class.text-sigo-muted]="patrullasFicticias().length >= MAX_PATRULLAS"
            [class.border-sigo-border]="patrullasFicticias().length >= MAX_PATRULLAS"
            [class.opacity-40]="patrullasFicticias().length >= MAX_PATRULLAS"
            [class.cursor-not-allowed]="patrullasFicticias().length >= MAX_PATRULLAS"
            [style.background]="patrullasFicticias().length < MAX_PATRULLAS ? 'rgba(0,212,255,0.10)' : 'transparent'"
            [title]="patrullasFicticias().length >= MAX_PATRULLAS ? 'Máximo 3 patrullas demo' : 'Agregar patrulla demo'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-2 space-y-1 px-2">

          <!-- Patrullas DEMO (auto-despacho) -->
          @for (p of patrullasFicticias(); track p.id) {
            <div
              class="sidebar-item rounded-lg cursor-pointer transition-all duration-150 border border-dashed"
              [class.border-disponible]="p.estado === 'DISPONIBLE'"
              [class.border-en-ruta]="p.estado === 'EN_RUTA'"
              [class.border-patrullando]="p.estado === 'PATRULLANDO'"
              [style.background]="fBg(p.estado)"
              (click)="selectPatrullaFicticia(p)">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                [style.background]="fColor(p.estado) + '22'">
                <span class="text-sm">{{ p.tipo === 'PATRULLA' ? '🚓' : p.tipo === 'MOTO' ? '🏍️' : '🚲' }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-sigo-text text-sm font-medium truncate flex-1">{{ p.nombre }}</p>
                  <span class="text-xs px-1 py-0.5 rounded font-semibold flex-shrink-0"
                    [style.background]="fColor(p.estado) + '22'"
                    [style.color]="fColor(p.estado)">DEMO</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    [style.background]="fColor(p.estado)"
                    [class.badge-blink]="p.estado === 'EN_RUTA'"></span>
                  <span class="text-xs" [style.color]="fColor(p.estado)">{{ fLabel(p.estado) }}</span>
                  @if (p.destinoZone) {
                    <span class="text-sigo-muted text-xs truncate">→ Z{{ p.destinoZone.id }}</span>
                  }
                </div>
              </div>
              <button
                (click)="$event.stopPropagation(); mapService.centerOn(p.lat, p.lng)"
                class="p-1 text-sigo-muted hover:text-sigo-accent transition-colors rounded"
                title="Centrar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          }

          <!-- Separador -->
          @if (patrullasFicticias().length > 0 && store.unidades().length > 0) {
            <div class="px-2 py-1">
              <p class="text-sigo-muted text-xs uppercase tracking-wider">— Unidades reales —</p>
            </div>
          }

          <!-- Unidades REALES -->
          @for (unidad of store.unidades(); track unidad.id_sesion) {
            <div
              class="sidebar-item rounded-lg cursor-pointer transition-all duration-150"
              [class.bg-sigo-surface2]="store.unidadSeleccionada()?.id_sesion === unidad.id_sesion"
              [class.border-l-2]="store.unidadSeleccionada()?.id_sesion === unidad.id_sesion"
              [class.border-sigo-accent]="store.unidadSeleccionada()?.id_sesion === unidad.id_sesion"
              (click)="selectUnidad(unidad)">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                [style.background]="estadoConfig(unidad.estado_operativo).dotColor + '22'">
                <span class="text-sm">
                  {{ unidad.tipo_transporte === 'PATRULLA' ? '🚓' : unidad.tipo_transporte === 'MOTO' ? '🏍️' : '🚲' }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sigo-text text-sm font-medium truncate">
                  {{ unidad.conductor?.nombre_completo ?? unidad.rut_conductor }}
                </p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    [style.background]="estadoConfig(unidad.estado_operativo).dotColor"
                    [class.badge-blink]="unidad.estado_operativo === 'OCUPADO_EMERGENCIA'"></span>
                  <span class="text-xs" [style.color]="estadoConfig(unidad.estado_operativo).dotColor">
                    {{ estadoConfig(unidad.estado_operativo).label }}
                  </span>
                </div>
              </div>
              <button
                (click)="$event.stopPropagation(); centerOnUnit(unidad)"
                class="p-1 text-sigo-muted hover:text-sigo-accent transition-colors rounded"
                title="Centrar en mapa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          } @empty {
            @if (patrullasFicticias().length === 0) {
              <div class="text-center py-12 px-4">
                <svg class="w-10 h-10 text-sigo-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p class="text-sigo-muted text-sm">Sin unidades activas</p>
                <p class="text-sigo-muted text-xs mt-1">
                  Presiona <strong class="text-sigo-accent">+</strong> para añadir una patrulla demo
                </p>
              </div>
            }
          }
        </div>
      </aside>

      <!-- ─── DRAWER: Detalle unidad real ───────────────────────────────── -->
      @if (store.unidadSeleccionada(); as unidad) {
        <div class="absolute bottom-0 left-0 right-80 glass border-t border-sigo-border p-4 z-10 animate-slide-in-l">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">
                  {{ unidad.tipo_transporte === 'PATRULLA' ? '🚓' : unidad.tipo_transporte === 'MOTO' ? '🏍️' : '🚲' }}
                </span>
                <div>
                  <h3 class="text-sigo-text font-semibold">{{ unidad.conductor?.nombre_completo ?? unidad.rut_conductor }}</h3>
                  <p class="text-sigo-muted text-xs">IMEI: {{ unidad.imei_simcard }}</p>
                </div>
                <span class="ml-auto px-2 py-1 rounded-md text-xs font-medium"
                  [style.background]="estadoConfig(unidad.estado_operativo).dotColor + '22'"
                  [style.color]="estadoConfig(unidad.estado_operativo).dotColor">
                  {{ estadoConfig(unidad.estado_operativo).label }}
                </span>
              </div>
              @if (unidad.tripulacion && unidad.tripulacion.length > 0) {
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sigo-muted text-xs">Tripulación:</span>
                  @for (t of unidad.tripulacion; track t.id_tripulacion) {
                    <span class="px-2 py-0.5 bg-sigo-surface2 border border-sigo-border rounded text-xs text-sigo-text">
                      {{ t.acompanante?.nombre_completo ?? t.rut_acompanante }}
                    </span>
                  }
                </div>
              }
              @if (unidad.asignacion_activa; as asignacion) {
                <div class="flex items-center gap-3 text-xs text-sigo-muted">
                  <span>Misión: <span class="font-medium text-sigo-text">{{ asignacion.origen_asignacion }}</span></span>
                  <span>Estado: <span [ngClass]="misionConfig(asignacion.estado_mision).color">{{ misionConfig(asignacion.estado_mision).label }}</span></span>
                </div>
              }
            </div>
            <button (click)="store.seleccionarUnidad(null)"
              class="p-2 text-sigo-muted hover:text-sigo-text rounded-lg hover:bg-sigo-surface2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- ─── DRAWER: Detalle patrulla DEMO ─────────────────────────────── -->
      @if (patrullaFicticiaSeleccionada(); as p) {
        <div class="absolute bottom-0 left-0 right-80 glass border-t border-sigo-border p-4 z-10 animate-slide-in-l">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">{{ p.tipo === 'PATRULLA' ? '🚓' : p.tipo === 'MOTO' ? '🏍️' : '🚲' }}</span>
                <div>
                  <h3 class="text-sigo-text font-semibold flex items-center gap-2">
                    {{ p.nombre }}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-sigo-accent/10 text-sigo-accent border border-sigo-accent/30">AUTO-DEMO</span>
                  </h3>
                  <p class="text-xs mt-0.5" [style.color]="fColor(p.estado)">{{ fLabel(p.estado) }}</p>
                </div>
              </div>

              <!-- Info del estado actual -->
              <div class="rounded-lg p-3 border"
                [style.background]="fColor(p.estado) + '12'"
                [style.borderColor]="fColor(p.estado) + '44'">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full" [style.background]="fColor(p.estado)"
                    [class.badge-blink]="p.estado === 'EN_RUTA'"></span>
                  <span class="text-sm font-medium" [style.color]="fColor(p.estado)">{{ fLabel(p.estado) }}</span>
                </div>
                @if (p.destinoZone) {
                  <p class="text-sigo-muted text-xs">
                    {{ p.estado === 'EN_RUTA' ? 'Moviéndose hacia' : 'Patrullando en' }}
                    <strong class="text-sigo-text">Z{{ p.destinoZone.id }} – {{ p.destinoZone.name }}</strong>
                  </p>
                  <p class="text-sigo-muted text-xs mt-0.5">
                    Nivel de riesgo:
                    <strong [style.color]="riskColor(p.destinoZone.crimeCount)">
                      {{ riskLabel(p.destinoZone.crimeCount) }}
                    </strong>
                  </p>
                } @else {
                  <p class="text-sigo-muted text-xs">Esperando rotación de zonas...</p>
                }
              </div>

              <p class="text-sigo-muted text-xs mt-2 flex items-center gap-1">
                <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Se mueve automáticamente con cada rotación de zona ({{ mapService.cycleCountdown() }}s)
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <button (click)="eliminarPatrullaFicticia(p)"
                class="p-2 text-emergencia/60 hover:text-emergencia rounded-lg hover:bg-emergencia/10 transition-colors"
                title="Eliminar patrulla">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
              <button (click)="patrullaFicticiaSeleccionada.set(null)"
                class="p-2 text-sigo-muted hover:text-sigo-text rounded-lg hover:bg-sigo-surface2 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ─── DRAWER: Alertas SOS ────────────────────────────────────────── -->
      @if (store.showSOSDrawer()) {
        <div class="absolute top-0 right-80 bottom-0 w-80 bg-sigo-surface border-l border-sigo-border
                    flex flex-col z-20 animate-slide-in-r shadow-glow-red">
          <div class="px-4 py-3 bg-emergencia/10 border-b border-emergencia/30 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emergencia badge-blink"></span>
              <h3 class="text-emergencia font-semibold text-sm">Alertas de Emergencia</h3>
            </div>
            <button (click)="store.showSOSDrawer.set(false)" class="text-sigo-muted hover:text-sigo-text">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            @for (alerta of store.alertasSOS(); track alerta.id_emergencia) {
              <div class="card border-l-2"
                [class.border-emergencia]="alerta.estado === 'ACTIVA'"
                [class.border-sigo-border]="alerta.estado === 'RESUELTA'">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="w-1.5 h-1.5 rounded-full"
                        [class.bg-emergencia]="alerta.estado === 'ACTIVA'"
                        [class.bg-disponible]="alerta.estado === 'RESUELTA'"
                        [class.badge-blink]="alerta.estado === 'ACTIVA'"></span>
                      <span class="text-xs font-semibold"
                        [class.text-emergencia]="alerta.estado === 'ACTIVA'"
                        [class.text-disponible]="alerta.estado === 'RESUELTA'">{{ alerta.estado }}</span>
                    </div>
                    <p class="text-sigo-muted text-xs">Sesión #{{ alerta.id_sesion_solicitante }}</p>
                    <p class="text-sigo-muted text-xs">{{ alerta.fecha_alerta | date:'dd/MM/yyyy HH:mm' }}</p>
                  </div>
                  <div class="flex flex-col gap-1">
                    <button (click)="centerOnAlerta(alerta)"
                      class="text-xs px-2 py-1 bg-sigo-surface2 border border-sigo-border rounded
                             hover:border-sigo-accent text-sigo-muted hover:text-sigo-accent transition-colors">
                      Ver
                    </button>
                    @if (alerta.estado === 'ACTIVA') {
                      <button (click)="resolverAlerta(alerta.id_emergencia)"
                        class="text-xs px-2 py-1 bg-disponible/10 border border-disponible/30 rounded
                               text-disponible hover:bg-disponible/20 transition-colors">
                        Resolver
                      </button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="text-center py-8">
                <p class="text-sigo-muted text-sm">Sin alertas registradas</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- ─── MODAL: Agregar Patrulla Demo ─────────────────────────────── -->
      @if (showAddPatrolModal()) {
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30"
             (click)="showAddPatrolModal.set(false)">
          <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-1">
              <div>
                <h3 class="text-sigo-text font-semibold">Nueva Patrulla Demo</h3>
                <p class="text-sigo-muted text-xs mt-0.5">Se moverá automáticamente a los puntos de calor activos</p>
              </div>
              <button (click)="showAddPatrolModal.set(false)" class="text-sigo-muted hover:text-sigo-text">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Indicador de cupos -->
            <div class="flex items-center gap-2 mt-3 mb-4 p-2 rounded-lg bg-sigo-surface2 border border-sigo-border">
              @for (i of [0,1,2]; track i) {
                <div class="flex-1 h-1.5 rounded-full transition-all"
                  [style.background]="i < patrullasFicticias().length ? '#00d4ff' : '#1e293b'"></div>
              }
              <span class="text-xs text-sigo-muted ml-1">{{ patrullasFicticias().length }}/{{ MAX_PATRULLAS }}</span>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm text-sigo-muted mb-1">Nombre</label>
                <input id="patrol-nombre" type="text" class="input-field"
                  placeholder="Patrulla Alpha-1"
                  [(ngModel)]="newPatrolForm.nombre">
              </div>
              <div>
                <label class="block text-sm text-sigo-muted mb-2">Tipo de vehículo</label>
                <div class="grid grid-cols-3 gap-2">
                  @for (tipo of tiposVehiculo; track tipo.value) {
                    <button
                      (click)="newPatrolForm.tipo = tipo.value"
                      class="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-all"
                      [class.border-sigo-accent]="newPatrolForm.tipo === tipo.value"
                      [class.border-sigo-border]="newPatrolForm.tipo !== tipo.value"
                      [style.background]="newPatrolForm.tipo === tipo.value ? 'rgba(0,212,255,0.10)' : ''">
                      <span class="text-xl">{{ tipo.icon }}</span>
                      <span class="text-xs text-sigo-text">{{ tipo.label }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>

            <div class="flex gap-3 mt-5">
              <button class="btn-ghost flex-1" (click)="showAddPatrolModal.set(false)">Cancelar</button>
              <button id="btn-confirmar-patrulla" class="btn-primary flex-1"
                (click)="agregarPatrullaFicticia()"
                [disabled]="!newPatrolForm.nombre.trim()">
                Agregar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  </div>
  `,
  styles: [`
    .stat-chip {
      @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium;
    }
    .nav-link {
      @apply flex items-center gap-1.5 px-3 py-2 rounded-lg text-sigo-muted text-sm
             hover:text-sigo-text hover:bg-sigo-surface2 transition-colors;
    }
    .nav-link.nav-active, :host ::ng-deep .nav-active {
      @apply text-sigo-accent bg-sigo-accent/10;
    }
    .layer-toggle {
      @apply flex items-center gap-2 cursor-pointer select-none;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapCanvas', { static: true }) mapCanvasRef!: ElementRef<HTMLDivElement>;

  readonly store       = new DashboardStore();
  readonly authService = inject(AuthService);
  readonly mapService  = inject(MapService);
  readonly mqttService = inject(MqttService);
  readonly apiService  = inject(ApiService);
  readonly supabase    = inject(SupabaseService);

  readonly ESTADO_CONFIG = ESTADO_CONFIG;
  readonly MAX_PATRULLAS = MAX_PATRULLAS;

  // ─── Estado de patrullas ficticias ───────────────────────────────────────
  readonly patrullasFicticias            = signal<PatrullaFicticia[]>([]);
  readonly patrullaFicticiaSeleccionada  = signal<PatrullaFicticia | null>(null);
  readonly showAddPatrolModal            = signal(false);

  newPatrolForm = { nombre: '', tipo: 'PATRULLA' as 'PATRULLA' | 'MOTO' | 'BICICLETA' };

  readonly tiposVehiculo = [
    { value: 'PATRULLA'  as const, label: 'Patrulla', icon: '🚓' },
    { value: 'MOTO'      as const, label: 'Moto',     icon: '🏍️' },
    { value: 'BICICLETA' as const, label: 'Bici',     icon: '🚲' },
  ];

  // Contadores totales (reales + ficticias)
  readonly totalDisponibles  = computed(() =>
    this.store.conteoDisponibles() + this.patrullasFicticias().filter(p => p.estado === 'DISPONIBLE').length
  );
  readonly totalEnRuta       = computed(() =>
    this.store.conteoEnRuta() + this.patrullasFicticias().filter(p => p.estado === 'EN_RUTA').length
  );
  readonly totalPatrullando  = computed(() =>
    this.store.conteoPatrullando() + this.patrullasFicticias().filter(p => p.estado === 'PATRULLANDO').length
  );
  readonly totalUnidadesActivas = computed(() =>
    this.store.totalActivas() + this.patrullasFicticias().length
  );

  private realtimeSubs: any[]  = [];
  /** map: patrol id → list of active interval/timeout IDs */
  private moveTimers = new Map<string, any[]>();

  estadoConfig = (e: EstadoOperativo) => ESTADO_CONFIG[e];
  misionConfig = (e: EstadoMision)    => MISION_CONFIG[e];

  // Helpers de color/label para patrullas ficticias
  fColor(e: PatrullaFicticia['estado']) {
    return e === 'DISPONIBLE' ? '#10b981' : e === 'EN_RUTA' ? '#3b82f6' : '#f59e0b';
  }
  fLabel(e: PatrullaFicticia['estado']) {
    return e === 'DISPONIBLE' ? 'Disponible' : e === 'EN_RUTA' ? 'En Ruta' : 'Patrullando';
  }
  fBg(e: PatrullaFicticia['estado']) {
    return e === 'DISPONIBLE' ? 'rgba(16,185,129,0.06)'
         : e === 'EN_RUTA'    ? 'rgba(59,130,246,0.06)'
         : 'rgba(245,158,11,0.06)';
  }
  riskColor(c: number) { return c >= 7 ? '#ef4444' : c >= 4 ? '#f59e0b' : '#22c55e'; }
  riskLabel(c: number) { return c >= 7 ? 'ALTO' : c >= 4 ? 'MEDIO' : 'BAJO'; }

  constructor() {
    // ─── Effect: reacciona SOLO a cambios en activeZones (cada 30s) ─────────
    // IMPORTANTE: Todo el cuerpo (excepto leer activeZones) está en untracked()
    // para que los signal-writes de _patch() dentro de _dispatchToZone NO
    // vuelvan a disparar este effect (evita el bucle infinito que congela la UI).
    effect(() => {
      const zones = this.mapService.activeZones();   // única dependencia reactiva

      untracked(() => {
        if (zones.length === 0) return;
        const patrullas = this.patrullasFicticias();
        if (patrullas.length === 0) return;

        // Asignación inteligente: cada patrulla va a la zona de su prioridad de riesgo
        const assignments = this._assignZones(patrullas, zones);
        patrullas.forEach(p => {
          const zone = assignments.get(p.id);
          if (zone) this._dispatchToZone(p, zone);
        });
      });
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {}

  async ngAfterViewInit(): Promise<void> {
    await this.mapService.initMap(this.mapCanvasRef.nativeElement);
    this.mapService.onMarkerClick = (idSesion) => {
      const unidad = this.store.unidades().find(u => u.id_sesion === idSesion);
      if (unidad) this.store.seleccionarUnidad(unidad);
    };

    const [sesiones, hotspots, asignaciones, alertas] = await Promise.all([
      this.apiService.getSesionesActivas().catch(() => []),
      this.apiService.getHotspots().catch(() => []),
      this.apiService.getAsignacionesActivas().catch(() => []),
      this.apiService.getAlertasActivas().catch(() => []),
    ]);

    this.store.setUnidades(sesiones);
    this.store.setAsignaciones(asignaciones);
    this.store.alertasSOS.set(alertas as AlertaEmergencia[]);

    this.mapService.renderHeatmap(hotspots);
    sesiones.forEach(s => this.mapService.upsertUnitMarker(s));
    asignaciones.forEach(a => this.mapService.upsertPolygon(a));
    alertas.filter(a => a.estado === 'ACTIVA').forEach(a => {
      this.mapService.addSOSMarker(a.id_emergencia, a.geom_emergencia.coordinates[1], a.geom_emergencia.coordinates[0]);
    });

    this.mqttService.connect();
    this.mqttService.subscribeToAllUnits((payload) => {
      if (this.mapService.updateUnitPosition(payload.imei, payload.lat, payload.lng)) {
        this.store.updateGpsUnidad(payload);
      }
    });
    this.mqttService.subscribeToSOS((payload) => {
      this.store.agregarAlertaSOS(payload as AlertaEmergencia);
      this.store.showSOSDrawer.set(true);
    });

    const sesionSub = this.supabase.subscribeToSesiones((event) => {
      if (event.new) {
        this.store.updateEstadoUnidad(event.new.id_sesion, event.new.estado_operativo);
        this.mapService.upsertUnitMarker(event.new as SesionOperativa);
      }
    });
    const alertaSub = this.supabase.subscribeToAlertas((event) => {
      if (event.new) {
        const nueva = event.new as AlertaEmergencia;
        this.store.agregarAlertaSOS(nueva);
        this.store.showSOSDrawer.set(true);
        this.mapService.addSOSMarker(nueva.id_emergencia, nueva.geom_emergencia.coordinates[1], nueva.geom_emergencia.coordinates[0]);
      }
    });
    this.realtimeSubs.push(sesionSub, alertaSub);
  }

  ngOnDestroy(): void {
    this.mqttService.disconnect();
    this.realtimeSubs.forEach(s => s.unsubscribe?.());
    this.moveTimers.forEach(timers => timers.forEach(t => clearInterval(t)));
  }

  toggleLayer(layer: 'heatmap' | 'simcards' | 'polygons', visible: boolean): void {
    this.mapService.toggleLayer(layer, visible);
    switch (layer) {
      case 'heatmap':   this.store.layerHeatmap.set(visible);   break;
      case 'simcards':  this.store.layerSimcards.set(visible);  break;
      case 'polygons':  this.store.layerPolygons.set(visible);  break;
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
    this.mapService.centerOn(alerta.geom_emergencia.coordinates[1], alerta.geom_emergencia.coordinates[0], 16);
    this.store.showSOSDrawer.set(false);
  }

  // ─── Gestión de patrullas ficticias ──────────────────────────────────────

  agregarPatrullaFicticia(): void {
    if (!this.newPatrolForm.nombre.trim()) return;
    if (this.patrullasFicticias().length >= MAX_PATRULLAS) return;

    // Posición inicial cerca del centro con pequeño offset
    const offset = this.patrullasFicticias().length;
    const lat = -33.0245 + (offset - 1) * 0.004;
    const lng = -71.5518 + (offset - 1) * 0.003;

    const p: PatrullaFicticia = {
      id:     crypto.randomUUID(),
      nombre: this.newPatrolForm.nombre.trim(),
      tipo:   this.newPatrolForm.tipo,
      estado: 'DISPONIBLE',
      lat, lng,
    };

    this.mapService.addFicticiaMarker(p.id, p.lat, p.lng, p.tipo, 'DISPONIBLE');
    this.patrullasFicticias.update(list => [...list, p]);
    this.newPatrolForm = { nombre: '', tipo: 'PATRULLA' };
    this.showAddPatrolModal.set(false);
    this.patrullaFicticiaSeleccionada.set(p);

    // Despachar inmediatamente a la primera zona activa disponible
    const activeZones = this.mapService.activeZones();
    if (activeZones.length > 0) {
      const idx = this.patrullasFicticias().length - 1;
      this._dispatchToZone(p, activeZones[idx % activeZones.length]);
    }
  }

  eliminarPatrullaFicticia(p: PatrullaFicticia): void {
    this._clearTimers(p.id);
    this.mapService.removeFicticiaMarker(p.id);
    this.patrullasFicticias.update(list => list.filter(x => x.id !== p.id));
    if (this.patrullaFicticiaSeleccionada()?.id === p.id) {
      this.patrullaFicticiaSeleccionada.set(null);
    }
  }

  async resolverAlerta(id: number): Promise<void> {
    await this.apiService.resolverAlerta(id).catch(() => {});
    this.store.resolverAlertaSOS(id);
  }

  logout(): void { inject(AuthService).logout(); }

  // ─── Motor de movimiento automático ──────────────────────────────────────

  /**
   * Despacha la patrulla ficticia hacia la zona destino.
   * Cancela cualquier movimiento previo, la pone EN_RUTA,
   * la anima en 20 pasos y al llegar la marca como PATRULLANDO.
   */
  private _dispatchToZone(patrulla: PatrullaFicticia, zone: HotspotZone): void {
    this._clearTimers(patrulla.id);

    // Leer posición actual del signal (puede haber cambiado)
    const current = this.patrullasFicticias().find(p => p.id === patrulla.id);
    if (!current) return;

    const startLat = current.lat;
    const startLng = current.lng;

    // → EN_RUTA
    this._patch(patrulla.id, { estado: 'EN_RUTA', destinoZone: zone });
    this.mapService.updateFicticiaMarkerColor(patrulla.id, 'EN_RUTA');

    const STEPS = 20;
    const DELAY = 500; // ms por paso → ~10 seg en total
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const t   = this._ease(step / STEPS);
      const lat = startLat + (zone.lat - startLat) * t;
      const lng = startLng + (zone.lng - startLng) * t;

      this.mapService.moveFicticiaMarker(patrulla.id, lat, lng);
      this._patch(patrulla.id, { lat, lng });

      if (step >= STEPS) {
        clearInterval(timer);
        // → PATRULLANDO
        this._patch(patrulla.id, { lat: zone.lat, lng: zone.lng, estado: 'PATRULLANDO' });
        this.mapService.updateFicticiaMarkerColor(patrulla.id, 'PATRULLANDO');
        this.mapService.moveFicticiaMarker(patrulla.id, zone.lat, zone.lng);
      }
    }, DELAY);

    this._storeTimer(patrulla.id, timer);
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

  /** Ease in-out cuadrática para movimiento suave */
  private _ease(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Asignación de zonas a patrullas por rango de criminalidad.
   *
   * Regla: el vehículo más "potente" siempre cubre la zona con MÁS delitos,
   * el más ligero cubre la de MENOS. Dentro del mismo nivel de riesgo,
   * el orden de potencia (PATRULLA > MOTO > BICICLETA) determina quién va
   * a la subzona con más o menos crímenes.
   *
   * Algoritmo:
   *   1. Ordenar zonas por crimeCount DESC   → [zona_alta, zona_media, zona_baja]
   *   2. Ordenar patrullas por peso DESC       → [PATRULLA, MOTO, BICICLETA]
   *   3. Emparejar por posición               → PATRULLA→más, MOTO→medio, BICI→menos
   *
   * Con menos patrullas que zonas, se cubren siempre las N más peligrosas.
   */
  private _assignZones(
    patrullas: PatrullaFicticia[],
    zones: HotspotZone[]
  ): Map<string, HotspotZone> {
    if (patrullas.length === 0 || zones.length === 0) return new Map();

    // Zonas: mayor crimeCount primero
    const sortedZones = [...zones].sort((a, b) => b.crimeCount - a.crimeCount);

    // Patrullas: mayor "peso" primero
    const weight: Record<PatrullaFicticia['tipo'], number> = {
      PATRULLA:  3,
      MOTO:      2,
      BICICLETA: 1,
    };
    const sortedPatrols = [...patrullas].sort((a, b) => weight[b.tipo] - weight[a.tipo]);

    const assignments = new Map<string, HotspotZone>();
    const count = Math.min(sortedPatrols.length, sortedZones.length);
    for (let i = 0; i < count; i++) {
      assignments.set(sortedPatrols[i].id, sortedZones[i]);
    }
    return assignments;
  }
}
