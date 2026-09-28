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
} from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../../theme';
import { TripulacionMiembro } from '../../types';
import { addCrewMember, removeCrewMember } from '../../services/patrol.service';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard } from 'react-native';

interface PatrolCrewListProps {
  crew: TripulacionMiembro[];
  conductorRut: string;
  conductorNombre: string;
  tipoTransporte: string;
  onCrewChange: () => void;
}

const getTransportEmoji = (tipo: string) => {
  switch (tipo) {
    case 'MOTO': return '🏍️';
    case 'BICICLETA': return '🚲';
    case 'INFANTERIA': return '👮';
    default: return '🚓';
  }
};

/**
 * PatrolCrewList — Gestión táctica de dotación y tripulación en tiempo real
 */
export default function PatrolCrewList({
  crew,
  conductorRut,
  conductorNombre,
  tipoTransporte,
  onCrewChange,
}: PatrolCrewListProps) {
  const [addRut, setAddRut] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState<string | null>(null);

  const handleAddMember = async () => {
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
          <Text style={styles.transportIconEmoji}>{getTransportEmoji(tipoTransporte)}</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Dotación de Turno</Text>
          <Text style={styles.headerSub}>
            Modo: {tipoTransporte.replace('_', ' ')} • {crew.length + 1} Efectivo(s)
          </Text>
        </View>
      </View>

      {/* Funcionario a cargo (Conductor / Líder) */}
      <View style={styles.leadCard}>
        <View style={styles.leadBadge}>
          <Text style={styles.leadBadgeText}>LÍDER / A CARGO</Text>
        </View>
        <View style={styles.memberAvatarLead}>
          <Text style={styles.avatarTextLead}>{conductorNombre.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{conductorNombre}</Text>
          <Text style={styles.memberRut}>{conductorRut}</Text>
        </View>
      </View>

      {/* Acompañantes asignados */}
      {crew.length > 0 ? (
        <View style={styles.crewSection}>
          <Text style={styles.sectionSubtitle}>Compañero(s) en Terreno ({crew.length})</Text>
          {crew.map((item) => {
            const nombre = item.usuarios?.nombre_completo ?? 'Funcionario Acompañante';
            const grado = item.usuarios?.grado_cargo ? `${item.usuarios.grado_cargo} • ` : '';
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

                {/* Botón de eliminación destacado */}
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.danger} style={styles.deleteSpinner} />
                ) : (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleRemoveMember(item.rut_acompanante, item.usuarios?.nombre_completo)}
                    activeOpacity={0.75}
                  >
                    <Feather name="trash-2" size={14} color={Colors.danger} style={{ marginRight: 4 }} />
                    <Text style={styles.deleteBtnText}>Eliminar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Feather name="shield" size={24} color={Colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Patrullaje individual</Text>
            <Text style={styles.emptySub}>Sin compañero asignado actualmente.</Text>
          </View>
        </View>
      )}

      {/* Agregar miembro en caliente */}
      <View style={styles.addWrapper}>
        <Text style={styles.addLabel}>Sumar compañero durante el turno:</Text>
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
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <Text style={styles.addBtnText}>+ Sumar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  transportIconEmoji: { fontSize: 32 },
  headerTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  leadBadge: {
    backgroundColor: Colors.info,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.md,
  },
  leadBadgeText: { color: Colors.textWhite, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  memberAvatarLead: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLead: { color: Colors.textWhite, fontWeight: '800', fontSize: Fonts.sizes.md },

  crewSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.textWhite, fontWeight: '700', fontSize: Fonts.sizes.md },
  memberInfo: { flex: 1 },
  memberName: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary },
  memberRut: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: Fonts.sizes.xs },
  deleteSpinner: { paddingHorizontal: Spacing.md },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
  emptySub: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  addWrapper: {
    marginTop: Spacing.sm,
  },
  addLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  addSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
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
    paddingHorizontal: Spacing.md,
    height: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: Colors.textWhite, fontSize: Fonts.sizes.sm, fontWeight: '700' },
});
