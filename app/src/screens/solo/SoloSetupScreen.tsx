import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Row, Screen, Segmented, Spacer, Stepper, T } from '@/components/ui';
import type { BotDifficulty } from '@/game/engine/solo';
import { spacing } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

export function SoloSetupScreen({ navigation }: ScreenProps<'SoloSetup'>) {
  const { t } = useTranslation();
  const [bots, setBots] = useState(5);
  const [myTickets, setMyTickets] = useState(2);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');

  return (
    <Screen scroll title={t('solo.title')}>
      <T muted>{t('solo.subtitle')}</T>
      <Spacer h={spacing.xl} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{t('solo.bots')}</T>
          <Stepper value={bots} min={1} max={11} onChange={setBots} width={40} />
        </Row>
        <Spacer />
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{t('solo.myTickets')}</T>
          <Stepper value={myTickets} min={1} max={4} onChange={setMyTickets} width={40} />
        </Row>
        <Spacer />
        <T variant="h3" style={{ marginBottom: spacing.sm }}>
          {t('solo.difficulty')}
        </T>
        <Segmented
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'easy', label: t('solo.easy') },
            { value: 'medium', label: t('solo.medium') },
            { value: 'hard', label: t('solo.hard') },
          ]}
        />
      </Card>
      <Spacer h={spacing.xl} />
      <Button
        title={t('solo.start')}
        variant="gold"
        icon="play"
        onPress={() => navigation.replace('SoloGame', { bots, myTickets, difficulty })}
      />
    </Screen>
  );
}
