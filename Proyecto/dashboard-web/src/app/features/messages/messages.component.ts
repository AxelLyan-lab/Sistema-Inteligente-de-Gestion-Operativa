import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { SesionOperativa, Mensaje } from '../../core/models';

interface MensajeDiaFolder {
  fechaStr: string;
  fechaDate: Date;
  mensajes: any[];
  expanded: boolean;
}

interface MensajeUsuarioFolder {
  usuarioNombre: string;
  unidad: string;
  dias: MensajeDiaFolder[];
  totalMensajes: number;
  expanded: boolean;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, IconComponent],
  template: `
    <div class="h-screen flex flex-col bg-sigo-bg text-sigo-text overflow-hidden select-none">
      <app-navbar></app-navbar>

      <!-- Barra de Pestañas: Chat Activo vs Historial de Mensajes -->
      <div class="px-5 py-2.5 bg-sigo-surface border-b border-sigo-border flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button
            (click)="tabActivo.set('ACTIVO')"
            [class.bg-sigo-accent]="tabActivo() === 'ACTIVO'"
            [class.text-white]="tabActivo() === 'ACTIVO'"
            [class.bg-sigo-surface2]="tabActivo() !== 'ACTIVO'"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-sigo-border flex items-center gap-2 transition-all shadow-sm"
          >
            <app-icon name="mensajes" [size]="15"></app-icon>
            <span>Chat en Vivo (Turno Actual)</span>
          </button>

          <button
            (click)="tabActivo.set('HISTORIAL'); cargarHistorial()"
            [class.bg-sigo-accent]="tabActivo() === 'HISTORIAL'"
            [class.text-white]="tabActivo() === 'HISTORIAL'"
            [class.bg-sigo-surface2]="tabActivo() !== 'HISTORIAL'"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-sigo-border flex items-center gap-2 transition-all shadow-sm"
          >
            <app-icon name="reloj" [size]="15"></app-icon>
            <span>Historial de Sesiones Anteriores</span>
          </button>
        </div>

        <!-- Filtros de Tiempo en modo Historial -->
        @if (tabActivo() === 'HISTORIAL') {
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-semibold text-sigo-muted mr-1">Filtrar:</span>
            <button
              (click)="filtroPeriodo.set('7D')"
              [class.bg-sigo-accent]="filtroPeriodo() === '7D'"
              [class.text-white]="filtroPeriodo() === '7D'"
              [class.bg-sigo-surface2]="filtroPeriodo() !== '7D'"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sigo-border transition-all"
            >
              Últimos 7 días
            </button>
            <button
              (click)="filtroPeriodo.set('30D')"
              [class.bg-sigo-accent]="filtroPeriodo() === '30D'"
              [class.text-white]="filtroPeriodo() === '30D'"
              [class.bg-sigo-surface2]="filtroPeriodo() !== '30D'"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sigo-border transition-all"
            >
              Último mes
            </button>
            <button
              (click)="filtroPeriodo.set('90D')"
              [class.bg-sigo-accent]="filtroPeriodo() === '90D'"
              [class.text-white]="filtroPeriodo() === '90D'"
              [class.bg-sigo-surface2]="filtroPeriodo() !== '90D'"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sigo-border transition-all"
            >
              Últimos 3 meses
            </button>
            <button
              (click)="filtroPeriodo.set('1Y')"
              [class.bg-sigo-accent]="filtroPeriodo() === '1Y'"
              [class.text-white]="filtroPeriodo() === '1Y'"
              [class.bg-sigo-surface2]="filtroPeriodo() !== '1Y'"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sigo-border transition-all"
            >
              Último año
            </button>
          </div>
        }
      </div>

      <!-- VISTA 1: CHAT EN VIVO CON PATRULLAS ACTIVAS -->
      @if (tabActivo() === 'ACTIVO') {
        <div class="flex-1 flex overflow-hidden">
          <!-- Columna Izquierda: Lista de Patrullas -->
          <aside class="w-80 border-r border-sigo-border bg-sigo-surface flex flex-col">
            <div class="p-3 border-b border-sigo-border">
              <h2 class="text-xs font-bold uppercase tracking-wider text-sigo-muted">Patrullas en Servicio</h2>
              <p class="text-[11px] text-sigo-muted mt-0.5">Canal directo de instrucciones tácticas</p>
            </div>

            <div class="flex-1 overflow-y-auto divide-y divide-sigo-border/60">
              <div
                *ngFor="let s of sesiones()"
                (click)="seleccionarSesion(s)"
                [ngClass]="selectedSesion()?.id_sesion === s.id_sesion ? 'bg-sigo-surface2 border-l-4 border-l-sigo-accent' : ''"
                class="p-3 cursor-pointer hover:bg-sigo-surface2 transition-colors flex items-center justify-between"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-sigo-surface2 border border-sigo-border flex items-center justify-center text-sigo-accent">
                    <app-icon [name]="getTransportIcon(s.tipo_transporte)" [size]="18"></app-icon>
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-xs text-sigo-text">{{ s.identificador_unidad }}</span>
                      <span class="w-1.5 h-1.5 rounded-full bg-sigo-accent"></span>
                    </div>
                    <p class="text-[11px] text-sigo-muted truncate max-w-[150px]">
                      {{ s.conductor?.nombre_completo || 'Conductor' }}
                    </p>
                  </div>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-sigo-surface2 text-sigo-muted font-medium border border-sigo-border">
                  #{{ s.id_sesion }}
                </span>
              </div>

              <div *ngIf="sesiones().length === 0" class="p-6 text-center text-xs text-sigo-muted">
                No hay patrullas conectadas en este momento.
              </div>
            </div>
          </aside>

          <!-- Columna Derecha: Chat Activo -->
          <main class="flex-1 flex flex-col bg-sigo-bg">
            <!-- Header de Conversación -->
            <div *ngIf="selectedSesion()" class="px-5 py-3 border-b border-sigo-border bg-sigo-surface flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-sigo-accent/15 border border-sigo-accent/30 text-sigo-accent flex items-center justify-center">
                  <app-icon [name]="getTransportIcon(selectedSesion()!.tipo_transporte)" [size]="20"></app-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-sm text-sigo-text">{{ selectedSesion()!.identificador_unidad }}</h3>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-sigo-accent/15 text-sigo-accent font-semibold border border-sigo-accent/20">
                      {{ selectedSesion()!.estado_operativo }}
                    </span>
                  </div>
                  <p class="text-xs text-sigo-muted">
                    Conductor: {{ selectedSesion()!.conductor?.nombre_completo || 'No asignado' }} | IMEI: {{ selectedSesion()!.imei_simcard }}
                  </p>
                </div>
              </div>

              <div class="text-right text-[11px] text-sigo-muted">
                <span>Sesión iniciada: {{ selectedSesion()!.fecha_inicio | date:'shortTime' }}</span>
              </div>
            </div>

            <!-- Lista de Mensajes -->
            <div class="flex-1 p-5 overflow-y-auto space-y-3" #messagesContainer>
              <div *ngIf="!selectedSesion()" class="h-full flex flex-col items-center justify-center text-sigo-muted text-xs gap-2">
                <app-icon name="mensajes" [size]="32" [stroke]="1.2"></app-icon>
                <p>Selecciona una patrulla de la lista para ver la mensajería táctica.</p>
              </div>

              <div *ngIf="selectedSesion() && mensajes().length === 0" class="h-full flex flex-col items-center justify-center text-sigo-muted text-xs gap-1">
                <app-icon name="check" [size]="28" [stroke]="1.2"></app-icon>
                <p>Sin mensajes registrados en esta sesión.</p>
                <p class="text-[11px] opacity-70">Envía una instrucción táctica al funcionario en terreno.</p>
              </div>

              <div
                *ngFor="let m of mensajes(); trackBy: trackByMsg"
                [class.justify-end]="m.remitente === 'SUPERVISOR'"
                [class.justify-start]="m.remitente === 'FUNCIONARIO'"
                class="flex"
              >
                <div
                  [class.bg-sigo-accent]="m.remitente === 'SUPERVISOR'"
                  [class.text-white]="m.remitente === 'SUPERVISOR'"
                  [class.bg-sigo-surface]="m.remitente === 'FUNCIONARIO'"
                  [class.text-sigo-text]="m.remitente === 'FUNCIONARIO'"
                  [class.border]="m.remitente === 'FUNCIONARIO'"
                  [class.border-sigo-border]="m.remitente === 'FUNCIONARIO'"
                  class="max-w-md rounded-2xl px-4 py-2.5 shadow-sm space-y-1"
                >
                  <div class="flex items-center justify-between gap-3 text-[10px] opacity-80">
                    <span class="font-bold uppercase tracking-wider">
                      {{ m.remitente === 'SUPERVISOR' ? 'Supervisor (Tú)' : 'Patrulla' }}
                    </span>
                    <span>{{ m.fecha | date:'HH:mm' }}</span>
                  </div>
                  <div *ngIf="isAudio(m.texto)" class="space-y-1 py-1">
                    <div class="flex items-center gap-1.5 text-[11px] font-bold opacity-90">
                      <span>🎙️ Nota de voz</span>
                    </div>
                    <audio [src]="getAudioUrl(m.texto)" controls preload="metadata" class="max-w-[240px] h-8 rounded-lg outline-none"></audio>
                  </div>
                  <p *ngIf="!isAudio(m.texto)" class="text-xs leading-relaxed whitespace-pre-wrap">{{ m.texto }}</p>
                </div>
              </div>
            </div>

            <!-- Input para Enviar Mensaje -->
            <div *ngIf="selectedSesion()" class="p-3 border-t border-sigo-border bg-sigo-surface">
              <form (ngSubmit)="enviar()" class="flex items-center gap-2">
                <input
                  type="text"
                  [(ngModel)]="nuevoTexto"
                  name="texto"
                  placeholder="Escribe una orden o instrucción táctica a la patrulla..."
                  class="input-field text-xs py-2.5 flex-1"
                  [disabled]="enviando"
                />
                <button
                  type="submit"
                  [disabled]="enviando || !nuevoTexto.trim()"
                  class="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-4"
                >
                  <app-icon name="enviar" [size]="14"></app-icon>
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </main>
        </div>
      }

      <!-- VISTA 2: HISTORIAL DE MENSAJES (CARPETAS POR USUARIO Y DÍA) -->
      @if (tabActivo() === 'HISTORIAL') {
        <div class="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-4">
          <!-- Input de Búsqueda -->
          <div class="w-full max-w-md">
            <input
              type="text"
              [(ngModel)]="busquedaHistorial"
              placeholder="Buscar en historial por funcionario, patrulla o texto..."
              class="input-field text-xs py-2"
            />
          </div>

          @for (userFolder of carpetasHistorial(); track userFolder.usuarioNombre) {
            <div class="card overflow-hidden border border-sigo-border hover:border-sigo-accent/50 transition-all">
              <!-- Nivel 1: Carpeta Funcionario / Patrulla -->
              <div
                (click)="userFolder.expanded = !userFolder.expanded"
                class="p-3.5 bg-sigo-surface2/60 cursor-pointer flex items-center justify-between hover:bg-sigo-surface2 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                    <app-icon name="mensajes" [size]="16"></app-icon>
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="font-bold text-sm text-sigo-text">{{ userFolder.usuarioNombre }}</h2>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-sigo-accent/15 text-sigo-accent font-semibold border border-sigo-accent/30">
                        {{ userFolder.unidad }}
                      </span>
                    </div>
                    <p class="text-[11px] text-sigo-muted">
                      {{ userFolder.dias.length }} {{ userFolder.dias.length === 1 ? 'jornada registrada' : 'jornadas registradas' }} · {{ userFolder.totalMensajes }} mensajes intercambiados
                    </p>
                  </div>
                </div>

                <span class="text-xs text-sigo-muted">{{ userFolder.expanded ? 'Ocultar sesiones ▲' : 'Ver por días ▼' }}</span>
              </div>

              <!-- Nivel 2: Días Registrados -->
              @if (userFolder.expanded) {
                <div class="p-3 bg-sigo-bg/50 divide-y divide-sigo-border/40 space-y-3">
                  @for (diaFolder of userFolder.dias; track diaFolder.fechaStr) {
                    <div class="pt-2">
                      <div
                        (click)="diaFolder.expanded = !diaFolder.expanded"
                        class="p-2.5 rounded-lg bg-sigo-surface border border-sigo-border cursor-pointer flex items-center justify-between hover:border-sigo-accent transition-all"
                      >
                        <div class="flex items-center gap-2.5">
                          <span class="text-base">📅</span>
                          <div>
                            <span class="font-bold text-xs text-sigo-text capitalize">{{ diaFolder.fechaStr }}</span>
                            <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sigo-surface2 text-sigo-muted font-bold">
                              {{ diaFolder.mensajes.length }} {{ diaFolder.mensajes.length === 1 ? 'mensaje' : 'mensajes' }}
                            </span>
                          </div>
                        </div>
                        <span class="text-[11px] text-sigo-accent font-medium">
                          {{ diaFolder.expanded ? 'Cerrar día ▲' : 'Ver mensajes ▼' }}
                        </span>
                      </div>

                      <!-- Nivel 3: Conversación Histórica del Día -->
                      @if (diaFolder.expanded) {
                        <div class="mt-3 pl-4 space-y-2.5 animate-fade-in max-w-2xl">
                          @for (m of diaFolder.mensajes; track m.id_mensaje) {
                            <div
                              [class.justify-end]="m.remitente === 'SUPERVISOR'"
                              [class.justify-start]="m.remitente === 'FUNCIONARIO'"
                              class="flex"
                            >
                              <div
                                [class.bg-sigo-accent]="m.remitente === 'SUPERVISOR'"
                                [class.text-white]="m.remitente === 'SUPERVISOR'"
                                [class.bg-sigo-surface]="m.remitente === 'FUNCIONARIO'"
                                [class.text-sigo-text]="m.remitente === 'FUNCIONARIO'"
                                [class.border]="m.remitente === 'FUNCIONARIO'"
                                [class.border-sigo-border]="m.remitente === 'FUNCIONARIO'"
                                class="max-w-md rounded-2xl px-4 py-2 shadow-sm space-y-1"
                              >
                                <div class="flex items-center justify-between gap-3 text-[10px] opacity-80">
                                  <span class="font-bold uppercase tracking-wider">
                                    {{ m.remitente === 'SUPERVISOR' ? 'Supervisor Central' : userFolder.usuarioNombre }}
                                  </span>
                                  <span>{{ m.fecha | date:'HH:mm:ss' }}</span>
                                </div>
                                <div *ngIf="isAudio(m.texto)" class="space-y-1 py-1">
                                  <div class="flex items-center gap-1.5 text-[11px] font-bold opacity-90">
                                    <span>🎙️ Nota de voz</span>
                                  </div>
                                  <audio [src]="getAudioUrl(m.texto)" controls class="max-w-[240px] h-8 rounded-lg outline-none"></audio>
                                </div>
                                <p *ngIf="!isAudio(m.texto)" class="text-xs leading-relaxed whitespace-pre-wrap">{{ m.texto }}</p>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @empty {
            <div class="card py-16 text-center text-sigo-muted text-xs space-y-2">
              <app-icon name="mensajes" [size]="36" [stroke]="1.2"></app-icon>
              <p class="font-semibold text-sm text-sigo-text">No se encontraron mensajes en este período</p>
              <p>Prueba ampliando el filtro de tiempo a "Último año".</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class MessagesComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth     = inject(AuthService);

  readonly tabActivo       = signal<'ACTIVO' | 'HISTORIAL'>('ACTIVO');
  readonly filtroPeriodo   = signal<'7D' | '30D' | '90D' | '1Y'>('7D');
  readonly sesiones        = signal<SesionOperativa[]>([]);
  readonly selectedSesion  = signal<SesionOperativa | null>(null);
  readonly mensajes        = signal<Mensaje[]>([]);
  readonly mensajesHistory = signal<any[]>([]);

  nuevoTexto = '';
  busquedaHistorial = '';
  enviando = false;
  private pollTimer: any;
  private realtimeSub: any;

  async ngOnInit(): Promise<void> {
    await this.cargarSesiones();
    this.pollTimer = setInterval(() => this.refrescar(), 3500);

    this.realtimeSub = this.supabase.subscribeToMensajes(() => {
      if (this.selectedSesion()) {
        this.cargarMensajes(this.selectedSesion()!.id_sesion);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.realtimeSub?.unsubscribe) this.realtimeSub.unsubscribe();
  }

  async cargarSesiones(): Promise<void> {
    const data = await this.api.getSesionesActivas();
    this.sesiones.set(data);
    if (!this.selectedSesion() && data.length > 0) {
      this.seleccionarSesion(data[0]);
    }
  }

  async cargarHistorial(): Promise<void> {
    const list = await this.api.getHistorialMensajes(365);
    this.mensajesHistory.set(list);
  }

  async seleccionarSesion(s: SesionOperativa): Promise<void> {
    this.selectedSesion.set(s);
    await this.cargarMensajes(s.id_sesion);
  }

  trackByMsg(_index: number, m: any): any {
    return m.id_mensaje ?? _index;
  }

  async cargarMensajes(idSesion: number): Promise<void> {
    const list = await this.api.getMensajes(idSesion);
    const curr = this.mensajes();
    if (
      curr.length !== list.length ||
      (curr.length > 0 && list.length > 0 && curr[curr.length - 1]?.id_mensaje !== list[list.length - 1]?.id_mensaje)
    ) {
      this.mensajes.set(list);
    }
  }

  async refrescar(): Promise<void> {
    if (this.tabActivo() === 'ACTIVO' && this.selectedSesion()) {
      await this.cargarMensajes(this.selectedSesion()!.id_sesion);
    }
  }

  async enviar(): Promise<void> {
    const txt = this.nuevoTexto.trim();
    const ses = this.selectedSesion();
    if (!txt || !ses) return;

    this.enviando = true;
    try {
      const rutSupervisor = this.auth.currentUser()?.rut_usuario || '11111111-1';
      await this.api.enviarMensaje(ses.id_sesion, txt, rutSupervisor);
      this.nuevoTexto = '';
      await this.cargarMensajes(ses.id_sesion);
    } catch (e: any) {
      alert('Error enviando mensaje: ' + (e.message || 'Error de conexión'));
    } finally {
      this.enviando = false;
    }
  }

  carpetasHistorial = computed<MensajeUsuarioFolder[]>(() => {
    let list = this.mensajesHistory();

    // 1. Filtro de Tiempo
    const periodo = this.filtroPeriodo();
    const now = Date.now();
    let dias = 7;
    if (periodo === '30D') dias = 30;
    if (periodo === '90D') dias = 90;
    if (periodo === '1Y')  dias = 365;

    const cutoff = now - (dias * 86400000);
    list = list.filter(m => new Date(m.fecha).getTime() >= cutoff);

    // 2. Filtro de búsqueda
    const q = this.busquedaHistorial.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        (m.texto?.toLowerCase().includes(q)) ||
        (m.sesion?.identificador_unidad?.toLowerCase().includes(q)) ||
        (m.sesion?.conductor?.nombre_completo?.toLowerCase().includes(q))
      );
    }

    // 3. Agrupar por Usuario / Funcionario
    const mapUsuarios = new Map<string, { unidad: string; mensajes: any[] }>();

    for (const m of list) {
      const usuario = m.sesion?.conductor?.nombre_completo || (m.remitente === 'SUPERVISOR' ? 'Supervisor Central' : `Patrulla Móvil #${m.id_sesion}`);
      const unidad = m.sesion?.identificador_unidad || `Móvil #${m.id_sesion}`;

      if (!mapUsuarios.has(usuario)) {
        mapUsuarios.set(usuario, { unidad, mensajes: [] });
      }
      mapUsuarios.get(usuario)!.mensajes.push(m);
    }

    const folders: MensajeUsuarioFolder[] = [];

    mapUsuarios.forEach((data, usuario) => {
      // Agrupar por día
      const mapDias = new Map<string, { fechaDate: Date; list: any[] }>();

      for (const m of data.mensajes) {
        const d = new Date(m.fecha);
        const dayKey = d.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        if (!mapDias.has(dayKey)) {
          mapDias.set(dayKey, { fechaDate: d, list: [] });
        }
        mapDias.get(dayKey)!.list.push(m);
      }

      const diasFolders: MensajeDiaFolder[] = [];
      mapDias.forEach((val, dayKey) => {
        // Ordenar mensajes cronológicamente dentro del día
        val.list.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

        diasFolders.push({
          fechaStr: dayKey,
          fechaDate: val.fechaDate,
          mensajes: val.list,
          expanded: false,
        });
      });

      // Ordenar días descendente
      diasFolders.sort((a, b) => b.fechaDate.getTime() - a.fechaDate.getTime());

      folders.push({
        usuarioNombre: usuario,
        unidad: data.unidad,
        dias: diasFolders,
        totalMensajes: data.mensajes.length,
        expanded: false,
      });
    });

    return folders.sort((a, b) => b.totalMensajes - a.totalMensajes);
  });

  getTransportIcon(tipo?: string): string {
    switch (tipo) {
      case 'MOTO': return 'moto';
      case 'BICICLETA': return 'bici';
      case 'INFANTERIA': return 'peaton';
      default: return 'auto';
    }
  }

  isAudio(texto: string): boolean {
    return !!texto && texto.startsWith('[AUDIO]');
  }

  getAudioUrl(texto: string): string {
    return (texto || '').replace('[AUDIO]', '').trim();
  }
}
