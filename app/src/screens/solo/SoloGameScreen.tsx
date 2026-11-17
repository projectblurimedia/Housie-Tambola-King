import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { CalledBoard } from '@/components/CalledBoard';
import { MiniBall, NumberBall } from '@/components/NumberBall';
import { PrizeList, PrizeRow } from '@/components/PrizeList';
import { TicketView } from '@/components/TicketView';
import { Button, IconButton, Row, Segmented, Spacer, T } from '@/components/ui';
import { useCaller } from '@/hooks/useCaller';
import { useMe } from '@/hooks/useMe';
import { callNext, claimForMe, createSoloGame, SoloState } from '@/game/engine/solo';
import { isPrizeComplete, PrizeType, remainingFor } from '@/game/engine/ticket';
import { showToast } from '@/state/toastStore';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const CALL_MS = 4500;
const SOLO_PRIZES: PrizeType[] = ['fast_5', 'line_1', 'line_2', 'line_3', 'full_house'];

/** Offline practice that plays exactly like a room: tap to strike, prizes auto-claim. */
export function SoloGameScreen({ route, navigation }: ScreenProps<'SoloGame'>) {
  useKeepAwake();
  const { bots, myTickets, difficulty } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const me = useMe();
  const caller = useCaller();

  const newGame = () =>
    createSoloGame({
      me: { id: 'me', name: me.data?.displayName ?? t('common.you'), avatarKey: me.data?.avatarKey ?? 'a1' },
      myTickets,
      bots,
      difficulty,
      prizes: SOLO_PRIZES,
    });

  const [game, setGame] = useState<SoloState>(newGame);
  const [paused, setPaused] = useState(true);
  const [tab, setTab] = useState<'tickets' | 'board' | 'prizes'>('tickets');
  const [strikes, setStrikes] = useState<number[][]>(() => Array.from({ length: myTickets }, () => []));
  const gameRef = useRef(game);
  gameRef.current = game;

  // Start after a short "get ready".
  useEffect(() => {
    const timer = setTimeout(() => setPaused(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (paused || game.finished) return;
    const timer = setInterval(() => {
      const before = gameRef.current;
      const after = callNext(before);
      const n = after.called[after.called.length - 1];
      if (after.called.length > before.called.length && n) caller.announce(n);
      after.prizes.forEach((p, i) => {
        const prev = before.prizes[i];
        p.winners
          .filter((w) => w.playerId !== 'me' && !prev.winners.some((x) => x.playerId === w.playerId))
          .forEach((w) => {
            const bot = after.players.find((pl) => pl.id === w.playerId);
            showToast({ variant: 'info', title: t('solo.wonBy', { name: bot?.name ?? '', prize: t(`prizes.${p.prize}`) }) });
          });
      });
      gameRef.current = after;
      setGame(after);
    }, CALL_MS);
    return () => clearInterval(timer);
  }, [paused, game.finished, caller, t]);

  const calledSet = useMemo(() => new Set(game.called), [game.called]);
  const mine = game.players[0];
  const struckSets = useMemo(
    () => mine.tickets.map((_, i) => new Set((strikes[i] ?? []).filter((n) => calledSet.has(n)))),
    [mine.tickets, strikes, calledSet],
  );
  const last = game.called.length ? game.called[game.called.length - 1] : null;

  const autoClaim = (marks: ReadonlySet<number>[]) => {
    for (const p of gameRef.current.prizes) {
      if (p.wonAtCall !== null) continue;
      if (!mine.tickets.some((cells, i) => isPrizeComplete(cells, marks[i], p.prize))) continue;
      const { state, result } = claimForMe(gameRef.current, p.prize, marks);
      if (result === 'won' || result === 'shared') {
        caller.celebrate();
        const name = t(`prizes.${p.prize}`);
        showToast({ variant: 'prize', title: t(result === 'won' ? 'game.claimWon' : 'game.claimShared', { prize: name }) });
        gameRef.current = state;
        setGame(state);
      }
    }
  };

  const strike = (ticketIndex: number) => (n: number) => {
    if (!calledSet.has(n) || game.finished) {
      caller.buzz();
      return;
    }
    if (struckSets[ticketIndex].has(n)) return;
    const next = struckSets.map((set, j) => (j === ticketIndex ? new Set([...set, n]) : set));
    setStrikes((s) => s.map((arr, j) => (j === ticketIndex ? [...arr, n] : arr)));
    autoClaim(next);
  };

  const rows: PrizeRow[] = game.prizes.map((p) => ({
    prize: p.prize,
    status: p.wonAtCall !== null ? 'won' : game.finished ? 'unclaimed' : 'open',
    winners: p.winners.map((w) => {
      const pl = game.players.find((x) => x.id === w.playerId)!;
      return { name: pl.name, avatarKey: pl.avatarKey, isMe: w.playerId === 'me' };
    }),
    remaining: Math.min(...mine.tickets.map((cells, i) => remainingFor(cells, struckSets[i], p.prize))),
  }));

  const myWins = game.prizes.filter((p) => p.winners.some((w) => w.playerId === 'me')).length;

  const restart = () => {
    const fresh = newGame();
    gameRef.current = fresh;
    setGame(fresh);
    setStrikes(Array.from({ length: myTickets }, () => []));
    setPaused(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={heroGradient} style={styles.top}>
        <SafeAreaView edges={['top']}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
            <IconButton icon="close" color="#fff" onPress={() => navigation.goBack()} />
            <T variant="h3" color="#fff">
              {t('solo.title')}
            </T>
            <IconButton icon={paused ? 'play' : 'pause'} color="#fff" onPress={() => setPaused((p) => !p)} />
          </Row>
          <Row style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }} gap={spacing.lg}>
            <NumberBall number={last} size={100} />
            <View style={{ flex: 1 }}>
              <T variant="h1" color="#fff">
                {game.finished
                  ? myWins > 0
                    ? t('solo.youWin', { count: myWins })
                    : t('solo.botsWin')
                  : t('game.calledCount', { count: game.called.length })}
              </T>
              <Row gap={6} style={{ marginTop: spacing.sm }}>
                {game.called
                  .slice(-6, -1)
                  .reverse()
                  .map((n) => (
                    <MiniBall key={n} n={n} size={26} />
                  ))}
              </Row>
            </View>
          </Row>
        </SafeAreaView>
      </LinearGradient>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tickets', label: t('game.tickets') },
            { value: 'board', label: t('game.board') },
            { value: 'prizes', label: t('game.prizes') },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        {game.finished ? <Button title={t('solo.again')} variant="gold" icon="refresh" onPress={restart} /> : null}
        {tab === 'tickets' ? (
          <>
            <T variant="small" muted center>
              👆 {t('game.tapToStrike')}
            </T>
            {mine.tickets.map((cells, i) => (
              <TicketView key={i} cells={cells} marked={struckSets[i]} lastCalled={last} label={`#${i + 1}`} onPressNumber={strike(i)} />
            ))}
            <PrizeList compact rows={rows} showAmounts={false} />
          </>
        ) : null}
        {tab === 'board' ? <CalledBoard called={calledSet} last={last} /> : null}
        {tab === 'prizes' ? <PrizeList rows={rows} showAmounts={false} /> : null}
        <Spacer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
});
