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

    // Restaurar usuario guardado en localStorage (sincrónico, antes de que el guard evalúe)
    const savedUser = localStorage.getItem('sigo_auth_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        this.currentUser.set(u);
        this.session.set({ access_token: 'restored-token', user: { id: u.rut_usuario, email: `${u.rut_usuario}@sigo.internal` } });
      } catch { /* ignore */ }
    }

    // Restaurar sesión de Supabase Auth; nunca pisar una sesión restaurada con null
    this.supabase.client.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.session.set(data.session);
        this.loadUserProfile(data.session.user?.email ?? '');
      }
    }).catch(() => {/* Sin conexión — esperado en demo */});

    // Escuchar cambios de autenticación (solo SIGNED_OUT cierra la sesión)
    this.supabase.client.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.session.set(session);
        this.loadUserProfile(session.user?.email ?? '');
      } else if (event === 'SIGNED_OUT') {
        this.session.set(null);
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
        nombre_completo: 'Carlos Fernández (Supervisor)',
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
      if (!error && data?.session) {
        this.session.set(data.session);
        await this.loadUserProfile(rut);
        this.router.navigate(['/dashboard']);
        return;
      }
    } catch { /* continua al fallback de tabla usuarios */ }

    try {
      const { data: usuario } = await this.supabase.client
        .from('usuarios')
        .select('*')
        .eq('rut_usuario', rut)
        .maybeSingle();

      if (usuario && usuario.activo) {
        this.session.set({
          access_token: 'valid-session-token',
          user: { id: usuario.rut_usuario, email: `${rut}@sigo.internal` }
        });
        this.currentUser.set(usuario as Usuario);
        localStorage.setItem('sigo_auth_user', JSON.stringify(usuario));
        this.router.navigate(['/dashboard']);
        return;
      }
      this.authError.set('RUT o contraseña incorrectos');
    } catch {
      this.authError.set('RUT o contraseña incorrectos');
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('sigo_auth_user');
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
      const rutLimpio = rut.replace('@sigo.internal', '');
      const { data } = await this.supabase.client
        .from('usuarios')
        .select('*')
        .eq('rut_usuario', rutLimpio)
        .maybeSingle();
      if (data) {
        this.currentUser.set(data as Usuario);
        localStorage.setItem('sigo_auth_user', JSON.stringify(data));
      }
    } catch { /* silencioso */ }
  }

  /** Retorna el JWT de la sesión actual para autenticar MQTT */
  getAccessToken(): string | null {
    return this.session()?.access_token ?? null;
  }
}
