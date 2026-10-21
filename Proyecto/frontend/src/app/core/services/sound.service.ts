import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private audioCtx: AudioContext | null = null;

  constructor() {
    // Los navegadores bloquean el audio hasta la primera interacción: se desbloquea con el primer clic/tecla.
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.getContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private sosInterval: any = null;
  public isSosLooping = false;

  /**
   * Inicia el bucle continuo de sirena SOS hasta que el operador haga clic en Recibido.
   */
  startSosAlarmLoop(): void {
    if (this.isSosLooping) return;
    this.isSosLooping = true;
    this.playSosAlarm();
    this.sosInterval = setInterval(() => {
      if (this.isSosLooping) {
        this.playSosAlarm();
      } else {
        this.stopSosAlarm();
      }
    }, 1400);
  }

  /**
   * Detiene el bucle de sirena SOS (silencia la alarma).
   */
  stopSosAlarm(): void {
    this.isSosLooping = false;
    if (this.sosInterval) {
      clearInterval(this.sosInterval);
      this.sosInterval = null;
    }
  }

  /**
   * Alarma táctica para alerta SOS / Refuerzos (sirena dual oscilante)
   */
  playSosAlarm(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Alternar tono de 880Hz y 660Hz cada 150ms durante 1.2 segundos
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.30);
      osc.frequency.setValueAtTime(660, now + 0.45);
      osc.frequency.setValueAtTime(880, now + 0.60);
      osc.frequency.setValueAtTime(660, now + 0.75);
      osc.frequency.setValueAtTime(880, now + 0.90);
      osc.frequency.setValueAtTime(660, now + 1.05);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.25);
    } catch (e) {
      console.warn('[SoundService] Error reproduciendo SOS:', e);
    }
  }

  /**
   * Tono suave táctico para nuevo mensaje entrante (campana de dos notas: 587Hz y 880Hz)
   */
  playMessageChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { freq: 587.33, start: 0, duration: 0.35, vol: 0.18 },
        { freq: 880.00, start: 0.12, duration: 0.45, vol: 0.22 },
      ].forEach(({ freq, start, duration, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(vol, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch (e) {
      console.warn('[SoundService] Error reproduciendo chime:', e);
    }
  }
}
