import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BOARD_CELL_RADIUS, BOARD_GAP, CalledBoard } from '@/components/CalledBoard';
import { Landscape } from '@/components/Landscape';
import { loadVoices, VoicePicker } from '@/components/VoicePicker';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { Button, Chip, IconButton, Row, T } from '@/components/ui';
import { speakNumber, useCaller } from '@/hooks/useCaller';
import { useSettingsStore } from '@/state/settingsStore';
import { CALLER_SPEEDS, minSpeedFor, useCallerStore } from '@/state/callerStore';
import { showToast } from '@/state/toastStore';
import { fonts, goldGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const STAGE = ['#1E0B4B', '#4C1D95', '#7C3AED'] as const;

/**
 * In-tree overlay with a smooth fade (a <Modal> would not rotate with the landscape view).
 */
/**
 * Caller Mode's pop-ups (settings, history, reset) as real Modals: they scroll and take touches
 * reliably (an overlay drawn inside the screen sometimes didn't). fill = a full-height sheet
 * on the right; otherwise a centred card.
 */
function Overlay({
  visible,
  onClose,
  children,
  maxHeight,
  fill,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight: number;
  fill?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={[styles.overlay, fill && styles.overlayFill]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={
            fill
              ? [styles.sideSheet, { backgroundColor: colors.surface }]
              : [styles.overlayCard, { backgroundColor: colors.surface, maxHeight }]
          }
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
  tint = '#fff',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
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

export function CallerScreen(props: ScreenProps<'Caller'>) {
  return (
    <ErrorBoundary onBack={() => props.navigation.goBack()}>
      <CallerScreenInner {...props} />
    </ErrorBoundary>
  );
}

function CallerScreenInner({ navigation }: ScreenProps<'Caller'>) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Home');
      return true;
    });
    return () => sub.remove();
  }, [navigation]);
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { called, intervalSeconds, voiceLanguage, mode, reset, setInterval: setSpeed, setVoiceLanguage, setMode } = useCallerStore();
  const caller = useCaller(voiceLanguage);
  const [auto, setAuto] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Looking at settings or the history pauses the calling (press Play to carry on).
  const openSettings = () => {
    setAuto(false);
    setSettingsOpen(true);
  };
  const openHistory = () => {
    setAuto(false);
    setHistoryOpen(true);
  };
  useEffect(() => {
    loadVoices().catch(() => undefined);
  }, []);
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
      ? {
          label: auto ? t('caller.pause') : t('caller.play'),
          icon: auto ? ('pause' as const) : ('play' as const),
          onPress: () => setAuto((a) => !a),
        }
      : { label: t('caller.next'), icon: 'arrow-forward' as const, onPress: next };

  return (
    <Landscape>
      {({ width, height, padLeft, padRight }) => {
        const pad = 6;
        const boardPad = 6;
        // Board: about two-thirds of the screen; each box as wide as that allows, as tall as the height allows.
        const boardWidth = Math.floor(Math.min(width * 0.58, 720));
        const cell = Math.max(24, Math.floor((height - pad * 2 - boardPad * 2 - 8 * BOARD_GAP) / 9));
        const cellWidth = Math.max(cell, Math.floor((boardWidth - boardPad * 2 - 9 * BOARD_GAP) / 10));
        const ball = Math.min(Math.floor(height * 0.3), 118);
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
                  <Row gap={6}>
                    {notStarted ? null : (
                      <Pressable
                        onPress={() => {
                          setAuto(false);
                          setConfirmReset(true);
                        }}
                        accessibilityLabel={t('caller.newGame')}
                        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
                      >
                        {/* Compact round button beside Settings — never crowds the title. */}
                        <LinearGradient colors={['#F472B6', '#E11D48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newGame}>
                          <Ionicons name="refresh" size={19} color="#fff" />
                        </LinearGradient>
                      </Pressable>
                    )}
                    <IconButton icon="options" color="#fff" onPress={openSettings} accessibilityLabel={t('caller.settings')} />
                  </Row>
                </Row>

                <Row gap={spacing.md} style={{ flex: 1 }}>
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
                          {voiceLanguage === 'both' ? 'English + తెలుగు' : voiceLanguage === 'te' ? 'తెలుగు' : 'English'}
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
                            <MiniBall n={n} size={26} />
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

                {done ? (
                  <Button
                    title={t('caller.newGame')}
                    variant="gold"
                    icon="refresh"
                    style={{ alignSelf: 'stretch' }}
                    onPress={() => setConfirmReset(true)}
                  />
                ) : (
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
                    <RoundButton icon="time-outline" label={t('caller.history')} onPress={openHistory} disabled={notStarted} />
                  </Row>
                )}
              </View>

              {/* Right: the board */}
              <View style={[styles.boardCard, { width: boardWidth, backgroundColor: colors.surface }]}>
                <CalledBoard called={calledSet} last={last} cellSize={cell} cellWidth={cellWidth} />
              </View>
            </View>

            <Overlay visible={settingsOpen} onClose={() => setSettingsOpen(false)} maxHeight={height - 24} fill>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h2">{t('caller.settings')}</T>
                <IconButton icon="close" onPress={() => setSettingsOpen(false)} />
              </Row>
              <ScrollView
                style={{ flex: 1 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
              >
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
                      {CALLER_SPEEDS.filter((s) => s >= minSpeedFor(voiceLanguage)).map((s) => (
                        <Chip
                          key={s}
                          label={t('common.seconds', { count: s })}
                          active={intervalSeconds === s}
                          onPress={() => setSpeed(s)}
                        />
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
                  <Chip
                    label={t('caller.both')}
                    active={voiceLanguage === 'both'}
                    onPress={() => {
                      setVoiceLanguage('both');
                      // A sample: 35 in English, then in Telugu.
                      const { voiceByLanguage, voiceStyle } = useSettingsStore.getState();
                      speakNumber(35, 'en', voiceByLanguage.en, voiceStyle);
                      speakNumber(35, 'te', voiceByLanguage.te, voiceStyle, true);
                    }}
                  />
                </Row>
                {voiceLanguage === 'both' ? (
                  <T variant="tiny" muted style={{ marginTop: 6 }}>
                    {t('caller.bothHint')}
                  </T>
                ) : null}
                {(voiceLanguage === 'both' ? (['en', 'te'] as const) : ([voiceLanguage] as const)).map((l) => (
                  <View key={l}>
                    <T variant="smallBold" muted style={styles.label}>
                      {t('caller.voice')} · {l === 'te' ? 'తెలుగు' : 'English'}
                    </T>
                    <VoicePicker language={l} />
                  </View>
                ))}
                <Button
                  title={t('caller.newGame')}
                  variant="danger"
                  icon="refresh"
                  style={{ marginTop: spacing.lg }}
                  disabled={notStarted}
                  onPress={() => {
                    setSettingsOpen(false);
                    setConfirmReset(true);
                  }}
                />
              </ScrollView>
            </Overlay>

            <Overlay visible={historyOpen} onClose={() => setHistoryOpen(false)} maxHeight={height - 24} fill>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h2">{t('caller.historyAll', { count: called.length })}</T>
                <IconButton icon="close" onPress={() => setHistoryOpen(false)} />
              </Row>
              <T variant="tiny" muted>
                {t('caller.historyOrderHint')}
              </T>
              {/* Every called number in the order it was called: #1, #2, … */}
              <ScrollView
                style={{ flex: 1, marginTop: spacing.sm }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.historyGrid}
              >
                {/* Latest first: #N, #N-1 … #1. */}
                {called
                  .map((n, i) => ({ n, order: i + 1 }))
                  .reverse()
                  .map(({ n, order }) => (
                    <View key={n} style={styles.historyItem}>
                      <MiniBall n={n} size={36} />
                      <T variant="tiny" muted>
                        #{order}
                      </T>
                    </View>
                  ))}
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
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  mainBtn: { height: 50, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  round: {
    width: 54,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  boardCard: {
    // Card corners follow the cells' corners (cell radius + padding).
    borderRadius: BOARD_CELL_RADIUS + 6,
    padding: 6,
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  overlay: { flex: 1, backgroundColor: 'rgba(10,4,24,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: spacing.lg },
  historyItem: { alignItems: 'center', gap: 2, width: 44 },
  overlayFill: { alignItems: 'flex-end', justifyContent: 'flex-start', padding: 0 },
  newGame: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sideSheet: {
    height: '100%',
    width: '46%',
    maxWidth: 440,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    padding: spacing.lg,
    paddingRight: spacing.xl,
  },
  overlayCard: { width: '100%', maxWidth: 460, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'column' },
  label: { marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirmIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
