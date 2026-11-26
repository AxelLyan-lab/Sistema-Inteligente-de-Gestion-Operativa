import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { pickPhotoAsset, uploadEvidenceAsset, listEvidence } from '../services/evidence.service';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import Icon, { IconName } from '../components/Icon';
import SmoothModal from '../components/SmoothModal';

const TRANSPORT_ICONS: Record<string, IconName> = {
  PATRULLA: 'auto',
  MOTO: 'moto',
  BICICLETA: 'bici',
  INFANTERIA: 'peaton',
};

/**
 * ProfileScreen — Perfil del funcionario, apariencia y cierre de turno
 */
const JUSTIFICACION_STORAGE_KEY = '@sigo_justificacion_cierre';

function formatChileDate(raw: string | Date | null | undefined): string {
  if (!raw) return '—';
  const s = typeof raw === 'string' ? raw.trim() : raw.toISOString();
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
}

export default function ProfileScreen() {
  const { funcionario, sesion, patrol_id, logout } = useAuth();
  const { Colors, isDark, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [loggingOut, setLoggingOut] = useState(false);

  // Modal "Ver mis evidencias del turno"
  const [evidenciasModalVisible, setEvidenciasModalVisible] = useState(false);
  const [misEvidencias, setMisEvidencias] = useState<any[]>([]);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);

  const abrirMisEvidencias = async () => {
    setEvidenciasModalVisible(true);
    setLoadingEvidencias(true);
    try {
      const lista = await listEvidence();
      setMisEvidencias(Array.isArray(lista) ? lista : []);
    } catch {
      setMisEvidencias([]);
    } finally {
      setLoadingEvidencias(false);
    }
  };

  // Estado de justificación automática al cerrar sesión
  const [modalVisible, setModalVisible] = useState(false);
  const [retrasosPendientes, setRetrasosPendientes] = useState<Array<{
    id_asignacion: number;
    nombre_zona: string;
    direccion_zona: string;
    hora_asignacion: string;
    minutos_retraso: number;
    texto_retraso?: string;
  }>>([]);
  const [justificacionTexto, setJustificacionTexto] = useState('');
  const [justificacionAsset, setJustificacionAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const seleccionarMediaOpcional = async () => {
    try {
      const asset = await pickPhotoAsset();
      if (asset) setJustificacionAsset(asset);
    } catch (err: any) {
      Alert.alert('Galería', err?.message ?? 'No se pudo acceder a la galería.');
    }
  };

  const ESTADO_COLORS: Record<string, string> = {
    DISPONIBLE: Colors.stateDisponible,
    EN_RUTA_HOTSPOT: Colors.stateEnRuta,
    PATRULLANDO_ZONA: Colors.statePatrullando,
    OCUPADO_EMERGENCIA: Colors.stateEmergencia,
    INACTIVO: Colors.stateInactivo,
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { data } = await apiClient.get('/patrol/retrasos');
      const pendientes = (data?.retrasos ?? []).filter((r: any) => !r.justificada);
      if (pendientes.length > 0) {
        setRetrasosPendientes(pendientes);
        setLoggingOut(false);
        setModalVisible(true);
        return;
      }
    } catch { /* si falla red, permite confirmar cierre */ }
    setLoggingOut(false);

    Alert.alert(
      'Finalizar turno',
      '¿Confirmas que deseas cerrar sesión y finalizar el turno operativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar turno',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch {
              Alert.alert('Error', 'No se pudo finalizar el turno.');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const confirmarCierreConJustificacion = async () => {
    if (!justificacionTexto.trim()) {
      Alert.alert('Justificación obligatoria', 'Debes escribir el motivo del retraso para poder cerrar sesión.');
      return;
    }
    setLoggingOut(true);
    try {
      const primero = retrasosPendientes[0];
      const resumenZonas = retrasosPendientes
        .map(r => `#ASIG-${r.id_asignacion} ${r.nombre_zona} (${r.direccion_zona} · Enviado ${r.hora_asignacion})`)
        .join(', ');
      const descripcion = `[RETRASO ${resumenZonas}] ${justificacionTexto.trim()}`;

      if (justificacionAsset) {
        await uploadEvidenceAsset(
          justificacionAsset,
          descripcion,
          'JUSTIFICACION_ATRASO',
          undefined,
          primero?.id_asignacion
        );
      } else {
        await apiClient.post('/patrol/justificar-retraso', {
          descripcion_texto: descripcion,
          id_asignacion: primero?.id_asignacion ?? null,
        });
      }

      setModalVisible(false);
      await logout();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo registrar la justificación.');
      setLoggingOut(false);
    }
  };

  const estadoColor = ESTADO_COLORS[sesion?.estado_operativo ?? 'DISPONIBLE'];
  const transportIcon = TRANSPORT_ICONS[sesion?.tipo_transporte ?? 'PATRULLA'] ?? 'auto';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar y nombre ────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {funcionario?.nombre_completo?.charAt(0).toUpperCase() ?? 'F'}
            </Text>
          </View>
          <Text style={styles.name}>{funcionario?.nombre_completo ?? 'Funcionario'}</Text>
          <Text style={styles.grade}>{funcionario?.grado_cargo ?? 'Oficial de Terreno'}</Text>
          <View style={[styles.stateBadge, { borderColor: estadoColor }]}>
            <View style={[styles.stateDot, { backgroundColor: estadoColor }]} />
            <Text style={[styles.stateText, { color: estadoColor }]}>
              {sesion?.estado_operativo?.replace(/_/g, ' ') ?? 'DISPONIBLE'}
            </Text>
          </View>
        </View>

        {/* ── Datos del turno ────────────────────────────── */}
        <Text style={styles.sectionTitle}>Turno activo</Text>
        <View style={styles.card}>
          <InfoRow styles={styles} color={Colors.textSecondary} icon="id" label="RUT / ID" value={funcionario?.rut ?? '—'} />
          <View style={styles.divider} />
          <InfoRow styles={styles} color={Colors.textSecondary} icon="lista" label="ID sesión" value={`#${patrol_id}`} />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon={transportIcon}
            label="Unidad"
            value={sesion?.identificador_unidad ?? '—'}
          />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon="inicio"
            label="Tipo de transporte"
            value={sesion?.tipo_transporte?.replace('_', ' ') ?? '—'}
          />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon="reloj"
            label="Inicio de turno"
            value={formatChileDate(sesion?.fecha_inicio)}
          />
        </View>

        {/* ── Apariencia ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Apariencia</Text>
        <View style={styles.card}>
          <View style={styles.actionRow}>
            <Icon name={isDark ? 'luna' : 'sol'} size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Modo oscuro</Text>
              <Text style={styles.actionHint}>{isDark ? 'Activado' : 'Desactivado'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(v) => setMode(v ? 'dark' : 'light')}
              trackColor={{ false: Colors.borderDark, true: Colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={Colors.borderDark}
            />
          </View>
        </View>

        {/* ── Acciones ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={abrirMisEvidencias} activeOpacity={0.75}>
            <Icon name="chart" size={22} color={Colors.primary} />
            <Text style={[styles.actionLabel, { flex: 1 }]}>Ver mis evidencias del turno</Text>
            <Icon name="chevron" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Cerrar sesión ─────────────────────────────── */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color={Colors.danger} />
          ) : (
            <>
              <Icon name="salir" size={20} color={Colors.danger} />
              <Text style={styles.logoutText}>Cerrar sesión y finalizar turno</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>S.I.G.O. Patrol v1.0.0 — Uso exclusivo institucional</Text>
      </ScrollView>

      {/* ── Modal Justificación Automática de Retraso al Cerrar Sesión ── */}
      <SmoothModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Justificación de retraso detectado</Text>
            <Text style={styles.modalSubtitle}>
              El sistema detectó llegada fuera de tiempo en la(s) siguiente(s) zona(s). Debes ingresar el motivo por escrito (imagen o video opcional) para cerrar sesión:
            </Text>

            <View style={{ maxHeight: 120, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 8, borderWidth: 1, borderColor: Colors.border }}>
              <ScrollView>
                {retrasosPendientes.map(r => (
                  <View key={r.id_asignacion} style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.danger }}>
                      {r.nombre_zona} · Hora envío: {r.hora_asignacion} (Demora: {r.texto_retraso ?? `${r.minutos_retraso} min`})
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                      Dirección: {r.direccion_zona}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.inputLabel}>Justificación escrita (Obligatoria) *</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              placeholder="Describe el motivo del retraso (se guardará en Evidencias del Operador)..."
              placeholderTextColor={Colors.textMuted}
              value={justificacionTexto}
              onChangeText={setJustificacionTexto}
            />

            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.imageBtn} onPress={seleccionarMediaOpcional}>
                <Icon name="camara" size={18} color={Colors.primary} />
                <Text style={styles.imageBtnText}>
                  {justificacionAsset ? 'Cambiar foto/video (Opcional)' : 'Adjuntar foto o video (Opcional)'}
                </Text>
              </TouchableOpacity>
              {justificacionAsset && (
                <TouchableOpacity onPress={() => setJustificacionAsset(null)}>
                  <Text style={styles.removeImgText}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>

            {justificacionAsset && (
              justificacionAsset.type === 'video' ? (
                <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>
                  🎬 Video adjunto listo para enviar
                </Text>
              ) : (
                <Image source={{ uri: justificacionAsset.uri }} style={styles.previewImg} />
              )
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  !justificacionTexto.trim() && styles.confirmBtnDisabled,
                ]}
                onPress={confirmarCierreConJustificacion}
                disabled={loggingOut || !justificacionTexto.trim()}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Guardar y cerrar sesión</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
      </SmoothModal>

      {/* ── Modal: Ver mis evidencias del turno (Estética unificada con Confirmar Solicitud de Refuerzos) ── */}
      <SmoothModal
        visible={evidenciasModalVisible}
        onRequestClose={() => setEvidenciasModalVisible(false)}
      >
        <View style={styles.evidModalCard}>
          {/* Badge / Icono circular superior */}
          <View style={styles.evidIconContainer}>
            <Icon name="camara" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.evidModalTitle}>Mis evidencias del turno</Text>
          <Text style={styles.evidModalSubtitle}>
            Registros audiovisuales y reportes enviados durante tu sesión activa{' '}
            <Text style={{ fontWeight: '700', color: Colors.primary }}>#{patrol_id}</Text>
          </Text>

          {loadingEvidencias ? (
            <View style={styles.evidEmptyBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.evidEmptySub}>Consultando registros del turno...</Text>
            </View>
          ) : misEvidencias.length === 0 ? (
            <View style={styles.evidEmptyBox}>
              <View style={styles.evidEmptyIconCircle}>
                <Icon name="evidencia" size={26} color={Colors.textMuted} />
              </View>
              <Text style={styles.evidEmptyTitle}>Sin evidencias registradas</Text>
              <Text style={styles.evidEmptySub}>
                Aún no has enviado fotografías, videos ni justificaciones durante este turno operativo.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.evidListScroll}
              contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
            >
              {misEvidencias.map((ev: any) => {
                const isVideo = Boolean(ev.url_fotografia && /\.(mp4|mov)$/i.test(ev.url_fotografia));
                const tipoLabel = (ev.tipo_evidencia || 'EVIDENCIA').replace(/_/g, ' ');
                return (
                  <View key={ev.id_evidencia} style={styles.evidItemCard}>
                    <View style={styles.evidItemHeader}>
                      <View style={styles.evidTypeBadge}>
                        <Icon
                          name={isVideo ? 'video' : ev.tipo_evidencia === 'JUSTIFICACION_ATRASO' ? 'reloj' : 'camara'}
                          size={12}
                          color={Colors.primary}
                        />
                        <Text style={styles.evidTypeBadgeText}>{tipoLabel}</Text>
                      </View>
                      <Text style={styles.evidDateText}>{formatChileDate(ev.fecha_subida)}</Text>
                    </View>

                    {ev.descripcion_texto ? (
                      <Text style={styles.evidDescText}>{ev.descripcion_texto}</Text>
                    ) : null}

                    {ev.url_fotografia ? (
                      isVideo ? (
                        <View style={styles.evidVideoPill}>
                          <Icon name="video" size={15} color={Colors.primary} />
                          <Text style={styles.evidVideoPillText}>Video táctico adjunto</Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: ev.url_fotografia }}
                          style={styles.evidItemImage}
                        />
                      )
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.evidClosePrimaryBtn}
            onPress={() => setEvidenciasModalVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.evidClosePrimaryBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </SmoothModal>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  styles,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  color: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={22} color={color} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },

    profileCard: { alignItems: 'center', paddingVertical: Spacing.xl, marginBottom: Spacing.lg },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: Colors.primarySoft,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    avatarText: { color: Colors.primary, fontSize: Fonts.sizes.xxxl, fontWeight: '500' },
    name: { fontSize: Fonts.sizes.xxl, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
    grade: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
    stateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs + 2,
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    stateDot: { width: 7, height: 7, borderRadius: 4 },
    stateText: { fontSize: Fonts.sizes.xs, fontWeight: '600', letterSpacing: 1 },

    sectionTitle: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.textMuted,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
    },

    card: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
    infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

    actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    actionLabel: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
    actionHint: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

    logoutBtn: {
      height: 52,
      borderWidth: 1,
      borderColor: Colors.danger,
      borderRadius: BorderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    logoutBtnDisabled: { opacity: 0.6 },
    logoutText: { color: Colors.danger, fontSize: Fonts.sizes.md, fontWeight: '600' },
    version: { textAlign: 'center', color: Colors.textMuted, fontSize: Fonts.sizes.xs },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: Spacing.sm,
    },
    modalTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
    modalSubtitle: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, lineHeight: 18 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
    },
    switchLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: 8 },
    inputLabel: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.textSecondary },
    textArea: {
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      color: Colors.textPrimary,
      fontSize: Fonts.sizes.sm,
      minHeight: 90,
      textAlignVertical: 'top',
    },
    imageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    imageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.primary,
      backgroundColor: Colors.primary + '15',
    },
    imageBtnText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.primary },
    removeImgText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.danger },
    previewImg: { width: '100%', height: 120, borderRadius: BorderRadius.md, marginTop: 4 },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
      alignItems: 'center',
    },
    cancelBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: Fonts.sizes.sm },
    closeIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeModalPrimaryBtn: {
      marginTop: 8,
      paddingVertical: 13,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    closeModalPrimaryBtnText: {
      color: Colors.onPrimary,
      fontWeight: '700',
      fontSize: Fonts.sizes.sm,
      letterSpacing: 0.3,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.danger,
      alignItems: 'center',
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary,
      alignItems: 'center',
    },
    confirmBtnDisabled: { opacity: 0.45 },
    confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: Fonts.sizes.sm },

    // Estilos del Modal "Mis evidencias del turno" (Estética homologada con EmergencyConfirmModal)
    evidModalCard: {
      backgroundColor: Colors.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xxl,
      alignItems: 'center',
      width: '90%',
      maxWidth: 380,
      maxHeight: '84%',
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 10,
    },
    evidIconContainer: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: Colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    evidModalTitle: {
      fontSize: Fonts.sizes.xl,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    evidModalSubtitle: {
      fontSize: Fonts.sizes.sm,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: Spacing.lg,
    },
    evidEmptyBox: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.lg,
      gap: 8,
    },
    evidEmptyIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    evidEmptyTitle: {
      fontSize: Fonts.sizes.md,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
    },
    evidEmptySub: {
      fontSize: Fonts.sizes.xs,
      color: Colors.textMuted,
      textAlign: 'center',
      lineHeight: 17,
    },
    evidListScroll: {
      width: '100%',
      maxHeight: 330,
      marginBottom: Spacing.lg,
    },
    evidItemCard: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 6,
    },
    evidItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    evidTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: Colors.primarySoft,
      borderWidth: 1,
      borderColor: Colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BorderRadius.full,
    },
    evidTypeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: Colors.primary,
      letterSpacing: 0.3,
    },
    evidDateText: {
      fontSize: 10,
      color: Colors.textMuted,
      fontWeight: '500',
    },
    evidDescText: {
      fontSize: Fonts.sizes.xs,
      color: Colors.textPrimary,
      lineHeight: 18,
    },
    evidVideoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    evidVideoPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
    },
    evidItemImage: {
      width: '100%',
      height: 130,
      borderRadius: BorderRadius.sm,
      marginTop: 4,
      resizeMode: 'cover',
    },
    evidClosePrimaryBtn: {
      width: '100%',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    evidClosePrimaryBtnText: {
      fontSize: Fonts.sizes.lg,
      fontWeight: '600',
      color: Colors.onPrimary,
    },
  });
