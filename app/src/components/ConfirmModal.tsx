import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

export const DANGER_GRADIENT = ['#DC2626', '#F43F5E'] as const;
export const BRAND_GRADIENT = ['#7C3AED', '#C026D3'] as const;

interface ConfirmModalProps {
  visible: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  gradient?: readonly [string, string];
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Important / destructive action confirmation — the same centered card as NearbyU's
 * ConfirmModal (gradient icon circle, title, message, Cancel + gradient confirm button).
 * Used instead of native Alert dialogs everywhere in the app.
 */
export function ConfirmModal({
  visible,
  icon,
  gradient = DANGER_GRADIENT,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={loading ? undefined : onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
            <Ionicons name={icon} size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>{cancelLabel ?? t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm} disabled={loading}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGradient}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {confirmLabel}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24, alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { ...typography.h2, textAlign: 'center', marginBottom: 8 },
  message: { ...typography.body, textAlign: 'center', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelButton: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, includeFontPadding: false },
  confirmButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, paddingHorizontal: 8 },
  confirmText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff', includeFontPadding: false },
});
