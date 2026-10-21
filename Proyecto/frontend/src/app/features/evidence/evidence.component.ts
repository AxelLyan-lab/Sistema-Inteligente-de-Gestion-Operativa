import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { RegistroEvidencia, SesionOperativa, TipoEvidencia } from '../../core/models';

interface EvidenciaDiaFolder {
  fechaStr: string;
  fechaDate: Date;
  evidencias: RegistroEvidencia[];
  expanded: boolean;
}

interface EvidenciaUsuarioFolder {
  usuarioNombre: string;
  unidad: string;
  dias: EvidenciaDiaFolder[];
  totalEvidencias: number;
  expanded: boolean;
}

@Component({
  selector: 'app-evidence',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-sigo-bg text-sigo-text select-none">
      <app-navbar></app-navbar>

      <main class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header con Acciones -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                <app-icon name="evidencia" [size]="18" [stroke]="1.8"></app-icon>
              </div>
              <div>
                <h1 class="text-lg font-bold text-sigo-text">Registro y Archivo de Evidencias</h1>
                <p class="text-xs text-sigo-muted">Organizado por funcionario y día, material fotográfico, video y respaldo operativo</p>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sigo-surface2 border border-sigo-border text-xs text-sigo-muted shadow-sm">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-medium text-[11px]">Carga exclusiva desde App Móvil en terreno</span>
            </div>
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

        <!-- Barra de Filtros: Período de Tiempo y Clasificación -->
        <div class="card p-4 space-y-3">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <!-- Filtro de Tiempo (7 días, 1 mes, 3 meses, 1 año) -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-sigo-muted mr-1">Período:</span>
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
              <button
                (click)="filtroPeriodo.set('ALL')"
                [class.bg-sigo-accent]="filtroPeriodo() === 'ALL'"
                [class.text-white]="filtroPeriodo() === 'ALL'"
                [class.bg-sigo-surface2]="filtroPeriodo() !== 'ALL'"
                class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sigo-border transition-all"
              >
                Todo el historial
              </button>
            </div>
          </div>

          <!-- Filtro de Tipo y Búsqueda -->
          <div class="pt-2 border-t border-sigo-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                (click)="filtroTipo.set('TODOS')"
                [class.text-sigo-accent]="filtroTipo() === 'TODOS'"
                [class.font-bold]="filtroTipo() === 'TODOS'"
                class="hover:underline px-1.5"
              >
                Todas ({{ evidenciasFiltradas().length }})
              </button>
              <span class="text-sigo-muted">•</span>
              <button
                (click)="filtroTipo.set('EVIDENCIA_IMPORTANTE')"
                [class.text-emergencia]="filtroTipo() === 'EVIDENCIA_IMPORTANTE'"
                [class.font-bold]="filtroTipo() === 'EVIDENCIA_IMPORTANTE'"
                class="hover:underline px-1.5"
              >
                Importantes
              </button>
              <span class="text-sigo-muted">•</span>
              <button
                (click)="filtroTipo.set('EVIDENCIA_BASICA')"
                [class.text-sigo-accent]="filtroTipo() === 'EVIDENCIA_BASICA'"
                [class.font-bold]="filtroTipo() === 'EVIDENCIA_BASICA'"
                class="hover:underline px-1.5"
              >
                Básicas
              </button>
              <span class="text-sigo-muted">•</span>
              <button
                (click)="filtroTipo.set('JUSTIFICACION_ATRASO')"
                [class.text-patrullando]="filtroTipo() === 'JUSTIFICACION_ATRASO'"
                [class.font-bold]="filtroTipo() === 'JUSTIFICACION_ATRASO'"
                class="hover:underline px-1.5"
              >
                Justificaciones
              </button>
            </div>

            <div class="w-full sm:w-64">
              <input
                type="text"
                [(ngModel)]="busqueda"
                placeholder="Buscar por funcionario, móvil o relato..."
                class="input-field text-xs py-1.5"
              />
            </div>
          </div>
        </div>

        <!-- VISTA: ORGANIZADA POR FUNCIONARIO -> POR DÍA -> EVIDENCIAS -->
        <div class="space-y-4">
          @for (userFolder of carpetasUsuarios(); track userFolder.usuarioNombre) {
            <div class="card overflow-hidden border border-sigo-border hover:border-sigo-accent/50 transition-all">
              <!-- Nivel 1: Funcionario -->
              <div
                (click)="userFolder.expanded = !userFolder.expanded"
                class="p-3.5 bg-sigo-surface2/60 cursor-pointer flex items-center justify-between hover:bg-sigo-surface2 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <span class="text-lg">📁</span>
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="font-bold text-sm text-sigo-text">{{ userFolder.usuarioNombre }}</h2>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-sigo-accent/15 text-sigo-accent font-semibold border border-sigo-accent/30">
                        {{ userFolder.unidad }}
                      </span>
                    </div>
                    <p class="text-[11px] text-sigo-muted">
                      {{ userFolder.dias.length }} {{ userFolder.dias.length === 1 ? 'día con registros' : 'días con registros' }} · {{ userFolder.totalEvidencias }} evidencias en total
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs text-sigo-muted">{{ userFolder.expanded ? 'Ocultar ▲' : 'Ver por días ▼' }}</span>
                </div>
              </div>

              <!-- Nivel 2: Días Registrados -->
              @if (userFolder.expanded) {
                <div class="p-3 bg-sigo-bg/50 divide-y divide-sigo-border/40 space-y-3">
                  @for (diaFolder of userFolder.dias; track diaFolder.fechaStr) {
                    <div class="pt-2">
                      <!-- Cabecera de Día -->
                      <div
                        (click)="diaFolder.expanded = !diaFolder.expanded"
                        class="p-2.5 rounded-lg bg-sigo-surface border border-sigo-border cursor-pointer flex items-center justify-between hover:border-sigo-accent transition-all"
                      >
                        <div class="flex items-center gap-2.5">
                          <span class="text-base">📅</span>
                          <div>
                            <span class="font-bold text-xs text-sigo-text capitalize">{{ diaFolder.fechaStr }}</span>
                            <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sigo-surface2 text-sigo-muted font-bold">
                              {{ diaFolder.evidencias.length }} {{ diaFolder.evidencias.length === 1 ? 'archivo' : 'archivos' }}
                            </span>
                          </div>
                        </div>
                        <span class="text-[11px] text-sigo-accent font-medium">
                          {{ diaFolder.expanded ? 'Cerrar día ▲' : 'Abrir evidencias ▼' }}
                        </span>
                      </div>

                      <!-- Nivel 3: Visualización de Evidencias del Día -->
                      @if (diaFolder.expanded) {
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3 pl-4 animate-fade-in">
                          @for (ev of diaFolder.evidencias; track ev.id_evidencia) {
                            <div class="card overflow-hidden flex flex-col justify-between border border-sigo-border group hover:border-sigo-accent transition-all bg-sigo-surface">
                              <div>
                                <!-- Fotografía o Video -->
                                <div class="h-44 bg-sigo-surface2 rounded-lg overflow-hidden relative border border-sigo-border mb-2.5 flex items-center justify-center">
                                  @if (esVideo(ev.url_fotografia)) {
                                    <video
                                      [src]="ev.url_fotografia"
                                      controls
                                      preload="metadata"
                                      class="w-full h-full object-cover bg-black"
                                    ></video>
                                  } @else if (ev.url_fotografia) {
                                    <img
                                      [src]="ev.url_fotografia"
                                      alt="Evidencia fotográfica"
                                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                                      (click)="verFoto(ev.url_fotografia)"
                                    />
                                  } @else {
                                    <div class="w-full h-full flex flex-col items-center justify-center text-sigo-muted text-xs gap-1">
                                      <app-icon name="camara" [size]="24" [stroke]="1.2"></app-icon>
                                      <span>Sin archivo adjunto</span>
                                    </div>
                                  }

                                  <!-- Badges -->
                                  <div class="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
                                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/75 text-white backdrop-blur-xs">
                                      {{ ev.origen === 'DASHBOARD' ? 'Web' : 'Móvil' }}
                                    </span>
                                    <span
                                      *ngIf="esVideo(ev.url_fotografia)"
                                      class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-600 text-white backdrop-blur-xs"
                                    >
                                      🎥 Video
                                    </span>
                                    <span
                                      [class.bg-emergencia]="ev.tipo_evidencia === 'EVIDENCIA_IMPORTANTE'"
                                      [class.bg-patrullando]="ev.tipo_evidencia === 'JUSTIFICACION_ATRASO'"
                                      [class.bg-sigo-accent]="ev.tipo_evidencia === 'EVIDENCIA_BASICA'"
                                      class="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white backdrop-blur-xs"
                                    >
                                      {{ getTipoLabel(ev.tipo_evidencia) }}
                                    </span>
                                  </div>
                                </div>

                                <!-- Contenido y Relato -->
                                <div class="space-y-1">
                                  <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-sigo-text">{{ ev.identificador_unidad || 'Unidad #' + ev.id_sesion }}</span>
                                    <span class="text-[10px] text-sigo-muted">{{ ev.fecha_subida | date:'HH:mm:ss' }}</span>
                                  </div>
                                  <p class="text-xs text-sigo-text font-normal leading-relaxed whitespace-pre-wrap">
                                    {{ ev.descripcion_texto || 'Sin descripción adicional.' }}
                                  </p>
                                </div>
                              </div>

                              <div class="pt-2 mt-2 border-t border-sigo-border flex items-center justify-between text-[10px] text-sigo-muted">
                                <span>Hora: {{ ev.fecha_subida | date:'shortTime' }}</span>
                                <button
                                  (click)="eliminar(ev.id_evidencia)"
                                  class="text-sigo-muted hover:text-emergencia p-1 rounded"
                                  title="Eliminar evidencia"
                                >
                                  <app-icon name="basura" [size]="12"></app-icon>
                                </button>
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
              <app-icon name="evidencia" [size]="36" [stroke]="1.2"></app-icon>
              <p class="font-semibold text-sm text-sigo-text">No se encontraron evidencias en este período</p>
              <p>Prueba seleccionando "Último año" o "Todo el historial" en los filtros superiores.</p>
            </div>
          }
        </div>
      </main>

      <!-- Modal de Carga de Nueva Evidencia -->
      <div *ngIf="showModalNueva" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div class="bg-sigo-surface border border-sigo-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-sigo-border flex items-center justify-between bg-sigo-surface2/50">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sigo-accent/15 text-sigo-accent flex items-center justify-center border border-sigo-accent/30">
                <app-icon name="camara" [size]="18" [stroke]="1.8"></app-icon>
              </div>
              <h3 class="font-bold text-sm text-sigo-text">Cargar Evidencia (Fotografía o Video)</h3>
            </div>
            <button (click)="showModalNueva = false" class="text-sigo-muted hover:text-sigo-text">
              <app-icon name="cerrar" [size]="18"></app-icon>
            </button>
          </div>

          <form (ngSubmit)="guardarNueva()" class="p-5 space-y-4 text-xs">
            <!-- Patrulla -->
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Patrulla o Móvil Asociado</label>
              <select [(ngModel)]="nuevaEvidencia.id_sesion" name="id_sesion" class="input-field" required>
                <option *ngFor="let s of sesiones" [ngValue]="s.id_sesion">
                  {{ s.identificador_unidad }} ({{ s.conductor?.nombre_completo || 'Conductor' }})
                </option>
              </select>
            </div>

            <!-- Tipo de Evidencia -->
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Clasificación de Evidencia</label>
              <select [(ngModel)]="nuevaEvidencia.tipo_evidencia" name="tipo_evidencia" class="input-field" required>
                <option value="EVIDENCIA_BASICA">Evidencia Básica (Control rutinario)</option>
                <option value="EVIDENCIA_IMPORTANTE">Evidencia Importante (Procedimiento crítico / Hallazgo)</option>
                <option value="JUSTIFICACION_ATRASO">Justificación de Atraso o Desvío</option>
              </select>
            </div>

            <!-- Archivo Fotográfico o Video -->
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Fotografía o Video de Respaldo</label>
              <input
                type="file"
                accept="image/*,video/*"
                (change)="onFileSelected($event)"
                class="block w-full text-xs text-sigo-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sigo-accent/15 file:text-sigo-accent hover:file:bg-sigo-accent/25 cursor-pointer"
              />
              <div *ngIf="previewUrl" class="mt-2.5">
                <video
                  *ngIf="selectedFileIsVideo"
                  [src]="previewUrl"
                  controls
                  class="max-h-40 w-full rounded-lg bg-black border border-sigo-border"
                ></video>
                <img
                  *ngIf="!selectedFileIsVideo"
                  [src]="previewUrl"
                  alt="Vista previa"
                  class="max-h-40 w-full object-cover rounded-lg border border-sigo-border"
                />
                <p class="text-[10px] text-sigo-accent font-medium mt-1">
                  {{ selectedFileIsVideo ? '🎥 Video listo para subir (comprimido para optimizar datos y memoria).' : '📷 Fotografía lista para subir.' }}
                </p>
              </div>
            </div>

            <!-- Descripción -->
            <div>
              <label class="block text-sigo-muted font-medium mb-1">Descripción / Relato de Hechos</label>
              <textarea
                [(ngModel)]="nuevaEvidencia.descripcion_texto"
                name="descripcion"
                rows="3"
                placeholder="Detalle de la evidencia o justificación operativa..."
                class="input-field"
                required
              ></textarea>
            </div>

            <div class="pt-3 border-t border-sigo-border flex items-center justify-end gap-2.5">
              <button type="button" (click)="showModalNueva = false" class="btn-ghost text-xs">Cancelar</button>
              <button type="submit" [disabled]="subiendo || !nuevaEvidencia.id_sesion" class="btn-primary text-xs">
                {{ subiendo ? 'Subiendo evidencia...' : 'Guardar y Registrar' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Ver Foto Grande -->
      <div *ngIf="fotoGrande" (click)="fotoGrande = null" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer animate-fade-in">
        <img [src]="fotoGrande" alt="Evidencia ampliada" class="max-w-4xl max-h-[90vh] rounded-xl object-contain shadow-2xl" />
      </div>
    </div>
  `
})
export class EvidenceComponent implements OnInit {
  private readonly api      = inject(ApiService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth     = inject(AuthService);

  readonly evidencias     = signal<RegistroEvidencia[]>([]);
  readonly cargando       = signal<boolean>(false);
  readonly filtroTipo     = signal<string>('TODOS');
  readonly filtroPeriodo  = signal<'7D' | '30D' | '90D' | '1Y' | 'ALL'>('7D');

  busqueda = '';
  sesiones: SesionOperativa[] = [];
  showModalNueva = false;
  subiendo = false;
  selectedFile: File | null = null;
  selectedFileIsVideo = false;
  previewUrl: string | null = null;
  fotoGrande: string | null = null;

  nuevaEvidencia: {
    id_sesion: number | null;
    tipo_evidencia: TipoEvidencia;
    descripcion_texto: string;
    lat: number | null;
    lng: number | null;
  } = {
    id_sesion: null,
    tipo_evidencia: TipoEvidencia.EVIDENCIA_BASICA,
    descripcion_texto: '',
    lat: -33.01840,
    lng: -71.51398,
  };

  async ngOnInit(): Promise<void> {
    await this.cargar();
    this.sesiones = await this.api.getSesionesActivas();
    if (this.sesiones.length > 0) {
      this.nuevaEvidencia.id_sesion = this.sesiones[0].id_sesion;
    }
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.api.getEvidencias();
      this.evidencias.set(data);
    } finally {
      this.cargando.set(false);
    }
  }

  evidenciasFiltradas = computed(() => {
    let list = this.evidencias();

    // 1. Filtro de Tiempo
    const periodo = this.filtroPeriodo();
    const now = Date.now();
    let dias = 0;
    if (periodo === '7D')  dias = 7;
    if (periodo === '30D') dias = 30;
    if (periodo === '90D') dias = 90;
    if (periodo === '1Y')  dias = 365;

    if (dias > 0) {
      const cutoff = now - (dias * 86400000);
      list = list.filter(e => new Date(e.fecha_subida).getTime() >= cutoff);
    }

    // 2. Filtro de Tipo
    const fTipo = this.filtroTipo();
    if (fTipo !== 'TODOS') {
      list = list.filter(e => e.tipo_evidencia === fTipo);
    }

    // 3. Filtro de Búsqueda de texto
    const q = this.busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter(e =>
        (e.subido_por?.toLowerCase().includes(q)) ||
        (e.conductor?.toLowerCase().includes(q)) ||
        (e.identificador_unidad?.toLowerCase().includes(q)) ||
        (e.descripcion_texto?.toLowerCase().includes(q))
      );
    }

    return list;
  });

  carpetasUsuarios = computed<EvidenciaUsuarioFolder[]>(() => {
    const list = this.evidenciasFiltradas();
    const mapUsuarios = new Map<string, { unidad: string; evidencias: RegistroEvidencia[] }>();

    for (const ev of list) {
      const usuario = ev.subido_por || ev.conductor || 'Funcionario en Terreno';
      const unidad = ev.identificador_unidad || `Móvil #${ev.id_sesion}`;

      if (!mapUsuarios.has(usuario)) {
        mapUsuarios.set(usuario, { unidad, evidencias: [] });
      }
      mapUsuarios.get(usuario)!.evidencias.push(ev);
    }

    const carpetas: EvidenciaUsuarioFolder[] = [];

    mapUsuarios.forEach((data, usuario) => {
      // Agrupar por día
      const mapDias = new Map<string, { fechaDate: Date; list: RegistroEvidencia[] }>();

      for (const ev of data.evidencias) {
        const d = new Date(ev.fecha_subida);
        const dayKey = d.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        if (!mapDias.has(dayKey)) {
          mapDias.set(dayKey, { fechaDate: d, list: [] });
        }
        mapDias.get(dayKey)!.list.push(ev);
      }

      const diasFolders: EvidenciaDiaFolder[] = [];
      mapDias.forEach((val, dayKey) => {
        diasFolders.push({
          fechaStr: dayKey,
          fechaDate: val.fechaDate,
          evidencias: val.list,
          expanded: false, // Cerrado por defecto: se abre al hacer clic
        });
      });

      // Ordenar días cronológicamente descendente
      diasFolders.sort((a, b) => b.fechaDate.getTime() - a.fechaDate.getTime());

      carpetas.push({
        usuarioNombre: usuario,
        unidad: data.unidad,
        dias: diasFolders,
        totalEvidencias: data.evidencias.length,
        expanded: false,
      });
    });

    return carpetas.sort((a, b) => b.totalEvidencias - a.totalEvidencias);
  });

  abrirModalNueva(): void {
    this.showModalNueva = true;
    this.selectedFile = null;
    this.previewUrl = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileIsVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov');
      this.previewUrl = URL.createObjectURL(file);
    }
  }

  esVideo(url: string | null): boolean {
    if (!url) return false;
    const clean = url.toLowerCase().split('?')[0];
    return (
      clean.endsWith('.mp4') ||
      clean.endsWith('.mov') ||
      clean.endsWith('.webm') ||
      clean.endsWith('.m4v') ||
      clean.includes('/video') ||
      clean.startsWith('data:video')
    );
  }

  verFoto(url: string | null): void {
    if (url) this.fotoGrande = url;
  }

  async guardarNueva(): Promise<void> {
    if (!this.nuevaEvidencia.id_sesion) return;
    this.subiendo = true;
    try {
      let fotoUrl: string | null = null;
      if (this.selectedFile) {
        fotoUrl = await this.supabase.uploadEvidenciaFoto(this.selectedFile);
      }

      await this.api.crearEvidencia({
        id_sesion:         this.nuevaEvidencia.id_sesion,
        tipo_evidencia:    this.nuevaEvidencia.tipo_evidencia,
        descripcion_texto: this.nuevaEvidencia.descripcion_texto,
        url_fotografia:    fotoUrl,
        subido_por:        this.auth.currentUser()?.nombre_completo || 'Supervisor Web',
        lat:               this.nuevaEvidencia.lat,
        lng:               this.nuevaEvidencia.lng,
      });

      this.showModalNueva = false;
      this.nuevaEvidencia.descripcion_texto = '';
      await this.cargar();
    } catch (e: any) {
      alert('Error guardando evidencia: ' + (e.message || 'Error de almacenamiento'));
    } finally {
      this.subiendo = false;
    }
  }

  async eliminar(idEvidencia: number): Promise<void> {
    if (!confirm('¿Confirma la eliminación de este registro de evidencia?')) return;
    try {
      await this.api.eliminarEvidencia(idEvidencia);
      await this.cargar();
    } catch (e: any) {
      alert('Error eliminando: ' + e.message);
    }
  }

  getTipoLabel(tipo: TipoEvidencia): string {
    switch (tipo) {
      case TipoEvidencia.EVIDENCIA_IMPORTANTE: return 'Importante';
      case TipoEvidencia.JUSTIFICACION_ATRASO: return 'Justificación';
      default: return 'Básica';
    }
  }
}
