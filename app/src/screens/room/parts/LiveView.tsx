import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CalledBoard } from '@/components/CalledBoard';
import { formatRupees } from '@/components/Money';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { PrizeList, PrizeRow } from '@/components/PrizeList';
import { TicketView } from '@/components/TicketView';
import { Card, IconButton, Pill, Row, Segmented, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { roomKey } from '@/hooks/useRoom';
import { useNow } from '@/hooks/useNow';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useMarksStore } from '@/state/marksStore';
import { useSettingsStore } from '@/state/settingsStore';
import { isPrizeComplete, prizeCompletedAt, remainingFor } from '@/game/engine/ticket';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { Me, RoomState, Ticket } from '@/types/api';
import { StandingsList } from './StandingsList';

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

  const struckSets = useMemo(
    () => state.myTickets.map((tk) => new Set((marks[tk.id] ?? NO_STRIKES).filter((n) => calledSet.has(n)))),
    [state.myTickets, marks, calledSet],
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

  const onPressNumber = (ticket: Ticket, index: number) => (n: number) => {
    if (!calledSet.has(n)) {
      caller.buzz();
      showToast({ variant: 'info', title: t('game.notCalled', { n }) });
      return;
    }
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
                {connected
                  ? room.kind === 'series'
                    ? t('room.gameOfSeries', { n: game.gameNo, total: room.totalGames })
                    : t('room.game', { n: game.gameNo })
                  : t('game.reconnecting')}
              </T>
            </View>
            <View style={{ minWidth: 40, alignItems: 'flex-end' }}>
              <Pill label={`● ${t('game.live')}`} color={colors.error} />
            </View>
          </Row>
          <Row style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }} gap={spacing.lg}>
            <NumberBall number={last} size={112} />
            <View style={{ flex: 1 }}>
              {waitingFirst ? (
                <>
                  <T variant="h2" color="#fff">
                    {t('game.getReady')}
                  </T>
                  <T color="rgba(255,255,255,0.85)">{t('game.firstNumberIn', { seconds: Math.max(0, Math.ceil(msToNext / 1000)) })}</T>
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
                        width: `${Math.max(0, Math.min(100, 100 - (msToNext / (room.callIntervalSeconds * 1000)) * 100))}%`,
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
        </SafeAreaView>
      </LinearGradient>

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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
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
                👆 {t('game.tapToStrike')}
              </T>
              {state.myTickets.map((tk, i) => (
                <TicketView
                  key={tk.id}
                  cells={tk.cells}
                  marked={struckSets[i]}
                  lastCalled={last}
                  onPressNumber={onPressNumber(tk, i)}
                  label={`#${tk.serial}`}
                  badge={wonByTicket(tk.id) || undefined}
                />
              ))}
              <PrizeList compact rows={prizeRows} />
            </>
          )
        ) : null}
        {tab === 'board' ? <CalledBoard called={calledSet} last={last} /> : null}
        {tab === 'prizes' ? <PrizeList rows={prizeRows} /> : null}
        {tab === 'standings' ? <StandingsList roomId={room.id} meId={me.id} /> : null}
      </ScrollView>
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
  top: { paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  progress: { height: 6, borderRadius: 3, marginTop: spacing.sm, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
});
