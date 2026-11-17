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
import { fonts, radius, spacing, useThemeColors } from '@/theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** "+₹10" / "−₹10" / "₹0" — the one number everyone wants to see. */
export function signedRupees(n: number): string {
  const v = Math.round(Number(n) * 100) / 100;
  if (v > 0) return `+${formatRupees(v)}`;
  if (v < 0) return `−${formatRupees(-v)}`;
  return formatRupees(0);
}

export function NetAmount({ value, size = 18 }: { value: number; size?: number }) {
  const { colors } = useThemeColors();
  const v = Number(value);
  const color = v > 0 ? colors.success : v < 0 ? colors.error : colors.textMuted;
  return <T style={{ fontFamily: fonts.bold, fontSize: size, color, includeFontPadding: false }}>{signedRupees(v)}</T>;
}

/** Room/series scoreboard: each player's +/− (best first); tap a row for the details. */
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
                  <T variant="tiny" muted>
                    {t('standings.wins', { count: r.wins })} · {t('standings.games', { count: r.games })}
                  </T>
                </View>
                <NetAmount value={r.net} size={19} />
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Row>
            </Pressable>
            {expanded ? (
              <View style={[styles.details, { borderTopColor: colors.border }]}>
                <Row gap={spacing.sm}>
                  <View style={[styles.stat, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                    <T variant="tiny" muted>
                      {t('standings.won')}
                    </T>
                    <T variant="h3" color={colors.success}>
                      {formatRupees(r.won)}
                    </T>
                  </View>
                  <View style={[styles.stat, { backgroundColor: 'rgba(220,38,38,0.08)' }]}>
                    <T variant="tiny" muted>
                      {t('standings.spentTickets', { count: r.tickets })}
                    </T>
                    <T variant="h3" color={colors.error}>
                      {formatRupees(r.spent)}
                    </T>
                  </View>
                  <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                    <T variant="tiny" muted>
                      {t('standings.net')}
                    </T>
                    <NetAmount value={r.net} size={16} />
                  </View>
                </Row>
                {r.list.map((w, k) => (
                  <View key={k} style={[styles.win, { backgroundColor: colors.surfaceAlt }]}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T variant="smallBold">
                        {t('standings.gameShort', { n: w.gameNo })} · {t(`prizes.${w.prize}`)}
                      </T>
                      <T variant="smallBold" color={colors.success}>
                        +{formatRupees(w.amount)}
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
  details: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  win: { borderRadius: radius.md, padding: spacing.sm },
});
