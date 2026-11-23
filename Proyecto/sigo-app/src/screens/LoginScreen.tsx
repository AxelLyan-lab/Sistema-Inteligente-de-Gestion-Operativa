import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { verifyCredentials, validateCompanion, getVehicles } from '../services/auth.service';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import Icon, { IconName } from '../components/Icon';
import { TipoTransporte, Funcionario, calcularUveMovil } from '../types';

// ─── Opciones de tipo de patrullaje con configuración U.V.E. ────────────────
const TRANSPORT_OPTIONS: { label: string; value: TipoTransporte; icon: IconName; desc: string; uveBadge: string }[] = [
  { label: 'Radio Patrulla', value: 'PATRULLA', icon: 'auto', desc: 'RPD (2) / RPT (3)', uveBadge: '0.80 - 1.00 U.V.E.' },
  { label: 'Furgón Z', value: 'FURGON_Z', icon: 'furgon', desc: 'Mín. 2 / Máx. 3 trip.', uveBadge: '1.00 U.V.E.' },
  { label: 'Moto TT', value: 'MOTO', icon: 'moto', desc: 'Líder individual', uveBadge: '0.45 U.V.E.' },
  { label: 'Bicicleta', value: 'BICICLETA', icon: 'bici', desc: 'Pareja servicio', uveBadge: '0.30 U.V.E.' },
  { label: 'Infantería', value: 'INFANTERIA', icon: 'peaton', desc: 'A pie / Pareja', uveBadge: '0.20 U.V.E.' },
];

const DEFAULT_UNITS: Partial<Record<TipoTransporte, string[]>> = {
  PATRULLA: ['RP-201', 'RP-402'],
  FURGON_Z: ['FZ-101', 'FZ-102'],
  MOTO: ['MT-105', 'MT-108'],
  BICICLETA: ['BC-021'],
  INFANTERIA: ['INF-01'],
};

interface CompanionItem {
  rut: string;
  nombre_completo: string;
  grado_cargo?: string;
}

