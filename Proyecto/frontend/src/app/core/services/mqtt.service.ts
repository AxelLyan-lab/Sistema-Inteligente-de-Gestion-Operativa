import { Injectable, signal, inject } from '@angular/core';
import * as mqtt from 'mqtt';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { GpsPayload } from '../models';

export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({ providedIn: 'root' })
export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private readonly authService = inject(AuthService);

  /** Signal del estado de la conexión al broker */
  readonly connectionStatus = signal<MqttConnectionStatus>('disconnected');

  /** Map de callbacks: imei → handler GPS */
  private gpsHandlers = new Map<string, (payload: GpsPayload) => void>();

  /** Callback global para alertas SOS */
  private sosHandler: ((raw: any) => void) | null = null;

  connect(): void {
    console.warn('[MQTT] MQTT connection is disabled. Using Supabase Realtime for telemetry instead.');
    this.connectionStatus.set('disconnected');
    // try {
    //   this.client = mqtt.connect(brokerUrl, { ... });
    // } catch (e) {}
  }

  /** Suscribirse a telemetría GPS de un IMEI específico */
  subscribeToUnit(imei: string, handler: (payload: GpsPayload) => void): void {
    this.gpsHandlers.set(imei, handler);
    if (this.client?.connected) {
      this.client.subscribe(`${environment.mqttTopicPrefix}/telemetria/${imei}`, { qos: 1 });
    }
  }

  /** Suscribirse a TODA la telemetría (wildcard) */
  subscribeToAllUnits(handler: (payload: GpsPayload) => void): void {
    this.gpsHandlers.set('*', handler);
    if (this.client?.connected) {
      this.client.subscribe(`${environment.mqttTopicPrefix}/telemetria/+`, { qos: 1 });
    }
  }

  /** Suscribirse a alertas SOS */
  subscribeToSOS(handler: (payload: any) => void): void {
    this.sosHandler = handler;
  }

  /** Publicar un override manual al topic de comandos */
  publishOverride(imei: string, lat: number, lng: number): void {
    if (!this.client?.connected) return;
    const payload = JSON.stringify({ imei, lat, lng, origen: 'MANUAL_SUPERVISOR', ts: Date.now() });
    this.client.publish(`${environment.mqttTopicPrefix}/cmd/${imei}`, payload, { qos: 1 });
  }

  disconnect(): void {
    this.client?.end(true);
    this.client = null;
    this.connectionStatus.set('disconnected');
  }

  private isLocalBrokerAvailable(): boolean {
    // En desarrollo, intentamos conectar siempre; el error se maneja en el handler 'error'
    return true;
  }
}
