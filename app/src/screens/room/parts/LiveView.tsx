import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
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
import { playStrikeSound } from '@/services/sounds';
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

export function LiveView({ state, me, serverNow, connected }: { state: RoomState; me: Me; serverNow: () => number; connected: boolean }) {
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
  /** Auto rule: the app strikes every called number and the server awards prizes — no taps. */
  const autoRule = room.claimMode === 'fair';
  const autoHint = room.autoMark && !autoRule;
  const isHost = room.hostId === me.id;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const struckSets = useMemo(
    () =>
      state.myTickets.map((tk) =>
        autoRule
          ? new Set(tk.cells.filter((n) => n > 0 && calledSet.has(n)))
          : new Set((marks[tk.id] ?? NO_STRIKES).filter((n) => calledSet.has(n))),
      ),
    [state.myTickets, marks, calledSet, autoRule],
  );
  const hintSets = useMemo(
    () =>
      !autoHint
        ? null
        : room.hintMode === 'next'
          ? // Only the newest number, until the next one is called.
            state.myTickets.map((tk, i) => new Set(last !== null && tk.cells.includes(last) && !struckSets[i].has(last) ? [last] : []))
          : // Every called number, until it's struck.
            state.myTickets.map((tk, i) => new Set(tk.cells.filter((n) => n > 0 && calledSet.has(n) && !struckSets[i].has(n)))),
    [autoHint, room.hintMode, last, state.myTickets, calledSet, struckSets],
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
          // Already won: worth claiming for a share — on the same number, or (Normal rule, during
          // the check) on an earlier number I was late to claim.
          if (p.status !== 'won') continue;
          const at = prizeCompletedAt(ticket.cells, called, p.prize);
          const late = room.checkClaims && game.checkOpen && at !== null && at <= (p.wonAtCall ?? 0);
          if (at !== p.wonAtCall && !late) continue;
        }
        attempted.current.add(key);
        try {
          const result = await roomService.claim(ticket.id, p.prize);
          const prizeName = t(`prizes.${p.prize}`);
          if (result === 'won' || result === 'shared') {
            caller.celebrate();
            showToast({
              variant: 'prize',
              title: t(result === 'won' ? 'game.claimWon' : 'game.claimShared', { prize: prizeName }),
            });
          } else if (result === 'already_claimed') {
            showToast({
              variant: 'info',
              title: t('game.claimTooLate', { prize: prizeName }),
            });
          } else if (result === 'too_late') {
            // Late claim on: finished earlier, but more numbers have passed than the room allows.
            showToast({
              variant: 'info',
              title: t('game.claimTooLateCalls', { prize: prizeName, count: room.lateClaimCalls }),
            });
          }
        } catch (err) {
          attempted.current.delete(key);
          showToast({ variant: 'error', title: errorMessage(err) });
        } finally {
          qc.invalidateQueries({ queryKey: roomKey(room.id) });
        }
      }
    },
    [state.prizes, me.id, called, caller, t, qc, room.id, room.lateClaimCalls],
  );

  // Uncalled numbers never reach here: the tile just wiggles (canStrike below).
  // The handlers read the latest values through a ref, so each ticket gets ONE stable function
  // and the memoized TicketView doesn't redraw on every countdown tick (twice a second).
  const latest = useRef({ struckSets, tryClaims, haptics, strike });
  latest.current = { struckSets, tryClaims, haptics, strike };
  const pressHandlers = useMemo(
    () =>
      state.myTickets.map((ticket, index) => (n: number) => {
        const cur = latest.current;
        if (cur.struckSets[index]?.has(n)) return;
        cur.strike(ticket.id, n);
        if (useSettingsStore.getState().strikeSound) playStrikeSound();
        if (cur.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        const next = new Set(cur.struckSets[index]);
        next.add(n);
        cur.tryClaims(ticket, next);
      }),
    [state.myTickets],
  );
  const canStrike = useCallback((n: number) => calledSet.has(n), [calledSet]);

  const prizeRows: PrizeRow[] = state.prizes.map((p) => ({
    prize: p.prize,
    amount: Number(p.amount),
    status: p.status,
    winners: p.winners.map((w) => ({
      name: w.name,
      avatarKey: w.avatarKey,
      isMe: w.userId === me.id,
    })),
    remaining: state.myTickets.length
      ? Math.min(...state.myTickets.map((tk, i) => remainingFor(tk.cells, struckSets[i], p.prize)))
      : undefined,
  }));

  const wonByTicket = (ticketId: string) =>
    state.prizes
      .filter((p) =>
        p.winners.some((w) => w.userId === me.id && state.myTickets.find((tk) => tk.id === ticketId)?.serial === w.ticketSerial),
      )
      .map((p) => t(`prizes.${p.prize}`))
      .join(' · ');

  const togglePause = useMutation({
    mutationFn: () => roomService.setPaused(game.id, !game.paused),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(room.id) }),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  // A check round (after a claim, or the last one after number 90) replaces the number header.
  const checking = game.checkOpen;

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
          <Row
            style={{
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
            }}
          >
            <IconButton icon="chevron-back" color="#fff" onPress={leave} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <T variant="h3" color="#fff" numberOfLines={1}>
                {room.title}
              </T>
              <T variant="tiny" color={connected ? 'rgba(255,255,255,0.8)' : '#FDE68A'}>
                {connected ? gameLabel(room, game.gameNo) : t('game.reconnecting')}
              </T>
            </View>
            <IconButton icon="settings-sharp" color="#fff" onPress={() => setSettingsOpen(true)} accessibilityLabel={t('game.settings')} />
          </Row>
          {checking ? (
            <ClaimHeader state={state} me={me} serverNow={serverNow} />
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
                      {game.paused
                        ? t('game.paused')
                        : t('game.firstNumberIn', {
                            seconds: Math.max(0, Math.ceil(msToNext / 1000)),
                          })}
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
        <Pressable
          onPress={isHost ? () => togglePause.mutate() : undefined}
          style={[styles.pausedBar, { backgroundColor: colors.warning }]}
        >
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
                {autoRule ? '🤖 ' + t('game.autoRuleHint') : '👆 ' + t('game.tapToStrike')}
                {autoHint ? ' ' + t('game.autoHintOn') : ''}
              </T>
              {state.myTickets.map((tk, i) => (
                <TicketView
                  key={tk.id}
                  cells={tk.cells}
                  marked={struckSets[i]}
                  // The glowing ring on the newest number is part of Auto hint — off means no rings.
                  lastCalled={autoHint ? last : null}
                  hinted={hintSets?.[i]}
                  onPressNumber={autoRule ? undefined : pressHandlers[i]}
                  canStrike={canStrike}
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
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: spacing.xl + insets.bottom,
              opacity: pressed || togglePause.isPending ? 0.8 : 1,
            },
          ]}
        >
          <LinearGradient colors={game.paused ? ['#22C55E', '#15803D'] : ['#F59E0B', '#D97706']} style={styles.fabInner}>
            <Ionicons name={game.paused ? 'play' : 'pause'} size={28} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}
      <GameSettingsSheet visible={settingsOpen} state={state} isHost={isHost} onClose={() => setSettingsOpen(false)} />
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
  fabInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  checkedBtn: { height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  notice: { marginTop: spacing.sm, backgroundColor: '#FFF7D6', borderRadius: radius.md, padding: spacing.sm },
  waitChip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingLeft: 3, paddingRight: 9, paddingVertical: 3 },
  pendingBox: { marginTop: spacing.sm, borderRadius: radius.md, padding: spacing.sm, gap: 6 },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingLeft: 9,
    paddingRight: 3,
    paddingVertical: 3,
  },
  pendingKick: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pausedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  progress: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});

