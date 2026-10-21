import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type IconName =
  | 'inicio'
  | 'evidencia'
  | 'mensajes'
  | 'zonas'
  | 'unidades'
  | 'reportes'
  | 'perfil'
  | 'escudo'
  | 'alerta'
  | 'campana'
  | 'mira'
  | 'camara'
  | 'imagen'
  | 'lupa'
  | 'reloj'
  | 'check'
  | 'enviar'
  | 'ojo'
  | 'ojoOculto'
  | 'flecha'
  | 'atras'
  | 'cerrar'
  | 'mas'
  | 'candado'
  | 'id'
  | 'lista'
  | 'auto'
  | 'moto'
  | 'bici'
  | 'peaton'
  | 'grupo'
  | 'salir'
  | 'chevron'
  | 'chart'
  | 'luna'
  | 'sol'
  | 'fuego'
  | 'capas'
  | 'mapa'
  | 'descarga'
  | 'basura'
  | 'editar'
  | 'ajustes'
  | 'info';

const ICON_PATHS: Record<string, string> = {
  inicio: `<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>`,
  evidencia: `<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>`,
  mensajes: `<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4 4v-4a3 3 0 0 1-2-3z"/>`,
  zonas: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>`,
  unidades: `<path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16M7 16v2M17 16v2"/><circle cx="8" cy="14" r=".5"/><circle cx="16" cy="14" r=".5"/>`,
  reportes: `<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>`,
  perfil: `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>`,
  escudo: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>`,
  alerta: `<path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4M12 17.4v.01"/>`,
  campana: `<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>`,
  mira: `<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,
  camara: `<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>`,
  imagen: `<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>`,
  lupa: `<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>`,
  reloj: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  check: `<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>`,
  enviar: `<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>`,
  ojo: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  ojoOculto: `<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`,
  flecha: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  atras: `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  cerrar: `<path d="M6 6l12 12M18 6L6 18"/>`,
  mas: `<path d="M12 5v14M5 12h14"/>`,
  candado: `<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  id: `<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.4-1.5 1.5-2 2.5-2s2.1.5 2.5 2M14 10h4M14 14h3"/>`,
  lista: `<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>`,
  auto: `<path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16M7 16v2M17 16v2"/><circle cx="8" cy="14" r=".5"/><circle cx="16" cy="14" r=".5"/>`,
  moto: `<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l4-7h4l4 7M10 9L8 6H6M14 9h3"/>`,
  bici: `<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h6l2 8M10 8L12 16M9 6h3"/>`,
  peaton: `<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6-2-3 1.5-4 3.5 2 2.5 2M11.5 15l4 6M11 8.5L8 11"/>`,
  grupo: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.8-5.5 6-5.5s6 1.9 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.2 3 5.2"/>`,
  salir: `<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/>`,
  chevron: `<path d="M9 6l6 6-6 6"/>`,
  chart: `<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>`,
  luna: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  sol: `<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`,
  fuego: `<path d="M12 2c1 3.5 4 6 4 9a6 6 0 1 1-12 0c0-3 3-5.5 4-9 1 3 3 4 4 0z"/>`,
  capas: `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>`,
  mapa: `<path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3V6zM8 3v15M16 6v15"/>`,
  descarga: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>`,
  basura: `<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>`,
  editar: `<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
  ajustes: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>`,
};

export function getIconSvg(name: string, color = 'currentColor', size = 20, stroke = 1.5): string {
  const inner = ICON_PATHS[name] || ICON_PATHS['info'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      [attr.stroke]="color() || 'currentColor'"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="inline-block transition-transform duration-150"
      [innerHTML]="trustedSvg()"
    ></svg>
  `,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }`]
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input<IconName | string>('info');
  readonly size = input<number>(20);
  readonly color = input<string>('');
  readonly stroke = input<number>(1.5);

  readonly trustedSvg = computed<SafeHtml>(() => {
    const raw = ICON_PATHS[this.name()] || ICON_PATHS['info'];
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });
}
