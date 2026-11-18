import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Row, Screen, Spacer, T } from '@/components/ui';
import { TicketView } from '@/components/TicketView';
import { spacing, useThemeColors } from '@/theme';

const DEMO = [4, 0, 21, 0, 45, 0, 63, 0, 85, 0, 12, 0, 33, 0, 57, 0, 71, 88, 7, 18, 0, 39, 48, 0, 66, 0, 0];
const TOP_LINE = new Set([4, 21, 45, 63, 85]);
const SECTIONS = ['1', '2', '3', '4', '5', '6'] as const;
const EMOJI = ['🎫', '📢', '🏆', '✋', '🤝', '🔒'];

export function HowToPlayScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Screen scroll title={t('howToPlay.title')}>
      <TicketView cells={DEMO} marked={TOP_LINE} label={t('prizes.line_1')} badge="✓" />
      <Spacer />
      <View style={{ gap: spacing.md }}>
        {SECTIONS.map((s, i) => (
          <Card key={s}>
            <Row style={{ alignItems: 'flex-start' }}>
              <T variant="h2">{EMOJI[i]}</T>
              <View style={{ flex: 1 }}>
                <T variant="h3" color={colors.primary}>
                  {t(`howToPlay.s${s}t`)}
                </T>
                <T variant="body">{t(`howToPlay.s${s}`)}</T>
              </View>
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
