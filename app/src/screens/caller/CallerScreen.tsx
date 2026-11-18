import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CalledBoard } from '@/components/CalledBoard';
import { Landscape } from '@/components/Landscape';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { Button, Chip, IconButton, Row, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { CALLER_SPEEDS, useCallerStore } from '@/state/callerStore';
import { showToast } from '@/state/toastStore';
import { fonts, goldGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const STAGE = ['#1E0B4B', '#4C1D95', '#7C3AED'] as const;

/**
 * In-tree overlay with a smooth fade (a <Modal> would not rotate with the landscape view).
 */
function Overlay({ visible, onClose, children, maxHeight }: { visible: boolean; onClose: () => void; children: React.ReactNode; maxHeight: number }) {
  const { colors } = useThemeColors();
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, fade]);
  if (!mounted) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.overlayCard,
          { backgroundColor: colors.surface, maxHeight, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

function RoundButton({ icon, label, onPress, disabled, tint = '#fff' }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; tint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <T variant="tiny" color="rgba(255,255,255,0.85)">
        {label}
      </T>
    </Pressable>
  );
}

export function CallerScreen({ navigation }: ScreenProps<'Caller'>) {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { called, intervalSeconds, voiceLanguage, mode, undo, reset, setInterval: setSpeed, setVoiceLanguage, setMode } = useCallerStore();
  const caller = useCaller(voiceLanguage);
  const [auto, setAuto] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const calledSet = useMemo(() => new Set(called), [called]);
  const last = called.length ? called[called.length - 1] : null;
  /** The last five calls, newest first (the current one is the big ball). */
  const lastFive = called.slice(-6, -1).reverse();
  const announceRef = useRef(caller.announce);
  announceRef.current = caller.announce;

  const next = () => {
    const n = useCallerStore.getState().callNext();
    if (n === null) {
      setAuto(false);
      showToast({ variant: 'info', title: t('caller.allCalled') });
      return;
    }
    announceRef.current(n);
  };

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(next, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [auto, intervalSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    next();
    if (mode === 'auto') setAuto(true);
  };
  const changeMode = (m: 'auto' | 'manual') => {
    setMode(m);
    if (m === 'manual') setAuto(false);
  };

  const done = called.length >= 90;
  const notStarted = called.length === 0;
  const main = notStarted
    ? { label: t('caller.start'), icon: 'play' as const, onPress: start }
    : mode === 'auto'
      ? { label: auto ? t('caller.pause') : t('caller.play'), icon: auto ? ('pause' as const) : ('play' as const), onPress: () => setAuto((a) => !a) }
      : { label: t('caller.next'), icon: 'arrow-forward' as const, onPress: next };

  return (
    <Landscape>
      {({ width, height, padLeft, padRight }) => {
        const pad = 12;
        const boardWidth = Math.min(width * 0.56, 560);
        const cell = Math.max(20, Math.floor((height - pad * 2 - 24 - 8 * 3) / 9));
        const ball = Math.min(Math.floor(height * 0.4), 150);
        return (
          <LinearGradient colors={STAGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width, height }}>
            <StatusBar hidden />
            <View style={[styles.body, { paddingLeft: padLeft, paddingRight: padRight, padding: pad }]}>
              {/* Left: the call */}
              <View style={styles.left}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={4}>
                    <IconButton icon="chevron-back" color="#fff" onPress={() => navigation.goBack()} />
                    <T variant="h3" color="#fff">
                      {t('caller.title')}
                    </T>
                  </Row>
                  <IconButton icon="options" color="#fff" onPress={() => setSettingsOpen(true)} accessibilityLabel={t('caller.settings')} />
                </Row>

                <Row gap={spacing.lg} style={{ flex: 1 }}>
                  <View style={styles.ballHalo}>
                    <NumberBall number={last} size={ball} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T variant="h1" color="#fff">
                      {called.length}
                      <T variant="h3" color="rgba(255,255,255,0.6)">
                        {' '}
                        / 90
                      </T>
                    </T>
                    <View style={styles.progress}>
                      <LinearGradient
                        colors={goldGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: '100%', width: `${(called.length / 90) * 100}%`, borderRadius: 4 }}
                      />
                    </View>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <View style={styles.tag}>
                        <Ionicons name={mode === 'auto' ? 'timer-outline' : 'hand-left-outline'} size={12} color="#FDE68A" />
                        <T variant="tiny" color="#fff">
                          {mode === 'auto' ? t('common.seconds', { count: intervalSeconds }) : t('caller.modeManual')}
                        </T>
                      </View>
                      <View style={styles.tag}>
                        <Ionicons name="volume-high" size={12} color="#FDE68A" />
                        <T variant="tiny" color="#fff">
                          {voiceLanguage === 'te' ? 'తెలుగు' : 'English'}
                        </T>
                      </View>
                    </Row>
                    <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 1, marginTop: 4 }}>
                      {t('caller.historyLast5').toUpperCase()}
                    </T>
                    <Row gap={6}>
                      {lastFive.length ? (
                        lastFive.map((n, i) => (
                          <View key={n} style={{ opacity: 1 - i * 0.12 }}>
                            <MiniBall n={n} size={32} />
                          </View>
                        ))
                      ) : (
                        <T variant="small" color="rgba(255,255,255,0.6)">
                          —
                        </T>
                      )}
                    </Row>
                  </View>
                </Row>

                <Row gap={spacing.sm}>
                  <Pressable
                    onPress={main.onPress}
                    disabled={done && !notStarted}
                    style={({ pressed }) => [{ flex: 1, opacity: done && !notStarted ? 0.4 : pressed ? 0.85 : 1 }]}
                  >
                    <LinearGradient
                      colors={auto ? ['#F87171', '#DC2626'] : goldGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.mainBtn}
                    >
                      <Ionicons name={main.icon} size={24} color={auto ? '#fff' : '#3B1D00'} />
                      <T variant="h3" color={auto ? '#fff' : '#3B1D00'}>
                        {main.label}
                      </T>
                    </LinearGradient>
                  </Pressable>
                  {mode === 'auto' && !notStarted ? <RoundButton icon="play-skip-forward" label={t('caller.next')} onPress={next} disabled={done} /> : null}
                  <RoundButton
                    icon="arrow-undo"
                    label={t('caller.undo')}
                    onPress={() => {
                      setAuto(false);
                      undo();
                    }}
                    disabled={notStarted}
                  />
                  <RoundButton icon="refresh" label={t('caller.reset')} onPress={() => setConfirmReset(true)} disabled={notStarted} tint="#FCA5A5" />
                </Row>
              </View>

              {/* Right: the board */}
              <View style={[styles.boardCard, { width: boardWidth, backgroundColor: colors.surface }]}>
                <CalledBoard called={calledSet} last={last} cellSize={cell} />
              </View>
            </View>

            <Overlay visible={settingsOpen} onClose={() => setSettingsOpen(false)} maxHeight={height - 24}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h2">{t('caller.settings')}</T>
                <IconButton icon="close" onPress={() => setSettingsOpen(false)} />
              </Row>
              <ScrollView showsVerticalScrollIndicator={false}>
                <T variant="smallBold" muted style={styles.label}>
                  {t('caller.mode')}
                </T>
                <Row gap={spacing.sm}>
                  <Chip label={t('caller.modeAuto')} active={mode === 'auto'} onPress={() => changeMode('auto')} />
                  <Chip label={t('caller.modeManual')} active={mode === 'manual'} onPress={() => changeMode('manual')} />
                </Row>
                {mode === 'auto' ? (
                  <>
                    <T variant="smallBold" muted style={styles.label}>
                      {t('caller.speed')}
                    </T>
                    <View style={styles.wrap}>
                      {CALLER_SPEEDS.map((s) => (
                        <Chip key={s} label={t('common.seconds', { count: s })} active={intervalSeconds === s} onPress={() => setSpeed(s)} />
                      ))}
                    </View>
                  </>
                ) : null}
                <T variant="smallBold" muted style={styles.label}>
                  {t('caller.voiceLanguage')}
                </T>
                <Row gap={spacing.sm}>
                  <Chip label="English" active={voiceLanguage === 'en'} onPress={() => setVoiceLanguage('en')} />
                  <Chip label="తెలుగు" active={voiceLanguage === 'te'} onPress={() => setVoiceLanguage('te')} />
                </Row>
              </ScrollView>
            </Overlay>

            <Overlay visible={confirmReset} onClose={() => setConfirmReset(false)} maxHeight={height - 24}>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.confirmIcon, { backgroundColor: colors.error }]}>
                  <Ionicons name="refresh" size={26} color="#fff" />
                </View>
                <T variant="h2" center>
                  {t('caller.resetTitle')}
                </T>
                <T muted center>
                  {t('caller.resetConfirm')}
                </T>
                <Row gap={spacing.sm} style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>
                  <Button title={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmReset(false)} />
                  <Button
                    title={t('caller.reset')}
                    variant="danger"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setAuto(false);
                      reset();
                      setConfirmReset(false);
                    }}
                  />
                </Row>
              </View>
            </Overlay>
          </LinearGradient>
        );
      }}
    </Landscape>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row', gap: 14 },
  left: { flex: 1, justifyContent: 'space-between', gap: 8 },
  ballHalo: { borderRadius: 999, padding: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  progress: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  mainBtn: { height: 56, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  round: { width: 62, height: 56, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', gap: 1 },
  boardCard: { borderRadius: radius.lg, padding: 12, justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { backgroundColor: 'rgba(10,4,24,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  overlayCard: { width: '100%', maxWidth: 440, borderRadius: radius.xl, padding: spacing.lg },
  label: { marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirmIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
