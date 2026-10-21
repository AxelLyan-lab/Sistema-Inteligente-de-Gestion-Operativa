import apiClient from './apiClient';
import * as ImagePicker from 'expo-image-picker';

export async function capturePhotoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se requieren permisos de cámara para capturar evidencias.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

/**
 * Graba un video táctico comprimido (640x480, H264, max 30s) para ahorrar memoria y carga ultrarrápida.
 */
export async function captureVideoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se requieren permisos de cámara para grabar video de evidencia.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    videoMaxDuration: 30, // 30s max para evitar archivos pesados
    videoQuality: 0, // Compresión alta
    videoExportPreset: ImagePicker.VideoExportPreset.H264_640x480, // Máxima compresión y tamaño ligero
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function pickPhotoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se requieren permisos de galería para adjuntar evidencias.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All, // Permite fotos y videos
    allowsEditing: false,
    quality: 0.8,
    videoMaxDuration: 30,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_640x480,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function uploadEvidenceAsset(
  asset: ImagePicker.ImagePickerAsset,
  description: string,
  tipoEvidencia: string = 'EVIDENCIA_BASICA',
  coords?: { latitude: number; longitude: number }
) {
  const isVideo =
    asset.type === 'video' ||
    asset.mimeType?.startsWith('video/') ||
    asset.uri.toLowerCase().endsWith('.mp4') ||
    asset.uri.toLowerCase().endsWith('.mov');

  const mimeType = isVideo ? (asset.mimeType ?? 'video/mp4') : (asset.mimeType ?? 'image/jpeg');
  const extension = isVideo ? 'mp4' : 'jpg';

  const formData = new FormData();
  formData.append('evidencia', {
    uri: asset.uri,
    type: mimeType,
    name: asset.fileName ?? `evidencia_${Date.now()}.${extension}`,
  } as any);

  formData.append('descripcion_texto', description);
  formData.append('tipo_evidencia', tipoEvidencia);

  if (coords) {
    formData.append('latitude', String(coords.latitude));
    formData.append('longitude', String(coords.longitude));
  }

  const { data } = await apiClient.post('/evidence/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

export async function pickAndUploadEvidence(
  description: string,
  tipoEvidencia: string = 'EVIDENCIA_BASICA',
  coords?: { latitude: number; longitude: number }
) {
  // Solicitar permisos de galería
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se requieren permisos de galería para adjuntar evidencias.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const formData = new FormData();

  // Adjuntar archivo como multipart
  formData.append('evidencia', {
    uri: asset.uri,
    type: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? `evidencia_${Date.now()}.jpg`,
  } as any);

  formData.append('descripcion_texto', description);
  formData.append('tipo_evidencia', tipoEvidencia);

  if (coords) {
    formData.append('latitude', String(coords.latitude));
    formData.append('longitude', String(coords.longitude));
  }

  const { data } = await apiClient.post('/evidence/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

export async function captureAndUploadEvidence(
  description: string,
  tipoEvidencia: string = 'EVIDENCIA_BASICA',
  coords?: { latitude: number; longitude: number }
) {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se requieren permisos de cámara para capturar evidencias.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const formData = new FormData();

  formData.append('evidencia', {
    uri: asset.uri,
    type: 'image/jpeg',
    name: `captura_${Date.now()}.jpg`,
  } as any);

  formData.append('descripcion_texto', description);
  formData.append('tipo_evidencia', tipoEvidencia);

  if (coords) {
    formData.append('latitude', String(coords.latitude));
    formData.append('longitude', String(coords.longitude));
  }

  const { data } = await apiClient.post('/evidence/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

export async function listEvidence() {
  const { data } = await apiClient.get('/evidence/list');
  return data.evidencias;
}
