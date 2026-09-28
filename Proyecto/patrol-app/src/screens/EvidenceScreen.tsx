import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { pickAndUploadEvidence, captureAndUploadEvidence } from '../services/evidence.service';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../theme';

const EVIDENCE_TYPES = [
  { value: 'EVIDENCIA_BASICA', label: 'Evidencia Básica', icon: '📸', color: Colors.info },
  { value: 'EVIDENCIA_IMPORTANTE', label: 'Evidencia Importante', icon: '🔍', color: Colors.warning },
  { value: 'JUSTIFICACION_ATRASO', label: 'Justificación Atraso', icon: '⏰', color: Colors.danger },
];

/**
 * EvidenceScreen — Carga de Evidencias Tácticas
 */
export default function EvidenceScreen() {
  const [description, setDescription] = useState('');
  const [tipoEvidencia, setTipoEvidencia] = useState('EVIDENCIA_BASICA');
  const [loading, setLoading] = useState(false);
  const [lastUpload, setLastUpload] = useState<any>(null);

  const getCoords = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch { return undefined; }
  };

  const handlePickFromGallery = async () => {
    setLoading(true);
    try {
      const coords = await getCoords();
      const result = await pickAndUploadEvidence(description, tipoEvidencia, coords);
      if (result) {
        setLastUpload(result.evidencia);
        setDescription('');
        Alert.alert('✅ Evidencia Cargada', 'La evidencia fue registrada en el sistema SIGO.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo cargar la evidencia.');
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePhoto = async () => {
    setLoading(true);
    try {
      const coords = await getCoords();
      const result = await captureAndUploadEvidence(description, tipoEvidencia, coords);
      if (result) {
        setLastUpload(result.evidencia);
        setDescription('');
        Alert.alert('✅ Evidencia Capturada', 'La foto fue enviada al sistema SIGO.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo capturar la foto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📁 Cargar Evidencia</Text>
        <Text style={styles.subtitle}>Registra material del hecho vinculado a tu turno activo</Text>

        {/* Tipo de evidencia */}
        <Text style={styles.sectionLabel}>Tipo de Evidencia</Text>
        <View style={styles.typeRow}>
          {EVIDENCE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeCard, tipoEvidencia === t.value && { borderColor: t.color, backgroundColor: `${t.color}15` }]}
              onPress={() => setTipoEvidencia(t.value)}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, tipoEvidencia === t.value && { color: t.color }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Descripción */}
        <Text style={styles.sectionLabel}>Descripción / Observación</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe el hecho, personas involucradas, contexto..."
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />

        {/* Última evidencia cargada */}
        {lastUpload && (
          <View style={styles.lastUploadCard}>
            <Text style={styles.lastUploadLabel}>✅ Última evidencia registrada</Text>
            <Text style={styles.lastUploadDate}>
              {new Date(lastUpload.fecha_subida).toLocaleString('es-CL')}
            </Text>
            {lastUpload.url_fotografia && (
              <Image source={{ uri: lastUpload.url_fotografia }} style={styles.previewImage} />
            )}
          </View>
        )}

        {/* Acciones */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cameraBtn, loading && styles.btnDisabled]}
            onPress={handleCapturePhoto}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <>
                <Text style={styles.actionIcon}>📷</Text>
                <Text style={styles.actionText}>Tomar Foto</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.galleryBtn, loading && styles.btnDisabled]}
            onPress={handlePickFromGallery}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <>
                <Text style={styles.actionIcon}>🖼️</Text>
                <Text style={styles.actionText}>Desde Galería</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  sectionLabel: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },

  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  typeCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  typeIcon: { fontSize: 22, marginBottom: Spacing.xs },
  typeLabel: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 120,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },

  lastUploadCard: {
    backgroundColor: '#F0FFF4',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  lastUploadLabel: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.success },
  lastUploadDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  previewImage: { width: '100%', height: 160, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },

  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadow.md,
  },
  cameraBtn: { backgroundColor: Colors.primary },
  galleryBtn: { backgroundColor: Colors.info },
  btnDisabled: { opacity: 0.5 },
  actionIcon: { fontSize: 20 },
  actionText: { color: Colors.textWhite, fontWeight: '700', fontSize: Fonts.sizes.sm },
});
