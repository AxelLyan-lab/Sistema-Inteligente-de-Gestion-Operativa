import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { Usuario, Rol } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router   = inject(Router);

  // ─── State signals ─────────────────────────────────────────────────────
  readonly session     = signal<any>(null);
  readonly currentUser = signal<Usuario | null>(null);
  readonly isLoading   = signal<boolean>(false);
  readonly authError   = signal<string | null>(null);

  readonly isAuthenticated = computed(() => !!this.session());
  readonly isSupervisor    = computed(() =>
    this.currentUser()?.rol === Rol.SUPERVISOR_WEB
  );

  constructor() {
    if (!this.supabase.isConfigured) return;

    // Restaurar sesión desde localStorage al iniciar
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      if (data.session?.user) {
        this.loadUserProfile(data.session.user.email ?? '');
      }
    }).catch(() => {/* Sin conexión — esperado en demo */});

    // Escuchar cambios de autenticación
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (session?.user) {
        this.loadUserProfile(session.user.email ?? '');
      } else {
        this.currentUser.set(null);
      }
    });
  }

  async login(rut: string, password: string): Promise<void> {
    this.isLoading.set(true);
    this.authError.set(null);

    if (!this.supabase.isConfigured) {
      // Modo demo sin Supabase: login simulado para visualizar la UI
      this.session.set({ access_token: 'demo-token', user: { id: 'demo', email: `${rut}@sigo.internal` } });
      this.currentUser.set({
        rut_usuario: rut,
        nombre_completo: 'Supervisor Demo',
        rol: Rol.SUPERVISOR_WEB,
      });
      this.isLoading.set(false);
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email:    `${rut}@sigo.internal`,
        password: password,
      });
      if (error) throw error;
      this.session.set(data.session);
      await this.loadUserProfile(rut);
      this.router.navigate(['/dashboard']);
    } catch {
      this.authError.set('RUT o contraseña incorrectos');
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    if (this.supabase.isConfigured) {
      await this.supabase.client.auth.signOut().catch(() => {});
    }
    this.session.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private async loadUserProfile(rut: string): Promise<void> {
    if (!this.supabase.isConfigured) return;
    try {
      const { data } = await this.supabase.client
        .from('usuarios')
        .select('*')
        .eq('rut_usuario', rut)
        .single();
      if (data) this.currentUser.set(data as Usuario);
    } catch { /* silencioso */ }
  }

  /** Retorna el JWT de la sesión actual para autenticar MQTT */
  getAccessToken(): string | null {
    return this.session()?.access_token ?? null;
  }
}
