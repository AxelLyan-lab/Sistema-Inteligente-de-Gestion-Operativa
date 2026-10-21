import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'sigo_dashboard_theme';
  readonly isDark = signal<boolean>(false);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved !== null) {
      this.isDark.set(saved === 'dark');
    } else {
      // Default a modo claro institucional
      this.isDark.set(false);
    }

    effect(() => {
      const dark = this.isDark();
      if (dark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(this.STORAGE_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(this.STORAGE_KEY, 'light');
      }
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  setDark(dark: boolean): void {
    this.isDark.set(dark);
  }
}
