import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CalledBoard } from '@/components/CalledBoard';
import { formatRupees } from '@/components/Money';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { PrizeList, PrizeRow } from '@/components/PrizeList';
import { TicketView } from '@/components/TicketView';
import { Card, IconButton, Row, Segmented, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { roomKey } from '@/hooks/useRoom';
import { useNow } from '@/hooks/useNow';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useMarksStore } from '@/state/marksStore';
import { useSettingsStore } from '@/state/settingsStore';
import { ClaimCheck, useClaimCheckStore } from '@/state/claimCheckStore';
import { Button } from '@/components/ui';
import { isPrizeComplete, prizeCompletedAt, prizeNumbers, remainingFor } from '@/game/engine/ticket';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { Me, RoomState, Ticket } from '@/types/api';
import { StandingsList } from './StandingsList';
import { GameSettingsSheet } from './GameSettingsSheet';
import { gameLabel } from '@/utils/gameLabel';

type Tab = 'tickets' | 'board' | 'prizes' | 'standings';
const NO_STRIKES: number[] = [];

export function LiveView({
  state,
  me,
  serverNow,
  connected,
}: {
  state: RoomState;
  me: Me;
  serverNow: () => number;
  connected: boolean;
}) {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const caller = useCaller();
  const haptics = useSettingsStore((s) => s.haptics);
  useNow(500);
  const { room } = state;
  const game = state.game!;
  const [tab, setTab] = useState<Tab>('tickets');
  const marks = useMarksStore((s) => s.marks);
  const strike = useMarksStore((s) => s.strike);
  /** ticketId:prize pairs already sent, so a prize is claimed once per ticket. */
  const attempted = useRef(new Set<string>());

  const called = game.calledNumbers;
  const calledSet = useMemo(() => new Set(called), [called]);
  const last = called.length ? called[called.length - 1] : null;
  const previous = called.slice(-6, -1).reverse();

  /** Auto hint: called numbers are highlighted on tickets; players still strike them. */
  const autoHint = room.autoMark;
  const isHost = room.hostId === me.id;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const struckSets = useMemo(
    () => state.myTickets.map((tk) => new Set((marks[tk.id] ?? NO_STRIKES).filter((n) => calledSet.has(n)))),
    [state.myTickets, marks, calledSet],
  );
  const hintSets = useMemo(
    () =>
      autoHint
        ? state.myTickets.map((tk, i) => new Set(tk.cells.filter((n) => n > 0 && calledSet.has(n) && !struckSets[i].has(n))))
        : null,
    [autoHint, state.myTickets, calledSet, struckSets],
  );

  const msToNext = game.nextCallAt ? new Date(game.nextCallAt).getTime() - serverNow() : 0;
  const waitingFirst = called.length === 0;

  /** After a strike: claim every prize this ticket's strikes now complete. */
  const tryClaims = useCallback(
    async (ticket: Ticket, struck: ReadonlySet<number>) => {
      for (const p of state.prizes) {
        const key = `${ticket.id}:${p.prize}`;
        if (attempted.current.has(key) || p.winners.some((w) => w.userId === me.id)) continue;
        if (!isPrizeComplete(ticket.cells, struck, p.prize)) continue;
        if (p.status !== 'open') {
          // Already won: only worth claiming if I completed it on the very same number (split).
          if (p.status !== 'won' || prizeCompletedAt(ticket.cells, called, p.prize) !== p.wonAtCall) continue;
        }
        attempted.current.add(key);
        try {
          const result = await roomService.claim(ticket.id, p.prize);
          const prizeName = t(`prizes.${p.prize}`);
          if (result === 'won' || result === 'shared') {
            caller.celebrate();
            showToast({ variant: 'prize', title: t(result === 'won' ? 'game.claimWon' : 'game.claimShared', { prize: prizeName }) });
          } else if (result === 'already_claimed') {
            showToast({ variant: 'info', title: t('game.claimTooLate', { prize: prizeName }) });
          }
        } catch (err) {
          attempted.current.delete(key);
          showToast({ variant: 'error', title: errorMessage(err) });
        } finally {
          qc.invalidateQueries({ queryKey: roomKey(room.id) });
        }
      }
    },
    [state.prizes, me.id, called, caller, t, qc, room.id],
  );

  // Uncalled numbers never reach here: the tile just wiggles (canStrike below).
  const onPressNumber = (ticket: Ticket, index: number) => (n: number) => {
    if (struckSets[index].has(n)) return;
    strike(ticket.id, n);
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const next = new Set(struckSets[index]);
    next.add(n);
    tryClaims(ticket, next);
  };

  const prizeRows: PrizeRow[] = state.prizes.map((p) => ({
    prize: p.prize,
    amount: Number(p.amount),
    status: p.status,
    winners: p.winners.map((w) => ({ name: w.name, avatarKey: w.avatarKey, isMe: w.userId === me.id })),
    remaining: state.myTickets.length
      ? Math.min(...state.myTickets.map((tk, i) => remainingFor(tk.cells, struckSets[i], p.prize)))
      : undefined,
  }));

  const wonByTicket = (ticketId: string) =>
    state.prizes
      .filter((p) => p.winners.some((w) => w.userId === me.id && state.myTickets.find((tk) => tk.id === ticketId)?.serial === w.ticketSerial))
      .map((p) => t(`prizes.${p.prize}`))
      .join(' · ');

  const togglePause = useMutation({
    mutationFn: () => roomService.setPaused(game.id, !game.paused),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(room.id) }),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  // A claim waiting for everyone to check replaces the number header until its time is up.
  const activeCheck = useClaimCheckStore((s) => s.checks).find(
    (c) => c.gameId === game.id && new Date(c.deadline).getTime() > serverNow() - 500,
  );

  // The timer bar stops where it is while the game is paused.
  const livePct = Math.max(0, Math.min(100, 100 - (msToNext / (room.callIntervalSeconds * 1000)) * 100));
  const frozenPct = useRef(livePct);
  if (!game.paused) frozenPct.current = livePct;
  const progressPct = game.paused ? frozenPct.current : livePct;

  const [confirmLeave, setConfirmLeave] = useState(false);
  const leave = () => setConfirmLeave(true);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={heroGradient} style={styles.top}>
        <SafeAreaView edges={['top']}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
            <IconButton icon="chevron-back" color="#fff" onPress={leave} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <T variant="h3" color="#fff" numberOfLines={1}>
                {room.title}
              </T>
              <T variant="tiny" color={connected ? 'rgba(255,255,255,0.8)' : '#FDE68A'}>
                {connected ? gameLabel(room, game.gameNo) : t('game.reconnecting')}
              </T>
            </View>
            {isHost ? (
              <IconButton icon="timer-outline" color="#fff" onPress={() => setSettingsOpen(true)} accessibilityLabel={t('game.speedTitle')} />
            ) : (
              <View style={{ width: 40 }} />
            )}
          </Row>
          {activeCheck ? (
            <ClaimHeader key={activeCheck.prize + activeCheck.callIndex} check={activeCheck} state={state} me={me} serverNow={serverNow} />
          ) : (
          <Row style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }} gap={spacing.lg}>
            <NumberBall number={last} size={112} />
            <View style={{ flex: 1 }}>
              {waitingFirst ? (
                <>
                  <T variant="h2" color="#fff">
                    {t('game.getReady')}
                  </T>
                  <T color="rgba(255,255,255,0.85)">
                    {game.paused ? t('game.paused') : t('game.firstNumberIn', { seconds: Math.max(0, Math.ceil(msToNext / 1000)) })}
                  </T>
                </>
              ) : (
                <>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="h1" color="#fff">
                      {t('game.calledCount', { count: called.length })}
                    </T>
                    <T variant="smallBold" color="#FDE68A">
                      {t('lobby.pot')} {formatRupees(game.pot)}
                    </T>
                  </Row>
                  <View style={styles.progress}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: 3,
                        backgroundColor: colors.gold,
                        width: `${progressPct}%`,
                      }}
                    />
                  </View>
                  <Row gap={6} style={{ marginTop: spacing.sm }}>
                    {previous.map((n) => (
                      <MiniBall key={n} n={n} size={28} />
                    ))}
                  </Row>
                </>
              )}
            </View>
          </Row>
          )}
        </SafeAreaView>
      </LinearGradient>

      {game.paused ? (
        <Pressable onPress={isHost ? () => togglePause.mutate() : undefined} style={[styles.pausedBar, { backgroundColor: colors.warning }]}>
          <Ionicons name="pause-circle" size={18} color="#fff" />
          <T variant="smallBold" color="#fff">
            {isHost ? t('game.pausedHost') : t('game.paused')}
          </T>
        </Pressable>
      ) : null}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tickets', label: t('game.tickets') },
            { value: 'board', label: t('game.board') },
            { value: 'prizes', label: t('game.prizes') },
            { value: 'standings', label: t('room.tabStandings') },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: tab === 'tickets' ? spacing.sm : spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.md,
          paddingBottom: spacing.xxl + insets.bottom + (isHost ? 64 : 0) + (room.chatEnabled ? 74 : 0),
        }}
      >
        {tab === 'tickets' ? (
          state.myTickets.length === 0 ? (
            <Card>
              <T muted center>
                {t('game.watching')}
              </T>
            </Card>
          ) : (
            <>
              <T variant="small" muted center>
                {'👆 ' + t('game.tapToStrike')}
                {autoHint ? ' ' + t('game.autoHintOn') : ''}
              </T>
              {state.myTickets.map((tk, i) => (
                <TicketView
                  key={tk.id}
                  cells={tk.cells}
                  marked={struckSets[i]}
                  lastCalled={last}
                  hinted={hintSets?.[i]}
                  onPressNumber={onPressNumber(tk, i)}
                  canStrike={(n) => calledSet.has(n)}
                  label={`#${tk.serial}`}
                  badge={wonByTicket(tk.id) || undefined}
                />
              ))}
            </>
          )
        ) : null}
        {tab === 'board' ? <CalledBoard called={calledSet} last={last} /> : null}
        {tab === 'prizes' ? <PrizeList rows={prizeRows} /> : null}
        {tab === 'standings' ? <StandingsList roomId={room.id} meId={me.id} /> : null}
      </ScrollView>
      {isHost ? (
        <Pressable
          onPress={() => togglePause.mutate()}
          disabled={togglePause.isPending}
          accessibilityLabel={game.paused ? t('game.resume') : t('game.pause')}
          style={({ pressed }) => [styles.fab, { bottom: spacing.xl + insets.bottom, opacity: pressed || togglePause.isPending ? 0.8 : 1 }]}
        >
          <LinearGradient colors={game.paused ? ['#22C55E', '#15803D'] : ['#F59E0B', '#D97706']} style={styles.fabInner}>
            <Ionicons name={game.paused ? 'play' : 'pause'} size={28} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}
      {isHost ? <GameSettingsSheet visible={settingsOpen} state={state} onClose={() => setSettingsOpen(false)} /> : null}
      <ConfirmModal
        visible={confirmLeave}
        icon="exit-outline"
        gradient={BRAND_GRADIENT}
        title={t('game.leaveTitle')}
        message={t('game.leaveConfirm')}
        confirmLabel={t('common.ok')}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingBottom: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabInner: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  claimBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(236,72,153,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(253,230,138,0.6)',
  },
  bell: { fontSize: 34 },
  checkBar: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
  pausedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  progress: { height: 6, borderRadius: 3, marginTop: spacing.sm, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
});

