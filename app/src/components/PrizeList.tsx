import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { PrizeType } from '@/game/engine/ticket';
import { radius, spacing, useThemeColors } from '@/theme';
import { Avatar } from './Avatar';
import { formatRupees, Money } from './Money';
import { isFreeRoom } from '@/state/stakeStore';
import { T } from './ui';

export interface PrizeRow {
  prize: PrizeType;
  amount?: number;
  status: 'open' | 'won' | 'settled' | 'unclaimed';
  winners: { name: string; avatarKey: string; isMe?: boolean; amount?: number }[];
  /** "1 to go" hint for my best ticket. */
  remaining?: number;
}

export function PrizeList({
  rows,
  showAmounts = true,
  compact,
}: {
  rows: PrizeRow[];
  showAmounts?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => {
        const done = row.status === 'won' || row.status === 'settled';
        const iWon = row.winners.some((w) => w.isMe);
        return (
          <View
            key={row.prize}
            style={[
              styles.row,
              compact && { paddingVertical: spacing.sm },
              {
                backgroundColor: iWon ? 'rgba(22,163,74,0.12)' : colors.surface,
                borderColor: iWon ? colors.success : done ? colors.gold : colors.border,
              },
            ]}
          >
            <Ionicons
              name={done ? 'trophy' : row.status === 'unclaimed' ? 'remove-circle-outline' : 'ellipse-outline'}
              size={22}
              color={done ? colors.gold : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T variant="h3">{t(`prizes.${row.prize}`)}</T>
                {!done && row.status === 'open' && row.remaining === 1 ? (
                  <T variant="tiny" color={colors.pink}>
                    {t('game.oneToGo')}
                  </T>
                ) : null}
              </View>
              {done ? (
                <View style={styles.winners}>
                  {row.winners.map((w, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Avatar avatarKey={w.avatarKey} size={18} />
                      <T variant="small" color={w.isMe ? colors.success : colors.textMuted} numberOfLines={1}>
                        {w.isMe ? t('common.you') : w.name}
                        {w.amount && !isFreeRoom() ? ` · ${formatRupees(w.amount)}` : ''}
                      </T>
                    </View>
                  ))}
                </View>
              ) : (
                <T variant="small" muted numberOfLines={1}>
                  {row.status === 'unclaimed' ? t('prizes.unclaimed') : t(`prizes.desc.${row.prize}`)}
                </T>
              )}
            </View>
            {showAmounts && !isFreeRoom() && row.amount !== undefined ? <Money amount={row.amount} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  winners: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
});
