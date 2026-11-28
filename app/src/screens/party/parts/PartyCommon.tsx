import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '@/components/Avatar';
import { CoinIcon } from '@/components/CoinIcon';
import { showToast } from '@/state/toastStore';
import { PARTY_LOOK } from './Premium';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button, Card, Row, T } from '@/components/ui';
import { JOIN_LINK_BASE } from '@/constants/config';
import { isBoardGame, PARTY_LIMITS, type PartyPlayer, type PartyState } from '@/services/partyService';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { GameCodeCard } from '@/components/GameCodeCard';

/** Re-renders every half second (countdowns). */
export function useNow(active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Round x / y + a countdown pill that turns red in the last 5 s. */
export function RoundBar({ state, seconds, label }: { state: PartyState; seconds: number; label?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const urgent = seconds <= 5;
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
      <View style={[styles.roundPill, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="flag" size={13} color={colors.primary} />
        <T variant="smallBold">{t('party.roundOf', { n: state.game.roundNo, total: state.game.rounds })}</T>
      </View>
      {label ? (
        <T variant="tiny" muted style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
          {label}
        </T>
      ) : null}
      {state.game.deadline ? (
        <View style={[styles.roundPill, { backgroundColor: urgent ? colors.error : colors.primary }]}>
          <Ionicons name="time" size={13} color="#fff" />
          <T variant="smallBold" color="#fff" maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {seconds}s
          </T>
        </View>
      ) : null}
    </Row>
  );
}

/** Running totals, best first. */
export function ScoreStrip({ players, meId }: { players: PartyPlayer[]; meId: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const ranked = [...players].filter((p) => p.active).sort((a, b) => b.score - a.score);
  return (
    <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.sm }}>
      <T variant="smallBold" muted style={{ marginBottom: 6, letterSpacing: 0.6 }}>
        {t('party.scores').toUpperCase()}
      </T>
      {ranked.map((p, i) => (
        <Row key={p.userId} gap={spacing.sm} style={{ paddingVertical: 4 }}>
          <T variant="smallBold" muted style={{ width: 20 }}>
            {i + 1}
          </T>
          <Avatar avatarKey={p.avatarKey} size={26} />
          <T variant="small" style={{ flex: 1 }} numberOfLines={1} color={p.userId === meId ? colors.primary : undefined}>
            {p.name}
            {p.userId === meId ? ` (${t('party.you')})` : ''}
          </T>
          <T variant="smallBold" color={colors.goldDark}>
            {p.score.toLocaleString('en-IN')}
          </T>
        </Row>
      ))}
    </Card>
  );
}

/** Lobby: the code to share, who's in, and Start (host, 3+) or "waiting for the host". */
export function PartyLobby({
  state,
  title,
  busy,
  onStart,
  onLeave,
  onRemove,
  extra,
}: {
  state: PartyState;
  title: string;
  /** Game-specific lobby settings (Show: card category). */
  extra?: React.ReactNode;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
  onRemove: (p: PartyPlayer) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [removing, setRemoving] = useState<PartyPlayer | null>(null);
  const isHost = state.game.hostId === state.me.userId;
  const players = state.players.filter((p) => p.active);
  const need = Math.max(0, PARTY_LIMITS[state.game.kind][0] - players.length);
  const look = PARTY_LOOK[state.game.kind];
  // Copy: the icon turns into a green tick and the button says Copied ✓ for 2 s (plus a toast).
  const [copied, setCopied] = useState(false);
  // Tiles shrink on narrow phones so the code and the copy button always fit on one line.
  const { width: screenW } = useWindowDimensions();
  const tileW = Math.max(26, Math.min(36, Math.floor((screenW - 32 - 48 - 46 - 30) / 6)));
  const copyPop = useRef(new Animated.Value(0)).current;
  const tilePop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(tilePop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [tilePop]);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = () =>
    Clipboard.setStringAsync(state.game.code).then(() => {
      setCopied(true);
      copyPop.setValue(0);
      Animated.timing(copyPop, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      showToast({ variant: 'success', title: t('common.copied') });
    });
  const share = () =>
    Share.share({ message: t('party.shareMessage', { game: title, code: state.game.code, link: JOIN_LINK_BASE + state.game.code }) }).catch(
      () => undefined,
    );

  return (
    <View>
      <GameCodeCard
        code={state.game.code}
        colors={look.colors}
        emoji={look.emoji}
        label={t('party.gameCode')}
        shareMessage={t('party.shareMessage', { game: title, code: state.game.code, link: JOIN_LINK_BASE + state.game.code })}
      />

      {/* Entry + pot, and the game's rules (Ashta Chamma) */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <CoinIcon size={18} />
            <T variant="smallBold">
              {state.game.options?.stake === 'amount'
                ? t('party.amountEach', { amount: state.game.options.amount ?? 0 })
                : state.game.entryCoins
                  ? t('party.entryEach', { count: state.game.entryCoins })
                  : t('party.freeGame')}
            </T>
          </Row>
          {state.game.options?.stake === 'amount' ? (
            <T variant="smallBold" color={colors.goldDark}>
              {t('party.amountPot', { amount: (state.game.options.amount ?? 0) * players.length })}
            </T>
          ) : state.game.entryCoins ? (
            <T variant="smallBold" color={colors.goldDark}>
              {t('party.potWillBe', { count: state.game.entryCoins * players.length })}
            </T>
          ) : null}
        </Row>
        {state.game.kind === 'chamma' ? (
          <View style={styles.ruleChips}>
            {[
              t(state.game.options.start === 'board' ? 'party.chamma.startBoard' : 'party.chamma.startEnter'),
              t(`party.chamma.safe_${state.game.options.safe ?? 'corners'}`),
              state.game.options.teams ? t('party.chamma.optTeams') : null,
              state.game.options.needCut === false ? t('party.chamma.noCutNeeded') : t('party.chamma.optCut'),
            ]
              .filter(Boolean)
              .map((label) => (
                <View key={label as string} style={[styles.ruleChip, { backgroundColor: colors.surfaceAlt }]}>
                  <T variant="tiny">{label}</T>
                </View>
              ))}
          </View>
        ) : null}
      </View>

      <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <T variant="smallBold" muted style={{ letterSpacing: 0.6 }}>
          {t('party.inLobby', { count: players.length }).toUpperCase()}
        </T>
        {isBoardGame(state.game.kind) ? null : (
          <T variant="tiny" muted>
            {t('party.roundsCount', { count: state.game.rounds })}
          </T>
        )}
      </Row>
      <View style={styles.grid}>
        {players.map((p) => (
          <PlayerChip key={p.userId} player={p} host={p.userId === state.game.hostId} me={p.userId === state.me.userId}>
            {isHost && p.userId !== state.me.userId ? (
              <Pressable onPress={() => setRemoving(p)} hitSlop={8} style={[styles.removeBtn, { backgroundColor: colors.error }]}>
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            ) : null}
          </PlayerChip>
        ))}
        {Array.from({ length: need }, (_, i) => (
          <View key={`empty${i}`} style={styles.chip}>
            <View style={[styles.emptySeat, { borderColor: colors.border }]}>
              <Ionicons name="person-add" size={18} color={colors.textMuted} />
            </View>
            <T variant="tiny" muted numberOfLines={1}>
              {t('party.waiting')}
            </T>
          </View>
        ))}
      </View>

      {extra}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {isHost ? (
          <>
            <Button title={t('party.start')} variant="gold" icon="play" loading={busy} disabled={need > 0} onPress={onStart} />
            {need > 0 ? (
              <T variant="tiny" muted center>
                {t('party.needMore', { count: need })}
              </T>
            ) : null}
          </>
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <PulseDot />
            <T variant="small" muted center style={{ marginTop: 6 }}>
              {need > 0 ? t('party.needMore', { count: need }) : t('party.waitingHost')}
            </T>
          </Card>
        )}
        <Button title={t('party.leave')} variant="ghost" icon="exit-outline" onPress={onLeave} />
      </View>

      <ConfirmModal
        visible={removing !== null}
        icon="person-remove"
        title={t('party.removeTitle')}
        message={t('party.removeMessage', { name: removing?.name ?? '' })}
        confirmLabel={t('party.remove')}
        onConfirm={() => {
          if (removing) onRemove(removing);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

export function PlayerChip({
  player,
  host,
  me,
  children,
}: {
  player: PartyPlayer;
  host?: boolean;
  me?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <View style={styles.chip}>
      <View>
        <Avatar avatarKey={player.avatarKey} size={52} ring={me ? '#FDE68A' : undefined} />
        {host ? (
          <View style={styles.hostBadge}>
            <Ionicons name="star" size={10} color="#3B1D00" />
          </View>
        ) : null}
        {children}
      </View>
      <T variant="tiny" numberOfLines={1} color={me ? colors.primary : undefined} style={{ marginTop: 4, maxWidth: 70 }}>
        {me ? t('party.you') : player.name}
      </T>
    </View>
  );
}

function PulseDot() {
  const { colors } = useThemeColors();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.primary,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
      }}
    />
  );
}

/** Game over: podium for the top three, then everyone; host plays again or ends. */
export function PartyFinished({
  state,
  busy,
  onAgain,
  onEnd,
  onLeave,
}: {
  state: PartyState;
  busy: boolean;
  onAgain: () => void;
  onEnd: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const isHost = state.game.hostId === state.me.userId;
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 3);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [pop]);
  // Podium order: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].filter(Boolean) as PartyPlayer[];
  const height = (p: PartyPlayer) => (p === top[0] ? 96 : p === top[1] ? 72 : 56);
  const medal = (p: PartyPlayer) => (p === top[0] ? '🥇' : p === top[1] ? '🥈' : '🥉');
  const actions = (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      {isHost ? (
        <>
          <Button title={t('party.playAgain')} variant="gold" icon="refresh" loading={busy} onPress={onAgain} />
        </>
      ) : (
        <T variant="small" muted center>
          {t('party.waitingAgain')}
        </T>
      )}
      <Button title={t('party.leave')} variant="ghost" icon="exit-outline" onPress={onLeave} />
    </View>
  );

  // Board games: just the winner(s) — and the coins they took.
  if (isBoardGame(state.game.kind)) {
    const winnerIds = state.game.state.winners ?? (state.game.state.winnerId ? [state.game.state.winnerId] : []);
    const winners = winnerIds.map((id) => state.players.find((p) => p.userId === id)).filter(Boolean) as PartyPlayer[];
    const iWon = winnerIds.includes(state.me.userId);
    const payout = state.game.state.payout;
    const look = PARTY_LOOK[state.game.kind];
    return (
      <View>
        <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
          <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.winnerCard}>
            <T style={styles.codeWatermark}>🏆</T>
            <T variant="tiny" color="rgba(255,255,255,0.85)" style={{ letterSpacing: 2 }}>
              {(iWon ? t('party.youWon') : t('party.gameOver')).toUpperCase()}
            </T>
            <Row gap={6} style={{ marginTop: spacing.md }}>
              {winners.map((w) => (
                <Avatar key={w.userId} avatarKey={w.avatarKey} size={78} ring="#FDE68A" />
              ))}
            </Row>
            <T style={styles.winnerName} center numberOfLines={2}>
              {winners.map((w) => (w.userId === state.me.userId ? t('party.you') : w.name)).join(' & ')}
            </T>
            <T variant="small" color="rgba(255,255,255,0.9)">
              {winners.length > 1 ? t('party.winTeam') : t('party.wins')} 🏆
            </T>
            {payout?.pot ? (
              <View style={styles.payoutPill}>
                <CoinIcon size={18} />
                <T variant="smallBold" color="#3B1D00">
                  {winners.length > 1 ? t('party.wonEach', { count: payout.each }) : t('party.wonCoins', { count: payout.pot })}
                </T>
              </View>
            ) : null}
          </LinearGradient>
        </Animated.View>
        {actions}
      </View>
    );
  }

  return (
    <View>
      <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
        <LinearGradient colors={['#2A0A4F', '#6D28D9', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.finishCard}>
          <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 2 }}>
            {t('party.gameOver').toUpperCase()}
          </T>
          <T variant="h2" color="#fff" center style={{ marginTop: 2 }}>
            {t('party.winnerIs', { name: top[0]?.name ?? '' })}
          </T>
          <Row style={{ alignItems: 'flex-end', marginTop: spacing.lg, gap: spacing.sm }}>
            {podium.map((p) => (
              <View key={p.userId} style={{ alignItems: 'center', flex: 1 }}>
                <Avatar avatarKey={p.avatarKey} size={p === top[0] ? 58 : 46} ring="#FDE68A" />
                <T variant="tiny" color="#fff" numberOfLines={1} style={{ marginTop: 4 }}>
                  {p.name}
                </T>
                <LinearGradient colors={['#FFF1A8', '#F5B700']} style={[styles.podium, { height: height(p) }]}>
                  <T style={{ fontSize: 22 }}>{medal(p)}</T>
                  <T variant="smallBold" color="#3B1D00">
                    {p.score.toLocaleString('en-IN')}
                  </T>
                </LinearGradient>
              </View>
            ))}
          </Row>
        </LinearGradient>
      </Animated.View>

      <Card style={{ marginTop: spacing.md, paddingVertical: spacing.sm }}>
        {ranked.map((p, i) => (
          <Row key={p.userId} gap={spacing.sm} style={{ paddingVertical: 5 }}>
            <T variant="smallBold" muted style={{ width: 22 }}>
              {i + 1}
            </T>
            <Avatar avatarKey={p.avatarKey} size={28} />
            <T variant="small" style={{ flex: 1 }} numberOfLines={1} color={p.userId === state.me.userId ? colors.primary : undefined}>
              {p.name}
            </T>
            <T variant="smallBold" color={colors.goldDark}>
              {p.score.toLocaleString('en-IN')}
            </T>
          </Row>
        ))}
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {isHost ? (
          <>
            <Button title={t('party.playAgain')} variant="gold" icon="refresh" loading={busy} onPress={onAgain} />
          </>
        ) : (
          <T variant="small" muted center>
            {t('party.waitingAgain')}
          </T>
        )}
        <Button title={t('party.leave')} variant="ghost" icon="exit-outline" onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  roundPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  codeEdge: { borderRadius: 22, padding: 1.5 },
  codeCard: { borderRadius: 21, padding: spacing.md, alignItems: 'center', overflow: 'hidden' },
  codeBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  codePill: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, height: 62, marginTop: spacing.sm, borderRadius: 31, paddingLeft: 9, paddingRight: 7, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)' },
  codeKey: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  codeBig: { flex: 1, textAlign: 'center', color: '#FDE68A', fontFamily: fonts.display, fontSize: 30, lineHeight: 38, letterSpacing: 7, includeFontPadding: false, textAlignVertical: 'center' },
  codeInvite: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#92400E' },
  codeWatermark: { position: 'absolute', right: -10, bottom: -20, fontSize: 110, lineHeight: 130, opacity: 0.18 },
  copyBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F5B700', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF1A8' },
  copyBtnDone: { backgroundColor: '#86EFAC' },
  codeActionDone: { backgroundColor: '#86EFAC' },
  codeTile: { width: 36, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  codeTileShine: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.6)' },
  codeChar: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  codeAction: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  codeActionMain: { backgroundColor: '#fff' },
  infoCard: { marginTop: spacing.md, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  ruleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ruleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  code: { fontFamily: fonts.display, fontSize: 40, lineHeight: 50, letterSpacing: 8, color: '#fff', marginTop: 2 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chip: { width: 70, alignItems: 'center' },
  emptySeat: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hostBadge: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: { position: 'absolute', right: -2, top: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  winnerCard: { borderRadius: 24, padding: spacing.lg, alignItems: 'center', overflow: 'hidden' },
  winnerName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: '#fff', marginTop: spacing.sm },
  payoutPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: '#FDE68A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  finishCard: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  podium: { width: '100%', marginTop: 6, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
