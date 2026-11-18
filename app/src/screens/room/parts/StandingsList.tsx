import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import type { LedgerGame, StandingRow } from '@/types/api';

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
  // Same key prefix as the standings, so refreshing those refreshes this too.
  const ledger = useQuery({ queryKey: [...standingsKey(roomId), 'ledger'], queryFn: () => roomService.getLedger(roomId) });

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
                    {r.isMember === false ? ` · ${t('standings.left')}` : ''}
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
      {ledger.data?.length ? <GameByGame games={ledger.data} players={rows} meId={meId} /> : null}
    </View>
  );
}

/**
 * Game-by-game table: one row per finished game, one column per player (their +/− that
 * game; "–" if they didn't play it), and the totals at the bottom.
 */
function GameByGame({ games, players, meId }: { games: LedgerGame[]; players: StandingRow[]; meId?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const totals = new Map<string, number>();
  games.forEach((g) => g.rows.forEach((r) => totals.set(r.userId, (totals.get(r.userId) ?? 0) + Number(r.net))));
  const cell = (v: number | null, bold?: boolean) => (
    <View style={styles.cell}>
      {v === null ? (
        <T variant="small" muted>
          –
        </T>
      ) : (
        <NetAmount value={v} size={bold ? 15 : 13} />
      )}
    </View>
  );
  return (
    <Card style={{ padding: spacing.md, gap: spacing.sm }}>
      <Row>
        <Ionicons name="list" size={18} color={colors.primary} />
        <T variant="h3">{t('standings.gameByGame')}</T>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Row gap={0} style={[styles.tr, { borderBottomColor: colors.border }]}>
            <View style={styles.gameCol}>
              <T variant="tiny" muted>
                {t('standings.game')}
              </T>
            </View>
            {players.map((p) => (
              <View key={p.userId} style={[styles.cell, { alignItems: 'center' }]}>
                <Avatar avatarKey={p.avatarKey} size={24} />
                <T variant="tiny" numberOfLines={1} color={p.userId === meId ? colors.primary : undefined}>
                  {p.userId === meId ? t('common.you') : p.name.split(' ')[0]}
                </T>
              </View>
            ))}
          </Row>
          {games.map((g) => (
            <Row key={g.gameId} gap={0} style={[styles.tr, { borderBottomColor: colors.border }]}>
              <View style={styles.gameCol}>
                <T variant="smallBold">{t('standings.gameShort', { n: g.gameNo })}</T>
                <T variant="tiny" muted>
                  {formatRupees(g.pot)}
                </T>
              </View>
              {players.map((p) => {
                const r = g.rows.find((x) => x.userId === p.userId);
                return <React.Fragment key={p.userId}>{cell(r ? Number(r.net) : null)}</React.Fragment>;
              })}
            </Row>
          ))}
          <Row gap={0} style={[styles.tr, { backgroundColor: colors.surfaceAlt, borderBottomWidth: 0 }]}>
            <View style={styles.gameCol}>
              <T variant="smallBold">{t('standings.total')}</T>
            </View>
            {players.map((p) => (
              <React.Fragment key={p.userId}>{cell(totals.get(p.userId) ?? 0, true)}</React.Fragment>
            ))}
          </Row>
        </View>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  details: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  win: { borderRadius: radius.md, padding: spacing.sm },
  tr: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  gameCol: { width: 64, justifyContent: 'center' },
  cell: { width: 78, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 6 },
});