/**
 * LoginScreen — Flujo en 2 pasos:
 * Paso 1: Autenticación con RUT y Clave
 * Paso 2: Selección de medio de transporte, unidad y dotación de compañeros
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const { Colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Paso actual (1: Credenciales, 2: Configuración de Turno)
  const [step, setStep] = useState<1 | 2>(1);

  // Paso 1: Credenciales
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [verifiedOfficer, setVerifiedOfficer] = useState<Funcionario | null>(null);

  // Paso 2: Configuración de turno
  const [tipoTransporte, setTipoTransporte] = useState<TipoTransporte>('PATRULLA');
  const [identificadorUnidad, setIdentificadorUnidad] = useState('RP-201');
  const [companionRut, setCompanionRut] = useState('');
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [validatingCompanion, setValidatingCompanion] = useState(false);
  const [unitSuggestions, setUnitSuggestions] = useState<string[]>(DEFAULT_UNITS['PATRULLA']);

  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Cargar vehículos al cambiar medio de transporte
  useEffect(() => {
    const units = DEFAULT_UNITS[tipoTransporte] ?? [];
    setUnitSuggestions(units);
    if (units.length > 0) {
      setIdentificadorUnidad(units[0]);
    }
    // Si es Moto Todo Terreno (MTT), opera estrictamente con 1 funcionario individual
    if (tipoTransporte === 'MOTO') {
      setCompanions([]);
      setCompanionRut('');
    } else if ((tipoTransporte === 'BICICLETA' || tipoTransporte === 'INFANTERIA') && companions.length > 1) {
      setCompanions(prev => prev.slice(0, 1));
    }
  }, [tipoTransporte]);

  const maxCompanionsAllowed =
    tipoTransporte === 'PATRULLA' || tipoTransporte === 'FURGON_Z'
      ? 2
      : tipoTransporte === 'BICICLETA' || tipoTransporte === 'INFANTERIA'
        ? 1
        : 0;

  // Regla obligatoria Furgón Z: mínimo 2 funcionarios (Líder + al menos 1 acompañante)
  const isFurgonZMissingCompanion = tipoTransporte === 'FURGON_Z' && companions.length < 1;
  const previewUve = calcularUveMovil(tipoTransporte, companions.length, identificadorUnidad);

  const shakeForm = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  // ── PASO 1: Validar identidad institucional ───────────────────────────────
  const handleVerifyStep1 = async () => {
    if (!rut.trim() || !password) {
      shakeForm();
      Alert.alert('Campos Requeridos', 'Por favor ingresa tu RUT y clave para identificarte.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyCredentials(rut.trim(), password);
      setVerifiedOfficer(res.funcionario);
      setStep(2);
    } catch (err: any) {
      shakeForm();
      if (!err?.response) {
        Alert.alert(
          'Sin conexión con el servidor',
          'No se pudo contactar al servidor S.I.G.O. Revisa tu conexión a internet e inténtalo nuevamente.'
        );
      } else {
        Alert.alert(
          'Error de Identificación',
          err.response.data?.error ?? 'No se pudo verificar la identidad. Comprueba tu RUT y clave.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ── PASO 2: Validar y agregar compañero libre ─────────────────────────────
  const handleAddCompanion = async () => {
    if (maxCompanionsAllowed === 0) {
      Alert.alert('Medio Individual', 'Moto Todo Terreno (MTT) opera con 1 solo funcionario (Líder individual - 0.45 U.V.E.).');
      return;
    }

    if (companions.length >= maxCompanionsAllowed) {
      Alert.alert(
        'Límite de Dotación',
        `Este medio admite un máximo de ${maxCompanionsAllowed} acompañante(s) (dotación total: ${maxCompanionsAllowed + 1} funcionarios).`
      );
      return;
    }

    const compRut = companionRut.trim();
    if (!compRut) {
      Alert.alert('Atención', 'Ingresa el RUT del compañero que deseas sumar al turno.');
      return;
    }

    if (compRut === rut.trim()) {
      Alert.alert('Acompañante Inválido', 'No puedes agregarte a ti mismo como acompañante.');
      return;
    }

    if (companions.some(c => c.rut === compRut)) {
      Alert.alert('Ya en dotación', 'Este funcionario ya fue agregado a este turno.');
      return;
    }

    setValidatingCompanion(true);
    try {
      const res = await validateCompanion(compRut, rut.trim());
      setCompanions(prev => [
        ...prev,
        {
          rut: res.funcionario.rut_usuario ?? res.funcionario.rut ?? compRut,
          nombre_completo: res.funcionario.nombre_completo,
          grado_cargo: res.funcionario.grado_cargo,
        },
      ]);
      setCompanionRut('');
      Alert.alert('Compañero Asignado', `${res.funcionario.nombre_completo} ha sido incorporado a la dotación.`);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ??
        'No se pudo validar al compañero. Asegúrate de que no tenga otra sesión activa.';
      Alert.alert('No Disponible', message);
    } finally {
      setValidatingCompanion(false);
    }
  };

  const handleRemoveCompanion = (rutToRemove: string) => {
    setCompanions(prev => prev.filter(c => c.rut !== rutToRemove));
  };

  // ── PASO 2: Iniciar despliegue en terreno ─────────────────────────────────
  const handleDeploy = async () => {
    if (!identificadorUnidad.trim()) {
      Alert.alert('Unidad Requerida', 'Indica el identificador de la unidad (ej: RP-402, FZ-101, MT-105).');
      return;
    }

    if (isFurgonZMissingCompanion) {
      shakeForm();
      Alert.alert(
        'Dotación Mínima Furgón Z',
        'El Furgón Z (FZ) requiere obligatoriamente al menos 1 acompañante registrado (mínimo 2 tripulantes: Líder + 1 acompañante).'
      );
      return;
    }

    setLoading(true);
    try {
      await login({
        rut: rut.trim(),
        password,
        tipo_transporte: tipoTransporte,
        identificador_unidad: identificadorUnidad.trim().toUpperCase(),
        tripulacion: companions.map(c => c.rut),
      });
    } catch (err: any) {
      shakeForm();
      const message = !err?.response
        ? 'No se pudo contactar al servidor S.I.G.O. Revisa tu conexión a internet.'
        : err.response.data?.error ?? 'Error al iniciar el turno operativo. Intenta nuevamente.';
      Alert.alert('Error de Despliegue', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header Táctico ────────────────────────────────── */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo-carabineros.webp')}
              style={{ width: 96, height: 96, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text style={styles.title}>S.I.G.O.</Text>
            <Text style={styles.subtitle}>Sistema Inteligente de Gestión Operativa</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {step === 1 ? 'PASO 1 · IDENTIFICACIÓN' : 'PASO 2 · ASIGNACIÓN DE TURNO'}
              </Text>
            </View>
          </View>

          {/* ── Tarjeta de Formulario ─────────────────────────── */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
            {step === 1 ? (
              // ─────────────────────────────────────────────────────────────
              // VISTA PASO 1: Identificación con RUT y Clave
              // ─────────────────────────────────────────────────────────────
              <>
                <Text style={styles.stepTitle}>Identificación Institucional</Text>
                <Text style={styles.stepSubtitle}>
                  Ingresa tus credenciales de funcionario para habilitar la asignación de turno.
                </Text>

                {/* RUT */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="id" size={16} color={Colors.textSecondary} />
                    <Text style={styles.fieldLabel}>RUT de funcionario</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 15678912-3"
                    placeholderTextColor={Colors.textMuted}
                    value={rut}
                    onChangeText={setRut}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                {/* Clave / PIN */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="candado" size={16} color={Colors.textSecondary} />
                    <Text style={styles.fieldLabel}>Contraseña / PIN</Text>
                  </View>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPin}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPin(p => !p)}
                    >
                      <Icon name={showPin ? 'ojoOculto' : 'ojo'} size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Botón Continuar */}
                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleVerifyStep1}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <>
                      <Text style={styles.loginBtnText}>VERIFICAR IDENTIDAD</Text>
                      <Icon name="flecha" size={18} color={Colors.onPrimary} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              // ─────────────────────────────────────────────────────────────
              // VISTA PASO 2: Selección de Transporte, Unidad y Dotación
              // ─────────────────────────────────────────────────────────────
              <>
                {/* Banner de funcionario verificado */}
                <View style={styles.officerCard}>
                  <View style={styles.officerAvatar}>
                    <Text style={styles.officerAvatarText}>
                      {verifiedOfficer?.nombre_completo?.charAt(0) ?? 'F'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.officerTitle}>
                      {verifiedOfficer?.grado_cargo ?? 'Funcionario'}
                    </Text>
                    <Text style={styles.officerNameText}>
                      {verifiedOfficer?.nombre_completo}
                    </Text>
                    <Text style={styles.officerRutText}>RUT: {verifiedOfficer?.rut_usuario}</Text>
                  </View>
                </View>

                <Text style={styles.sectionHeader}>1. Medio de Transporte y Capacidad U.V.E.</Text>
                <View style={styles.transportGrid}>
                  {TRANSPORT_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.transportCard,
                        tipoTransporte === opt.value && styles.transportCardActive,
                      ]}
                      onPress={() => setTipoTransporte(opt.value)}
                      disabled={loading}
                    >
                      <Icon
                        name={opt.icon}
                        size={26}
                        color={tipoTransporte === opt.value ? Colors.primary : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.transportLabel,
                          tipoTransporte === opt.value && styles.transportLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.transportDesc}>{opt.desc}</Text>
                      <View
                        style={[
                          styles.uvePill,
                          tipoTransporte === opt.value && styles.uvePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.uvePillText,
                            tipoTransporte === opt.value && styles.uvePillTextActive,
                          ]}
                        >
                          {opt.uveBadge}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview dinámico de U.V.E. calculada */}
                <View style={styles.uvePreviewBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uvePreviewLabel}>
                      CARGA OPERATIVA ASIGNADA ({previewUve.tipoMedio})
                    </Text>
                    <Text style={styles.uvePreviewSub}>
                      {previewUve.nombreMedio} · Dotación: {previewUve.dotacionTotal} func.
                    </Text>
                  </View>
                  <View style={styles.uvePreviewValueBox}>
                    <Text style={styles.uvePreviewValueText}>
                      {previewUve.valorUve.toFixed(2)} U.V.E.
                    </Text>
                  </View>
                </View>

                {/* Identificador de unidad */}
                <View style={[styles.fieldGroup, { marginTop: Spacing.lg }]}>
                  <View style={styles.labelRow}>
                    <Icon name="auto" size={16} color={Colors.textSecondary} />
                    <Text style={styles.fieldLabel}>Identificador de unidad asignada</Text>
                  </View>
                  {/* Sugerencias rápidas */}
                  <View style={styles.suggestionRow}>
                    {unitSuggestions.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.suggestionChip,
                          identificadorUnidad === u && styles.suggestionChipActive,
                        ]}
                        onPress={() => setIdentificadorUnidad(u)}
                      >
                        <Text
                          style={[
                            styles.suggestionText,
                            identificadorUnidad === u && styles.suggestionTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[styles.input, { marginTop: Spacing.xs }]}
                    placeholder="Ej: RP-402, MT-105"
                    placeholderTextColor={Colors.textMuted}
                    value={identificadorUnidad}
                    onChangeText={setIdentificadorUnidad}
                    autoCapitalize="characters"
                    editable={!loading}
                  />
                </View>

                {/* Dotación: Agregar compañero libre */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="grupo" size={16} color={Colors.textSecondary} />
                    <Text style={styles.fieldLabel}>
                      Dotación de Turno{' '}
                      {maxCompanionsAllowed > 0
                        ? `(${companions.length}/${maxCompanionsAllowed} acompañantes)`
                        : '(Individual)'}
                    </Text>
                  </View>

                  {maxCompanionsAllowed === 0 ? (
                    <View style={[styles.companionList, { backgroundColor: Colors.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border }]}>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 18 }}>
                        ℹ️ <Text style={{ fontWeight: 'bold' }}>Moto Todo Terreno (MTT):</Text> Opera con 1 funcionario individual (0.45 U.V.E.).
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.fieldHelp}>
                        {tipoTransporte === 'FURGON_Z'
                          ? 'Furgón Z (FZ) exige un MÍNIMO OBLIGATORIO de 1 acompañante (2 tripulantes) y permite hasta 2 acompañantes (3 tripulantes = 1.00 U.V.E.).'
                          : tipoTransporte === 'PATRULLA'
                            ? 'Radio Patrulla: 1 acompañante = RPD (0.80 U.V.E.) · 2 acompañantes = RPT (1.00 U.V.E.).'
                            : 'Pareja de servicio: permite registrar 1 acompañante.'}
                      </Text>

                      {isFurgonZMissingCompanion && (
                        <View style={styles.furgonWarningBox}>
                          <Icon name="alerta" size={16} color={Colors.danger} />
                          <Text style={styles.furgonWarningText}>
                            Requisito Furgón Z: Registra al menos 1 acompañante para habilitar el inicio de turno (mínimo 2 funcionarios).
                          </Text>
                        </View>
                      )}

                      {companions.length < maxCompanionsAllowed && (
                        <View style={styles.companionInputRow}>
                          <TextInput
                            style={[styles.input, styles.companionInput]}
                            placeholder="RUT Compañero (Ej: 18345672-K)"
                            placeholderTextColor={Colors.textMuted}
                            value={companionRut}
                            onChangeText={setCompanionRut}
                            autoCapitalize="none"
                            editable={!validatingCompanion && !loading}
                          />
                          <TouchableOpacity
                            style={[
                              styles.addCompanionBtn,
                              validatingCompanion && styles.loginBtnDisabled,
                            ]}
                            onPress={handleAddCompanion}
                            disabled={validatingCompanion || loading}
                          >
                            {validatingCompanion ? (
                              <ActivityIndicator color={Colors.textWhite} size="small" />
                            ) : (
                              <Text style={styles.addCompanionBtnText}>Sumar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {companions.length >= maxCompanionsAllowed && (
                        <View style={{ paddingVertical: 6 }}>
                          <Text style={{ fontSize: 11, color: Colors.warning, fontWeight: '600' }}>
                            ✓ Capacidad máxima alcanzada ({maxCompanionsAllowed} acompañante(s) + 1 líder = {maxCompanionsAllowed + 1} funcionarios).
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Lista de compañeros sumados */}
                  {companions.length > 0 && (
                    <View style={styles.companionList}>
                      {companions.map(comp => (
                        <View key={comp.rut} style={styles.companionChip}>
                          <Icon name="perfil" size={18} color={Colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.companionChipName}>
                              {comp.grado_cargo ? `${comp.grado_cargo} ` : ''}{comp.nombre_completo}
                            </Text>
                            <Text style={styles.companionChipRut}>{comp.rut}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeCompanionBtn}
                            onPress={() => handleRemoveCompanion(comp.rut)}
                          >
                            <Icon name="cerrar" size={16} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Botón de despliegue (deshabilitado si es Furgón Z sin al menos 1 acompañante) */}
                <TouchableOpacity
                  style={[
                    styles.deployBtn,
                    (loading || isFurgonZMissingCompanion) && styles.loginBtnDisabled,
                  ]}
                  onPress={handleDeploy}
                  disabled={loading || isFurgonZMissingCompanion}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <>
                      <Icon name="flecha" size={18} color={Colors.onPrimary} />
                      <Text style={styles.loginBtnText}>
                        {isFurgonZMissingCompanion
                          ? 'AGREGA 1 ACOMPAÑANTE (FURGÓN Z)'
                          : `INICIAR PATRULLAJE (${previewUve.valorUve.toFixed(2)} U.V.E.)`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Volver a cambiar funcionario */}
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep(1)}
                  disabled={loading}
                >
                  <Text style={styles.backBtnText}>Cambiar funcionario</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.footerNote}>
              Acceso reservado exclusivamente a personal operativo en terreno S.I.G.O.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDark },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xxl },

  // ── Header ───────────────────────────────────────────────
  header: {
    backgroundColor: Colors.backgroundDark,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: Colors.textWhite,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: Fonts.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.xs,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  badge: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  badgeText: {
    color: Colors.textWhite,
    fontSize: Fonts.sizes.xs,
    fontWeight: '500',
    letterSpacing: 1.5,
  },

  // ── Formulario ───────────────────────────────────────────
  formCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingTop: Spacing.xl,
    flex: 1,
  },
  stepTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  fieldHelp: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  input: {
    height: 52,
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontWeight: '400',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    width: 52,
    height: 52,
    backgroundColor: Colors.inputBackground,
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: { fontSize: 20 },

  // ── Officer Card ─────────────────────────────────────────
  officerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  officerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  officerAvatarText: {
    color: Colors.onPrimary,
    fontSize: 20,
    fontWeight: '500',
  },
  officerTitle: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  officerNameText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  officerRutText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },

  // ── Tipo de transporte ────────────────────────────────────
  transportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  transportCard: {
    width: '48%',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transportCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  transportLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    marginTop: 6,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  transportLabelActive: { color: Colors.primary },
  transportDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  uvePill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uvePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  uvePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  uvePillTextActive: {
    color: Colors.onPrimary,
  },
  uvePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  uvePreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  uvePreviewSub: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  uvePreviewValueBox: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  uvePreviewValueText: {
    color: Colors.onPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
  },
  furgonWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  furgonWarningText: {
    flex: 1,
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '600',
    lineHeight: 16,
  },

  // ── Sugerencias de unidad ────────────────────────────────
  suggestionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  suggestionText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  suggestionTextActive: {
    color: Colors.onPrimary,
  },

  // ── Acompañante ──────────────────────────────────────────
  companionInputRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  companionInput: {
    flex: 1,
  },
  addCompanionBtn: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCompanionBtnText: {
    color: Colors.onPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
  },
  companionList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  companionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  companionChipIcon: { fontSize: 18 },
  companionChipName: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  companionChipRut: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  removeCompanionBtn: {
    padding: Spacing.xs,
  },
  removeCompanionText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Botones Principales ──────────────────────────────────
  loginBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  deployBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: {
    color: Colors.onPrimary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  backBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  backBtnText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  footerNote: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: Spacing.xl,
    letterSpacing: 0.2,
  },
});
