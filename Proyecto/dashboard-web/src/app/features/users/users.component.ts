import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  Usuario, SesionOperativa, TipoTransporte, EstadoOperativo,
} from '../../core/models';

export type EstadoUsuarioOperativo = 'ACTIVO_PRINCIPAL' | 'ACTIVO_ASIGNADO' | 'INACTIVO';

export interface UsuarioConEstado {
  usuario: Usuario;
  estado: EstadoUsuarioOperativo;
  sesion?: SesionOperativa;
  conductorTitular?: {
    rut: string;
    nombre: string;
    grado?: string;
  };
  unidad?: string;
  tipoTransporte?: TipoTransporte;
}

function cleanRut(rut?: string): string {
  return (rut ?? '').replace(/[.\-\s]/g, '').toLowerCase();
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NavbarComponent, IconComponent],
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
              <app-icon name="grupo" [size]="18" [stroke]="1.8"></app-icon>
            </div>
            <div>
              <h1 class="text-lg font-bold text-sigo-text">Gestión de Usuarios y Personal</h1>
              <p class="text-xs text-sigo-muted">
                Dotación activa, conductores titulares al mando, acompañantes asignados y personal de franco
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="px-3 py-1.5 bg-sigo-surface border border-sigo-border rounded-lg text-sigo-muted text-xs font-medium">
            {{ totalUsuarios() }} Efectivos Registrados
          </span>
          <button (click)="cargar()" class="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
            <app-icon name="reloj" [size]="13"></app-icon>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Métricas / KPIs Resumen -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <!-- Total Registrados -->
        <div class="p-3.5 rounded-xl bg-sigo-surface border border-sigo-border flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <app-icon name="grupo" [size]="20"></app-icon>
          </div>
          <div>
            <div class="text-xl font-bold text-sigo-text">{{ totalUsuarios() }}</div>
            <div class="text-[11px] text-sigo-muted font-medium">Dotación Total</div>
          </div>
        </div>

        <!-- Activos Principales (Conductores a cargo) -->
        <div
          (click)="setFiltroEstado('ACTIVO_PRINCIPAL')"
          class="p-3.5 rounded-xl bg-sigo-surface border border-sigo-border flex items-center gap-3 cursor-pointer hover:border-emerald-500/50 transition-all"
          [class.ring-2]="filtroEstado() === 'ACTIVO_PRINCIPAL'"
          [class.ring-emerald-500]="filtroEstado() === 'ACTIVO_PRINCIPAL'"
        >
          <div class="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 relative">
            <app-icon name="auto" [size]="20"></app-icon>
            <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div>
            <div class="text-xl font-bold text-emerald-400">{{ totalPrincipales() }}</div>
            <div class="text-[11px] text-sigo-muted font-medium">Activos Principales</div>
          </div>
        </div>

        <!-- Activos Asignados (Acompañantes en turno) -->
        <div
          (click)="setFiltroEstado('ACTIVO_ASIGNADO')"
          class="p-3.5 rounded-xl bg-sigo-surface border border-sigo-border flex items-center gap-3 cursor-pointer hover:border-sky-500/50 transition-all"
          [class.ring-2]="filtroEstado() === 'ACTIVO_ASIGNADO'"
          [class.ring-sky-500]="filtroEstado() === 'ACTIVO_ASIGNADO'"
        >
          <div class="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 relative">
            <app-icon name="grupo" [size]="20"></app-icon>
            <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
          </div>
          <div>
            <div class="text-xl font-bold text-sky-400">{{ totalAsignados() }}</div>
            <div class="text-[11px] text-sigo-muted font-medium">Activos Asignados</div>
          </div>
        </div>

        <!-- Inactivos / Francos -->
        <div
          (click)="setFiltroEstado('INACTIVO')"
          class="p-3.5 rounded-xl bg-sigo-surface border border-sigo-border flex items-center gap-3 cursor-pointer hover:border-sigo-muted/50 transition-all"
          [class.ring-2]="filtroEstado() === 'INACTIVO'"
          [class.ring-sigo-muted]="filtroEstado() === 'INACTIVO'"
        >
          <div class="w-10 h-10 rounded-lg bg-sigo-surface2 text-sigo-muted flex items-center justify-center shrink-0 border border-sigo-border">
            <app-icon name="candado" [size]="18"></app-icon>
          </div>
          <div>
            <div class="text-xl font-bold text-sigo-muted">{{ totalInactivos() }}</div>
            <div class="text-[11px] text-sigo-muted font-medium">Inactivos / Francos</div>
          </div>
        </div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="p-4 bg-sigo-surface border border-sigo-border rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <!-- Filtros Rápidos de Estado -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            (click)="setFiltroEstado('')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            [ngClass]="filtroEstado() === '' ? 'bg-sigo-accent text-white shadow-sm' : 'bg-sigo-surface2 text-sigo-muted hover:text-sigo-text'"
          >
            Todos ({{ totalUsuarios() }})
          </button>
          <button
            type="button"
            (click)="setFiltroEstado('ACTIVO_PRINCIPAL')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            [ngClass]="filtroEstado() === 'ACTIVO_PRINCIPAL' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-sigo-surface2 text-sigo-muted hover:text-emerald-400'"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Principales ({{ totalPrincipales() }})</span>
          </button>
          <button
            type="button"
            (click)="setFiltroEstado('ACTIVO_ASIGNADO')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            [ngClass]="filtroEstado() === 'ACTIVO_ASIGNADO' ? 'bg-sky-600 text-white shadow-sm' : 'bg-sigo-surface2 text-sigo-muted hover:text-sky-400'"
          >
            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>Asignados ({{ totalAsignados() }})</span>
          </button>
          <button
            type="button"
            (click)="setFiltroEstado('INACTIVO')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            [ngClass]="filtroEstado() === 'INACTIVO' ? 'bg-zinc-600 text-white shadow-sm' : 'bg-sigo-surface2 text-sigo-muted hover:text-sigo-text'"
          >
            <span class="w-2 h-2 rounded-full bg-zinc-400"></span>
            <span>Inactivos ({{ totalInactivos() }})</span>
          </button>
        </div>

        <!-- Búsqueda por texto -->
        <div class="relative w-full md:w-80">
          <app-icon name="lupa" [size]="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-sigo-muted pointer-events-none"></app-icon>
          <input
            type="text"
            [ngModel]="filtroTexto()"
            (ngModelChange)="filtroTexto.set($event)"
            placeholder="Buscar por RUT, nombre, grado o móvil..."
            class="w-full pl-9 pr-3 py-1.5 bg-sigo-surface2 border border-sigo-border rounded-lg text-xs text-sigo-text placeholder:text-sigo-muted focus:outline-none focus:border-sigo-accent transition-colors"
          />
          <button
            *ngIf="filtroTexto()"
            (click)="filtroTexto.set('')"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-sigo-muted hover:text-sigo-text text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Contenedor Principal: Tabla de Usuarios -->
      @if (cargando()) {
        <div class="flex flex-col items-center justify-center py-20 text-sigo-muted gap-2">
          <div class="w-6 h-6 border-2 border-sigo-accent border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs">Cargando dotación del sistema...</span>
        </div>
      } @else {
        <div class="bg-sigo-surface border border-sigo-border rounded-xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-sigo-border bg-sigo-surface2/60 text-sigo-muted text-[11px] uppercase tracking-wider font-semibold">
                  <th class="px-4 py-3">Funcionario / Efectivo</th>
                  <th class="px-4 py-3">Rol Sistema</th>
                  <th class="px-4 py-3">Estado Operativo</th>
                  <th class="px-4 py-3">Servicio y Asignación Táctica</th>
                  <th class="px-4 py-3">Hora Inicio</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-sigo-border">
                @for (item of usuariosFiltrados(); track item.usuario.rut_usuario) {
                  <tr class="hover:bg-sigo-surface2/40 transition-colors">
                    <!-- Funcionario / Efectivo -->
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
                          [ngClass]="{
                            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30': item.estado === 'ACTIVO_PRINCIPAL',
                            'bg-sky-500/15 text-sky-400 border-sky-500/30': item.estado === 'ACTIVO_ASIGNADO',
                            'bg-sigo-surface2 text-sigo-muted border-sigo-border': item.estado === 'INACTIVO'
                          }"
                        >
                          {{ item.usuario.nombre_completo.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <div class="font-semibold text-sigo-text flex items-center gap-2">
                            <span>{{ item.usuario.nombre_completo }}</span>
                            <span *ngIf="item.usuario.grado_cargo" class="text-[10px] px-1.5 py-0.2 rounded bg-sigo-surface2 text-sigo-muted border border-sigo-border">
                              {{ item.usuario.grado_cargo }}
                            </span>
                          </div>
                          <p class="text-[11px] text-sigo-muted font-mono">{{ item.usuario.rut_usuario }}</p>
                        </div>
                      </div>
                    </td>

                    <!-- Rol Sistema -->
                    <td class="px-4 py-3">
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider"
                        [ngClass]="item.usuario.rol === 'SUPERVISOR_WEB' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-sigo-surface2 text-sigo-text border border-sigo-border'"
                      >
                        {{ item.usuario.rol === 'SUPERVISOR_WEB' ? 'SUPERVISOR' : 'FUNCIONARIO' }}
                      </span>
                    </td>

                    <!-- Estado Operativo -->
                    <td class="px-4 py-3">
                      <!-- ACTIVO PRINCIPAL -->
                      <div *ngIf="item.estado === 'ACTIVO_PRINCIPAL'" class="space-y-1">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>ACTIVO PRINCIPAL</span>
                        </span>
                        <div class="text-[10px] text-sigo-muted">
                          Titular a cargo del servicio
                        </div>
                      </div>

                      <!-- ACTIVO ASIGNADO -->
                      <div *ngIf="item.estado === 'ACTIVO_ASIGNADO'" class="space-y-1">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-bold">
                          <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                          <span>ACTIVO ASIGNADO</span>
                        </span>
                        <div class="text-[10px] text-sky-400/90 font-medium">
                          Acompañante en patrullaje
                        </div>
                      </div>

                      <!-- INACTIVO -->
                      <div *ngIf="item.estado === 'INACTIVO'">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sigo-surface2 text-sigo-muted border border-sigo-border text-[10px] font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                          <span>INACTIVO / FRANCO</span>
                        </span>
                      </div>
                    </td>

                    <!-- Servicio y Asignación Táctica -->
                    <td class="px-4 py-3">
                      <!-- Detalle para ACTIVO PRINCIPAL -->
                      <div *ngIf="item.estado === 'ACTIVO_PRINCIPAL' && item.sesion" class="space-y-1">
                        <div class="flex items-center gap-1.5 font-semibold text-sigo-text text-xs">
                          <app-icon [name]="getTransportIcon(item.sesion.tipo_transporte)" [size]="14" color="var(--sigo-accent)"></app-icon>
                          <span>{{ item.sesion.identificador_unidad }}</span>
                          <span class="text-[10px] font-normal text-sigo-muted">({{ item.sesion.tipo_transporte }})</span>
                        </div>
                        <div class="flex items-center gap-2 text-[11px]">
                          <span
                            *ngIf="item.sesion.tripulacion && item.sesion.tripulacion.length > 0"
                            class="px-1.5 py-0.2 rounded bg-sigo-accent/15 text-sigo-accent border border-sigo-accent/30 text-[10px] font-semibold"
                          >
                            +{{ item.sesion.tripulacion.length }} Acompañante{{ item.sesion.tripulacion.length > 1 ? 's' : '' }} a cargo
                          </span>
                          <span *ngIf="!item.sesion.tripulacion || item.sesion.tripulacion.length === 0" class="text-sigo-muted text-[10px]">
                            Dotación individual
                          </span>
                          <span *ngIf="item.sesion.asignacion_activa?.nombre_zona" class="text-sigo-muted text-[10px]">
                            · Zona: {{ item.sesion.asignacion_activa?.nombre_zona }}
                          </span>
                        </div>
                      </div>

                      <!-- Detalle para ACTIVO ASIGNADO (DEBE QUEDAR CLARO A CARGO DE QUIÉN ESTÁ) -->
                      <div *ngIf="item.estado === 'ACTIVO_ASIGNADO' && item.conductorTitular" class="space-y-1.5">
                        <!-- Conductor Titular a cargo -->
                        <div class="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40">
                          <div class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                            <app-icon name="id" [size]="11"></app-icon>
                            <span>A CARGO DE:</span>
                          </div>
                          <div class="text-xs font-semibold text-sigo-text">
                            {{ item.conductorTitular.nombre }}
                          </div>
                          <div class="text-[10px] text-sigo-muted font-mono">
                            {{ item.conductorTitular.rut }} {{ item.conductorTitular.grado ? '· ' + item.conductorTitular.grado : '' }}
                          </div>
                        </div>

                        <!-- Unidad en la que va asignado -->
                        <div class="flex items-center gap-1.5 text-[11px] text-sigo-text font-medium pl-1">
                          <app-icon [name]="getTransportIcon(item.tipoTransporte)" [size]="13" color="var(--sigo-accent)"></app-icon>
                          <span>Móvil: {{ item.unidad || 'Unidad Asignada' }}</span>
                          <span *ngIf="item.tipoTransporte" class="text-[10px] text-sigo-muted">({{ item.tipoTransporte }})</span>
                        </div>
                      </div>

                      <!-- Detalle para INACTIVO -->
                      <div *ngIf="item.estado === 'INACTIVO'" class="text-sigo-muted text-xs">
                        — Sin servicio activo asignado —
                      </div>
                    </td>

                    <!-- Hora Inicio -->
                    <td class="px-4 py-3 text-sigo-muted">
                      {{ item.sesion?.fecha_inicio ? (item.sesion?.fecha_inicio | date:'dd/MM HH:mm') : '—' }}
                    </td>

                    <!-- Acciones -->
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          (click)="abrirFicha(item)"
                          class="btn-ghost py-1 px-2 text-[11px] flex items-center gap-1 hover:text-sigo-accent transition-colors"
                          title="Ver ficha del funcionario"
                        >
                          <app-icon name="ojo" [size]="13"></app-icon>
                          <span>Ficha</span>
                        </button>
                        <button
                          *ngIf="item.sesion"
                          (click)="irAUnidad(item.sesion)"
                          class="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                          title="Ir a gestionar unidad en Unidades"
                        >
                          <app-icon name="unidades" [size]="12"></app-icon>
                          <span>Ver Unidad</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="px-4 py-12 text-center text-sigo-muted">
                      No se encontraron usuarios con los filtros seleccionados.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Modal Ficha de Funcionario -->
    <div
      *ngIf="usuarioSeleccionado"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <!-- Header Modal -->
        <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border"
              [ngClass]="{
                'bg-emerald-500/15 text-emerald-400 border-emerald-500/30': usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL',
                'bg-sky-500/15 text-sky-400 border-sky-500/30': usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO',
                'bg-sigo-surface text-sigo-muted border-sigo-border': usuarioSeleccionado.estado === 'INACTIVO'
              }"
            >
              {{ usuarioSeleccionado.usuario.nombre_completo.charAt(0).toUpperCase() }}
            </div>
            <div>
              <h3 class="font-bold text-sm text-sigo-text">{{ usuarioSeleccionado.usuario.nombre_completo }}</h3>
              <p class="text-[11px] text-sigo-muted font-mono">
                RUT: {{ usuarioSeleccionado.usuario.rut_usuario }} {{ usuarioSeleccionado.usuario.grado_cargo ? '· ' + usuarioSeleccionado.usuario.grado_cargo : '' }}
              </p>
            </div>
          </div>
          <button (click)="usuarioSeleccionado = null" class="btn-ghost p-1.5 text-sigo-muted hover:text-sigo-text">
            <app-icon name="cerrar" [size]="16"></app-icon>
          </button>
        </div>

        <!-- Body Modal -->
        <div class="p-5 space-y-4 text-xs">
          <!-- Tarjeta de Estado Operativo -->
          <div
            class="p-4 rounded-xl border flex items-center justify-between"
            [ngClass]="{
              'bg-emerald-950/20 border-emerald-500/30': usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL',
              'bg-sky-950/20 border-sky-500/30': usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO',
              'bg-sigo-surface2/40 border-sigo-border': usuarioSeleccionado.estado === 'INACTIVO'
            }"
          >
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-sigo-muted">Condición Operativa</span>
              <div class="font-bold text-sm mt-0.5" [ngClass]="{
                'text-emerald-400': usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL',
                'text-sky-400': usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO',
                'text-sigo-muted': usuarioSeleccionado.estado === 'INACTIVO'
              }">
                {{ usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL' ? 'Activo Principal (Conductor Titular)' : (usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO' ? 'Activo Asignado (Acompañante)' : 'Inactivo / Franco') }}
              </div>
            </div>
            <span
              class="px-2.5 py-1 rounded-full text-[10px] font-bold border"
              [ngClass]="{
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/40': usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL',
                'bg-sky-500/20 text-sky-300 border-sky-500/40': usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO',
                'bg-zinc-800 text-zinc-400 border-zinc-700': usuarioSeleccionado.estado === 'INACTIVO'
              }"
            >
              {{ usuarioSeleccionado.estado }}
            </span>
          </div>

          <!-- Si es ACTIVO ASIGNADO: Mostrar información clara del Conductor a Cargo -->
          <div *ngIf="usuarioSeleccionado.estado === 'ACTIVO_ASIGNADO' && usuarioSeleccionado.conductorTitular" class="space-y-2">
            <h4 class="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <app-icon name="id" [size]="13"></app-icon>
              <span>Dependencia Operativa: Conductor Titular a Cargo</span>
            </h4>
            <div class="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-bold text-xs text-sigo-text">{{ usuarioSeleccionado.conductorTitular.nombre }}</div>
                  <div class="text-[11px] text-sigo-muted font-mono">{{ usuarioSeleccionado.conductorTitular.rut }} · {{ usuarioSeleccionado.conductorTitular.grado || 'Funcionario Titular' }}</div>
                </div>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  A CARGO
                </span>
              </div>
              <p class="text-[11px] text-sigo-muted border-t border-sky-800/30 pt-2">
                Este funcionario fue incorporado al servicio activo por el conductor titular responsable de la unidad <strong class="text-sigo-text">{{ usuarioSeleccionado.unidad }}</strong>.
              </p>
            </div>
          </div>

          <!-- Si es ACTIVO PRINCIPAL: Mostrar acompañantes a su cargo -->
          <div *ngIf="usuarioSeleccionado.estado === 'ACTIVO_PRINCIPAL' && usuarioSeleccionado.sesion" class="space-y-2">
            <h4 class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <app-icon name="grupo" [size]="13"></app-icon>
              <span>Personal y Acompañantes a su Cargo ({{ usuarioSeleccionado.sesion.tripulacion?.length || 0 }})</span>
            </h4>
            @if (usuarioSeleccionado.sesion.tripulacion && usuarioSeleccionado.sesion.tripulacion.length > 0) {
              <div class="space-y-1.5">
                @for (item of usuarioSeleccionado.sesion.tripulacion; track item.id_tripulacion) {
                  <div class="p-2.5 rounded-lg bg-sigo-surface2 border border-sigo-border flex items-center justify-between">
                    <div>
                      <div class="font-semibold text-xs text-sigo-text">{{ item.acompanante?.nombre_completo || 'Acompañante' }}</div>
                      <div class="text-[10px] text-sigo-muted font-mono">{{ item.rut_acompanante }} · {{ item.acompanante?.grado_cargo || 'Efectivo' }}</div>
                    </div>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      ASIGNADO
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="p-3 rounded-lg bg-sigo-surface2/30 border border-dashed border-sigo-border text-center text-sigo-muted text-xs">
                Sin acompañantes asignados (patrullaje individual).
              </div>
            }
          </div>

          <!-- Datos de la unidad y sesión si aplica -->
          <div *ngIf="usuarioSeleccionado.sesion" class="grid grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-lg bg-sigo-surface2 border border-sigo-border">
              <span class="text-[10px] text-sigo-muted block">Unidad Móvil</span>
              <span class="font-semibold text-sigo-text">{{ usuarioSeleccionado.sesion.identificador_unidad }}</span>
              <span class="text-[10px] text-sigo-muted block font-mono">Tipo: {{ usuarioSeleccionado.sesion.tipo_transporte }}</span>
            </div>
            <div class="p-2.5 rounded-lg bg-sigo-surface2 border border-sigo-border">
              <span class="text-[10px] text-sigo-muted block">Zona de Patrullaje</span>
              <span class="font-semibold text-sigo-text">{{ usuarioSeleccionado.sesion.asignacion_activa?.nombre_zona || 'Sin Zona Fija' }}</span>
              <span class="text-[10px] text-sigo-muted block">Turno: {{ usuarioSeleccionado.sesion.fecha_inicio | date:'HH:mm' }} hrs</span>
            </div>
          </div>
        </div>

        <!-- Footer Modal -->
        <div class="px-5 py-3 border-t border-sigo-border bg-sigo-surface2/40 flex items-center justify-end">
          <button (click)="usuarioSeleccionado = null" class="btn-primary text-xs py-1.5 px-4">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
  `,
})
export class UsersComponent implements OnInit, OnDestroy {
  private readonly apiService      = inject(ApiService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router          = inject(Router);

  readonly cargando = signal(false);
  readonly usuarios = signal<Usuario[]>([]);
  readonly sesiones = signal<SesionOperativa[]>([]);

  readonly filtroEstado = signal<string>(''); // '', 'ACTIVO_PRINCIPAL', 'ACTIVO_ASIGNADO', 'INACTIVO'
  readonly filtroTexto  = signal<string>('');

  usuarioSeleccionado: UsuarioConEstado | null = null;

  private subSesiones?: any;
  private subTripulacion?: any;

  setFiltroEstado(st: string): void {
    if (!st) {
      this.filtroEstado.set('');
    } else {
      this.filtroEstado.set(this.filtroEstado() === st ? '' : st);
    }
  }

  // Lista combinada de usuarios con estado
  readonly usuariosConEstado = computed<UsuarioConEstado[]>(() => {
    const userList = this.usuarios();
    const sesionList = this.sesiones();

    // Mapas para búsqueda O(1) con RUT limpio
    const principalMap = new Map<string, SesionOperativa>();
    const asignadoMap = new Map<string, SesionOperativa>();

    for (const sesion of sesionList) {
      if (sesion.rut_conductor) {
        principalMap.set(cleanRut(sesion.rut_conductor), sesion);
      }
      if (sesion.tripulacion && Array.isArray(sesion.tripulacion)) {
        for (const trip of sesion.tripulacion) {
          if (trip.rut_acompanante) {
            asignadoMap.set(cleanRut(trip.rut_acompanante), sesion);
          }
        }
      }
    }

    return userList.map(u => {
      const rutClean = cleanRut(u.rut_usuario);

      // Es Activo Principal?
      const sesionPrincipal = principalMap.get(rutClean);
      if (sesionPrincipal) {
        return {
          usuario: u,
          estado: 'ACTIVO_PRINCIPAL' as EstadoUsuarioOperativo,
          sesion: sesionPrincipal,
          unidad: sesionPrincipal.identificador_unidad,
          tipoTransporte: sesionPrincipal.tipo_transporte,
        };
      }

      // Es Activo Asignado?
      const sesionAsignada = asignadoMap.get(rutClean);
      if (sesionAsignada) {
        return {
          usuario: u,
          estado: 'ACTIVO_ASIGNADO' as EstadoUsuarioOperativo,
          sesion: sesionAsignada,
          conductorTitular: {
            rut: sesionAsignada.rut_conductor,
            nombre: sesionAsignada.conductor?.nombre_completo || 'Conductor Titular',
            grado: sesionAsignada.conductor?.grado_cargo,
          },
          unidad: sesionAsignada.identificador_unidad,
          tipoTransporte: sesionAsignada.tipo_transporte,
        };
      }

      // Inactivo / Franco
      return {
        usuario: u,
        estado: 'INACTIVO' as EstadoUsuarioOperativo,
      };
    });
  });

  // Métricas
  readonly totalUsuarios = computed(() => this.usuariosConEstado().length);
  readonly totalPrincipales = computed(() =>
    this.usuariosConEstado().filter(u => u.estado === 'ACTIVO_PRINCIPAL').length
  );
  readonly totalAsignados = computed(() =>
    this.usuariosConEstado().filter(u => u.estado === 'ACTIVO_ASIGNADO').length
  );
  readonly totalInactivos = computed(() =>
    this.usuariosConEstado().filter(u => u.estado === 'INACTIVO').length
  );

  // Filtro reactivo con Signals
  readonly usuariosFiltrados = computed(() => {
    const list = this.usuariosConEstado();
    const query = this.filtroTexto().trim().toLowerCase();
    const queryClean = cleanRut(query);
    const st = this.filtroEstado();

    return list.filter(item => {
      const matchEstado = !st || item.estado === st;
      const matchText = !query ||
        item.usuario.rut_usuario.toLowerCase().includes(query) ||
        cleanRut(item.usuario.rut_usuario).includes(queryClean) ||
        item.usuario.nombre_completo.toLowerCase().includes(query) ||
        (item.usuario.grado_cargo ?? '').toLowerCase().includes(query) ||
        (item.unidad ?? '').toLowerCase().includes(query) ||
        (item.conductorTitular?.nombre ?? '').toLowerCase().includes(query) ||
        (item.conductorTitular?.rut ?? '').toLowerCase().includes(query);

      return matchEstado && matchText;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();

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
      console.warn('[UsersComponent] Error during destroy:', e);
    }
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
    try {
      const [users, sessions] = await Promise.all([
        this.apiService.getUsuarios(),
        this.apiService.getSesionesActivas(),
      ]);

      this.usuarios.set(users);
      this.sesiones.set(sessions);
    } catch (err) {
      console.error('[UsersComponent] Error al cargar usuarios o sesiones:', err);
    }
  }

  abrirFicha(item: UsuarioConEstado): void {
    this.usuarioSeleccionado = item;
  }

  irAUnidad(sesion: SesionOperativa): void {
    this.router.navigate(['/unidades']);
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
