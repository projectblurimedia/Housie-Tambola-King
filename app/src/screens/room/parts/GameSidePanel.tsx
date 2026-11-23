import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { T } from '@/components/ui';
import { CallLanguage, useSettingsStore } from '@/state/settingsStore';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';

// In a game the caller speaks one language (English + Telugu together is a Caller Mode option).
const LANGS: { key: CallLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'te', label: 'తెలుగు' },
];

function Option({
  icon,
  label,
  note,
  badge,
  tint,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  note?: string;
  badge?: number;
  tint: [string, string];
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.option, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optIcon}>
        <Ionicons name={icon} size={20} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <T variant="smallBold" numberOfLines={1}>
          {label}
        </T>
        {note ? (
          <T variant="tiny" muted numberOfLines={1}>
            {note}
          </T>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.pink }]}>
          <T variant="tiny" color="#fff" style={{ fontFamily: fonts.bold }}>
            {badge > 9 ? '9+' : badge}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The game's extra controls, tucked into a slim "‹" tab on the right edge (instead of big
 * floating buttons over the tickets). Tap it: a panel slides out with Room chat, Pause /
 * Resume (host) or "Ask host to pause" (players), and the caller voice language. Tap outside
 * to close.
 */
export function GameSidePanel({
  isHost,
  paused,
  chatEnabled,
  chatUnread,
  pauseBusy,
  onChat,
  onTogglePause,
  onAskPause,
}: {
  isHost: boolean;
  paused: boolean;
  chatEnabled: boolean;
  chatUnread: number;
  pauseBusy: boolean;
  onChat: () => void;
  onTogglePause: () => void;
  onAskPause: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const callLanguage = useSettingsStore((s) => s.callLanguage);
  const setCallLanguage = useSettingsStore((s) => s.setCallLanguage);
  const appLanguage = useSettingsStore((s) => s.language);
  const current: CallLanguage = callLanguage === 'app' || callLanguage === 'both' ? appLanguage : callLanguage;

  useEffect(() => {
    if (!open) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, slide]);

  const close = () => setOpen(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const bottom = spacing.xxl * 3 + insets.bottom;

  return (
    <>
      {/* The slim tab on the right edge. */}
      <Pressable onPress={() => setOpen(true)} style={[styles.tab, { bottom }]} accessibilityRole="button" accessibilityLabel={t('game.moreOptions')}>
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabInner}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </LinearGradient>
        {chatUnread > 0 ? <View style={[styles.tabDot, { backgroundColor: colors.pink }]} /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close}>
          <Animated.View
            style={[
              styles.panel,
              {
                bottom: bottom - spacing.md,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: slide,
                transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
              },
            ]}
          >
            {/* Taps inside the panel don't close it. */}
            <Pressable onPress={() => undefined} style={{ gap: spacing.sm }}>
              {chatEnabled ? (
                <Option icon="chatbubbles" label={t('chat.title')} badge={chatUnread} tint={['#7C3AED', '#C026D3']} onPress={run(onChat)} />
              ) : null}
              {isHost ? (
                <Option
                  icon={paused ? 'play' : 'pause'}
                  label={paused ? t('game.resume') : t('game.pause')}
                  note={paused ? t('game.pausedNote') : t('game.pauseNote')}
                  tint={paused ? ['#22C55E', '#15803D'] : ['#F59E0B', '#D97706']}
                  disabled={pauseBusy}
                  onPress={run(onTogglePause)}
                />
              ) : (
                <Option
                  icon="hand-left"
                  label={t('game.askPause')}
                  note={paused ? t('game.paused') : t('game.askPauseNote')}
                  tint={['#F59E0B', '#D97706']}
                  disabled={paused}
                  onPress={run(onAskPause)}
                />
              )}
              <View style={[styles.voiceBox, { backgroundColor: colors.surfaceAlt }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="volume-high" size={16} color={colors.primary} />
                  <T variant="smallBold">{t('game.callerVoice')}</T>
                </View>
                <View style={styles.langRow}>
                  {LANGS.map((l) => {
                    const on = current === l.key;
                    return (
                      <Pressable
                        key={l.key}
                        onPress={() => setCallLanguage(l.key)}
                        style={[styles.lang, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
                      >
                        <T variant="tiny" color={on ? '#fff' : colors.text} style={{ fontFamily: fonts.semibold }}>
                          {l.label}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tab: { position: 'absolute', right: 0, elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: -2, height: 2 } },
  tabInner: {
    width: 30,
    height: 78,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabDot: { position: 'absolute', top: 6, left: 4, width: 10, height: 10, borderRadius: 5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    position: 'absolute',
    right: spacing.sm,
    width: 250,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  optIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  voiceBox: { borderRadius: radius.md, padding: spacing.sm, gap: 6, marginTop: 2 },
  langRow: { flexDirection: 'row', gap: 6 },
  lang: { flex: 1, alignItems: 'center', borderRadius: 999, borderWidth: 1, paddingVertical: 5 },
});
