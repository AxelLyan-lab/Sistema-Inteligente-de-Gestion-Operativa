import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageBadgeService } from '../../../core/services/message-badge.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <header class="bg-[#1B3B2B] dark:bg-[#0E1813] text-white border-b border-[#142C20] dark:border-[#243B2E] px-4 py-2.5 flex items-center justify-between select-none shadow-md transition-colors duration-200">
      <!-- Izquierda: Marca SIGO / Carabineros de Chile -->
      <div class="flex items-center gap-6">
        <a routerLink="/dashboard" class="flex items-center gap-2.5 group">
          <img src="assets/logo-carabineros.webp" alt="Carabineros de Chile"
               class="w-10 h-10 object-contain group-hover:scale-105 transition-all drop-shadow" />
          <div>
            <div class="flex items-center gap-2">
              <span class="font-black text-base tracking-wider text-white">S.I.G.O.</span>
              <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-white/90 border border-white/25">
                Carabineros de Chile
              </span>
            </div>
            <p class="text-[10px] text-white/70 tracking-wide -mt-0.5 font-medium">Consola de Mando y Control Táctico</p>
          </div>
        </a>

        <!-- Enlaces principales -->
        <nav class="hidden md:flex items-center gap-1.5">
          <a
            routerLink="/dashboard"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="mapa" [size]="15"></app-icon>
            <span>Mapa Táctico</span>
          </a>

          <a
            routerLink="/unidades"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="unidades" [size]="15"></app-icon>
            <span>Unidades</span>
          </a>

          <a
            routerLink="/mensajes"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            (click)="messageBadge.clearUnread()"
            class="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <div class="relative flex items-center justify-center">
              <app-icon name="mensajes" [size]="15"></app-icon>
              @if (messageBadge.hasUnread()) {
                <span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse border border-white"></span>
              }
            </div>
            <span>Mensajes</span>
          </a>

          <a
            routerLink="/evidencias"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="evidencia" [size]="15"></app-icon>
            <span>Evidencias</span>
          </a>

          <a
            routerLink="/zonas"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="zonas" [size]="15"></app-icon>
            <span>Zonas</span>
          </a>

          <a
            routerLink="/usuarios"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="grupo" [size]="15"></app-icon>
            <span>Usuarios</span>
          </a>

          <a
            routerLink="/configuracion"
            routerLinkActive="bg-white/20 text-white font-semibold shadow-inner border-white/30"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 border border-transparent transition-all"
          >
            <app-icon name="ajustes" [size]="15"></app-icon>
            <span>Ajustes</span>
          </a>
        </nav>
      </div>

      <!-- Derecha: Tema, Usuario y Logout -->
      <div class="flex items-center gap-3">
        <!-- Toggle Claro / Oscuro -->
        <button
          type="button"
          (click)="theme.toggle()"
          [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo táctico nocturno'"
          class="w-8 h-8 rounded-lg border border-white/20 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all"
        >
          <app-icon [name]="theme.isDark() ? 'sol' : 'luna'" [size]="16"></app-icon>
        </button>

        <!-- Usuario Supervisor -->
        <div class="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-xs text-white shadow-sm">
          <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span class="font-semibold">{{ auth.currentUser()?.nombre_completo || 'Carlos Fernández (Supervisor)' }}</span>
          <span class="text-[10px] text-white/60 font-mono">| CAPITÁN</span>
        </div>

        <!-- Salir -->
        <button
          type="button"
          (click)="auth.logout()"
          title="Cerrar sesión"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-red-600/80 border border-white/20 hover:border-red-500 transition-all"
        >
          <app-icon name="salir" [size]="14"></app-icon>
          <span class="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  `
})
export class NavbarComponent {
  readonly theme        = inject(ThemeService);
  readonly auth         = inject(AuthService);
  readonly messageBadge = inject(MessageBadgeService);
}