/**
 * A check round (Normal rule after a claim, or the last check after number 90). It replaces
 * the number header: everything claimed on this number grouped by player ("Mani — First Line &
 * Second Line"), a countdown (or "until everyone is ready"), and for each player:
 *  - "I have it too!" — claims every prize their tickets completed (striking missed numbers),
 *  - "Checked" — nothing more for me.
 * The host sees who hasn't checked yet, can remove them, or continue the game.
 * Players can keep striking numbers they missed on their tickets below meanwhile.
 */
function ClaimHeader({ state, me, serverNow }: { state: RoomState; me: Me; serverNow: () => number }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const marks = useMarksStore((s) => s.marks);
  const { room } = state;
  const game = state.game!;
  const called = game.calledNumbers;
  const isHost = room.hostId === me.id;
  const final = game.finalCheck;
  const claims = state.prizes.filter((p) => p.status === 'won');
  const callIndex = claims[0]?.wonAtCall ?? called.length;
  const number = called[callIndex - 1] ?? null;
  const unlimited = room.checkSeconds === 0 && room.checkClaims;
  const msLeft = Math.max(0, (game.nextCallAt ? new Date(game.nextCallAt).getTime() : 0) - serverNow());
  const total = Math.max(1, (final ? Math.max(room.checkSeconds, 15) : room.checkSeconds) * 1000);
  const checked = new Set(state.checkedUserIds);
  const iChecked = checked.has(me.id);
  const pending = state.members.filter((m) => m.tickets > 0 && !checked.has(m.userId));
  const refresh = () => qc.invalidateQueries({ queryKey: roomKey(room.id) });
  const onError = (err: unknown) => showToast({ variant: 'error', title: errorMessage(err) });

  // Group the claims by player.
  const byPlayer = new Map<string, { name: string; avatarKey: string; prizes: string[] }>();
  claims.forEach((p) =>
    p.winners.forEach((w) => {
      const e = byPlayer.get(w.userId) ?? { name: w.userId === me.id ? t('common.you') : w.name, avatarKey: w.avatarKey, prizes: [] };
      e.prizes.push(t(`prizes.${p.prize}`));
      byPlayer.set(w.userId, e);
    }),
  );

  const enter = useRef(new Animated.Value(0)).current;
  const bell = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bell, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 280, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(1100),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, bell]);

  /** Claim everything my tickets completed: open prizes, or a share of one won on the same number. */
  /**
   * Claim = only what the player's OWN strikes complete (nothing is struck for them). A prize
   * that's still open, or a share of one won on this number / later than my completion
   * (Normal rule) — e.g. Fast 5 plus another line or Full Housie on the same number.
   * If their ticket has it but some numbers aren't struck yet, they're asked to strike them first.
   */
  /** What "I have it too" found (shown inside the header, not as a passing toast). */
  const [notice, setNotice] = useState<'strikeFirst' | 'late' | 'none' | null>(null);
  const showClaim = state.myTickets.length > 0 && !iChecked && room.claimMode !== 'fair';
  // Host: one "Checked" that also moves the game on. Players: "Checked" until they have.
  const showChecked = isHost || (state.myTickets.length > 0 && !iChecked);
  const claimMine = useMutation({
    mutationFn: async () => {
      let best: 'none' | 'shared' | 'late' | 'strikeFirst' = 'none';
      const calledSet = new Set(called);
      for (const tk of state.myTickets) {
        const struck = new Set((marks[tk.id] ?? []).filter((n) => calledSet.has(n)));
        for (const p of state.prizes) {
          const at = prizeCompletedAt(tk.cells, called, p.prize);
          if (at === null) continue;
          if (p.status === 'won' ? at > (p.wonAtCall ?? 0) : p.status !== 'open') continue;
          if (!isPrizeComplete(tk.cells, struck, p.prize)) {
            if (best === 'none') best = 'strikeFirst';
            continue;
          }
          const r = await roomService.claim(tk.id, p.prize);
          if (r === 'won' || r === 'shared' || r === 'already_yours') best = 'shared';
          else if (best !== 'shared' && (r === 'already_claimed' || r === 'too_late')) best = 'late';
        }
      }
      return best;
    },
    onSuccess: (r) => {
      if (r === 'shared') {
        setNotice(null);
        showToast({ variant: 'prize', title: t('game.claimedYours') });
      } else setNotice(r);
      refresh();
    },
    onError,
  });
  const done = useMutation({ mutationFn: () => roomService.checkDone(game.id), onSuccess: refresh, onError });
  const endCheck = useMutation({
    mutationFn: async () => {
      if (state.myTickets.length && !iChecked) await roomService.checkDone(game.id);
      await roomService.endCheck(game.id);
    },
    onSuccess: refresh,
    onError,
  });
  const kick = useMutation({ mutationFn: (userId: string) => roomService.removeMember(room.id, userId), onSuccess: refresh, onError });

  return (
    <Animated.View
      style={[
        styles.claimBox,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
      ]}
    >
      <Row gap={spacing.sm}>
        <Animated.Text
          style={[styles.bell, { transform: [{ rotate: bell.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] }) }] }]}
        >
          {final ? '🏁' : '🔔'}
        </Animated.Text>
        <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 1, flex: 1 }}>
          {(final ? t('game.finalCheckLabel') : t('game.claimedLabel')).toUpperCase()}
        </T>
        {number !== null && byPlayer.size ? <MiniBall n={number} size={38} /> : null}
      </Row>

      {/* Who claimed what — with their photo. */}
      {byPlayer.size ? (
        <View style={{ gap: 6, marginTop: 6 }}>
          {[...byPlayer.values()].map((p) => (
            <Row key={p.name} gap={spacing.sm}>
              <Avatar avatarKey={p.avatarKey} size={34} ring="#FDE68A" />
              <View style={{ flex: 1 }}>
                <T variant="h3" color="#fff" numberOfLines={1}>
                  {p.name}
                </T>
                <T variant="small" color="rgba(255,255,255,0.9)" numberOfLines={1}>
                  {t('game.claimedPrizes', { prizes: p.prizes.join(' & ') })}
                </T>
              </View>
            </Row>
          ))}
        </View>
      ) : (
        <T variant="h3" color="#fff" style={{ marginTop: 6 }}>
          {final ? t('game.finalCheckTitle') : t('game.checkTitleGeneric')}
        </T>
      )}

      <View style={{ marginTop: spacing.sm, gap: 4 }}>
        {unlimited ? null : (
          <View style={styles.checkBar}>
            <View
              style={{ height: '100%', borderRadius: 4, backgroundColor: '#FDE68A', width: `${Math.min(100, (msLeft / total) * 100)}%` }}
            />
          </View>
        )}
        <T variant="tiny" color="rgba(255,255,255,0.85)">
          {unlimited
            ? t('game.waitingEveryone', { count: pending.length })
            : t('game.checkSecondsLeft', { count: Math.ceil(msLeft / 1000) })}
        </T>
      </View>

      {/* After "I have it too": what to do next, right here (not a passing toast). */}
      {notice ? (
        <Row gap={spacing.sm} style={styles.notice}>
          <T style={{ fontSize: 18, lineHeight: 22 }}>{notice === 'strikeFirst' ? '📝' : notice === 'late' ? '⏱️' : '🔍'}</T>
          <T variant="small" color="#3B0764" style={{ flex: 1 }}>
            {notice === 'strikeFirst'
              ? t('game.strikeMissedFirst')
              : notice === 'late'
                ? t('game.claimTooLateAny')
                : t('game.nothingToClaim')}
          </T>
        </Row>
      ) : null}

      {/* I have it too · Checked — side by side. The host's Checked also moves the game on. */}
      {showClaim || showChecked ? (
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
          {showClaim ? (
            <Pressable
              onPress={() => claimMine.mutate()}
              disabled={claimMine.isPending}
              style={({ pressed }) => [{ flex: 1, opacity: pressed || claimMine.isPending ? 0.8 : 1 }]}
            >
              <LinearGradient colors={['#FDE68A', '#F5B700']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.checkedBtn}>
                <Ionicons name="hand-left" size={17} color="#3B1D00" />
                <T variant="smallBold" color="#3B1D00" numberOfLines={1}>
                  {final ? t('game.claimMine') : t('game.checkHaveIt')}
                </T>
              </LinearGradient>
            </Pressable>
          ) : null}
          {showChecked ? (
            <Pressable
              onPress={() => (isHost ? endCheck.mutate() : done.mutate())}
              disabled={done.isPending || endCheck.isPending}
              style={({ pressed }) => [{ flex: 1, opacity: pressed || done.isPending || endCheck.isPending ? 0.8 : 1 }]}
            >
              <LinearGradient colors={['#34D399', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.checkedBtn}>
                <Ionicons name="checkmark-done" size={18} color="#fff" />
                <T variant="smallBold" color="#fff" numberOfLines={1}>
                  {t('game.checkedButton')}
                </T>
              </LinearGradient>
            </Pressable>
          ) : null}
        </Row>
      ) : state.myTickets.length ? (
        <Row style={{ marginTop: spacing.sm }}>
          <Ionicons name="checkmark-circle" size={18} color="#86EFAC" />
          <T variant="small" color="#fff">
            {t('game.checkedWaiting')}
          </T>
        </Row>
      ) : null}

      {/* Who hasn't checked yet — names with their photos. */}
      {pending.length ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <T variant="tiny" color="rgba(255,255,255,0.75)">
            {t('game.notCheckedYetPlain')}
          </T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {pending.map((m) => (
              <Row key={m.userId} gap={5} style={styles.waitChip}>
                <Avatar avatarKey={m.avatarKey} size={20} />
                <T variant="tiny" color="#fff">
                  {m.userId === me.id ? t('common.you') : m.name.split(' ')[0]}
                </T>
              </Row>
            ))}
          </Row>
        </View>
      ) : null}
    </Animated.View>
  );
}
