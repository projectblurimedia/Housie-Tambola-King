import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { CalledBoard } from '@/components/CalledBoard';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { Button, Header, IconButton, Row, Screen, Segmented, Spacer, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { useCallerStore } from '@/state/callerStore';
import { useSettingsStore } from '@/state/settingsStore';
import { classicPhrase } from '@/game/engine/calls';
import { showToast } from '@/state/toastStore';
import { radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

export function CallerScreen({ navigation }: ScreenProps<'Caller'>) {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const caller = useCaller();
  const language = useSettingsStore((s) => s.language);
  const { called, intervalSeconds, callNext, undo, reset, setInterval: setSpeed } = useCallerStore();
  const [auto, setAuto] = useState(false);
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

  const confirmReset = () =>
    Alert.alert('', t('caller.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('caller.reset'),
        style: 'destructive',
        onPress: () => {
          setAuto(false);
          reset();
        },
      },
    ]);

  return (
    <Screen scroll>
        <Header
          title={t('caller.title')}
          right={<IconButton icon="print-outline" onPress={() => navigation.navigate('PrintTickets')} accessibilityLabel={t('caller.printTickets')} />}
        />
        <View style={{ alignItems: 'center', paddingVertical: spacing.md, backgroundColor: colors.primaryDark, borderRadius: radius.xl }}>
          <NumberBall number={last} size={140} subtitle={last && language === 'en' ? classicPhrase(last) : null} />
          <T variant="smallBold" color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.sm }}>
            {t('game.calledCount', { count: called.length })} · {t('caller.remaining', { count: 90 - called.length })}
          </T>
          <Row gap={6} style={{ marginTop: spacing.sm }}>
            {called
              .slice(-6, -1)
              .reverse()
              .map((n) => (
                <MiniBall key={n} n={n} size={30} />
              ))}
          </Row>
        </View>

        <Spacer />
        <Row gap={spacing.sm}>
          <Button title={t('caller.next')} variant="gold" icon="arrow-forward-circle" style={{ flex: 2 }} onPress={next} disabled={auto || called.length >= 90} />
          <Button
            title={auto ? t('caller.pause') : t('caller.auto')}
            icon={auto ? 'pause' : 'play'}
            style={{ flex: 1 }}
            onPress={() => setAuto((a) => !a)}
            disabled={called.length >= 90}
          />
        </Row>
        <Spacer h={spacing.sm} />
        <T variant="smallBold" muted style={{ marginBottom: 6 }}>
          {t('caller.speed')}
        </T>
        <Segmented
          value={intervalSeconds}
          onChange={setSpeed}
          options={[
            { value: 4, label: t('create.speedFast') },
            { value: 6, label: t('create.speedNormal') },
            { value: 9, label: t('create.speedSlow') },
          ]}
        />
        <Spacer h={spacing.sm} />
        <Row gap={spacing.sm}>
          <Button title={t('caller.undo')} variant="secondary" icon="arrow-undo" small style={{ flex: 1 }} onPress={undo} disabled={!called.length || auto} />
          <Button title={t('caller.reset')} variant="secondary" icon="refresh" small style={{ flex: 1 }} onPress={confirmReset} />
        </Row>
        <Spacer h={spacing.lg} />
        <CalledBoard called={calledSet} last={last} cellSize={32} />
    </Screen>
  );
}
