import {
  Component, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector:          'app-login',
  standalone:        true,
  imports:           [CommonModule, ReactiveFormsModule],
  changeDetection:   ChangeDetectionStrategy.OnPush,
  template: `
  <div class="min-h-screen bg-sigo-bg flex items-center justify-center px-4 relative overflow-hidden">

    <!-- Fondo animado con gradiente radial -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                  bg-sigo-accent/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-0 w-80 h-80
                  bg-en-ruta/5 rounded-full blur-3xl"></div>
    </div>

    <!-- Tarjeta de login -->
    <div class="relative w-full max-w-md">

      <!-- Logo y título -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                    bg-sigo-accent/10 border border-sigo-accent/30 mb-4">
          <svg class="w-8 h-8 text-sigo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955
                 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-sigo-text tracking-tight">S.I.G.O.</h1>
        <p class="text-sigo-muted text-sm mt-1">Sistema Inteligente de Gestión Operativa</p>
        <div class="mt-2 inline-block px-3 py-1 bg-sigo-accent/10 border border-sigo-accent/20
                    rounded-full text-sigo-accent text-xs font-medium">
          Consola de Mando — Supervisor
        </div>
      </div>

      <!-- Formulario -->
      <div class="card shadow-card">
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-5">

          <!-- RUT -->
          <div>
            <label for="rut" class="block text-sm font-medium text-sigo-muted mb-2">
              RUT del funcionario
            </label>
            <input
              id="rut"
              type="text"
              formControlName="rut"
              class="input-field font-mono"
              placeholder="12.345.678-9"
              autocomplete="username"
              (input)="formatRut($event)"
              [class.border-emergencia]="rutControl.invalid && rutControl.touched"
            >
            @if (rutControl.invalid && rutControl.touched) {
              <p class="text-emergencia text-xs mt-1 flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"/>
                </svg>
                Ingrese un RUT válido (ej: 12.345.678-9)
              </p>
            }
          </div>

          <!-- Contraseña -->
          <div>
            <label for="password" class="block text-sm font-medium text-sigo-muted mb-2">
              Contraseña
            </label>
            <div class="relative">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                class="input-field pr-12"
                placeholder="••••••••"
                autocomplete="current-password"
                [class.border-emergencia]="passControl.invalid && passControl.touched"
              >
              <button
                type="button"
                (click)="showPassword.set(!showPassword())"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-sigo-muted hover:text-sigo-accent transition-colors"
                aria-label="Mostrar contraseña"
              >
                @if (showPassword()) {
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
                         a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878
                         9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3
                         3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7
                         a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                } @else {
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542
                         7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                }
              </button>
            </div>
          </div>

          <!-- Error de autenticación -->
          @if (authService.authError()) {
            <div class="flex items-center gap-3 p-3 bg-emergencia/10 border border-emergencia/30
                        rounded-lg text-emergencia text-sm animate-fade-in">
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732
                     4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              {{ authService.authError() }}
            </div>
          }

          <!-- Botón de ingreso -->
          <button
            id="btn-login"
            type="submit"
            [disabled]="loginForm.invalid || authService.isLoading()"
            class="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (authService.isLoading()) {
              <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Autenticando...
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              Ingresar al sistema
            }
          </button>

        </form>
      </div>

      <!-- Footer -->
      <p class="text-center text-sigo-muted text-xs mt-6">
        S.I.G.O. v1.0 · Acceso restringido a personal autorizado
      </p>
    </div>
  </div>
  `,
})
export class LoginComponent {
  readonly authService = inject(AuthService);
  readonly showPassword = signal(false);

  private readonly fb = inject(FormBuilder);

  readonly loginForm = this.fb.group({
    rut:      ['', [Validators.required, Validators.minLength(9)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get rutControl():  AbstractControl { return this.loginForm.get('rut')!; }
  get passControl(): AbstractControl { return this.loginForm.get('password')!; }

  formatRut(event: Event): void {
    const input  = event.target as HTMLInputElement;
    let value    = input.value.replace(/[^0-9kK]/g, '');
    if (value.length > 1) {
      const body = value.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const dv   = value.slice(-1).toUpperCase();
      value      = `${body}-${dv}`;
    }
    this.loginForm.patchValue({ rut: value }, { emitEvent: false });
    input.value = value;
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    const { rut, password } = this.loginForm.value;
    // Limpiar formato RUT para enviar solo dígitos + dv
    const rutLimpio = (rut ?? '').replace(/\./g, '');
    await this.authService.login(rutLimpio, password ?? '');
  }
}
