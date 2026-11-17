import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { formatRupees } from '@/components/Money';
import { MiniBall } from '@/components/NumberBall';
import { Card, EmptyState, Loading, Row, T } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { standingsKey } from '@/hooks/useRoom';
import { radius, spacing, useThemeColors } from '@/theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Room/series scoreboard: total won, tickets, net, and every win game by game. */
export function StandingsList({ roomId, meId }: { roomId: string; meId?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [open, setOpen] = useState<string | null>(null);
  const standings = useQuery({ queryKey: standingsKey(roomId), queryFn: () => roomService.getStandings(roomId) });

  if (standings.isLoading) return <Loading />;
  const rows = (standings.data ?? []).filter((r) => r.games > 0 || r.wins > 0);
  if (!rows.length) return <EmptyState icon="podium-outline" title={t('standings.empty')} />;

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r, i) => {
        const expanded = open === r.userId;
        const isMe = r.userId === meId;
        return (
          <Card key={r.userId} style={[{ padding: spacing.md }, isMe && { borderColor: colors.primary, borderWidth: 2 }]}>
            <Pressable onPress={() => setOpen(expanded ? null : r.userId)}>
              <Row gap={spacing.md}>
                <T variant="h2" style={{ width: 30, textAlign: 'center' }}>
                  {MEDALS[i] ?? i + 1}
                </T>
                <Avatar avatarKey={r.avatarKey} size={40} />
                <View style={{ flex: 1 }}>
                  <T variant="h3" numberOfLines={1}>
                    {r.name}
                    {isMe ? ` (${t('common.you')})` : ''}
                  </T>
                  <T variant="small" muted>
                    {t('standings.wins', { count: r.wins })} · {t('standings.games', { count: r.games })}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T variant="h3" color={colors.goldDark}>
                    {formatRupees(r.won)}
                  </T>
                  <T variant="tiny" color={r.net >= 0 ? colors.success : colors.error}>
                    {t('standings.net')} {r.net >= 0 ? '+' : ''}
                    {formatRupees(r.net)}
                  </T>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Row>
            </Pressable>
            {expanded ? (
              <View style={[styles.details, { borderTopColor: colors.border }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="small" muted>
                    {t('standings.spent')}: 🎫 {r.tickets} · {formatRupees(r.spent)}
                  </T>
                  <T variant="small" muted>
                    {t('standings.won')}: {formatRupees(r.won)}
                  </T>
                </Row>
                {r.list.map((w, k) => (
                  <View key={k} style={[styles.win, { backgroundColor: colors.surfaceAlt }]}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T variant="smallBold">
                        {t('standings.gameShort', { n: w.gameNo })} · {t(`prizes.${w.prize}`)}
                      </T>
                      <T variant="smallBold" color={colors.goldDark}>
                        {formatRupees(w.amount)}
                      </T>
                    </Row>
                    <Row gap={4} style={{ flexWrap: 'wrap', marginTop: 4 }}>
                      {w.numbers.map((n) => (
                        <MiniBall key={n} n={n} size={22} />
                      ))}
                    </Row>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  details: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, gap: spacing.sm },
  win: { borderRadius: radius.md, padding: spacing.sm },
});
