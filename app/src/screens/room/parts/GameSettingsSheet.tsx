import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconButton, Row, T, Toggle } from '@/components/ui';
import { VoicePicker } from '@/components/VoicePicker';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { radius, spacing, useThemeColors } from '@/theme';
import type { RoomState } from '@/types/api';

const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function SettingToggle({
  icon,
  label,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Row style={styles.toggleRow}>
      <View style={[styles.toggleIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <T variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </T>
      <Toggle value={value} onValueChange={onChange} />
    </Row>
  );
}

/**
 * Game settings (gear in the game header). Host: calling speed for everyone. Everyone: prize
 * sounds, strike sound and vibration on this phone. Voices and ticket looks stay in Profile.
 */
export function GameSettingsSheet({
  visible,
  state,
  isHost,
  onClose,
}: {
  visible: boolean;
  state: RoomState;
  isHost: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const sounds = useSettingsStore((s) => s.sounds);
  const strikeSound = useSettingsStore((s) => s.strikeSound);
  const haptics = useSettingsStore((s) => s.haptics);
  const voice = useSettingsStore((s) => s.voice);
  const language = useSettingsStore((s) => s.language);
  const set = useSettingsStore((s) => s.set);
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
              <Ionicons name="settings-sharp" size={22} color={colors.primary} />
              <T variant="h2">{t('game.settings')}</T>
            </Row>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {isHost ? (
              <>
                <T variant="smallBold" muted style={styles.label}>
                  {t('game.speedTitle')}
                </T>
                <T variant="small" muted style={{ marginBottom: spacing.sm }}>
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
              </>
            ) : null}
            <T variant="smallBold" muted style={styles.label}>
              {t('game.thisPhone')}
            </T>
            <SettingToggle icon="musical-notes" label={t('profile.sounds')} value={sounds} onChange={(v) => set({ sounds: v })} />
            <SettingToggle
              icon="radio-button-on"
              label={t('profile.strikeSound')}
              value={strikeSound}
              onChange={(v) => set({ strikeSound: v })}
            />
            <SettingToggle icon="phone-portrait" label={t('profile.haptics')} value={haptics} onChange={(v) => set({ haptics: v })} />
            <T variant="smallBold" muted style={styles.label}>
              {t('game.callerVoice')}
            </T>
            <SettingToggle icon="volume-high" label={t('profile.voice')} value={voice} onChange={(v) => set({ voice: v })} />
            {voice ? <VoicePicker language={language} /> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.xl, padding: spacing.lg, maxHeight: '88%' },
  label: { marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  // Even spacing (no fixed column gap): 5 boxes always fit in a row, even on narrow / zoomed screens.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, justifyContent: 'space-between' },
  speed: { width: '18%', aspectRatio: 0.9, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { paddingVertical: 6, gap: spacing.md },
  toggleIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
