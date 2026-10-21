import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  StatusBar,
  Platform,
  Image,
  Modal,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon, { IconName } from '../components/Icon';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import PatrolCrewList from '../components/PatrolCrewList';
import EmergencyConfirmModal from '../components/EmergencyConfirmModal';
import NotificationBanner from '../components/NotificationBanner';
import GnssStatusPanel, { EstadoBarra } from '../components/GnssStatusPanel';
import {
  captureGnssReading,
  sendGnssTelemetry,
  GnssReading,
} from '../services/gnss.service';
import { requestReinforcements, getMessages, MensajeChat } from '../services/patrol.service';
import { getCrew, getActiveAssignment, markAssignmentArrived, AsignacionMision } from '../services/patrol.service';
import { playSosSound, playMessageSound } from '../services/sound.service';
import { useNavigation } from '@react-navigation/native';
import { useMessageBadge, messageBadgeStore } from '../services/messageBadge.service';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { TripulacionMiembro, Notificacion, Coordenadas } from '../types';

const { height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.40;

// Geocerca predeterminada de patrullaje (Viña del Mar)
const DEFAULT_COORDS: Coordenadas = { latitude: -33.0153, longitude: -71.5500 };
const GEOFENCE_RADIUS = 600; // metros

// Intervalo de transmisión de telemetría (ms)
const TELEMETRY_INTERVAL_MS = 5000;

// Estilo de mapa oscuro (Google Maps) para el modo oscuro
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1b1e1c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a938e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1b1e1c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2f2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1512' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

/**
 * HomeScreen — HU14: Transmisión de Telemetría GPS
 * Dashboard operativo principal con mapa, panel GNSS en tiempo real
 * y transmisión continua de telemetría al servidor.
 */
export default function HomeScreen() {
  const { funcionario, sesion } = useAuth();
  const navigation = useNavigation<any>();
  const { hasUnread: hasUnreadMessage } = useMessageBadge();
  const { Colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const mapRef = useRef<MapView>(null);
  const telemetryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Estado GPS / GNSS ─────────────────────────────────────────────────────
  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [gnssReading, setGnssReading] = useState<GnssReading | null>(null);
  const [geofenceCenter, setGeofenceCenter] = useState<Coordenadas | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [txOk, setTxOk] = useState<boolean | null>(null);

  // ── Estado operativo ──────────────────────────────────────────────────────
  const [crew, setCrew] = useState<TripulacionMiembro[]>([]);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosConfirmed, setSosConfirmed] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [notification, setNotification] = useState<Notificacion | null>(null);
  const [notifBadgeCount, setNotifBadgeCount] = useState(0);
  const [mission, setMission] = useState<AsignacionMision | null>(null);
  const missionRef = useRef<AsignacionMision | null>(null);
  const missionIdRef = useRef<string | null>(null);
  const coordsRef = useRef<Coordenadas | null>(null);
  useEffect(() => { coordsRef.current = coords; }, [coords]);
  useEffect(() => { missionRef.current = mission; }, [mission]);

  const [notificationsList, setNotificationsList] = useState<Notificacion[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const wasInsideZoneRef = useRef<boolean>(false);
  const [dispatchCountdown, setDispatchCountdown] = useState<number | null>(null);
  const dispatchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localEstado, setLocalEstado] = useState<string>('DISPONIBLE');
  const localEstadoRef = useRef<string>('DISPONIBLE');
  useEffect(() => { localEstadoRef.current = localEstado; }, [localEstado]);
  const [zoneInside, setZoneInside] = useState<boolean | null>(null);

  const estadoBarra: EstadoBarra =
    dispatchCountdown !== null || localEstado === 'EN_CAMINO'
      ? 'EN_CAMINO'
      : localEstado === 'EN_ZONA'
      ? (zoneInside === false ? 'FUERA_ZONA' : 'EN_ZONA')
      : 'DISPONIBLE';

  const handleClearNotifications = () => {
    setNotificationsList([]);
    setNotification(null);
    setNotifBadgeCount(0);
  };

  // ── Misión asignada por el supervisor (polling 3 s) ───────────────────────
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const m: any = await getActiveAssignment();
        if (!alive) return;
        setMission(m ?? null);

        if (!m) {
          setLocalEstado('DISPONIBLE');
          setDispatchCountdown(null);
          setZoneInside(null);
          wasInsideZoneRef.current = false;
          return;
        }

        // Si es una asignación nueva o actualizada
        if (m && String(m.id_asignacion) !== missionIdRef.current) {
          missionIdRef.current = String(m.id_asignacion);
          wasInsideZoneRef.current = false;

          const newNotif: Notificacion = {
            id: 'mision_' + m.id_asignacion,
            tipo: 'INFO',
            mensaje: `Misión asignada: ${m.nombre_zona ?? 'Sector asignado'}. Desplazamiento táctico iniciado.`,
            leida: false,
            timestamp: new Date(),
          };
          setNotification(newNotif);
          setNotificationsList((prev) => [newNotif, ...prev]);
          setNotifBadgeCount((c) => c + 1);

          if (m.centro_lat != null && m.centro_lng != null) {
            mapRef.current?.animateToRegion(
              { latitude: m.centro_lat, longitude: m.centro_lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
              800
            );
          }

          // Verificar distancia actual a la zona (tolerancia de 20m para compensar imprecisión GNSS móvil)
          const currentDist = coordsRef.current && m.centro_lat != null && m.centro_lng != null
            ? getDistance(coordsRef.current, { latitude: m.centro_lat, longitude: m.centro_lng })
            : 999999;
          const allowedRadius = Math.max(Number(m.radio_m) || 50, 50) + 20;
          const isPhysicallyInside = currentDist <= allowedRadius;

          // Si ya está físicamente en la zona o ya tenía ingreso previo registrado
          if (m.hora_ingreso_zona || m.estado_mision === 'PATRULLANDO' || isPhysicallyInside) {
            setLocalEstado('EN_ZONA');
            setDispatchCountdown(null);
            if (dispatchTimerRef.current) {
              clearInterval(dispatchTimerRef.current);
              dispatchTimerRef.current = null;
            }
            if (isPhysicallyInside && !m.hora_ingreso_zona) {
              markAssignmentArrived(m.id_asignacion).catch(() => {});
            }
          } else {
            // Está fuera de la zona: estado EN_CAMINO con cronómetro de cuenta regresiva
            setLocalEstado('EN_CAMINO');
            const limitMin = m.tiempo_limite_minutos || 15;
            const startMs = parseUtcIso(m.hora_despacho);
            const targetMs = startMs + limitMin * 60 * 1000;

            const updateCountdown = () => {
              const rem = Math.round((targetMs - Date.now()) / 1000);
              setDispatchCountdown(rem);
            };

            updateCountdown();
            if (dispatchTimerRef.current) clearInterval(dispatchTimerRef.current);
            dispatchTimerRef.current = setInterval(updateCountdown, 1000);
          }
        } else {
          // Asignación en curso: verificar si el servidor confirmó llegada o si la patrulla ya está físicamente en la zona
          const currentDist = coordsRef.current && m.centro_lat != null && m.centro_lng != null
            ? getDistance(coordsRef.current, { latitude: m.centro_lat, longitude: m.centro_lng })
            : 999999;
          const allowedRadius = Math.max(Number(m.radio_m) || 50, 50) + 20;
          const isPhysicallyInside = currentDist <= allowedRadius;

          if (m.hora_ingreso_zona || m.estado_mision === 'PATRULLANDO' || isPhysicallyInside) {
            if (localEstadoRef.current !== 'EN_ZONA') {
              console.log(`[TICK AUTOGEOFENCE] Patrulla detectada en zona ${m.nombre_zona} (dist: ${Math.round(currentDist)}m <= ${allowedRadius}m)`);
              setLocalEstado('EN_ZONA');
              setDispatchCountdown(null);
              if (dispatchTimerRef.current) {
                clearInterval(dispatchTimerRef.current);
                dispatchTimerRef.current = null;
              }
              if (isPhysicallyInside && !m.hora_ingreso_zona) {
                markAssignmentArrived(m.id_asignacion).catch(() => {});
              }
              const arrivedNotif: Notificacion = {
                id: 'arrived_' + m.id_asignacion + '_' + Date.now(),
                tipo: 'INFO',
                mensaje: `🎯 ¡Has arribado a ${m.nombre_zona ?? 'la zona'}! Estado actualizado automáticamente: En zona de patrullaje.`,
                leida: false,
                timestamp: new Date(),
              };
              setNotification(arrivedNotif);
              setNotificationsList((prev) => [arrivedNotif, ...prev]);
              setNotifBadgeCount((c) => c + 1);
            }
          }
        }
      } catch { /* sin conexión */ }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(t);
      if (dispatchTimerRef.current) clearInterval(dispatchTimerRef.current);
    };
  }, []);

  // ── Transmitir telemetría y actualizar estado GNSS ────────────────────────
  const transmitTelemetry = useCallback(async () => {
    try {
      const reading = await captureGnssReading(Location.Accuracy.High);
      setGnssReading(reading);
      const newCoords: Coordenadas = { latitude: reading.latitude, longitude: reading.longitude };
      setCoords(newCoords);
      setIsLocating(false);

      // Verificación de geocerca inmediata en cada ping de telemetría (cada 5s)
      const curMission = missionRef.current;
      if (curMission && curMission.centro_lat != null && curMission.centro_lng != null) {
        const allowedRadius = Math.max(Number(curMission.radio_m) || 50, 50) + 20;
        const dist = getDistance(newCoords, { latitude: curMission.centro_lat, longitude: curMission.centro_lng });
        if (dist <= allowedRadius) {
          if (localEstadoRef.current !== 'EN_ZONA') {
            console.log(`[TELEMETRY AUTOGEOFENCE] Llegada detectada en TX a ${curMission.nombre_zona}. Dist: ${Math.round(dist)}m <= ${allowedRadius}m`);
            setLocalEstado('EN_ZONA');
            setDispatchCountdown(null);
            if (dispatchTimerRef.current) {
              clearInterval(dispatchTimerRef.current);
              dispatchTimerRef.current = null;
            }
            markAssignmentArrived(curMission.id_asignacion).catch(() => {});
            const arrivedNotif: Notificacion = {
              id: 'arrived_' + curMission.id_asignacion + '_' + Date.now(),
              tipo: 'INFO',
              mensaje: `🎯 ¡Has arribado a ${curMission.nombre_zona ?? 'la zona'}! Estado actualizado automáticamente: En zona de patrullaje.`,
              leida: false,
              timestamp: new Date(),
            };
            setNotification(arrivedNotif);
            setNotificationsList((prev) => [arrivedNotif, ...prev]);
            setNotifBadgeCount((c) => c + 1);
          }
          wasInsideZoneRef.current = true;
        }
      }

      const result = await sendGnssTelemetry(reading);
      setTxOk(result.ok === true);
    } catch {
      setTxOk(false);
    }
  }, []);

  // ── Listener de AppState (Reactivación inmediata al desbloquear pantalla) ─
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[HomeScreen] Teléfono desbloqueado / App en primer plano -> Transmitiendo telemetría');
        transmitTelemetry();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [transmitTelemetry]);

  // ── Mensajes entrantes del supervisor (notificación flotante + sonido chime) ──
  const lastMsgIdRef = useRef<number | null>(null);
  useEffect(() => {
    let alive = true;
    const checkMessages = async () => {
      try {
        const msgs = await getMessages();
        if (!alive || !msgs || !msgs.length) return;
        const last = msgs[msgs.length - 1];
        if (lastMsgIdRef.current === null) {
          lastMsgIdRef.current = last.id_mensaje;
          return;
        }
        if (last.id_mensaje > lastMsgIdRef.current) {
          lastMsgIdRef.current = last.id_mensaje;
          if (last.remitente === 'SUPERVISOR') {
            playMessageSound();
            const txt = last.texto.startsWith('[AUDIO]')
              ? 'Nota de voz recibida de la Central'
              : last.texto;
            const msgNotif: Notificacion = {
              id: 'msg_' + last.id_mensaje,
              tipo: 'INFO',
              mensaje: `Supervisor: ${txt}`,
              leida: false,
              timestamp: new Date(),
            };
            setNotification(msgNotif);
            setNotificationsList(prev => [msgNotif, ...prev]);
            setNotifBadgeCount(c => c + 1);
            messageBadgeStore.setUnread(true);
          }
        }
      } catch {
        // sin conexión
      }
    };

    checkMessages();
    const timer = setInterval(checkMessages, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // ── Inicializar GPS, watch de posición y loop de telemetría ───────────────
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setIsLocating(false);
            setNotification({
              id: 'loc_error',
              tipo: 'INFO',
              mensaje: 'Activa los permisos de ubicación para posicionar tu patrulla en el mapa.',
              leida: false,
              timestamp: new Date(),
            });
          }
          return;
        }

        // 1. Última posición conocida (respuesta inmediata)
        const lastKnown = await Location.getLastKnownPositionAsync({}).catch(() => null);
        if (lastKnown && isMounted) {
          const initial: Coordenadas = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          setCoords(initial);
          setGeofenceCenter(initial);
          setIsLocating(false);
          mapRef.current?.animateToRegion(
            { ...initial, latitudeDelta: 0.007, longitudeDelta: 0.007 },
            800
          );
        }

        // 2. Primer fix GNSS de alta precisión + primer TX
        await transmitTelemetry();

        if (!isMounted) return;

        // Centrar mapa
        if (gnssReading) {
          const c = { latitude: gnssReading.latitude, longitude: gnssReading.longitude };
          setGeofenceCenter(c);
          mapRef.current?.animateToRegion(
            { ...c, latitudeDelta: 0.007, longitudeDelta: 0.007 },
            1000
          );
        }

        // 3. Watch de posición para actualizar marcador en tiempo real
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!isMounted) return;
            const newCoords: Coordenadas = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setCoords(newCoords);
            setIsLocating(false);

            // Geofence check en tiempo real si hay misión activa
            if (missionRef.current && missionRef.current.centro_lat != null && missionRef.current.centro_lng != null) {
              const missionCenter = {
                latitude: missionRef.current.centro_lat,
                longitude: missionRef.current.centro_lng,
              };
              const allowedRadius = Math.max(Number(missionRef.current.radio_m) || 50, 50) + 20;
              const dist = getDistance(newCoords, missionCenter);
              setZoneInside(dist <= allowedRadius);

              if (dist <= allowedRadius) {
                // Si la unidad entra físicamente a la zona
                if (localEstadoRef.current !== 'EN_ZONA') {
                  console.log(`[AUTOGEOFENCE] Unidad ingresó a zona ${missionRef.current.nombre_zona}. Distancia: ${Math.round(dist)}m <= ${allowedRadius}m. Transicionando a En Zona.`);
                  setLocalEstado('EN_ZONA');
                  setDispatchCountdown(null);
                  if (dispatchTimerRef.current) {
                    clearInterval(dispatchTimerRef.current);
                    dispatchTimerRef.current = null;
                  }
                  markAssignmentArrived(missionRef.current.id_asignacion).catch(() => {});
                  const arrivedNotif: Notificacion = {
                    id: 'arrived_' + missionRef.current.id_asignacion,
                    tipo: 'INFO',
                    mensaje: `🎯 ¡Has arribado a ${missionRef.current.nombre_zona ?? 'la zona'}! Estado actualizado automáticamente: En zona de patrullaje.`,
                    leida: false,
                    timestamp: new Date(),
                  };
                  setNotification(arrivedNotif);
                  setNotificationsList((prev) => [arrivedNotif, ...prev]);
                  setNotifBadgeCount((c) => c + 1);
                }
                wasInsideZoneRef.current = true;
              } else if (dist > (allowedRadius + 20) && wasInsideZoneRef.current) {
                // Salió de la zona estando dentro (se reinicia para advertir nuevamente si vuelve a salir)
                wasInsideZoneRef.current = false;
                const outNotif: Notificacion = {
                  id: 'out_zone_' + Date.now(),
                  tipo: 'FUERA_ZONA',
                  mensaje: 'Has salido de la zona, vuelve al perímetro asignado.',
                  leida: false,
                  timestamp: new Date(),
                };
                setNotification(outNotif);
                setNotificationsList((prev) => [outNotif, ...prev]);
                setNotifBadgeCount((c) => c + 1);
              }
            }
          }
        );

        // 4. Loop de telemetría con metadatos GNSS completos (#48)
        telemetryTimer.current = setInterval(() => {
          if (isMounted) transmitTelemetry();
        }, TELEMETRY_INTERVAL_MS);

      } catch (err) {
        console.warn('[GPS INIT ERROR]:', err);
        if (isMounted) setIsLocating(false);
      }
    })();

    return () => {
      isMounted = false;
      subscription?.remove();
      if (telemetryTimer.current) clearInterval(telemetryTimer.current);
    };
  }, []);

  // ── Cargar dotación de turno ──────────────────────────────────────────────
  const loadCrew = useCallback(async () => {
    try {
      const data = await getCrew();
      setCrew(data);
    } catch (err) {
      console.warn('[LOAD CREW ERROR]:', err);
    }
  }, []);

  useEffect(() => { loadCrew(); }, [loadCrew]);

  // ── Recentrar mapa ────────────────────────────────────────────────────────
  const handleRecenter = () => {
    const target = coords ?? geofenceCenter ?? DEFAULT_COORDS;
    mapRef.current?.animateToRegion(
      { ...target, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      700
    );
  };

  // ── SOS / Refuerzos ───────────────────────────────────────────────────────
  const handleSosConfirm = async () => {
    if (!coords) {
      Alert.alert('Sin GPS', 'Esperando señal GPS para emitir las coordenadas de emergencia.');
      return;
    }
    setSosLoading(true);
    try {
      await requestReinforcements(coords);
      playSosSound();
      setSosConfirmed(true);
      const sosNotif: Notificacion = {
        id: 'sos_sent',
        tipo: 'REFUERZOS_ASIGNADOS',
        mensaje: 'Alerta SOS transmitida. Refuerzos en ruta hacia tus coordenadas.',
        leida: false,
        timestamp: new Date(),
      };
      setNotification(sosNotif);
      setNotificationsList(prev => [sosNotif, ...prev]);
      setNotifBadgeCount(c => c + 1);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'No se pudo enviar la alerta.');
    } finally {
      setSosLoading(false);
    }
  };

  // ── Región inicial del mapa ───────────────────────────────────────────────
  const activeCenter = geofenceCenter ?? coords ?? DEFAULT_COORDS;
  const initialRegion = {
    latitude: activeCenter.latitude,
    longitude: activeCenter.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };

  const getTransportIcon = (tipo?: string): IconName => {
    switch (tipo) {
      case 'MOTO':       return 'moto';
      case 'BICICLETA':  return 'bici';
      case 'INFANTERIA': return 'peaton';
      default:           return 'auto';
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

      {/* ── Banner táctica ────────────────────────────────────────── */}
      <NotificationBanner
        notification={notification}
        onDismiss={() => setNotification(null)}
      />

      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View>
          <View style={styles.unitRow}>
            {(!sesion?.tipo_transporte || sesion.tipo_transporte === 'PATRULLA') ? (
              <Image
                source={require('../../assets/icono de patrulla.png')}
                style={{ width: 22, height: 44, resizeMode: 'contain' }}
              />
            ) : (
              <Icon name={getTransportIcon(sesion?.tipo_transporte)} size={22} color={Colors.primary} />
            )}
            <Text style={styles.unitLabel}>{sesion?.identificador_unidad ?? 'PATRULLA'}</Text>
          </View>
          <Text style={styles.statusLabel}>
            {dispatchCountdown !== null && localEstado === 'EN_CAMINO'
              ? (dispatchCountdown >= 0
                  ? `En camino (${formatCountdown(dispatchCountdown)})`
                  : `En camino (Demora ${formatCountdown(dispatchCountdown)})`)
              : localEstado === 'EN_ZONA'
              ? 'En zona'
              : localEstado === 'EN_CAMINO'
              ? 'En camino'
              : getEstadoLabel(sesion?.estado_operativo ?? 'DISPONIBLE')}
          </Text>
        </View>

        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.bellBtn}
            activeOpacity={0.7}
            onPress={() => setShowNotifModal(true)}
          >
            <Icon name="campana" size={22} color={Colors.textPrimary} />
            {notifBadgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifBadgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Mapa + Panel GNSS ─────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          mapType="standard"
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          loadingEnabled={true}
          loadingIndicatorColor={Colors.primary}
          loadingBackgroundColor={Colors.mapBackground}
        >
          {mission && mission.centro_lat != null && mission.centro_lng != null && (
            <>
              {/* Halo exterior de calor delictual y cobertura táctica */}
              <Circle
                center={{ latitude: mission.centro_lat, longitude: mission.centro_lng }}
                radius={mission.radio_m || 50}
                strokeColor="rgba(220, 38, 38, 0.60)"
                fillColor="rgba(220, 38, 38, 0.18)"
                strokeWidth={1.5}
              />
              {/* Núcleo focal del punto de riesgo / calle crítica */}
              <Circle
                center={{ latitude: mission.centro_lat, longitude: mission.centro_lng }}
                radius={Math.min(20, (mission.radio_m || 50) / 2)}
                strokeColor="#DC2626"
                fillColor="rgba(220, 38, 38, 0.45)"
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: mission.centro_lat, longitude: mission.centro_lng }}
                title={`🔥 Punto de Calor: ${mission.nombre_zona ?? 'Zona Asignada'}`}
                description={mission.instrucciones ?? 'Focalización táctica por riesgo delictual'}
                pinColor="#DC2626"
              />
            </>
          )}
          {/* Marcador táctico del funcionario */}
          {coords && (
            <Marker
              coordinate={coords}
              title={funcionario?.nombre_completo ?? 'Mi Ubicación'}
              description={`Móvil: ${sesion?.identificador_unidad ?? ''}`}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={3}
            >
              <>
                {(!sesion?.tipo_transporte || sesion.tipo_transporte === 'PATRULLA') ? (
                  <Image
                    source={require('../../assets/icono de patrulla.png')}
                    style={{ width: 54, height: 108, resizeMode: 'contain' }}
                  />
                ) : (
                  <View style={styles.tacticalMarkerContainer}>
                    <View style={styles.markerPulse} />
                    <View style={styles.markerCore}>
                      <Icon name={getTransportIcon(sesion?.tipo_transporte)} size={16} color={Colors.onPrimary} />
                    </View>
                  </View>
                )}
              </>
            </Marker>
          )}
        </MapView>

        {/* Botón recentrar (top-right) */}
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Icon name="mira" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Panel GNSS — posicionado sobre el mapa (bottom) */}
        <GnssStatusPanel estado={estadoBarra} />
      </View>

      {/* ── Tarjeta inferior ──────────────────────────────────────── */}
      <ScrollView
        style={styles.card}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Perfil del funcionario */}
        <View style={styles.profileSection}>
          <Text style={styles.officerName}>
            {funcionario?.nombre_completo ?? 'Funcionario'}
          </Text>
          <Text style={styles.officerSub}>
            {funcionario?.grado_cargo ?? 'Oficial en Terreno'} — {sesion?.identificador_unidad ?? 'Móvil'}
          </Text>
        </View>

        {/* Botón SOS */}
        <TouchableOpacity
          style={[styles.sosBtn, sosConfirmed && styles.sosBtnConfirmed]}
          onPress={() => setShowSosModal(true)}
          activeOpacity={0.85}
        >
          <Icon name="alerta" size={18} color={Colors.danger} />
          <Text style={styles.sosBtnText}>
            {sosConfirmed ? 'Refuerzos Solicitados' : 'Pedir Refuerzos'}
          </Text>
        </TouchableOpacity>

        {/* Dotación de turno */}
        <PatrolCrewList
          crew={crew}
          conductorRut={funcionario?.rut ?? ''}
          conductorNombre={funcionario?.nombre_completo ?? ''}
          tipoTransporte={sesion?.tipo_transporte ?? 'PATRULLA'}
          onCrewChange={loadCrew}
        />
      </ScrollView>

      {/* Modal SOS */}
      <EmergencyConfirmModal
        visible={showSosModal}
        onConfirm={handleSosConfirm}
        onCancel={() => {
          setShowSosModal(false);
          if (sosConfirmed) setSosConfirmed(false);
        }}
        loading={sosLoading}
        confirmed={sosConfirmed}
      />

      {/* Modal Centro de Notificaciones */}
      <Modal
        visible={showNotifModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notifModalCard}>
            <View style={styles.notifModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="campana" size={20} color={Colors.primary} />
                <Text style={styles.notifModalTitle}>Notificaciones ({notificationsList.length})</Text>
              </View>
              {notificationsList.length > 0 && (
                <TouchableOpacity
                  style={styles.cleanBtn}
                  onPress={handleClearNotifications}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cleanBtnText}>Limpiar</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {notificationsList.length === 0 ? (
                <View style={styles.emptyNotif}>
                  <Text style={styles.emptyNotifText}>No hay notificaciones pendientes</Text>
                </View>
              ) : (
                notificationsList.map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <View style={styles.notifItemIcon}>
                      <Icon
                        name={n.tipo === 'FUERA_ZONA' ? 'alerta' : 'campana'}
                        size={16}
                        color={n.tipo === 'FUERA_ZONA' ? Colors.danger : Colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifItemMsg}>{n.mensaje}</Text>
                      <Text style={styles.notifItemTime}>
                        {new Date(n.timestamp).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeNotifBtn}
              onPress={() => setShowNotifModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeNotifBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    DISPONIBLE:        'Disponible',
    EN_RUTA_HOTSPOT:   'En ruta al hotspot',
    PATRULLANDO_ZONA:  'Patrullando zona',
    OCUPADO_EMERGENCIA:'Emergencia activa',
    INACTIVO:          'Inactivo',
  };
  return labels[estado] ?? estado;
}

function formatCountdown(totalSecs: number): string {
  const isNegative = totalSecs < 0;
  const abs = Math.abs(totalSecs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  if (isNegative) {
    return `+${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function parseUtcIso(str: string | null | undefined): number {
  if (!str) return Date.now();
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(str) ? str : str.replace(' ', 'T') + 'Z';
  const t = new Date(iso).getTime();
  return isNaN(t) ? Date.now() : t;
}

function getDistance(a: Coordenadas, b: Coordenadas): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  unitRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unitLabel: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  statusLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  topActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn:   { padding: Spacing.sm, position: 'relative' },
  msgDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.notifBadge,
    width: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: Colors.textWhite, fontSize: 8, fontWeight: '800' },

  // Mapa
  mapContainer: {
    height: MAP_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: Colors.mapBackground,
    overflow: 'hidden',
  },
  map: { width: '100%', height: '100%' },

  // Botón recentrar — minimalista
  recenterBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Marcador táctico
  tacticalMarkerContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  markerCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },

  // Tarjeta inferior
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    marginTop: -12,
  },
  profileSection: { alignItems: 'center', marginBottom: Spacing.lg },
  officerName: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  officerSub: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Botón SOS
  sosBtn: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sosBtnConfirmed: { borderColor: Colors.stateEnRuta, backgroundColor: Colors.surface },
  sosBtnText: {
    color: Colors.danger,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Modal Notificaciones
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  notifModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  notifModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  notifModalTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cleanBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  cleanBtnText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.danger,
  },
  emptyNotif: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  emptyNotifText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifItemIcon: {
    marginTop: 2,
  },
  notifItemMsg: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: '500',
    lineHeight: 18,
  },
  notifItemTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeNotifBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  closeNotifBtnText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
