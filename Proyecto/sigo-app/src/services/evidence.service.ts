import apiClient from './apiClient';
import * as ImagePicker from 'expo-image-picker';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { SigoBackground } = NativeModules;

async function ensureCameraPermission(includeMic: boolean = false): Promise<boolean> {
  if (Platform.OS === 'android') {
    const permsToAsk: Array<any> = [PermissionsAndroid.PERMISSIONS.CAMERA];
    if (includeMic) {
      permsToAsk.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    const results = await PermissionsAndroid.requestMultiple(permsToAsk);
    const camGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
    if (!camGranted) return false;
    return true;
  }
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

async function ensureGalleryPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (apiLevel >= 33) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ]);
      const ok =
        res[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED ||
        res[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED;
      if (ok) return true;
    } else {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      if (res === PermissionsAndroid.RESULTS.GRANTED) return true;
    }
    // En Android 13+ el selector de documentos ACTION_GET_CONTENT no exige permiso si el usuario elige el archivo manualmente
    return true;
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function capturePhotoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const granted = await ensureCameraPermission(false);
  if (!granted) {
    throw new Error('Se requieren permisos de cámara para capturar evidencias.');
  }

  if (Platform.OS === 'android' && SigoBackground?.capturePhotoNative) {
    const nativeAsset = await SigoBackground.capturePhotoNative();
    if (!nativeAsset || !nativeAsset.uri) return null;
    return {
      uri: nativeAsset.uri,
      fileName: nativeAsset.fileName ?? `foto_${Date.now()}.jpg`,
      type: 'image',
      mimeType: nativeAsset.mimeType ?? 'image/jpeg',
      fileSize: nativeAsset.fileSize,
      width: 1280,
      height: 720,
    } as ImagePicker.ImagePickerAsset;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

/**
 * Graba un video táctico comprimido (max 30s) para ahorrar memoria y carga ultrarrápida.
 */
export async function captureVideoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const granted = await ensureCameraPermission(true);
  if (!granted) {
    throw new Error('Se requieren permisos de cámara y micrófono para grabar video de evidencia.');
  }

  if (Platform.OS === 'android' && SigoBackground?.captureVideoNative) {
    const nativeAsset = await SigoBackground.captureVideoNative();
    if (!nativeAsset || !nativeAsset.uri) return null;
    return {
      uri: nativeAsset.uri,
      fileName: nativeAsset.fileName ?? `video_${Date.now()}.mp4`,
      type: 'video',
      mimeType: nativeAsset.mimeType ?? 'video/mp4',
      fileSize: nativeAsset.fileSize,
      duration: nativeAsset.duration ?? 0,
      width: 640,
      height: 480,
    } as ImagePicker.ImagePickerAsset;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    videoMaxDuration: 30,
    videoQuality: 0,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function pickPhotoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const granted = await ensureGalleryPermission();
  if (!granted) {
    throw new Error('Se requieren permisos de galería para adjuntar evidencias.');
  }

  if (Platform.OS === 'android' && SigoBackground?.pickMediaNative) {
    const nativeAsset = await SigoBackground.pickMediaNative();
    if (!nativeAsset || !nativeAsset.uri) return null;
    return {
      uri: nativeAsset.uri,
      fileName: nativeAsset.fileName ?? `evidencia_${Date.now()}`,
      type: nativeAsset.type === 'video' ? 'video' : 'image',
      mimeType: nativeAsset.mimeType ?? (nativeAsset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileSize: nativeAsset.fileSize,
      duration: nativeAsset.duration ?? 0,
      width: 1280,
      height: 720,
    } as ImagePicker.ImagePickerAsset;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsEditing: false,
    quality: 0.8,
    videoMaxDuration: 30,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function uploadEvidenceAsset(
  asset: ImagePicker.ImagePickerAsset,
  description: string,
  tipoEvidencia: string = 'EVIDENCIA_BASICA',
  coords?: { latitude: number; longitude: number },
  idAsignacion?: number
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
  if (idAsignacion != null) {
    formData.append('id_asignacion', String(idAsignacion));
  }

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
  const asset = await pickPhotoAsset();
  if (!asset) return null;
  return uploadEvidenceAsset(asset, description, tipoEvidencia, coords);
}

export async function captureAndUploadEvidence(
  description: string,
  tipoEvidencia: string = 'EVIDENCIA_BASICA',
  coords?: { latitude: number; longitude: number }
) {
  const asset = await capturePhotoAsset();
  if (!asset) return null;
  return uploadEvidenceAsset(asset, description, tipoEvidencia, coords);
}

export async function listEvidence() {
  const { data } = await apiClient.get('/evidence/list');
  return data.evidencias;
}
