import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { formatRupees } from '@/components/Money';
import { PrizeList } from '@/components/PrizeList';
import { TicketView } from '@/components/TicketView';
import { Button, Card, IconButton, Loading, Pill, Row, Screen, Segmented, Spacer, T } from '@/components/ui';
import { RoomEvent, roomKey, useRoom } from '@/hooks/useRoom';
import { useMe } from '@/hooks/useMe';
import { useCaller } from '@/hooks/useCaller';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useWinnerStore } from '@/state/winnerStore';
import { APP_NAME } from '@/constants/config';
import type { PrizeType } from '@/game/engine/ticket';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { Me, RoomState } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';
import { LiveView } from './parts/LiveView';
import { PrizeAmountsModal } from './parts/PrizeAmountsModal';
import { ResultsCard } from './parts/ResultsCard';
import { StandingsList } from './parts/StandingsList';
import { TicketPicker } from './parts/TicketPicker';

const NO_STRIKES = new Set<number>();
type Tab = 'game' | 'players' | 'standings';

function RoomHeader({ state, onBack }: { state: RoomState; onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { room, game } = state;
  const share = () =>
    Share.share({ message: t('room.shareMessage', { title: room.title, app: APP_NAME, code: room.code }) }).catch(() => undefined);
  const copy = () => Clipboard.setStringAsync(room.code).then(() => showToast({ variant: 'success', title: t('common.copied') }));
  const gameNo = game?.gameNo ?? room.gamesPlayed;

  return (
    <LinearGradient colors={heroGradient} style={styles.header}>
      <SafeAreaView edges={['top']}>
        <Row style={{ paddingHorizontal: spacing.md, justifyContent: 'space-between' }}>
          <IconButton icon="chevron-back" color="#fff" onPress={onBack} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T variant="h2" color="#fff" numberOfLines={1}>
              {room.title}
            </T>
            <Row gap={6}>
              <Pill label={t(`kind.${room.kind}`)} color="rgba(255,255,255,0.25)" />
              <Pill label={t(`visibility.${room.visibility}`)} color="rgba(255,255,255,0.25)" />
              {gameNo > 0 ? (
                <Pill
                  label={room.kind === 'series' ? t('room.gameOfSeries', { n: gameNo, total: room.totalGames }) : t('room.game', { n: gameNo })}
                  color={colors.pink}
                />
              ) : null}
            </Row>
          </View>
          <IconButton icon="share-social" color="#fff" onPress={share} />
        </Row>
        <Pressable onPress={copy} style={styles.codePill}>
          <T variant="tiny" color="rgba(255,255,255,0.8)">
            {t('room.code')}
          </T>
          <T variant="h1" color="#FDE68A" style={{ letterSpacing: 6 }}>
            {room.code}
          </T>
          <Ionicons name="copy-outline" size={16} color="#FDE68A" />
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

function LobbyPanel({ state, me, onOpenPicker }: { state: RoomState; me: Me; onOpenPicker: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const { room } = state;
  const game = state.game!;
  const isHost = room.hostId === me.id;
  const host = state.members.find((m) => m.userId === room.hostId);
  const [editing, setEditing] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: roomKey(room.id) });
  const onError = (err: unknown) => showToast({ variant: 'error', title: errorMessage(err) });

  const start = useMutation({ mutationFn: () => roomService.start(game.id), onSuccess: refresh, onError });
  const saveAmounts = useMutation({
    mutationFn: (amounts: Partial<Record<PrizeType, number>>) => roomService.setPrizeAmounts(game.id, amounts),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError,
  });

  const playersReady = state.members.filter((m) => m.tickets > 0).length;

  return (
    <View style={{ gap: spacing.md }}>
      {state.previousGameId ? <ResultsCard gameId={state.previousGameId} meId={me.id} highlight={t('results.nextGame')} /> : null}

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{t('lobby.yourTickets')}</T>
          <Button
            title={state.myTickets.length ? t('lobby.changeTickets') : t('lobby.chooseTickets')}
            small
            variant={state.myTickets.length ? 'secondary' : 'gold'}
            icon="ticket"
            onPress={onOpenPicker}
          />
        </Row>
        {state.myTickets.length === 0 ? (
          <T muted>{t('lobby.noTickets')}</T>
        ) : (
          state.myTickets.map((tk) => <TicketView key={tk.id} cells={tk.cells} marked={NO_STRIKES} label={`#${tk.serial}`} compact />)
        )}
      </Card>

      <LinearGradient colors={['#FDE68A', '#F5B700']} style={styles.potCard}>
        <View>
          <T variant="smallBold" color="#7C2D12">
            {t('lobby.pot')}
          </T>
          <T variant="hero" color="#3B1D00">
            {formatRupees(game.pot)}
          </T>
          <T variant="tiny" color="#7C2D12">
            {t('lobby.potFormula', { tickets: game.ticketCount, price: formatRupees(game.ticketPrice) })}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T style={{ fontSize: 40 }}>💰</T>
          <T variant="tiny" color="#7C2D12">
            {t('lobby.readyCount', { ready: playersReady, total: state.members.length })}
          </T>
        </View>
      </LinearGradient>

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <T variant="h3">{t('lobby.prizes')}</T>
            {game.prizesCustom ? <Pill label={t('lobby.custom')} color={colors.primary} /> : null}
          </Row>
          {isHost ? <Button title={t('lobby.editAmounts')} small variant="secondary" icon="create" onPress={() => setEditing(true)} /> : null}
        </Row>
        <PrizeList
          compact
          rows={state.prizes.map((p) => ({ prize: p.prize, amount: Number(p.amount), status: p.status, winners: [] }))}
        />
      </Card>

      {isHost ? (
        <View>
          <Button
            title={t('lobby.start')}
            variant="gold"
            icon="play"
            loading={start.isPending}
            disabled={game.playerCount < 2}
            onPress={() => start.mutate()}
          />
          {game.playerCount < 2 ? (
            <T variant="small" muted center style={{ marginTop: 6 }}>
              {t('lobby.needTwo')}
            </T>
          ) : null}
        </View>
      ) : (
        <Row style={{ justifyContent: 'center' }}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} />
          <T muted>{t('lobby.waitingHost', { name: host?.name ?? t('room.host') })}</T>
        </Row>
      )}

      <PrizeAmountsModal
        visible={editing}
        pot={Number(game.pot)}
        prizes={state.prizes}
        saving={saveAmounts.isPending}
        onSave={(amounts) => saveAmounts.mutate(amounts)}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

function PlayersPanel({ state, me, onLeave, onEnd }: { state: RoomState; me: Me; onLeave: () => void; onEnd: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { room } = state;
  return (
    <View style={{ gap: spacing.sm }}>
      <T variant="h3">{t('room.players', { count: room.memberCount, max: room.maxPlayers })}</T>
      {state.members.map((m) => (
        <Card key={m.userId} style={{ paddingVertical: spacing.sm }}>
          <Row>
            <Avatar avatarKey={m.avatarKey} size={40} ring={m.userId === room.hostId ? colors.gold : undefined} />
            <View style={{ flex: 1 }}>
              <T variant="h3" numberOfLines={1}>
                {m.name}
                {m.userId === me.id ? ` (${t('common.you')})` : ''}
              </T>
              {m.userId === room.hostId ? (
                <T variant="tiny" color={colors.goldDark}>
                  👑 {t('room.host')}
                </T>
              ) : null}
            </View>
            {state.game?.status === 'lobby' ? (
              <T variant="smallBold" color={m.tickets ? colors.success : colors.textMuted}>
                {m.tickets ? `🎫 ${m.tickets}` : t('lobby.noTicketsYet')}
              </T>
            ) : null}
          </Row>
        </Card>
      ))}
      <Spacer />
      {room.status === 'open' && room.hostId === me.id ? (
        <Button title={t('room.endRoom')} variant="danger" icon="stop-circle" onPress={onEnd} />
      ) : null}
      <Button title={t('room.leave')} variant="ghost" icon="exit-outline" onPress={onLeave} />
    </View>
  );
}

function EndedPanel({ state, me, onPlayAgain, busy }: { state: RoomState; me: Me; onPlayAgain: () => void; busy: boolean }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { room } = state;
  const lastGameId = state.game?.status === 'finished' ? state.game.id : state.previousGameId;
  return (
    <View style={{ gap: spacing.md }}>
      <LinearGradient colors={['#4C1D95', '#C026D3']} style={styles.endedBanner}>
        <T style={{ fontSize: 44 }}>{room.kind === 'series' ? '🏆' : '🎉'}</T>
        <T variant="h1" color="#fff" center>
          {room.kind === 'series' && room.gamesPlayed >= room.totalGames ? t('results.seriesOver') : t('results.gameOver')}
        </T>
      </LinearGradient>
      {lastGameId ? <ResultsCard gameId={lastGameId} meId={me.id} /> : null}
      <T variant="h2">{t('room.tabStandings')}</T>
      <StandingsList roomId={room.id} meId={me.id} />
      {room.hostId === me.id ? (
        <Button title={t('results.playAgain')} variant="gold" icon="refresh" loading={busy} onPress={onPlayAgain} />
      ) : (
        <T variant="small" muted center>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} /> {t('room.ended')}
        </T>
      )}
    </View>
  );
}

export function RoomScreen({ route, navigation }: ScreenProps<'Room'>) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const me = useMe();
  const meRef = useRef<string | undefined>(undefined);
  meRef.current = me.data?.id;
  const caller = useCaller();
  const announce = useWinnerStore((s) => s.announce);
  const [tab, setTab] = useState<Tab>('game');
  const [pickerOpen, setPickerOpen] = useState(false);
  const promptedGame = useRef<string | null>(null);

  const onEvent = useCallback(
    (e: RoomEvent) => {
      switch (e.type) {
        case 'call':
          caller.announce(e.n);
          break;
        case 'prize':
          announce({ gameId: e.gameId, prize: e.prize, amount: Number(e.amount), winners: e.winners });
          if (e.winners.some((w) => w.userId === meRef.current)) caller.celebrate();
          break;
        case 'game':
          setTab('game');
          showToast({ variant: 'info', title: t('results.nextGame') });
          break;
        case 'room_ended':
          if (e.reason === 'host') showToast({ variant: 'info', title: t('room.endedHost') });
          qc.invalidateQueries({ queryKey: ['myRooms'] });
          break;
        case 'members':
          if (e.joined) showToast({ variant: 'info', title: t('room.joined', { name: e.joined }) });
          break;
        default:
          break;
      }
    },
    [caller, announce, t, qc],
  );

  const roomQuery = useRoom(roomId, onEvent);
  const state = roomQuery.data;

  useEffect(() => () => useWinnerStore.getState().clear(), []);

  // Ask "how many tickets?" once at the start of every game.
  const lobbyGameId = state?.game?.status === 'lobby' && state.room.status === 'open' ? state.game.id : null;
  const hasTickets = (state?.myTickets.length ?? 0) > 0;
  useEffect(() => {
    if (lobbyGameId && !hasTickets && promptedGame.current !== lobbyGameId) {
      promptedGame.current = lobbyGameId;
      setPickerOpen(true);
    }
  }, [lobbyGameId, hasTickets]);

  const setTickets = useMutation({
    mutationFn: (count: number) => roomService.setMyTickets(state!.game!.id, count),
    onSuccess: () => {
      setPickerOpen(false);
      qc.invalidateQueries({ queryKey: roomKey(roomId) });
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const playAgain = useMutation({
    mutationFn: () => roomService.playAgain(roomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(roomId) }),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const leave = () =>
    Alert.alert('', t('room.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('room.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await roomService.leave(roomId);
            qc.invalidateQueries({ queryKey: ['myRooms'] });
            navigation.goBack();
          } catch (err) {
            showToast({ variant: 'error', title: errorMessage(err) });
          }
        },
      },
    ]);

  const endRoom = () =>
    Alert.alert('', t('room.endRoomConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('room.endRoom'),
        style: 'destructive',
        onPress: () =>
          roomService
            .end(roomId)
            .then(() => qc.invalidateQueries({ queryKey: roomKey(roomId) }))
            .catch((err) => showToast({ variant: 'error', title: errorMessage(err) })),
      },
    ]);

  if (roomQuery.isLoading || !me.data) return <Loading />;
  if (roomQuery.error || !state) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <T center>{errorMessage(roomQuery.error)}</T>
          <Button title={t('common.retry')} onPress={() => roomQuery.refetch()} />
          <Button title={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  if (state.game?.status === 'running') {
    return <LiveView state={state} me={me.data} serverNow={roomQuery.serverNow} connected={roomQuery.connected} />;
  }

  const ended = state.room.status === 'ended';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RoomHeader state={state} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'game', label: t('room.tabPlay') },
            { value: 'players', label: `${t('room.tabPlayers')} ${state.room.memberCount}` },
            { value: 'standings', label: t('room.tabStandings') },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {tab === 'game' ? (
          ended || !state.game ? (
            <EndedPanel state={state} me={me.data} onPlayAgain={() => playAgain.mutate()} busy={playAgain.isPending} />
          ) : (
            <LobbyPanel state={state} me={me.data} onOpenPicker={() => setPickerOpen(true)} />
          )
        ) : null}
        {tab === 'players' ? <PlayersPanel state={state} me={me.data} onLeave={leave} onEnd={endRoom} /> : null}
        {tab === 'standings' ? <StandingsList roomId={roomId} meId={me.data.id} /> : null}
      </ScrollView>

      {state.game ? (
        <TicketPicker
          visible={pickerOpen && !ended && state.game.status === 'lobby'}
          current={state.myTickets.length}
          price={Number(state.room.ticketPrice)}
          gameLabel={
            state.room.kind === 'series'
              ? t('room.gameOfSeries', { n: state.game.gameNo, total: state.room.totalGames })
              : t('room.game', { n: state.game.gameNo })
          }
          busy={setTickets.isPending}
          onPick={(n) => setTickets.mutate(n)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  potCard: { borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  endedBanner: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
});
