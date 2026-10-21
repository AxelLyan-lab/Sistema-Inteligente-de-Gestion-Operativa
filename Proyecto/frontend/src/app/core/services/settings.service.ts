import { Injectable, signal, effect } from '@angular/core';

export interface MobileProfile {
  rut_usuario: string;
  nombre_completo: string;
  grado_cargo?: string;
  rol: string;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // 1. Rotación de Zonas:
  // true: bucle automático cada 2 minutos (120 seg)
  // false: selección manual de zonas activas
  readonly bucleZonasActivo = signal<boolean>(
    localStorage.getItem('sigo_bucle_zonas') !== 'false'
  );

  // Intervalo de rotación contrarreloj (en segundos, por defecto 120s / 2 min)
  readonly intervaloRotacionSeg = signal<number>(
    (() => {
      const saved = Number(localStorage.getItem('sigo_intervalo_rotacion'));
      return saved >= 10 && saved <= 1800 ? saved : 120;
    })()
  );

  // Cantidad de zonas activas simultáneamente en la rotación (1 a 5, por defecto 3)
  readonly cantidadZonasRotacion = signal<number>(
    (() => {
      const saved = Number(localStorage.getItem('sigo_cantidad_zonas_rotacion'));
      return saved >= 1 && saved <= 5 ? saved : 3;
    })()
  );

  // Zonas activas seleccionadas manualmente cuando el bucle está apagado
  readonly zonasManuales = signal<number[]>(
    (() => {
      try {
        const saved = localStorage.getItem('sigo_zonas_manuales');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    })()
  );

  // 2. SOS y Despacho de Refuerzos:
  // Cantidad de recursos a pedir (1 a 5, por defecto 2)
  readonly recursosSos = signal<number>(
    (() => {
      const saved = Number(localStorage.getItem('sigo_recursos_sos'));
      return saved >= 1 && saved <= 5 ? saved : 2;
    })()
  );

  // 3. Tiempo Límite de Traslado / Llegada al Destino (ETA):
  // Minutos que puede tardar un funcionario en llegar (15, 20, 30 o manual)
  readonly tiempoLlegadaMin = signal<number>(
    (() => {
      const saved = Number(localStorage.getItem('sigo_tiempo_llegada_min'));
      return saved >= 1 && saved <= 120 ? saved : 15;
    })()
  );

  readonly modoTiempoLlegada = signal<'PRESET' | 'MANUAL'>(
    (() => {
      const saved = localStorage.getItem('sigo_modo_tiempo_llegada');
      return (saved === 'MANUAL' || saved === 'PRESET') ? saved : 'PRESET';
    })()
  );

  constructor() {
    effect(() => {
      localStorage.setItem('sigo_bucle_zonas', String(this.bucleZonasActivo()));
    });
    effect(() => {
      localStorage.setItem('sigo_intervalo_rotacion', String(this.intervaloRotacionSeg()));
    });
    effect(() => {
      localStorage.setItem('sigo_cantidad_zonas_rotacion', String(this.cantidadZonasRotacion()));
    });
    effect(() => {
      localStorage.setItem('sigo_zonas_manuales', JSON.stringify(this.zonasManuales()));
    });
    effect(() => {
      localStorage.setItem('sigo_recursos_sos', String(this.recursosSos()));
    });
    effect(() => {
      localStorage.setItem('sigo_tiempo_llegada_min', String(this.tiempoLlegadaMin()));
    });
    effect(() => {
      localStorage.setItem('sigo_modo_tiempo_llegada', this.modoTiempoLlegada());
    });
  }

  setBucleZonas(activo: boolean): void {
    this.bucleZonasActivo.set(activo);
    if (!activo) {
      // Al pasar a Modo Manual, deshabilitar zonas activas por defecto
      this.zonasManuales.set([]);
      try {
        localStorage.setItem('sigo_zonas_manuales', '[]');
      } catch {}
    }
  }

  setIntervaloRotacionSeg(segundos: number): void {
    const clamped = Math.max(10, Math.min(1800, Math.round(segundos)));
    this.intervaloRotacionSeg.set(clamped);
  }

  setCantidadZonasRotacion(cantidad: number): void {
    const clamped = Math.max(1, Math.min(5, Math.round(cantidad)));
    this.cantidadZonasRotacion.set(clamped);
  }

  toggleZonaManual(idZona: number): void {
    const actuales = this.zonasManuales();
    if (actuales.includes(idZona)) {
      this.zonasManuales.set(actuales.filter(id => id !== idZona));
    } else {
      this.zonasManuales.set([...actuales, idZona]);
    }
  }

  setRecursosSos(cantidad: number): void {
    const clamped = Math.max(1, Math.min(5, cantidad));
    this.recursosSos.set(clamped);
  }

  setTiempoLlegadaPreset(minutos: number): void {
    this.modoTiempoLlegada.set('PRESET');
    this.tiempoLlegadaMin.set(minutos);
  }

  setTiempoLlegadaManual(minutos: number): void {
    const clamped = Math.max(1, Math.min(120, Math.round(minutos || 1)));
    this.modoTiempoLlegada.set('MANUAL');
    this.tiempoLlegadaMin.set(clamped);
  }
}
