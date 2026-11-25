import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { formatRupees } from '@/components/Money';
import { useStakeStore } from '@/state/stakeStore';
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
  // Free rooms: only wins count; no amounts.
  const free = useStakeStore((st) => st.mode) === 'free';
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
                {free ? null : <NetAmount value={r.net} size={19} />}
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Row>
            </Pressable>
            {expanded ? (
              <View style={[styles.details, { borderTopColor: colors.border }]}>
                {free ? null : (
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
                )}
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
      {/* Free rooms have no money: no game-by-game money table. */}
      {ledger.data?.length && !free ? <GameByGame games={ledger.data} players={rows} meId={meId} /> : null}
    </View>
  );
}

/** Game column: just "1.", "2." and the pot under it. */
const COL_GAME = 52;
/** Player columns are at least this wide; with few players they stretch to fill the card. */
const COL_PLAYER_MIN = 76;

/**
 * Game-by-game table: rows = games in order (Game 1, 2, …), columns = players (best first),
 * each box what that player won in that game ("–" if they didn't play it), totals at the
 * bottom. Tap any box for the details: tickets, spent, won, net and the prizes.
 */
function GameByGame({ games, players, meId }: { games: LedgerGame[]; players: StandingRow[]; meId?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [picked, setPicked] = useState<{ game: LedgerGame; player: StandingRow } | null>(null);
  const totals = new Map<string, number>();
  games.forEach((g) => g.rows.forEach((r) => totals.set(r.userId, (totals.get(r.userId) ?? 0) + Number(r.won))));
  // Net = won − what the tickets cost, per game and in total (who is up / down overall).
  const netTotals = new Map<string, number>();
  games.forEach((g) => g.rows.forEach((r) => netTotals.set(r.userId, (netTotals.get(r.userId) ?? 0) + Number(r.net))));
  const netText = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatRupees(Math.abs(Math.round(n * 100) / 100))}`;
  const netColor = (n: number) => (n > 0 ? colors.success : n < 0 ? colors.error : colors.textMuted);
  const line = colors.border;
  // Spread the table over the card's full width; scroll sideways only when it can't fit.
  const [avail, setAvail] = useState(0);
  const colPlayer = Math.max(COL_PLAYER_MIN, Math.floor((avail - COL_GAME - 2) / Math.max(1, players.length)));

  const head = (label: React.ReactNode, width: number, key: string) => (
    <View key={key} style={[styles.th, { width, borderColor: line, backgroundColor: colors.surfaceAlt }]}>
      {label}
    </View>
  );

  const detail = picked ? picked.game.rows.find((r) => r.userId === picked.player.userId) : null;
  const prizes = picked ? picked.player.list.filter((w) => w.gameNo === picked.game.gameNo) : [];

  return (
    <Card style={{ padding: spacing.md, gap: spacing.sm }}>
      <Row>
        <Ionicons name="grid-outline" size={18} color={colors.primary} />
        <T variant="h3" style={{ flex: 1 }}>
          {t('standings.gameByGame')}
        </T>
        <T variant="tiny" muted>
          {t('standings.tapBox')}
        </T>
      </Row>
      <T variant="tiny" muted>
        {t('standings.wonNetLegend')}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setAvail(e.nativeEvent.layout.width)}>
        <View style={[styles.table, { borderColor: line }]}>
          <View style={styles.tr}>
            {head(
              <T variant="tiny" muted>
                {t('standings.game')}
              </T>,
              COL_GAME,
              'g',
            )}
            {players.map((p) =>
              head(
                <>
                  <Avatar avatarKey={p.avatarKey} size={22} />
                  <T variant="tiny" numberOfLines={1} color={p.userId === meId ? colors.primary : undefined}>
                    {p.userId === meId ? t('common.you') : p.name.split(' ')[0]}
                  </T>
                </>,
                colPlayer,
                p.userId,
              ),
            )}
          </View>
          {games.map((g, gi) => (
            <View key={g.gameId} style={[styles.tr, gi % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.td, { width: COL_GAME, borderColor: line, alignItems: 'flex-start' }]}>
                <T variant="smallBold">{g.gameNo}.</T>
                <T variant="tiny" muted>
                  {formatRupees(g.pot)}
                </T>
              </View>
              {players.map((p) => {
                const r = g.rows.find((x) => x.userId === p.userId);
                const won = r ? Number(r.won) : null;
                const net = r ? Number(r.net) : 0;
                return (
                  <Pressable
                    key={p.userId}
                    disabled={!r}
                    onPress={() => setPicked({ game: g, player: p })}
                    style={({ pressed }) => [styles.td, { width: colPlayer, borderColor: line, opacity: pressed ? 0.6 : 1 }]}
                  >
                    {won === null ? (
                      <T variant="small" muted>
                        –
                      </T>
                    ) : (
                      <T style={{ fontFamily: fonts.bold, fontSize: 13, color: netColor(net) }}>{netText(net)}</T>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={[styles.tr, { backgroundColor: `${colors.primary}14` }]}>
            <View style={[styles.td, { width: COL_GAME, borderColor: line, alignItems: 'flex-start' }]}>
              <T variant="smallBold">{t('standings.total')}</T>
            </View>
            {players.map((p) => (
              <View key={p.userId} style={[styles.td, { width: colPlayer, borderColor: line }]}>
                <T style={{ fontFamily: fonts.bold, fontSize: 14, color: netColor(netTotals.get(p.userId) ?? 0) }}>
                  {netText(netTotals.get(p.userId) ?? 0)}
                </T>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={picked !== null} transparent animationType="fade" onRequestClose={() => setPicked(null)} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setPicked(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {picked && detail ? (
              <>
                <Row gap={spacing.md}>
                  <Avatar avatarKey={picked.player.avatarKey} size={44} />
                  <View style={{ flex: 1 }}>
                    <T variant="h3" numberOfLines={1}>
                      {picked.player.userId === meId ? t('common.you') : picked.player.name}
                    </T>
                    <T variant="small" muted>
                      {t('standings.gameShort', { n: picked.game.gameNo })} · {t('standings.potOf', { pot: formatRupees(picked.game.pot) })}
                    </T>
                  </View>
                </Row>
                <Row gap={spacing.sm}>
                  <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                    <T variant="tiny" muted>
                      {t('standings.spentTickets', { count: detail.tickets })}
                    </T>
                    <T variant="h3" color={colors.error}>
                      {formatRupees(detail.spent)}
                    </T>
                  </View>
                  <View style={[styles.stat, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                    <T variant="tiny" muted>
                      {t('standings.won')}
                    </T>
                    <T variant="h3" color={colors.success}>
                      {formatRupees(detail.won)}
                    </T>
                  </View>
                  <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                    <T variant="tiny" muted>
                      {t('standings.net')}
                    </T>
                    <NetAmount value={detail.net} size={16} />
                  </View>
                </Row>
                {prizes.length ? (
                  prizes.map((w, k) => (
                    <View key={k} style={[styles.win, { backgroundColor: colors.surfaceAlt }]}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T variant="smallBold">{t(`prizes.${w.prize}`)}</T>
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
                  ))
                ) : (
                  <T muted center>
                    {t('standings.noPrizesThisGame')}
                  </T>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  details: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  win: { borderRadius: radius.md, padding: spacing.sm },
  table: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  tr: { flexDirection: 'row' },
  th: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  td: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
});
