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
import * as ImagePicker from 'expo-image-picker';
import {
  capturePhotoAsset,
  captureVideoAsset,
  pickPhotoAsset,
  uploadEvidenceAsset,
} from '../services/evidence.service';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import Icon, { IconName } from '../components/Icon';

/**
 * EvidenceScreen — Carga y Despacho de Evidencias
 * Permite tomar foto o grabar video (con compresión 640p optimizada para memoria y datos),
 * previsualizarla, redactar la descripción y enviarla formalmente al sistema.
 */
export default function EvidenceScreen() {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [description, setDescription] = useState('');
  const [tipoEvidencia, setTipoEvidencia] = useState('EVIDENCIA_BASICA');
  const [loading, setLoading] = useState(false);
  const [lastUpload, setLastUpload] = useState<any>(null);

  const isVideoAsset = (asset: ImagePicker.ImagePickerAsset | null) => {
    if (!asset) return false;
    return (
      asset.type === 'video' ||
      asset.mimeType?.startsWith('video/') ||
      asset.uri.toLowerCase().endsWith('.mp4') ||
      asset.uri.toLowerCase().endsWith('.mov')
    );
  };

  const EVIDENCE_TYPES: { value: string; label: string; icon: IconName }[] = [
    { value: 'EVIDENCIA_BASICA', label: 'Evidencia básica', icon: 'camara' },
    { value: 'EVIDENCIA_IMPORTANTE', label: 'Evidencia importante', icon: 'lupa' },
    { value: 'JUSTIFICACION_ATRASO', label: 'Justificación atraso', icon: 'reloj' },
  ];

  const getCoords = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return undefined;
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const asset = await capturePhotoAsset();
      if (asset) {
        setSelectedAsset(asset);
      }
    } catch (err: any) {
      Alert.alert('Cámara', err.message ?? 'No se pudo acceder a la cámara.');
    }
  };

  const handleCaptureVideo = async () => {
    try {
      const asset = await captureVideoAsset();
      if (asset) {
        setSelectedAsset(asset);
      }
    } catch (err: any) {
      Alert.alert('Video', err.message ?? 'No se pudo iniciar la grabación de video.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const asset = await pickPhotoAsset();
      if (asset) {
        setSelectedAsset(asset);
      }
    } catch (err: any) {
      Alert.alert('Galería', err.message ?? 'No se pudo acceder a los archivos.');
    }
  };

  const handleSubmitEvidence = async () => {
    if (!selectedAsset) {
      Alert.alert('Evidencia Requerida', 'Por favor capture una fotografía o grabe un video antes de enviar.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Descripción Requerida', 'Por favor agregue una descripción u observación del hecho antes de enviar.');
      return;
    }

    setLoading(true);
    try {
      const coords = await getCoords();
      const result = await uploadEvidenceAsset(
        selectedAsset,
        description.trim(),
        tipoEvidencia,
        coords
      );

      if (result) {
        setLastUpload(result.evidencia);
        setSelectedAsset(null);
        setDescription('');
        Alert.alert(
          'Evidencia Registrada',
          'El archivo audiovisual y su descripción fueron enviados con éxito a la central SIGO.'
        );
      }
    } catch (err: any) {
      Alert.alert('Error al Enviar', err.message ?? 'No se pudo cargar la evidencia al servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cargar evidencia</Text>
        <Text style={styles.subtitle}>Respaldo de fotografía, video comprimido y descripción de turno</Text>

        {/* 1. Selector / Previsualización de Foto o Video */}
        <Text style={styles.sectionLabel}>Archivo Audiovisual del Hecho</Text>

        {selectedAsset ? (
          <View style={styles.previewContainer}>
            {isVideoAsset(selectedAsset) ? (
              <View style={styles.videoPreviewCard}>
                <View style={styles.videoIconCircle}>
                  <Icon name="video" size={32} color={Colors.onPrimary} />
                </View>
                <Text style={styles.videoBadgeTitle}>Video Táctico Comprimido</Text>
                <Text style={styles.videoBadgeSubtitle}>
                  Formato H.264 ligero (640×480) · Ahorro de memoria y datos
                </Text>
                {selectedAsset.duration ? (
                  <Text style={styles.videoDurationText}>
                    Duración: {Math.round(selectedAsset.duration / 1000)}s
                  </Text>
                ) : null}
              </View>
            ) : (
              <Image source={{ uri: selectedAsset.uri }} style={styles.stagedImage} />
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleCapturePhoto}
                disabled={loading}
              >
                <Icon name="camara" size={15} color={Colors.primary} />
                <Text style={styles.retakeBtnText}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleCaptureVideo}
                disabled={loading}
              >
                <Icon name="video" size={15} color={Colors.primary} />
                <Text style={styles.retakeBtnText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handlePickFromGallery}
                disabled={loading}
              >
                <Icon name="imagen" size={15} color={Colors.primary} />
                <Text style={styles.retakeBtnText}>Galería</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => setSelectedAsset(null)}
                disabled={loading}
              >
                <Icon name="cerrar" size={15} color={Colors.danger} />
                <Text style={styles.discardBtnText}>Quitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.photoCaptureBox}>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cameraBtn, loading && styles.btnDisabled]}
                onPress={handleCapturePhoto}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Icon name="camara" size={18} color={Colors.onPrimary} />
                <Text style={styles.actionText}>Tomar foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.videoBtn, loading && styles.btnDisabled]}
                onPress={handleCaptureVideo}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Icon name="video" size={18} color={Colors.onPrimary} />
                <Text style={styles.actionText}>Grabar video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.galleryBtn, loading && styles.btnDisabled]}
                onPress={handlePickFromGallery}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Icon name="imagen" size={18} color={Colors.primary} />
                <Text style={[styles.actionText, { color: Colors.primary }]}>Galería</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.compressionNote}>
              ⚡ Los videos se graban en formato comprimido 640p para no saturar memoria ni demorar la subida.
            </Text>
          </View>
        )}

        {/* 2. Tipo de evidencia */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Tipo de evidencia</Text>
        <View style={styles.typeRow}>
          {EVIDENCE_TYPES.map((t) => {
            const active = tipoEvidencia === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeCard, active && styles.typeCardActive]}
                onPress={() => setTipoEvidencia(t.value)}
              >
                <Icon name={t.icon} size={22} color={active ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. Descripción */}
        <Text style={styles.sectionLabel}>Descripción / Relato de Hechos</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Escriba aquí el contexto, personas involucradas, patente, circunstancias del hecho..."
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />

        {/* 4. Botón Explícito de ENVIAR EVIDENCIA */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedAsset || loading) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmitEvidence}
          disabled={!selectedAsset || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={Colors.onPrimary} />
              <Text style={styles.submitBtnText}>Enviando evidencia al sistema...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="enviar" size={20} color={Colors.onPrimary} />
              <Text style={styles.submitBtnText}>Enviar Evidencia</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 5. Última evidencia cargada */}
        {lastUpload && (
          <View style={styles.lastUploadCard}>
            <View style={styles.lastUploadHeader}>
              <Icon name="check" size={18} color={Colors.success} />
              <Text style={styles.lastUploadLabel}>Última evidencia registrada</Text>
            </View>
            <Text style={styles.lastUploadDate}>
              {new Date(lastUpload.fecha_subida).toLocaleString('es-CL')}
            </Text>
            {lastUpload.url_fotografia && (
              <Image source={{ uri: lastUpload.url_fotografia }} style={styles.previewImage} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
    title: { fontSize: Fonts.sizes.xxl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
    subtitle: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
    sectionLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },

    photoCaptureBox: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
    },
    previewContainer: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      marginBottom: Spacing.sm,
    },
    stagedImage: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.md,
      resizeMode: 'cover',
      marginBottom: Spacing.md,
    },
    previewActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    retakeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.primary,
      borderRadius: BorderRadius.md,
    },
    retakeBtnText: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.primary,
    },
    discardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: Colors.dangerLight,
      borderWidth: 1,
      borderColor: Colors.danger,
      borderRadius: BorderRadius.md,
    },
    discardBtnText: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.danger,
    },

    typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    typeCard: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    typeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
    typeLabel: { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },
    typeLabelActive: { color: Colors.primary, fontWeight: '700' },

    textArea: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      fontSize: Fonts.sizes.md,
      color: Colors.textPrimary,
      borderWidth: 1,
      borderColor: Colors.border,
      minHeight: 110,
      marginBottom: Spacing.xl,
    },

    submitBtn: {
      height: 52,
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnText: {
      color: Colors.onPrimary,
      fontWeight: '700',
      fontSize: Fonts.sizes.md,
    },

    lastUploadCard: {
      backgroundColor: Colors.successSoft,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.success,
    },
    lastUploadHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    lastUploadLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.success },
    lastUploadDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
    previewImage: { width: '100%', height: 160, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },

    actions: { flexDirection: 'row', gap: Spacing.md },
    actionBtn: {
      flex: 1,
      height: 48,
      borderRadius: BorderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    cameraBtn: { backgroundColor: Colors.primary },
    videoBtn: { backgroundColor: '#b45309' }, // Color ámbar/táctico para video
    galleryBtn: { borderWidth: 1, borderColor: Colors.primary },
    btnDisabled: { opacity: 0.5 },
    actionText: { color: Colors.onPrimary, fontWeight: '600', fontSize: Fonts.sizes.xs },

    compressionNote: {
      fontSize: 11,
      color: Colors.textMuted,
      marginTop: Spacing.sm,
      textAlign: 'center',
      lineHeight: 15,
    },

    videoPreviewCard: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.md,
      gap: Spacing.xs,
    },
    videoIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#b45309',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    videoBadgeTitle: {
      fontSize: Fonts.sizes.sm,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    videoBadgeSubtitle: {
      fontSize: Fonts.sizes.xs,
      color: Colors.textSecondary,
      textAlign: 'center',
      maxWidth: 240,
    },
    videoDurationText: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: '#b45309',
      marginTop: 2,
    },
  });
