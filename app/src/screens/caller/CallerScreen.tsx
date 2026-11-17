import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { CalledBoard } from '@/components/CalledBoard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { Button, Chip, IconButton, Row, Screen, Spacer, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { CALLER_SPEEDS, useCallerStore } from '@/state/callerStore';
import { showToast } from '@/state/toastStore';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

/** History: every called number in call order. Opening it pauses auto-calling. */
function HistoryModal({ visible, called, onClose }: { visible: boolean; called: number[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{t('caller.historyTitle', { count: called.length })}</T>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <T variant="small" muted>
            {t('caller.historyHint')}
          </T>
          <ScrollView style={{ marginTop: spacing.md }} contentContainerStyle={styles.historyGrid}>
            {called.length === 0 ? (
              <T muted>{t('caller.historyEmpty')}</T>
            ) : (
              called.map((n, i) => (
                <View key={n} style={styles.historyItem}>
                  <T variant="tiny" muted>
                    {i + 1}
                  </T>
                  <MiniBall n={n} size={38} />
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CallerScreen({ navigation }: ScreenProps<'Caller'>) {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { called, intervalSeconds, voiceLanguage, undo, reset, setInterval: setSpeed, setVoiceLanguage } = useCallerStore();
  const caller = useCaller(voiceLanguage);
  const [auto, setAuto] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const calledSet = useMemo(() => new Set(called), [called]);
  const last = called.length ? called[called.length - 1] : null;
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

  const openHistory = () => {
    setAuto(false);
    setHistoryOpen(true);
  };

  const done = called.length >= 90;

  return (
    <Screen
      scroll
      title={t('caller.title')}
      right={<IconButton icon="print-outline" color="#fff" onPress={() => navigation.navigate('PrintTickets')} accessibilityLabel={t('caller.printTickets')} />}
    >
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stage}>
        <NumberBall number={last} size={150} />
        <T variant="smallBold" color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.md }}>
          {t('game.calledCount', { count: called.length })} · {t('caller.remaining', { count: 90 - called.length })}
        </T>
        <Row gap={6} style={{ marginTop: spacing.sm, minHeight: 30 }}>
          {called
            .slice(-6, -1)
            .reverse()
            .map((n) => (
              <MiniBall key={n} n={n} size={30} />
            ))}
        </Row>
      </LinearGradient>

      <Spacer />
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
      <Spacer h={spacing.sm} />
      <Row gap={spacing.sm}>
        <Button title={t('caller.history')} variant="secondary" icon="list" small style={{ flex: 1 }} onPress={openHistory} />
        <Button title={t('caller.undo')} variant="secondary" icon="arrow-undo" small style={{ flex: 1 }} onPress={undo} disabled={!called.length || auto} />
        <Button title={t('caller.reset')} variant="secondary" icon="refresh" small style={{ flex: 1 }} onPress={() => setConfirmReset(true)} disabled={!called.length} />
      </Row>

      <T variant="smallBold" muted style={styles.label}>
        {t('caller.voice')}
      </T>
      <Row gap={spacing.sm}>
        <Chip label="English" active={voiceLanguage === 'en'} onPress={() => setVoiceLanguage('en')} />
        <Chip label="తెలుగు" active={voiceLanguage === 'te'} onPress={() => setVoiceLanguage('te')} />
      </Row>

      <T variant="smallBold" muted style={styles.label}>
        {t('caller.speed')}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {CALLER_SPEEDS.map((s) => (
          <Chip key={s} label={t('common.seconds', { count: s })} active={intervalSeconds === s} onPress={() => setSpeed(s)} />
        ))}
      </ScrollView>

      <Spacer h={spacing.lg} />
      <CalledBoard called={calledSet} last={last} cellSize={32} />

      <HistoryModal visible={historyOpen} called={called} onClose={() => setHistoryOpen(false)} />
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
  stage: { alignItems: 'center', paddingVertical: spacing.lg, borderRadius: radius.xl },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '80%' },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  historyItem: { alignItems: 'center', width: 44 },
});
