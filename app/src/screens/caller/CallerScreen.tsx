import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CalledBoard } from '@/components/CalledBoard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { VoicePicker } from '@/components/VoicePicker';
import { Button, Chip, IconButton, Row, Screen, Spacer, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { CALLER_SPEEDS, useCallerStore } from '@/state/callerStore';
import { showToast } from '@/state/toastStore';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <T variant="h2">{title}</T>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Settings tile: icon + label, used for History / Undo / Reset / Print. */
function Tile({ icon, label, onPress, disabled, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { colors } = useThemeColors();
  const tint = danger ? colors.error : colors.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surfaceAlt, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={tint} />
      <T variant="smallBold" color={danger ? colors.error : undefined} center>
        {label}
      </T>
    </Pressable>
  );
}

export function CallerScreen({ navigation }: ScreenProps<'Caller'>) {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { called, intervalSeconds, voiceLanguage, undo, reset, setInterval: setSpeed, setVoiceLanguage } = useCallerStore();
  const caller = useCaller(voiceLanguage);
  const [auto, setAuto] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const calledSet = useMemo(() => new Set(called), [called]);
  const last = called.length ? called[called.length - 1] : null;
  // Newest first.
  const recent = called.slice(0, -1).reverse().slice(0, 8);
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
    setAuto(true);
  };

  const openHistory = () => {
    setAuto(false);
    setSettingsOpen(false);
    setHistoryOpen(true);
  };

  const done = called.length >= 90;
  const notStarted = called.length === 0;

  return (
    <Screen
      scroll
      title={t('caller.title')}
      right={<IconButton icon="settings-sharp" color="#fff" onPress={() => setSettingsOpen(true)} accessibilityLabel={t('caller.settings')} />}
    >
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stage}>
        <NumberBall number={last} size={140} />
        <View style={styles.side}>
          <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 1 }}>
            {t('caller.recent')}
          </T>
          <View style={styles.recentGrid}>
            {recent.length ? (
              recent.map((n) => <MiniBall key={n} n={n} size={34} />)
            ) : (
              <T variant="small" color="rgba(255,255,255,0.7)">
                —
              </T>
            )}
          </View>
          <T variant="smallBold" color="#fff" style={{ marginTop: spacing.sm }}>
            {t('game.calledCount', { count: called.length })}
          </T>
          <T variant="tiny" color="rgba(255,255,255,0.8)">
            {t('caller.remaining', { count: 90 - called.length })}
          </T>
        </View>
      </LinearGradient>

      <Spacer />
      {notStarted ? (
        <Button title={t('caller.start')} variant="gold" icon="play" onPress={start} />
      ) : (
        <Row gap={spacing.sm}>
          <Button title={t('caller.next')} variant="gold" icon="arrow-forward-circle" style={{ flex: 2 }} onPress={next} disabled={auto || done} />
          <Button
            title={auto ? t('caller.stop') : t('caller.auto')}
            variant={auto ? 'danger' : 'primary'}
            icon={auto ? 'stop' : 'play'}
            style={{ flex: 1 }}
            onPress={() => setAuto((a) => !a)}
            disabled={done}
          />
        </Row>
      )}
      <T variant="tiny" muted center style={{ marginTop: spacing.sm }}>
        {t('caller.statusLine', {
          speed: t('common.seconds', { count: intervalSeconds }),
          voice: voiceLanguage === 'te' ? 'తెలుగు' : 'English',
        })}
      </T>

      <Spacer h={spacing.lg} />
      <CalledBoard called={calledSet} last={last} cellSize={32} />

      <Sheet visible={settingsOpen} title={t('caller.settings')} onClose={() => setSettingsOpen(false)}>
        <Row gap={spacing.sm}>
          <Tile icon="list" label={t('caller.history')} onPress={openHistory} />
          <Tile
            icon="arrow-undo"
            label={t('caller.undo')}
            onPress={() => {
              setAuto(false);
              undo();
            }}
            disabled={!called.length}
          />
          <Tile
            icon="refresh"
            label={t('caller.reset')}
            danger
            onPress={() => {
              setSettingsOpen(false);
              setConfirmReset(true);
            }}
            disabled={!called.length}
          />
          <Tile
            icon="print-outline"
            label={t('caller.printTickets')}
            onPress={() => {
              setSettingsOpen(false);
              navigation.navigate('PrintTickets');
            }}
          />
        </Row>

        <T variant="smallBold" muted style={styles.label}>
          {t('caller.speed')}
        </T>
        <View style={styles.wrap}>
          {CALLER_SPEEDS.map((s) => (
            <Chip key={s} label={t('common.seconds', { count: s })} active={intervalSeconds === s} onPress={() => setSpeed(s)} />
          ))}
        </View>

        <T variant="smallBold" muted style={styles.label}>
          {t('caller.voiceLanguage')}
        </T>
        <Row gap={spacing.sm}>
          <Chip label="English" active={voiceLanguage === 'en'} onPress={() => setVoiceLanguage('en')} />
          <Chip label="తెలుగు" active={voiceLanguage === 'te'} onPress={() => setVoiceLanguage('te')} />
        </Row>

        <T variant="smallBold" muted style={styles.label}>
          {t('caller.voice')}
        </T>
        <VoicePicker language={voiceLanguage} />
      </Sheet>

      <Sheet visible={historyOpen} title={t('caller.historyTitle', { count: called.length })} onClose={() => setHistoryOpen(false)}>
        <T variant="small" muted style={{ marginBottom: spacing.md }}>
          {t('caller.historyHint')}
        </T>
        {called.length === 0 ? (
          <T muted>{t('caller.historyEmpty')}</T>
        ) : (
          <View style={styles.historyGrid}>
            {called
              .map((n, i) => ({ n, order: i + 1 }))
              .reverse()
              .map(({ n, order }) => (
                <View key={n} style={styles.historyItem}>
                  <T variant="tiny" muted>
                    #{order}
                  </T>
                  <MiniBall n={n} size={40} />
                </View>
              ))}
          </View>
        )}
      </Sheet>

      <ConfirmModal
        visible={confirmReset}
        icon="refresh"
        title={t('caller.resetTitle')}
        message={t('caller.resetConfirm')}
        confirmLabel={t('caller.reset')}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setAuto(false);
          reset();
          setConfirmReset(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl },
  side: { flex: 1 },
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, minHeight: 34 },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, maxHeight: '85%' },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: radius.md },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  historyItem: { alignItems: 'center', width: 46 },
});
