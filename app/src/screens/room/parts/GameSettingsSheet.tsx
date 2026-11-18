import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VoicePicker } from '@/components/VoicePicker';
import { TicketStylePicker } from '@/components/TicketStylePicker';
import { Chip, IconButton, Row, T, Toggle } from '@/components/ui';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { radius, spacing, useThemeColors } from '@/theme';
import type { RoomState } from '@/types/api';

const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Settings during a live game. Host: change the speed for everyone (pause/play is the
 * floating button on the game screen). Everyone: voice, sounds and ticket colours.
 */
export function GameSettingsSheet({ visible, state, isHost, onClose }: { visible: boolean; state: RoomState; isHost: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const voice = useSettingsStore((s) => s.voice);
  const sounds = useSettingsStore((s) => s.sounds);
  const language = useSettingsStore((s) => s.language);
  const setSettings = useSettingsStore((s) => s.set);
  const refresh = () => qc.invalidateQueries({ queryKey: roomKey(state.room.id) });
  const onError = (err: unknown) => showToast({ variant: 'error', title: errorMessage(err) });

  const speed = useMutation({ mutationFn: (s: number) => roomService.setSpeed(state.room.id, s), onSuccess: refresh, onError });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{t('game.settings')}</T>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {isHost ? (
              <>
                <T variant="smallBold" muted style={styles.label}>
                  {t('game.hostControls')}
                </T>
                <T variant="small" muted style={{ marginBottom: spacing.sm }}>
                  {t('game.speedForAll')}
                </T>
                <View style={styles.wrap}>
                  {SPEEDS.map((s) => (
                    <Chip key={s} label={t('common.seconds', { count: s })} active={state.room.callIntervalSeconds === s} onPress={() => speed.mutate(s)} />
                  ))}
                </View>
              </>
            ) : null}

            <T variant="smallBold" muted style={styles.label}>
              {t('game.myVoice')}
            </T>
            <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <T variant="bodyMedium">{t('profile.voice')}</T>
              <Toggle value={voice} onValueChange={(v) => setSettings({ voice: v })} />
            </Row>
            {voice ? <VoicePicker language={language} /> : null}
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('profile.sounds')}</T>
                <T variant="tiny" muted>
                  {t('profile.soundsDesc')}
                </T>
              </View>
              <Toggle value={sounds} onValueChange={(v) => setSettings({ sounds: v })} />
            </Row>

            <T variant="smallBold" muted style={styles.label}>
              {t('ticketStyle.title')}
            </T>
            <TicketStylePicker preview={false} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, maxHeight: '85%' },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.sm },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