/**
 * Normal rule ("check before announcing"): someone claimed a prize. This replaces the number
 * header for the check time: who claimed what on which number, a countdown, and — for
 * everyone else — "I have it too!", which strikes the missed numbers and claims a share.
 * Players can also keep striking numbers they missed on their tickets below.
 */
function ClaimHeader({ check, state, me, serverNow }: { check: ClaimCheck; state: RoomState; me: Me; serverNow: () => number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const strike = useMarksStore((s) => s.strike);
  const game = state.game!;
  const called = game.calledNumbers;
  const number = called[check.callIndex - 1] ?? null;
  const msLeft = Math.max(0, new Date(check.deadline).getTime() - serverNow());
  const left = Math.ceil(msLeft / 1000);
  const total = Math.max(1, state.room.checkSeconds * 1000);
  const mine = check.winners.some((w) => w.userId === me.id);
  const names = check.winners.map((w) => (w.userId === me.id ? t('common.you') : w.name)).join(' & ');
  const prize = t(`prizes.${check.prize}`);

  const enter = useRef(new Animated.Value(0)).current;
  const bell = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bell, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 240, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, bell]);

  const claim = useMutation({
    mutationFn: async () => {
      const tickets = state.myTickets.filter((tk) => prizeCompletedAt(tk.cells, called, check.prize) === check.callIndex);
      if (!tickets.length) return 'none' as const;
      // Strike the numbers that made it, in case some were missed.
      const upTo = new Set(called.slice(0, check.callIndex));
      tickets.forEach((tk) => prizeNumbers(tk.cells, check.prize).forEach((n) => upTo.has(n) && strike(tk.id, n)));
      let best = 'already_claimed';
      for (const tk of tickets) {
        const r = await roomService.claim(tk.id, check.prize);
        if (r === 'won' || r === 'shared' || r === 'already_yours') best = 'shared';
      }
      return best;
    },
    onSuccess: (r) => {
      if (r === 'none') showToast({ variant: 'error', title: t('game.checkNotYours', { prize }) });
      else if (r === 'shared') showToast({ variant: 'prize', title: t('game.claimShared', { prize }) });
      else showToast({ variant: 'info', title: t('game.claimTooLate', { prize }) });
      qc.invalidateQueries({ queryKey: roomKey(state.room.id) });
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  return (
    <Animated.View
      style={[
        styles.claimBox,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
          ],
        },
      ]}
    >
      <Row gap={spacing.md}>
        <Animated.Text style={[styles.bell, { transform: [{ rotate: bell.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] }]}>
          🔔
        </Animated.Text>
        <View style={{ flex: 1 }}>
          <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 1 }}>
            {t('game.claimedLabel').toUpperCase()}
          </T>
          <T variant="h2" color="#fff" numberOfLines={2}>
            {t('game.checkTitle', { name: names, prize })}
          </T>
        </View>
        {number !== null ? <MiniBall n={number} size={44} /> : null}
      </Row>
      <T variant="small" color="rgba(255,255,255,0.9)" style={{ marginTop: 6 }}>
        {mine ? t('game.checkWaitingOthers') : t('game.checkYours', { number: number ?? '' })}
      </T>
      <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.checkBar}>
            <View style={{ height: '100%', borderRadius: 4, backgroundColor: '#FDE68A', width: `${(msLeft / total) * 100}%` }} />
          </View>
          <T variant="tiny" color="rgba(255,255,255,0.8)">
            {t('game.checkSecondsLeft', { count: left })}
          </T>
        </View>
        {!mine && state.myTickets.length ? (
          <Button title={t('game.checkHaveIt')} variant="gold" icon="hand-left" small loading={claim.isPending} onPress={() => claim.mutate()} />
        ) : null}
      </Row>
    </Animated.View>
  );
}
