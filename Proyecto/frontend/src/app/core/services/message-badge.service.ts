import { Injectable, signal, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { SoundService } from './sound.service';
@Injectable({ providedIn: 'root' })
export class MessageBadgeService {
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly sound = inject(SoundService);

  readonly hasUnread = signal(false);

  constructor() {
    // Escuchar mensajes entrantes desde las patrullas en tiempo real
    this.supabase.subscribeToMensajes((event) => {
      const row = event?.new;
      if (row && row.remitente === 'FUNCIONARIO' && event.eventType === 'INSERT') {
        this.sound.playMessageChime();
        if (!this.router.url.includes('/mensajes')) {
          this.hasUnread.set(true);
        }
      }
    });

    // Al ingresar a /mensajes, limpiar el punto rojo
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd && evt.urlAfterRedirects.includes('/mensajes')) {
        this.clearUnread();
      }
    });
  }

  markUnread(): void {
    this.hasUnread.set(true);
  }

  clearUnread(): void {
    this.hasUnread.set(false);
  }
}
