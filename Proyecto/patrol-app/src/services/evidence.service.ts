import apiClient from './apiClient';
import * as ImagePicker from 'expo-image-picker';

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
