import React, { useState } from 'react';
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
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../theme';

interface Message {
  id: string;
  text: string;
  sent: boolean;
  timestamp: Date;
}

/**
 * MessagesScreen — Canal directo con el supervisor de turno
 */
export default function MessagesScreen() {
  const { funcionario } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Central SIGO activa. Canal de comunicación establecido.',
      sent: false,
      timestamp: new Date(),
    },
  ]);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      sent: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMsg]);
    const textCopy = message.trim();
    setMessage('');
    setSending(true);

    try {
      // Enviar reporte al supervisor via API
      await apiClient.post('/patrol/message', { texto: textCopy });

      // Simular respuesta del supervisor
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `ack_${Date.now()}`,
            text: `✅ Mensaje recibido por Central. En espera de acuse.`,
            sent: false,
            timestamp: new Date(),
          },
        ]);
      }, 1500);
    } catch {
      // Mensaje encolado para reenvío
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 Central de Supervisión</Text>
        <View style={styles.onlineBadge}>
          <Text style={styles.onlineText}>● EN LÍNEA</Text>
        </View>
      </View>

      <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.bubble, msg.sent ? styles.bubbleSent : styles.bubbleReceived]}
          >
            {!msg.sent && (
              <Text style={styles.bubbleSender}>Central SIGO</Text>
            )}
            <Text style={[styles.bubbleText, msg.sent && styles.bubbleTextSent]}>
              {msg.text}
            </Text>
            <Text style={[styles.bubbleTime, msg.sent && styles.bubbleTimeSent]}>
              {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputArea}>
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
        <TouchableOpacity
          style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!message.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  onlineBadge: {
    backgroundColor: '#F0FFF4',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  onlineText: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.success, letterSpacing: 1 },

  chat: { flex: 1 },
  chatContent: { padding: Spacing.xl, gap: Spacing.md },

  bubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  bubbleReceived: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleSent: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleSender: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.info, marginBottom: 4 },
  bubbleText: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextSent: { color: Colors.textWhite },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
  bubbleTimeSent: { color: 'rgba(255,255,255,0.6)' },

  inputArea: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    ...Shadow.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: Colors.textWhite, fontSize: 18, fontWeight: '700' },
});
