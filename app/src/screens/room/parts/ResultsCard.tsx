import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PrizeList } from '@/components/PrizeList';
import { formatRupees } from '@/components/Money';
import { Card, Loading, Row, T } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { spacing, useThemeColors } from '@/theme';

/** Who won what in one finished game. */
export function ResultsCard({ gameId, meId, highlight }: { gameId: string; meId?: string; highlight?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const results = useQuery({ queryKey: ['results', gameId], queryFn: () => roomService.getResults(gameId) });
  if (results.isLoading) return <Loading />;
  if (!results.data) return null;
  const r = results.data;
  return (
    <Card style={{ borderColor: colors.gold, borderWidth: 2, gap: spacing.sm }}>
      {highlight ? (
        <T variant="smallBold" color={colors.pink}>
          {highlight}
        </T>
      ) : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="h2">🏁 {t('results.title', { n: r.gameNo })}</T>
        <T variant="smallBold" color={colors.goldDark}>
          {t('lobby.pot')} {formatRupees(r.pot)}
        </T>
      </Row>
      <View>
        <PrizeList
          compact
          rows={r.prizes.map((p) => ({
            prize: p.prize,
            amount: Number(p.amount),
            status: p.status,
            winners: p.winners.map((w) => ({ name: w.name, avatarKey: w.avatarKey, isMe: w.userId === meId, amount: Number(w.amount ?? 0) })),
          }))}
        />
      </View>
    </Card>
  );
}
