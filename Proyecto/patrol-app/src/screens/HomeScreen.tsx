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
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import PatrolCrewList from '../components/PatrolCrewList';
import EmergencyConfirmModal from '../components/EmergencyConfirmModal';
import NotificationBanner from '../components/NotificationBanner';
import { getCrew, requestReinforcements, sendTelemetry } from '../services/patrol.service';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../theme';
import { TripulacionMiembro, Notificacion, Coordenadas } from '../types';

const { height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.40;

// Geocerca predeterminada de patrullaje (500 metros de radio)
const DEFAULT_COORDS = { latitude: -33.0153, longitude: -71.5500 }; // Viña del Mar
const GEOFENCE_RADIUS = 600; // metros

/**
 * HomeScreen — Vista principal de patrullaje con mapa interactivo y GPS en tiempo real
 */
export default function HomeScreen() {
  const { funcionario, sesion } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [geofenceCenter, setGeofenceCenter] = useState<Coordenadas | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [crew, setCrew] = useState<TripulacionMiembro[]>([]);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosConfirmed, setSosConfirmed] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [notification, setNotification] = useState<Notificacion | null>(null);
  const [notifBadgeCount, setNotifBadgeCount] = useState(0);

  // ── Inicializar GPS y suscripción en tiempo real ──────────────────────────
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

        // 1. Obtener última posición conocida de forma inmediata (cache rápido)
        const lastKnown = await Location.getLastKnownPositionAsync({}).catch(() => null);
        if (lastKnown && isMounted) {
          const initialCoords: Coordenadas = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          setCoords(initialCoords);
          setGeofenceCenter(initialCoords);
          setIsLocating(false);

          mapRef.current?.animateToRegion({
            latitude: initialCoords.latitude,
            longitude: initialCoords.longitude,
            latitudeDelta: 0.007,
            longitudeDelta: 0.007,
          }, 800);
        }

        // 2. Obtener posición GPS actual precisa
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);

        if (current && isMounted) {
          const freshCoords: Coordenadas = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };
          setCoords(freshCoords);
          if (!geofenceCenter) setGeofenceCenter(freshCoords);
          setIsLocating(false);

          try { await sendTelemetry(freshCoords); } catch {}

          mapRef.current?.animateToRegion({
            latitude: freshCoords.latitude,
            longitude: freshCoords.longitude,
            latitudeDelta: 0.007,
            longitudeDelta: 0.007,
          }, 1000);
        }

        // 3. Monitorear movimiento en tiempo real
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          async (loc) => {
            if (!isMounted) return;
            const newCoords: Coordenadas = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setCoords(newCoords);
            setIsLocating(false);

            // Verificar si sale del cuadrante asignado
            const center = geofenceCenter ?? newCoords;
            const dist = getDistance(newCoords, center);
            if (dist > GEOFENCE_RADIUS) {
              setNotification({
                id: 'out_zone',
                tipo: 'FUERA_ZONA',
                mensaje: '⚠️ Fuera del sector de patrullaje asignado.',
                leida: false,
                timestamp: new Date(),
              });
              setNotifBadgeCount((c) => c + 1);
            }

            try { await sendTelemetry(newCoords); } catch {}
          }
        );
      } catch (err) {
        console.warn('[GPS INIT ERROR]:', err);
        if (isMounted) setIsLocating(false);
      }
    })();

    return () => {
      isMounted = false;
      subscription?.remove();
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

  useEffect(() => {
    loadCrew();
  }, [loadCrew]);

  // ── Recentrar cámara en la posición del funcionario ──────────────────────
  const handleRecenter = () => {
    const target = coords ?? geofenceCenter ?? DEFAULT_COORDS;
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      800
    );
  };

  // ── Solicitar refuerzos (SOS) ─────────────────────────────────────────────
  const handleSosConfirm = async () => {
    if (!coords) {
      Alert.alert('Sin GPS', 'Esperando señal GPS para emitir las coordenadas de emergencia.');
      return;
    }
    setSosLoading(true);
    try {
      await requestReinforcements(coords);
      setSosConfirmed(true);
      setNotification({
        id: 'sos_sent',
        tipo: 'REFUERZOS_ASIGNADOS',
        mensaje: '🚔 Alerta SOS transmitida. Refuerzos en ruta hacia tus coordenadas.',
        leida: false,
        timestamp: new Date(),
      });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'No se pudo enviar la alerta.');
    } finally {
      setSosLoading(false);
    }
  };

  const activeCenter = geofenceCenter ?? coords ?? DEFAULT_COORDS;
  const initialRegion = {
    latitude: activeCenter.latitude,
    longitude: activeCenter.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };

  const getTransportEmoji = (tipo?: string) => {
    switch (tipo) {
      case 'MOTO': return '🏍️';
      case 'BICICLETA': return '🚲';
      case 'INFANTERIA': return '👮';
      default: return '🚓';
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Banner de Notificación Táctica ────────────────────────────── */}
      <NotificationBanner
        notification={notification}
        onDismiss={() => setNotification(null)}
      />

      {/* ── Header Superior ────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View>
          <View style={styles.unitRow}>
            {(!sesion?.tipo_transporte || sesion.tipo_transporte === 'PATRULLA') ? (
              <Image 
                source={require('../../assets/icono de patrulla.png')}
                style={{ width: 24, height: 48, resizeMode: 'contain' }}
              />
            ) : (
              <Text style={{ fontSize: 20 }}>{getTransportEmoji(sesion?.tipo_transporte)}</Text>
            )}
            <Text style={styles.unitLabel}>{sesion?.identificador_unidad ?? 'PATRULLA'}</Text>
          </View>
          <Text style={styles.statusLabel}>
            {getEstadoLabel(sesion?.estado_operativo ?? 'DISPONIBLE')}
          </Text>
        </View>

        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
          <Feather name="bell" size={24} color={Colors.textPrimary} />
          {notifBadgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifBadgeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Área del Mapa con GPS en Tiempo Real ────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          mapType="standard"
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          loadingEnabled={true}
          loadingIndicatorColor={Colors.primary}
          loadingBackgroundColor="#E2E8F0"
        >



          {/* Marcador táctico del funcionario / patrulla en tiempo real */}
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
                    style={{ width: 60, height: 120, resizeMode: 'contain' }}
                  />
                ) : (
                  <View style={styles.tacticalMarkerContainer}>
                    <View style={styles.markerPulse} />
                    <View style={styles.markerCore}>
                      <Text style={{ fontSize: 16 }}>{getTransportEmoji(sesion?.tipo_transporte)}</Text>
                    </View>
                  </View>
                )}
              </>
            </Marker>
          )}
        </MapView>

        {/* Indicador de estado GPS flotante sobre el mapa */}
        <View style={styles.gpsPill}>
          <View style={[styles.gpsDot, isLocating && styles.gpsDotSearching]} />
          <Text style={styles.gpsPillText}>
            {isLocating ? 'Buscando GPS...' : 'GPS Conectado • Tiempo Real'}
          </Text>
        </View>

        {/* Botón flotante para recentrar el mapa */}
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Feather name="crosshair" size={16} color={Colors.textPrimary} />
          <Text style={styles.recenterText}>Mi Ubicación</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tarjeta Inferior de Gestión y Turno ─────────────────────────── */}
      <ScrollView style={styles.card} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Perfil del Funcionario */}
        <View style={styles.profileSection}>
          <Text style={styles.officerName}>{funcionario?.nombre_completo ?? 'Funcionario'}</Text>
          <Text style={styles.officerSub}>
            {funcionario?.grado_cargo ?? 'Oficial en Terreno'} — {sesion?.identificador_unidad ?? 'Móvil'}
          </Text>
        </View>

        {/* Botón de Pánico / Refuerzos (Rojo central — Figma) */}
        <TouchableOpacity
          style={[styles.sosBtn, sosConfirmed && styles.sosBtnConfirmed]}
          onPress={() => setShowSosModal(true)}
          activeOpacity={0.85}
        >
          <Feather name="alert-triangle" size={20} color="#FFF" />
          <Text style={styles.sosBtnText}>
            {sosConfirmed ? 'Refuerzos Solicitados' : 'Pedir Refuerzos'}
          </Text>
        </TouchableOpacity>

        {/* Dotación de Turno con compañeros y opción de eliminar */}
        <PatrolCrewList
          crew={crew}
          conductorRut={funcionario?.rut ?? ''}
          conductorNombre={funcionario?.nombre_completo ?? ''}
          tipoTransporte={sesion?.tipo_transporte ?? 'PATRULLA'}
          onCrewChange={loadCrew}
        />
      </ScrollView>

      {/* Modal de confirmación SOS */}
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
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    DISPONIBLE: '🟢 Disponible',
    EN_RUTA_HOTSPOT: '🟡 En ruta al hotspot',
    PATRULLANDO_ZONA: '🔵 Patrullando zona',
    OCUPADO_EMERGENCIA: '🔴 Emergencia activa',
    INACTIVO: '⚫ Inactivo',
  };
  return labels[estado] ?? estado;
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
const styles = StyleSheet.create({
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
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transportBadge: { fontSize: 20 },
  unitLabel: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  statusLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  bellBtn: { padding: Spacing.sm, position: 'relative' },
  bellIcon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.notifBadge,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: Colors.textWhite, fontSize: 9, fontWeight: '800' },

  // Contenedor del Mapa
  mapContainer: {
    height: MAP_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: '#CBD5E1',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },

  // Marcador táctico
  tacticalMarkerContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(30, 58, 138, 0.5)',
  },
  markerCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    ...Shadow.md,
  },
  markerEmoji: { fontSize: 16 },

  // Píldora GPS
  gpsPill: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    gap: 6,
    ...Shadow.sm,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  gpsDotSearching: { backgroundColor: '#F59E0B' },
  gpsPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Botón Recentrar
  recenterBtn: {
    position: 'absolute',
    bottom: 40,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.md,
  },
  recenterIcon: { fontSize: 14 },
  recenterText: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.textPrimary },

  // Tarjeta inferior
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    marginTop: -16,
    ...Shadow.lg,
  },
  profileSection: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.geofenceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadow.md,
  },
  avatarText: { color: Colors.textWhite, fontWeight: '800', fontSize: Fonts.sizes.xxl },
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
    height: 54,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  sosBtnConfirmed: { backgroundColor: Colors.stateEnRuta },
  sosBtnIcon: { fontSize: 22 },
  sosBtnText: {
    color: Colors.textWhite,
    fontSize: Fonts.sizes.lg,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
