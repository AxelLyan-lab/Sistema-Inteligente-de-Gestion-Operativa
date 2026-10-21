import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../../theme';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import Icon, { IconName } from '../Icon';
import { TripulacionMiembro } from '../../types';
import { addCrewMember, removeCrewMember } from '../../services/patrol.service';

interface PatrolCrewListProps {
  crew: TripulacionMiembro[];
  conductorRut: string;
  conductorNombre: string;
  tipoTransporte: string;
  onCrewChange: () => void;
}

const getTransportIcon = (tipo: string): IconName => {
  switch (tipo) {
    case 'MOTO': return 'moto';
    case 'BICICLETA': return 'bici';
    case 'INFANTERIA': return 'peaton';
    default: return 'auto';
  }
};

/**
 * PatrolCrewList — Gestión de dotación y tripulación en tiempo real
 */
export default function PatrolCrewList({
  crew,
  conductorRut,
  conductorNombre,
  tipoTransporte,
  onCrewChange,
}: PatrolCrewListProps) {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [addRut, setAddRut] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState<string | null>(null);

  const handleAddMember = async () => {
    if (tipoTransporte !== 'PATRULLA') {
      Alert.alert('Medio Individual', 'Moto, Bicicleta e Infantería operan con 1 solo funcionario (sin acompañantes).');
      return;
    }

    if (crew.length >= 2) {
      Alert.alert('Límite de Dotación', 'Radio Patrulla admite un máximo de 2 acompañantes (total 3 funcionarios en turno).');
      return;
    }

    const rutLimpio = addRut.trim();
    if (!rutLimpio) {
      Alert.alert('Atención', 'Ingresa el RUT del funcionario a sumar al turno.');
      return;
    }
    if (rutLimpio === conductorRut) {
      Alert.alert('Acción Inválida', 'El conductor a cargo ya está en este turno.');
      return;
    }
    if (crew.some((m) => m.rut_acompanante === rutLimpio)) {
      Alert.alert('Ya Asignado', 'Este funcionario ya forma parte de esta dotación.');
      return;
    }

    setLoadingAdd(true);
    try {
      await addCrewMember(rutLimpio);
      setAddRut('');
      Alert.alert('Compañero Agregado', 'Funcionario incorporado al turno exitosamente.');
      onCrewChange();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'No se pudo agregar el acompañante.';
      Alert.alert('Error al Sumar', msg);
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleRemoveMember = (rut: string, nombre?: string) => {
    const label = nombre ?? rut;
    Alert.alert(
      'Desvincular Compañero',
      `¿Deseas eliminar a ${label} de la dotación de este patrullaje?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingRemove(rut);
            try {
              await removeCrewMember(rut);
              Alert.alert('Dotación Actualizada', `${label} ha sido removido del turno.`);
              onCrewChange();
            } catch (err: any) {
              const msg = err?.response?.data?.error ?? 'No se pudo eliminar al funcionario.';
              Alert.alert('Error al Eliminar', msg);
            } finally {
              setLoadingRemove(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado con tipo de transporte */}
      <View style={styles.header}>
        {(!tipoTransporte || tipoTransporte === 'PATRULLA') ? (
          <Image
            source={require('../../../assets/icono de patrulla.png')}
            style={{ width: 40, height: 80, resizeMode: 'contain' }}
          />
        ) : (
          <Icon name={getTransportIcon(tipoTransporte)} size={30} color={Colors.primary} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Dotación de turno</Text>
          <Text style={styles.headerSub}>
            Modo: {tipoTransporte.replace('_', ' ')} · {crew.length + 1} efectivo(s)
          </Text>
        </View>
      </View>

      {/* Funcionario a cargo */}
      <View style={styles.leadCard}>
        <View style={styles.memberAvatarLead}>
          <Text style={styles.avatarTextLead}>{conductorNombre.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{conductorNombre}</Text>
          <Text style={styles.memberRut}>{conductorRut}</Text>
        </View>
        <View style={styles.leadBadge}>
          <Text style={styles.leadBadgeText}>A CARGO</Text>
        </View>
      </View>

      {/* Acompañantes asignados */}
      {crew.length > 0 ? (
        <View style={styles.crewSection}>
          <Text style={styles.sectionSubtitle}>Compañero(s) en terreno ({crew.length})</Text>
          {crew.map((item) => {
            const nombre = item.usuarios?.nombre_completo ?? 'Funcionario Acompañante';
            const grado = item.usuarios?.grado_cargo ? `${item.usuarios.grado_cargo} · ` : '';
            const isDeleting = loadingRemove === item.rut_acompanante;

            return (
              <View key={item.rut_acompanante} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.avatarText}>{nombre.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{nombre}</Text>
                  <Text style={styles.memberRut}>{grado}RUT: {item.rut_acompanante}</Text>
                </View>

                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.danger} style={styles.deleteSpinner} />
                ) : (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleRemoveMember(item.rut_acompanante, item.usuarios?.nombre_completo)}
                    activeOpacity={0.75}
                  >
                    <Icon name="cerrar" size={14} color={Colors.danger} />
                    <Text style={styles.deleteBtnText}>Quitar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Icon name="escudo" size={22} color={Colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Patrullaje individual</Text>
            <Text style={styles.emptySub}>Sin compañero asignado actualmente.</Text>
          </View>
        </View>
      )}

      {/* Agregar miembro en caliente */}
      {tipoTransporte !== 'PATRULLA' ? (
        <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm }]}>
          <Text style={{ fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 18 }}>
            ℹ️ <Text style={{ fontWeight: '600' }}>Medio de transporte individual:</Text> Este móvil ({tipoTransporte.replace('_', ' ')}) opera con 1 solo funcionario (sin acompañantes).
          </Text>
        </View>
      ) : crew.length >= 2 ? (
        <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm }]}>
          <Text style={{ fontSize: Fonts.sizes.sm, color: Colors.warning, fontWeight: '600' }}>
            ✓ Dotación completa: Radio Patrulla tiene asignados los 2 acompañantes permitidos.
          </Text>
        </View>
      ) : (
        <View style={styles.addWrapper}>
          <Text style={styles.addLabel}>Sumar compañero durante el turno ({crew.length}/2)</Text>
          <View style={styles.addSection}>
            <TextInput
              style={styles.addInput}
              placeholder="RUT compañero (ej: 19876543-2)"
              placeholderTextColor={Colors.textMuted}
              value={addRut}
              onChangeText={setAddRut}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <TouchableOpacity
              style={[styles.addBtn, loadingAdd && styles.addBtnDisabled]}
              onPress={handleAddMember}
              disabled={loadingAdd}
            >
              {loadingAdd ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <Icon name="mas" size={16} color={Colors.onPrimary} />
                  <Text style={styles.addBtnText}>Sumar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { paddingVertical: Spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    headerTitle: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.textPrimary },
    headerSub: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

    leadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.primarySoft,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    leadBadge: {
      borderWidth: 1,
      borderColor: Colors.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    leadBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },

    memberAvatarLead: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarTextLead: { color: Colors.onPrimary, fontWeight: '600', fontSize: Fonts.sizes.md },

    crewSection: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
    sectionSubtitle: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.xs,
      marginLeft: Spacing.xs,
    },

    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.md },
    memberInfo: { flex: 1 },
    memberName: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
    memberRut: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: Spacing.xs + 2,
      paddingHorizontal: Spacing.sm + 2,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: Colors.danger,
    },
    deleteBtnText: { color: Colors.danger, fontWeight: '500', fontSize: Fonts.sizes.xs },
    deleteSpinner: { paddingHorizontal: Spacing.md },

    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    emptyTitle: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
    emptySub: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

    addWrapper: { marginTop: Spacing.sm },
    addLabel: { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.textSecondary, marginBottom: 6, marginLeft: 2 },
    addSection: { flexDirection: 'row', gap: Spacing.sm },
    addInput: {
      flex: 1,
      height: 46,
      backgroundColor: Colors.inputBackground,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      fontSize: Fonts.sizes.sm,
      color: Colors.textPrimary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    addBtn: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: Spacing.md,
      height: 46,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { color: Colors.onPrimary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  });
