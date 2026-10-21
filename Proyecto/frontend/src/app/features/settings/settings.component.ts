import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SettingsService, MobileProfile } from '../../core/services/settings.service';
import { ApiService } from '../../core/services/api.service';
import { MapService, HOTSPOT_ZONES, HotspotZone, syncDatabaseZones, getRisk } from '../../core/services/map.service';
import { DashboardStore } from '../dashboard/store/dashboard.store';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-sigo-bg text-sigo-text select-none">
      <app-navbar></app-navbar>

      <main class="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                <app-icon name="ajustes" [size]="18" [stroke]="1.8"></app-icon>
              </div>
              <div>
                <h1 class="text-lg font-bold text-sigo-text">Panel de Ajustes y Configuración Táctica</h1>
                <p class="text-xs text-sigo-muted">Gestión de perfiles móviles, rotación de zonas críticas y parámetros de refuerzos SOS</p>
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 1: ROTACIÓN DE ZONAS Y MAPA DE CALOR -->
        <div class="card p-5 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-sigo-border">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent">
                <app-icon name="zonas" [size]="16"></app-icon>
              </div>
              <div>
                <h2 class="text-sm font-bold text-sigo-text">Rotación de Zonas de Riesgo Delictual</h2>
                <p class="text-[11px] text-sigo-muted">Control del bucle automático con contrarreloj configurable o selección táctica manual</p>
              </div>
            </div>

            <!-- Toggle Bucle -->
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold" [ngClass]="settings.bucleZonasActivo() ? 'text-sigo-accent' : 'text-sigo-muted'">
                {{ settings.bucleZonasActivo() ? 'Bucle Activo (' + settings.intervaloRotacionSeg() + 's)' : 'Modo Manual' }}
              </span>
              <button
                type="button"
                (click)="toggleBucle()"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                [ngClass]="settings.bucleZonasActivo() ? 'bg-sigo-accent' : 'bg-sigo-surface2 border-sigo-border'"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                  [ngClass]="settings.bucleZonasActivo() ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>
          </div>

          <!-- CONTROLES TÁCTICOS DE ROTACIÓN (CONTRARRELOJ Y CANTIDAD DE ZONAS) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-sigo-surface2/70 border border-sigo-border">
            <!-- 1. Temporizador Manual (Contrarreloj) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-sigo-text flex items-center gap-1.5">
                  <app-icon name="historial" [size]="14" color="var(--sigo-accent)"></app-icon>
                  <span>Tiempo del Contrarreloj (Rotación)</span>
                </label>
                <span class="text-[11px] font-mono font-bold text-sigo-accent">
                  {{ settings.intervaloRotacionSeg() }}s ({{ formatTiempo(settings.intervaloRotacionSeg()) }})
                </span>
              </div>
              <p class="text-[11px] text-sigo-muted">
                Define manualmente los segundos que dura cada ciclo antes de rotar los cuadrantes tácticos.
              </p>

              <div class="flex items-center gap-2 pt-1">
                <div class="relative flex-1">
                  <input
                    type="number"
                    min="10"
                    max="1800"
                    step="5"
                    [ngModel]="settings.intervaloRotacionSeg()"
                    (ngModelChange)="onCambioTiempoManual($event)"
                    class="input text-xs font-mono font-bold w-full pr-12"
                    placeholder="Segundos (ej. 120)"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-sigo-muted font-bold pointer-events-none">
                    SEG
                  </span>
                </div>
              </div>

              <!-- Botones rápidos de tiempo -->
              <div class="flex items-center gap-1.5 pt-1">
                <button
                  *ngFor="let t of [30, 60, 120, 300, 600]"
                  type="button"
                  (click)="settings.setIntervaloRotacionSeg(t)"
                  class="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all"
                  [ngClass]="settings.intervaloRotacionSeg() === t ? 'bg-sigo-accent text-white border-sigo-accent shadow-xs' : 'bg-sigo-surface border-sigo-border text-sigo-muted hover:text-sigo-text'"
                >
                  {{ t < 60 ? t + 's' : (t / 60) + 'm' }}
                </button>
              </div>
            </div>

            <!-- 2. Cantidad de Zonas Activas Simultáneamente (1 a 5) -->
            <div class="space-y-2 border-t md:border-t-0 md:border-l border-sigo-border md:pl-4 pt-3 md:pt-0">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-sigo-text flex items-center gap-1.5">
                  <app-icon name="zonas" [size]="14" color="var(--sigo-accent)"></app-icon>
                  <span>Cantidad de Zonas a Rotar</span>
                </label>
                <span class="text-[11px] font-bold text-sigo-accent">
                  {{ settings.cantidadZonasRotacion() }} cuadrante{{ settings.cantidadZonasRotacion() > 1 ? 's' : '' }}
                </span>
              </div>
              <p class="text-[11px] text-sigo-muted">
                Selecciona cuántas zonas de riesgo (1 a 5) activará y moverá el algoritmo en cada ciclo.
              </p>

              <!-- Selector 1 a 5 -->
              <div class="flex items-center gap-1.5 pt-1">
                <button
                  *ngFor="let num of [1, 2, 3, 4, 5]"
                  type="button"
                  (click)="settings.setCantidadZonasRotacion(num)"
                  class="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all text-center"
                  [ngClass]="settings.cantidadZonasRotacion() === num ? 'bg-sigo-accent text-white border-sigo-accent shadow-xs' : 'bg-sigo-surface border-sigo-border text-sigo-muted hover:text-sigo-text'"
                >
                  {{ num }}
                </button>
              </div>

              <div class="p-2 rounded-lg bg-sigo-surface/60 border border-sigo-border text-[10px] text-sigo-muted">
                {{ settings.cantidadZonasRotacion() === 1 ? 'Rotación de máxima concentración (1 zona crítica prioritaria).' : 'Distribución táctica equilibrada en ' + settings.cantidadZonasRotacion() + ' cuadrantes simultáneos.' }}
              </div>
            </div>
          </div>

          <div class="text-xs text-sigo-muted flex items-center justify-between">
            <span *ngIf="settings.bucleZonasActivo()">
              🔄 El algoritmo rota automáticamente <b>{{ settings.cantidadZonasRotacion() }} cuadrante(s)</b> cada <b>{{ settings.intervaloRotacionSeg() }} segundos ({{ formatTiempo(settings.intervaloRotacionSeg()) }})</b> con mapa de calor focalizado.
            </span>
            <span *ngIf="!settings.bucleZonasActivo()">
              ✋ Bucle en pausa. Selecciona a continuación las zonas que deseas mantener fijas y activas en el mapa táctico:
            </span>
            <span class="text-[11px] font-semibold text-sigo-muted">
              {{ zonasDisponibles.length }} zonas registradas en el sistema
            </span>
          </div>

          <!-- Selector manual de zonas (Visible siempre para ver el estado, editable) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            <div
              *ngFor="let z of zonasDisponibles"
              (click)="seleccionarZona(z.id)"
              class="p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer hover:border-sigo-accent"
              [ngClass]="isZonaManualActiva(z.id) ? 'bg-sigo-surface2 border-sigo-accent/60 shadow-sm' : 'bg-sigo-surface border-sigo-border/60 opacity-60'"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="w-3 h-3 rounded-full shrink-0"
                  [style.backgroundColor]="getRiskInfo(z.crimeCount).color"
                ></span>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-sigo-text">{{ z.name }}</span>
                    <span
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded"
                      [style.color]="getRiskInfo(z.crimeCount).color"
                      [style.backgroundColor]="getRiskInfo(z.crimeCount).bg"
                    >
                      {{ z.crimeCount }}/10 Delitos
                    </span>
                  </div>
                  <p class="text-[10px] text-sigo-muted truncate max-w-[150px]">{{ z.address }}</p>
                </div>
              </div>

              <div class="w-4 h-4 rounded border flex items-center justify-center"
                   [ngClass]="isZonaManualActiva(z.id) ? 'bg-sigo-accent border-sigo-accent text-white' : 'border-sigo-border'">
                <app-icon *ngIf="isZonaManualActiva(z.id)" name="check" [size]="12"></app-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: CONFIGURACIÓN DE RECURSOS SOS -->
        <div class="card p-5 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-sigo-border">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-red-500/15 text-red-500 flex items-center justify-center border border-red-500/30">
                <app-icon name="alerta" [size]="16"></app-icon>
              </div>
              <div>
                <h2 class="text-sm font-bold text-sigo-text">Dotación y Recursos para Refuerzos SOS</h2>
                <p class="text-[11px] text-sigo-muted">Cantidad de unidades tácticas convocadas por defecto ante pedido de auxilio urgente</p>
              </div>
            </div>

            <!-- Selector 1 a 5 -->
            <div class="flex items-center gap-1.5 bg-sigo-surface2 p-1 rounded-xl border border-sigo-border">
              <button
                *ngFor="let num of [1, 2, 3, 4, 5]"
                type="button"
                (click)="settings.setRecursosSos(num)"
                class="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                [ngClass]="settings.recursosSos() === num ? 'bg-red-600 text-white shadow-sm' : 'text-sigo-muted hover:text-sigo-text'"
              >
                {{ num }}
              </button>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-sigo-surface2/60 border border-sigo-border text-xs space-y-1.5">
            <p class="text-sigo-text font-semibold flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              Configurado actualmente: {{ settings.recursosSos() }} patrulla{{ settings.recursosSos() > 1 ? 's' : '' }} requerida{{ settings.recursosSos() > 1 ? 's' : '' }}
            </p>
            <p class="text-[11px] text-sigo-muted">
              Al emitirse una alerta de emergencia desde el móvil, el sistema convocará a los <b>{{ settings.recursosSos() }} móviles más cercanos</b> mediante el algoritmo geográfico (o requerirá que el operador seleccione manualmente {{ settings.recursosSos() }} unidades activas).
            </p>
          </div>
        </div>

        <!-- SECCIÓN 3: TIEMPO MÁXIMO DE TRASLADO AL DESTINO (ETA DE LLEGADA) -->
        <div class="card p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sigo-border">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <app-icon name="reloj" [size]="16"></app-icon>
              </div>
              <div>
                <h2 class="text-sm font-bold text-sigo-text">Tiempo Límite de Traslado al Destino (ETA)</h2>
                <p class="text-[11px] text-sigo-muted">Tiempo estimado que puede tardar una unidad en arribar a la zona asignada (cronometrado en app y dashboard)</p>
              </div>
            </div>

            <!-- Selector de Opciones: 15 min, 20 min, 30 min o Manual -->
            <div class="flex items-center gap-1.5 bg-sigo-surface2 p-1 rounded-xl border border-sigo-border flex-wrap">
              <button
                *ngFor="let min of [15, 20, 30]"
                type="button"
                (click)="settings.setTiempoLlegadaPreset(min)"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                [ngClass]="settings.modoTiempoLlegada() === 'PRESET' && settings.tiempoLlegadaMin() === min ? 'bg-blue-600 text-white shadow-sm' : 'text-sigo-muted hover:text-sigo-text'"
              >
                {{ min }} min
              </button>

              <button
                type="button"
                (click)="settings.modoTiempoLlegada.set('MANUAL')"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                [ngClass]="settings.modoTiempoLlegada() === 'MANUAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-sigo-muted hover:text-sigo-text'"
              >
                ✏️ Manual
              </button>
            </div>
          </div>

          <!-- Detalle y Control de Tiempo -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-sigo-surface2/60 border border-sigo-border">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-sigo-text">Estado del Tiempo de Llegada</span>
                <span class="text-xs font-mono font-bold text-blue-400">
                  {{ settings.tiempoLlegadaMin() }} MINUTOS ({{ settings.tiempoLlegadaMin() * 60 }}s)
                </span>
              </div>
              <p class="text-[11px] text-sigo-muted leading-relaxed">
                El tiempo comienza a correr automáticamente en el <b>Dashboard</b> y en la <b>App Móvil</b> desde el momento exacto en que la unidad es despachada.
              </p>

              <!-- Control manual si está activo -->
              <div *ngIf="settings.modoTiempoLlegada() === 'MANUAL'" class="pt-2 space-y-2 animate-fade-in">
                <label class="block text-[11px] font-bold text-sigo-text">Definir Minutos Manualmente:</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="ajustarTiempoLlegada(-5)"
                    class="btn-ghost py-1 px-2.5 text-xs font-bold"
                    title="Restar 5 minutos"
                  >
                    -5m
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    [ngModel]="settings.tiempoLlegadaMin()"
                    (ngModelChange)="settings.setTiempoLlegadaManual($event)"
                    class="input text-xs font-mono font-bold w-24 text-center"
                  />
                  <button
                    type="button"
                    (click)="ajustarTiempoLlegada(5)"
                    class="btn-ghost py-1 px-2.5 text-xs font-bold"
                    title="Sumar 5 minutos"
                  >
                    +5m
                  </button>
                  <span class="text-xs text-sigo-muted font-medium">minutos de tolerancia</span>
                </div>
              </div>
            </div>

            <!-- Información de Geocerca Automática -->
            <div class="space-y-2 border-t md:border-t-0 md:border-l border-sigo-border md:pl-4 pt-3 md:pt-0">
              <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <app-icon name="mira" [size]="14"></app-icon>
                <span>Detección Automática de Llegada a Zona</span>
              </span>
              <p class="text-[11px] text-sigo-muted leading-relaxed">
                Si el sistema GPS detecta que la patrulla ha ingresado al cuadrante asignado antes o durante el tiempo límite, la unidad <b>pasa automáticamente a estar "En Zona" (Patrullando)</b>, deteniendo el contador de traslado y registrando la hora de ingreso en terreno.
              </p>
              <div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                ✓ Geocerca activa por radio métrico y validación satelital instantánea.
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 3: ADMINISTRACIÓN DE PERFILES APP MÓVIL -->
        <div class="card p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sigo-border">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sigo-surface2 flex items-center justify-center text-sigo-accent">
                <app-icon name="perfil" [size]="16"></app-icon>
              </div>
              <div>
                <h2 class="text-sm font-bold text-sigo-text">Perfiles de la Aplicación Móvil (Terreno)</h2>
                <p class="text-[11px] text-sigo-muted">Gestión de credenciales, grados y dotación de funcionarios autorizados</p>
              </div>
            </div>

            <button
              (click)="showNuevoUsuario = !showNuevoUsuario"
              class="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <app-icon [name]="showNuevoUsuario ? 'cerrar' : 'mas'" [size]="13"></app-icon>
              <span>{{ showNuevoUsuario ? 'Cerrar Formulario' : '+ Nuevo Funcionario' }}</span>
            </button>
          </div>

          <!-- Formulario Agregar Nuevo Funcionario -->
          <div *ngIf="showNuevoUsuario" class="p-4 rounded-xl bg-sigo-surface2 border border-sigo-accent/40 space-y-3 animate-fade-in text-xs">
            <h3 class="font-bold text-xs text-sigo-text text-sigo-accent">Registrar Funcionario en Terreno</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label class="block text-sigo-muted font-medium mb-1">RUT Funcionario</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoUsuario.rut_usuario"
                  placeholder="Ej: 18.234.567-8"
                  class="input-field"
                />
              </div>

              <div>
                <label class="block text-sigo-muted font-medium mb-1">Nombre Completo</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoUsuario.nombre_completo"
                  placeholder="Ej: Juan Pérez Soto"
                  class="input-field"
                />
              </div>

              <div>
                <label class="block text-sigo-muted font-medium mb-1">Grado / Cargo</label>
                <select [(ngModel)]="nuevoUsuario.grado_cargo" class="input-field bg-sigo-surface">
                  <option value="Carabinero">Carabinero</option>
                  <option value="Cabo 2°">Cabo 2°</option>
                  <option value="Cabo 1°">Cabo 1°</option>
                  <option value="Sargento 2°">Sargento 2°</option>
                  <option value="Sargento 1°">Sargento 1°</option>
                  <option value="Suboficial">Suboficial</option>
                  <option value="Suboficial Mayor">Suboficial Mayor</option>
                  <option value="Subteniente">Subteniente</option>
                  <option value="Teniente">Teniente</option>
                  <option value="Capitán">Capitán</option>
                </select>
              </div>

              <div>
                <label class="block text-sigo-muted font-medium mb-1">Contraseña / PIN</label>
                <input
                  type="password"
                  [(ngModel)]="nuevoUsuario.password_hash"
                  placeholder="••••••••"
                  class="input-field"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button (click)="showNuevoUsuario = false" class="btn-ghost text-xs py-1.5 px-3">Cancelar</button>
              <button
                (click)="guardarUsuario()"
                [disabled]="guardandoUsuario || !nuevoUsuario.rut_usuario || !nuevoUsuario.nombre_completo"
                class="btn-primary text-xs py-1.5 px-3"
              >
                {{ guardandoUsuario ? 'Guardando...' : 'Guardar y Habilitar en App' }}
              </button>
            </div>
          </div>

          <!-- Tabla de Funcionarios Móviles -->
          <div class="overflow-x-auto rounded-xl border border-sigo-border">
            <table class="w-full text-left text-xs">
              <thead class="bg-sigo-surface2/80 text-sigo-muted font-bold text-[11px] border-b border-sigo-border">
                <tr>
                  <th class="p-3">Funcionario</th>
                  <th class="p-3">RUT</th>
                  <th class="p-3">Grado / Cargo</th>
                  <th class="p-3">Rol</th>
                  <th class="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-sigo-border/60">
                <tr *ngFor="let u of usuariosMoviles()" class="hover:bg-sigo-surface2/50 transition-colors">
                  <td class="p-3">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-sigo-surface2 flex items-center justify-center text-sigo-accent font-bold text-[10px]">
                        {{ u.nombre_completo.charAt(0) }}
                      </div>
                      <span class="font-bold text-sigo-text">{{ u.nombre_completo }}</span>
                    </div>
                  </td>
                  <td class="p-3 font-mono text-sigo-muted">{{ u.rut_usuario }}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-md bg-sigo-surface2 text-sigo-text font-medium border border-sigo-border text-[11px]">
                      {{ u.grado_cargo || 'Carabinero' }}
                    </span>
                  </td>
                  <td class="p-3">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [ngClass]="u.rol === 'SUPERVISOR_WEB' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'">
                      {{ u.rol }}
                    </span>
                  </td>
                  <td class="p-3 text-right">
                    <button
                      (click)="eliminarUsuario(u)"
                      class="btn-ghost p-1 text-sigo-muted hover:text-red-500 transition-colors"
                      title="Eliminar funcionario"
                    >
                      <app-icon name="basura" [size]="14"></app-icon>
                    </button>
                  </td>
                </tr>

                <tr *ngIf="usuariosMoviles().length === 0">
                  <td colspan="5" class="p-6 text-center text-sigo-muted">
                    No se encontraron funcionarios registrados. Usa el botón superior para agregar uno nuevo.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  readonly settings   = inject(SettingsService);
  private readonly api        = inject(ApiService);
  private readonly mapService = inject(MapService);
  private readonly store      = inject(DashboardStore);

  get zonasDisponibles(): HotspotZone[] {
    return HOTSPOT_ZONES;
  }
  readonly usuariosMoviles = signal<any[]>([]);

  showNuevoUsuario = false;
  guardandoUsuario = false;

  nuevoUsuario = {
    rut_usuario: '',
    nombre_completo: '',
    grado_cargo: 'Carabinero',
    password_hash: '1234',
  };

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cargarUsuarios(),
      this.cargarZonas(),
    ]);
  }

  async cargarZonas(): Promise<void> {
    try {
      const zonas = await this.api.getZonas();
      syncDatabaseZones(zonas);
    } catch (e) {
      console.warn('Error cargando zonas en ajustes:', e);
    }
  }

  formatTiempo(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    if (min === 0) return `${sec}s`;
    if (sec === 0) return `${min}m`;
    return `${min}m ${sec}s`;
  }

  onCambioTiempoManual(val: any): void {
    const n = Number(val);
    if (!isNaN(n) && n >= 10 && n <= 1800) {
      this.settings.setIntervaloRotacionSeg(n);
    }
  }

  getRiskInfo(count: number) {
    return getRisk(count);
  }

  isZonaManualActiva(id: number): boolean {
    return this.settings.zonasManuales().includes(id);
  }

  seleccionarZona(id: number): void {
    if (this.settings.bucleZonasActivo()) {
      this.settings.setBucleZonas(false);
      this.mapService.clearManualActiveZones();
      this.store.resetDemoPatrolsToAvailable();
    }
    this.settings.toggleZonaManual(id);
  }

  toggleBucle(): void {
    const nuevo = !this.settings.bucleZonasActivo();
    this.settings.setBucleZonas(nuevo);
    if (!nuevo) {
      this.mapService.clearManualActiveZones();
      this.store.resetDemoPatrolsToAvailable();
    }
  }

  async cargarUsuarios(): Promise<void> {
    try {
      const data = await this.api.getUsuariosMoviles();
      this.usuariosMoviles.set(data);
    } catch (e) {
      console.warn('Error cargando usuarios:', e);
    }
  }

  async guardarUsuario(): Promise<void> {
    if (!this.nuevoUsuario.rut_usuario || !this.nuevoUsuario.nombre_completo) return;
    this.guardandoUsuario = true;
    try {
      await this.api.crearUsuarioMovil(this.nuevoUsuario);
      this.showNuevoUsuario = false;
      this.nuevoUsuario = {
        rut_usuario: '',
        nombre_completo: '',
        grado_cargo: 'Carabinero',
        password_hash: '1234',
      };
      await this.cargarUsuarios();
    } catch (e: any) {
      alert('Error creando funcionario: ' + (e.message || 'Error en Supabase'));
    } finally {
      this.guardandoUsuario = false;
    }
  }

  ajustarTiempoLlegada(delta: number): void {
    const actual = this.settings.tiempoLlegadaMin();
    this.settings.setTiempoLlegadaManual(actual + delta);
  }

  async eliminarUsuario(u: any): Promise<void> {
    if (!confirm(`¿Confirma eliminar al funcionario ${u.nombre_completo} (${u.rut_usuario})?`)) return;
    try {
      await this.api.eliminarUsuarioMovil(u.rut_usuario);
      await this.cargarUsuarios();
    } catch (e: any) {
      alert('Error eliminando usuario: ' + e.message);
    }
  }
}
