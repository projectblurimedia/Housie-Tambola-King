import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconButton, Row, T, Toggle } from '@/components/ui';
import { VoicePicker } from '@/components/VoicePicker';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { CallLanguage, useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { RoomState } from '@/types/api';

const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LANGS: { key: 'en' | 'te'; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'te', label: 'తెలుగు' },
];

/** One section: gradient icon + title (+ a short note), then its controls. */
function Section({
  icon,
  tint,
  title,
  note,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: [string, string];
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Row gap={spacing.sm} style={{ marginBottom: spacing.sm }}>
        <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionIcon}>
          <Ionicons name={icon} size={17} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          {note ? (
            <T variant="tiny" muted>
              {note}
            </T>
          ) : null}
        </View>
      </Row>
      {children}
    </View>
  );
}

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
      <Ionicons name={icon} size={18} color={colors.primary} />
      <T variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </T>
      <Toggle value={value} onValueChange={onChange} />
    </Row>
  );
}

/**
 * Game settings (gear in the game header): calling speed for everyone (host), the caller
 * voice (on/off, English or Telugu, which voice) and this phone's sounds and vibration.
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
  const appLanguage = useSettingsStore((s) => s.language);
  const callLanguage = useSettingsStore((s) => s.callLanguage);
  const setCallLanguage = useSettingsStore((s) => s.setCallLanguage);
  const set = useSettingsStore((s) => s.set);
  // In a game the caller speaks one language (English + Telugu together is Caller Mode only).
  const spoken: 'en' | 'te' = callLanguage === 'en' || callLanguage === 'te' ? callLanguage : appLanguage;
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
          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="settings-sharp" size={20} color="#fff" />
            </View>
            <T variant="h2" color="#fff" style={{ flex: 1 }}>
              {t('game.settings')}
            </T>
            <IconButton icon="close" color="#fff" onPress={onClose} />
          </LinearGradient>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {isHost ? (
              <Section icon="speedometer" tint={['#F59E0B', '#D97706']} title={t('game.speedTitle')} note={t('game.speedNote')}>
                <View style={styles.grid}>
                  {SPEEDS.map((s) => {
                    const active = current === s;
                    return (
                      <Pressable
                        key={s}
                        disabled={speed.isPending}
                        onPress={() => speed.mutate(s)}
                        style={({ pressed }) => [styles.speedWrap, { opacity: pressed ? 0.75 : 1 }]}
                      >
                        {active ? (
                          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.speed, { borderColor: '#FDE68A' }]}>
                            <T variant="h2" color="#fff">
                              {s}
                            </T>
                            <T variant="tiny" color="rgba(255,255,255,0.85)">
                              {t('game.secShort')}
                            </T>
                          </LinearGradient>
                        ) : (
                          <View style={[styles.speed, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <T variant="h2">{s}</T>
                            <T variant="tiny" muted>
                              {t('game.secShort')}
                            </T>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}

            <Section icon="volume-high" tint={['#7C3AED', '#C026D3']} title={t('game.callerVoice')}>
              <SettingToggle icon="mic" label={t('profile.voice')} value={voice} onChange={(v) => set({ voice: v })} />
              {voice ? (
                <>
                  <Row gap={spacing.sm} style={{ marginVertical: spacing.sm }}>
                    {LANGS.map((l) => {
                      const on = spoken === l.key;
                      return (
                        <Pressable
                          key={l.key}
                          onPress={() => setCallLanguage(l.key as CallLanguage)}
                          style={[styles.lang, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
                        >
                          {on ? <Ionicons name="checkmark-circle" size={16} color="#fff" /> : null}
                          <T variant="smallBold" color={on ? '#fff' : colors.text} style={{ fontFamily: fonts.semibold }}>
                            {l.label}
                          </T>
                        </Pressable>
                      );
                    })}
                  </Row>
                  <VoicePicker language={spoken} />
                  <Row gap={6} style={{ marginTop: spacing.sm }}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                    <T variant="tiny" muted style={{ flex: 1 }}>
                      {t('game.voiceTip')}
                    </T>
                  </Row>
                </>
              ) : null}
            </Section>

            <Section icon="phone-portrait" tint={['#0891B2', '#2563EB']} title={t('game.thisPhone')}>
              <SettingToggle icon="musical-notes" label={t('profile.sounds')} value={sounds} onChange={(v) => set({ sounds: v })} />
              <SettingToggle icon="radio-button-on" label={t('profile.strikeSound')} value={strikeSound} onChange={(v) => set({ strikeSound: v })} />
              <SettingToggle icon="pulse" label={t('profile.haptics')} value={haptics} onChange={(v) => set({ haptics: v })} />
            </Section>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.xl, maxHeight: '88%', overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  headIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Even spacing (no fixed column gap): 5 boxes always fit in a row, even on narrow / zoomed screens.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, justifyContent: 'space-between' },
  speedWrap: { width: '18%' },
  speed: { aspectRatio: 0.9, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { paddingVertical: 6, gap: spacing.md },
  lang: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, borderWidth: 1.5, paddingVertical: 8 },
});
