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
    if (this.client?.connected) return;

    const session = this.authService.session();
    if (!session) {
      console.warn('[MQTT] No hay sesión activa para autenticar.');
      return;
    }

    // Verificar que la URL del broker no sea un placeholder
    const brokerUrl = environment.mqttBrokerUrl;
    if (!brokerUrl || brokerUrl.includes('localhost') && !this.isLocalBrokerAvailable()) {
      console.warn('[MQTT] Broker no configurado — telemetría en tiempo real desactivada.');
      return;
    }

    this.connectionStatus.set('connecting');

    try {
      this.client = mqtt.connect(brokerUrl, {
        username:        session.user?.email ?? session.user?.id ?? 'supervisor',
        password:        session.access_token,    // JWT de Supabase Auth
        clientId:        `sigo_dashboard_${Date.now()}`,
        keepalive:       30,
        reconnectPeriod: 5000,
        connectTimeout:  10000,
        clean:           true,
      });

      this.client.on('connect', () => {
        console.log('[MQTT] Conectado al broker');
        this.connectionStatus.set('connected');
        // Re-suscribir a todos los IMEIs registrados
        this.gpsHandlers.forEach((_, imei) => {
          if (imei !== '*') {
            this.client?.subscribe(`${environment.mqttTopicPrefix}/telemetria/${imei}`, { qos: 1 });
          }
        });
        if (this.gpsHandlers.has('*')) {
          this.client?.subscribe(`${environment.mqttTopicPrefix}/telemetria/+`, { qos: 1 });
        }
        this.client?.subscribe(`${environment.mqttTopicPrefix}/alertas/sos`, { qos: 2 });
      });

      this.client.on('error', (err) => {
        console.error('[MQTT] Error de conexión:', err.message);
        this.connectionStatus.set('error');
      });

      this.client.on('close', () => {
        this.connectionStatus.set('disconnected');
      });

      this.client.on('message', (topic: string, message: any) => {
        try {
          const payload = JSON.parse(message.toString());
          if (topic.startsWith(`${environment.mqttTopicPrefix}/telemetria/`)) {
            const imei = topic.split('/').pop()!;
            this.gpsHandlers.get(imei)?.(payload as GpsPayload);
            this.gpsHandlers.get('*')?.(payload as GpsPayload);
          } else if (topic === `${environment.mqttTopicPrefix}/alertas/sos`) {
            this.sosHandler?.(payload);
          }
        } catch (e) {
          console.warn('[MQTT] Error parseando mensaje:', e);
        }
      });
    } catch (err) {
      console.error('[MQTT] No se pudo conectar:', err);
      this.connectionStatus.set('error');
    }
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
