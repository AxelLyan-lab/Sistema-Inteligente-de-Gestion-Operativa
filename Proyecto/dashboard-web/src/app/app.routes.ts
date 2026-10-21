import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'unidades',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/units/units.component').then(m => m.UnitsComponent),
  },
  {
    path: 'mensajes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/messages/messages.component').then(m => m.MessagesComponent),
  },
  {
    path: 'evidencias',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/evidence/evidence.component').then(m => m.EvidenceComponent),
  },
  {
    path: 'zonas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/zones/zones.component').then(m => m.ZonesComponent),
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/users.component').then(m => m.UsersComponent),
  },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'ajustes',
    redirectTo: 'configuracion',
  },
  {
    path: 'reportes',
    redirectTo: 'evidencias',
  },
  { path: '**', redirectTo: 'dashboard' },
];
