import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMessages, sendMessage, sendAudioMessage, MensajeChat } from '../services/patrol.service';
import { playMessageSound } from '../services/sound.service';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
} from 'expo-audio';
import { useAuth } from '../context/AuthContext';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { messageBadgeStore } from '../services/messageBadge.service';
import Icon from '../components/Icon';

interface Message {
  id: string;
  text: string;
  sent: boolean;
  timestamp: Date;
}

/**
 * MessagesScreen — Canal directo con el supervisor de turno
 * Soporta texto y notas de voz tácticas con protección total contra fallos de módulos en Expo Go.
 */
export default function MessagesScreen() {
  const { funcionario } = useAuth();
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Estados para grabación y reproducción de notas de voz
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordTimerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const toUi = (m: MensajeChat): Message => ({
    id: String(m.id_mensaje),
    text: m.texto,
    sent: m.remitente === 'FUNCIONARIO',
    timestamp: new Date(m.fecha),
  });

  const lastMsgIdRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMessages();
      if (data.length > 0) {
        const last = data[data.length - 1];
        if (lastMsgIdRef.current !== null && last.id_mensaje > lastMsgIdRef.current && last.remitente === 'SUPERVISOR') {
          playMessageSound();
        }
        lastMsgIdRef.current = last.id_mensaje;
      }
      setMessages(prev => {
        const next = data.map(toUi);
        const pending = prev.filter(p => p.id.startsWith('tmp_'));
        return next.length === prev.length - pending.length ? prev : [...next, ...pending];
      });
    } catch {
      // Sin conexión
    }
  }, []);

  // Sincronización periódica con la central
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // Al enfocar la pantalla de mensajes, limpiar el punto rojo de no leídos
  useFocusEffect(
    useCallback(() => {
      messageBadgeStore.setUnread(false);
    }, [])
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try { playerRef.current?.remove(); } catch {}
    };
  }, []);

  const handleSend = async () => {
    const textCopy = message.trim();
    if (!textCopy) return;

    const tmpId = `tmp_${Date.now()}`;
    setMessages(prev => [...prev, { id: tmpId, text: textCopy, sent: true, timestamp: new Date() }]);
    setMessage('');
    setSending(true);

    try {
      await sendMessage(textCopy);
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      await load();
    } catch {
      Alert.alert('Sin conexión', 'No se pudo enviar el mensaje a la central.');
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      setMessage(textCopy);
    } finally {
      setSending(false);
    }
  };

  // ── Grabación real de Notas de Voz ───────────────────────────────────────────
  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Micrófono', 'Debes permitir el acceso al micrófono para enviar notas de voz.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Micrófono', err?.message ?? 'No se pudo iniciar la grabación.');
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordSeconds(0);
    try { await recorder.stop(); } catch {}
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
  };

  const stopAndSendRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);

    const tmpId = `tmp_audio_${Date.now()}`;
    let recordedUri: string | null = null;

    try {
      await recorder.stop();
      recordedUri = recorder.uri ?? null;
    } catch {}
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}

    if (!recordedUri || recordSeconds < 1) {
      setRecordSeconds(0);
      Alert.alert('Nota de voz', 'La grabación es demasiado corta. Mantén el micrófono activo al menos 1 segundo.');
      return;
    }

    setSending(true);
    try {
      setMessages(prev => [
        ...prev,
        { id: tmpId, text: `[AUDIO] ${recordedUri}`, sent: true, timestamp: new Date() },
      ]);
      await sendAudioMessage(recordedUri);
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      await load();
    } catch (err: any) {
      Alert.alert('Transmisión', err?.response?.data?.error ?? err?.message ?? 'No se pudo enviar el audio.');
      setMessages(prev => prev.filter(m => m.id !== tmpId));
    } finally {
      setSending(false);
      setRecordSeconds(0);
    }
  };

  // ── Reproducción real de audio ───────────────────────────────────────────────
  const isAudio = (text: string) => text.startsWith('[AUDIO]');
  const getAudioUrl = (text: string) => text.replace('[AUDIO]', '').trim();

  const togglePlayAudio = async (msgId: string, text: string) => {
    // Detener reproducción actual
    try { playerRef.current?.remove(); } catch {}
    playerRef.current = null;

    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
      return;
    }

    const url = getAudioUrl(text);
    if (!/^(https?|file):\/\//i.test(url)) {
      Alert.alert('Audio', 'Este mensaje no contiene un audio reproducible.');
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: url });
      playerRef.current = player;
      setPlayingAudioId(msgId);
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) {
          setPlayingAudioId(prev => (prev === msgId ? null : prev));
        }
      });
      player.play();
    } catch (err: any) {
      setPlayingAudioId(null);
      Alert.alert('Audio', err?.message ?? 'No se pudo reproducir el audio.');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Central de supervisión</Text>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>EN LÍNEA</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.length === 0 && (
          <Text style={styles.empty}>Canal abierto con la central. Envía un mensaje o nota de voz para comenzar.</Text>
        )}
        {messages.map((msg) => {
          const hasAudio = isAudio(msg.text);
          const isPlaying = playingAudioId === msg.id;

          return (
            <View
              key={msg.id}
              style={[styles.bubble, msg.sent ? styles.bubbleSent : styles.bubbleReceived]}
            >
              {!msg.sent && <Text style={styles.bubbleSender}>Central SIGO</Text>}

              {hasAudio ? (
                <View style={styles.audioBubbleContainer}>
                  <TouchableOpacity
                    style={[styles.audioPlayBtn, msg.sent && styles.audioPlayBtnSent]}
                    onPress={() => togglePlayAudio(msg.id, msg.text)}
                  >
                    <Icon
                      name={isPlaying ? 'pausa' : 'play'}
                      size={18}
                      color={msg.sent ? Colors.primary : Colors.onPrimary}
                    />
                  </TouchableOpacity>

                  <View style={styles.audioInfo}>
                    <Text style={[styles.audioTitle, msg.sent && styles.bubbleTextSent]}>
                      {isPlaying ? 'Reproduciendo audio...' : 'Nota de voz táctica'}
                    </Text>
                    <Text style={[styles.audioSubtitle, msg.sent && styles.bubbleTextSent]}>
                      {isPlaying ? 'Pausar' : 'Toca para escuchar'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.bubbleText, msg.sent && styles.bubbleTextSent]}>
                  {msg.text}
                </Text>
              )}

              <Text style={[styles.bubbleTime, msg.sent && styles.bubbleTimeSent]}>
                {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Área de Entrada: Texto o Grabación de Voz */}
      <View style={styles.inputArea}>
        {isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recIndicator}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>Grabando audio ({formatSeconds(recordSeconds)})</Text>
            </View>

            <View style={styles.recActions}>
              <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelRecording}>
                <Icon name="cerrar" size={16} color={Colors.danger} />
                <Text style={styles.cancelRecText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sendRecBtn} onPress={stopAndSendRecording}>
                <Icon name="enviar" size={16} color={Colors.onPrimary} />
                <Text style={styles.sendRecText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un reporte o mensaje..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              editable={!sending}
            />

            {/* Botón de Micrófono para Nota de Voz */}
            {!message.trim() && (
              <TouchableOpacity
                style={styles.micBtn}
                onPress={startRecording}
                disabled={sending}
                activeOpacity={0.8}
              >
                <Icon name="microfono" size={20} color={Colors.onPrimary} />
              </TouchableOpacity>
            )}

            {/* Botón Enviar Texto */}
            {Boolean(message.trim()) && (
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Icon name="enviar" size={20} color={Colors.onPrimary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '600', color: Colors.textPrimary },
    onlineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: Colors.success,
    },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
    onlineText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.success, letterSpacing: 1 },

    chat: { flex: 1 },
    chatContent: { padding: Spacing.xl, gap: Spacing.md },
    empty: { textAlign: 'center', color: Colors.textMuted, fontSize: Fonts.sizes.sm, marginTop: Spacing.xl },

    bubble: { maxWidth: '80%', borderRadius: BorderRadius.lg, padding: Spacing.md },
    bubbleReceived: {
      backgroundColor: Colors.surface,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    bubbleSent: {
      backgroundColor: Colors.primary,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    bubbleSender: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
    bubbleText: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, lineHeight: 20 },
    bubbleTextSent: { color: Colors.onPrimary },
    bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
    bubbleTimeSent: { color: Colors.onPrimary, opacity: 0.65 },

    audioBubbleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minWidth: 160,
      paddingVertical: 2,
    },
    audioPlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioPlayBtnSent: {
      backgroundColor: Colors.onPrimary,
    },
    audioInfo: {
      flex: 1,
    },
    audioTitle: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    audioSubtitle: {
      fontSize: 10,
      color: Colors.textMuted,
      marginTop: 1,
    },

    inputArea: {
      padding: Spacing.md,
      backgroundColor: Colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'flex-end',
    },
    input: {
      flex: 1,
      backgroundColor: Colors.inputBackground,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: Fonts.sizes.sm,
      color: Colors.textPrimary,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },

    micBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#b45309', // Color ámbar/táctico para micrófono
      justifyContent: 'center',
      alignItems: 'center',
    },

    recordingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1.5,
      borderColor: Colors.danger,
    },
    recIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.danger,
    },
    recText: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '700',
      color: Colors.danger,
    },
    recActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    cancelRecBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.dangerLight,
    },
    cancelRecText: {
      fontSize: Fonts.sizes.xs,
      color: Colors.danger,
      fontWeight: '600',
    },
    sendRecBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary,
    },
    sendRecText: {
      fontSize: Fonts.sizes.xs,
      color: Colors.onPrimary,
      fontWeight: '700',
    },
  });
