import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconButton, Row, T } from '@/components/ui';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { radius, spacing, useThemeColors } from '@/theme';
import type { RoomState } from '@/types/api';

const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Host-only game settings: calling speed for everyone. Pause/play is the floating button on
 * the game screen; voice, sounds and ticket colours live only in Profile.
 */
export function GameSettingsSheet({ visible, state, onClose }: { visible: boolean; state: RoomState; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const current = state.room.callIntervalSeconds;
  const speed = useMutation({
    mutationFn: (s: number) => roomService.setSpeed(state.room.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(state.room.id) }),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <Ionicons name="speedometer" size={22} color={colors.primary} />
              <T variant="h2">{t('game.speedTitle')}</T>
            </Row>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <T variant="small" muted style={{ marginBottom: spacing.md }}>
            {t('game.speedForAll')}
          </T>
          <View style={styles.grid}>
            {SPEEDS.map((s) => {
              const active = current === s;
              return (
                <Pressable
                  key={s}
                  disabled={speed.isPending}
                  onPress={() => speed.mutate(s)}
                  style={({ pressed }) => [
                    styles.speed,
                    { backgroundColor: active ? colors.primary : colors.surfaceAlt, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <T variant="h2" color={active ? '#fff' : colors.text}>
                    {s}
                  </T>
                  <T variant="tiny" color={active ? 'rgba(255,255,255,0.85)' : colors.textMuted}>
                    {t('game.secShort')}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  speed: { width: '18%', aspectRatio: 0.9, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
