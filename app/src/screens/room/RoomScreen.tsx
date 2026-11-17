import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatRupees } from '@/components/Money';
import { PrizeList } from '@/components/PrizeList';
import { TicketView } from '@/components/TicketView';
import { Button, Card, IconButton, Loading, Pill, Row, Screen, Segmented, Spacer, T } from '@/components/ui';
import { RoomEvent, roomKey, useRoom } from '@/hooks/useRoom';
import { useMe } from '@/hooks/useMe';
import { useCaller } from '@/hooks/useCaller';
import { roomService } from '@/services/roomService';
import { toAppError } from '@/services/errors';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useWinnerStore } from '@/state/winnerStore';
import { APP_NAME } from '@/constants/config';
import type { PrizeType } from '@/game/engine/ticket';
import { gameLabel } from '@/utils/gameLabel';
import { heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { Me, RoomState } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';
import { LiveView } from './parts/LiveView';
import { PrizeSetupModal } from './parts/PrizeSetupModal';
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
              {gameNo > 0 ? <Pill label={gameLabel(room, gameNo)} color={colors.pink} /> : null}
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

/** A player whose join request the host hasn't answered yet. Polls until let in. */
function WaitingForHost({ roomId, onAccepted, onBack }: { roomId: string; onAccepted: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const status = useQuery({ queryKey: ['joinStatus', roomId], queryFn: () => roomService.myJoinStatus(roomId), refetchInterval: 3000 });
  const ask = useMutation({
    mutationFn: () => roomService.joinByCode(status.data!.code),
    onSuccess: () => status.refetch(),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  useEffect(() => {
    if (status.data?.status === 'member') onAccepted();
  }, [status.data?.status, onAccepted]);

  const s = status.data;
  return (
    <Screen title={s?.title ?? ''} onBack={onBack}>
      <View style={styles.waitWrap}>
        {s?.status === 'rejected' ? (
          <>
            <Ionicons name="close-circle" size={64} color={colors.error} />
            <T variant="h2" center>
              {t('join.rejectedTitle')}
            </T>
            <T muted center>
              {t('join.rejectedMessage')}
            </T>
          </>
        ) : s?.status === 'none' ? (
          <>
            <Ionicons name="enter" size={64} color={colors.primary} />
            <T variant="h2" center>
              {s.title}
            </T>
            <Button title={t('join.requestAgain')} variant="gold" icon="hand-right" loading={ask.isPending} onPress={() => ask.mutate()} />
          </>
        ) : (
          <>
            <Avatar avatarKey={s?.hostAvatar ?? 'a1'} size={84} ring={colors.gold} />
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            <T variant="h2" center style={{ marginTop: spacing.md }}>
              {t('join.waitingTitle')}
            </T>
            <T muted center>
              {t('join.waitingMessage', { name: s?.hostName ?? t('room.host') })}
            </T>
          </>
        )}
        <Button title={t('common.back')} variant="ghost" onPress={onBack} style={{ marginTop: spacing.lg }} />
      </View>
    </Screen>
  );
}

function LobbyPanel({ state, me, onOpenPicker, onEndSeries }: { state: RoomState; me: Me; onOpenPicker: () => void; onEndSeries: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const { room } = state;
  const game = state.game!;
  const isHost = room.hostId === me.id;
  const host = state.members.find((m) => m.userId === room.hostId);
  const [editing, setEditing] = useState(false);
  /** 'edit' = save the prize setup; 'start' = host tapped Start: confirm prizes against the real pot, then start. */
  const [mode, setMode] = useState<'edit' | 'start'>('edit');
  const refresh = () => qc.invalidateQueries({ queryKey: roomKey(room.id) });

  const saveAmounts = useMutation({
    mutationFn: async (amounts: Partial<Record<PrizeType, number>>) => {
      await roomService.setPrizeAmounts(game.id, amounts);
      if (mode === 'start') await roomService.start(game.id);
    },
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const playersReady = state.members.filter((m) => m.tickets > 0).length;
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const remove = useMutation({
    mutationFn: (userId: string) => roomService.removeMember(room.id, userId),
    onSuccess: () => {
      setRemoving(null);
      refresh();
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  const openSetup = (m: 'edit' | 'start') => {
    setMode(m);
    setEditing(true);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {state.previousGameId ? <ResultsCard gameId={state.previousGameId} meId={me.id} highlight={t('results.nextGame')} /> : null}

      {isHost && state.joinRequests.length ? (
        <Card style={{ borderColor: colors.pink, borderWidth: 2 }}>
          <Row>
            <Ionicons name="person-add" size={22} color={colors.pink} />
            <T variant="h3" style={{ flex: 1 }}>
              {t('join.requestsWaiting', { count: state.joinRequests.length })}
            </T>
          </Row>
          <T variant="tiny" muted>
            {t('join.requestsHint')}
          </T>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{t('lobby.yourTickets')}</T>
          {state.myTickets.length === 0 ? (
            <Button title={t('lobby.chooseTickets')} small variant="gold" icon="ticket" onPress={onOpenPicker} />
          ) : (
            <Pill label={t('lobby.tickets', { count: state.myTickets.length })} color={colors.success} />
          )}
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
        <T style={{ fontSize: 40, lineHeight: 50 }}>💰</T>
      </LinearGradient>

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3" style={{ flex: 1 }}>
            {t('lobby.playersThisGame')}
          </T>
          <Pill label={t('lobby.readyCount', { ready: playersReady, total: state.members.length })} color={colors.primary} />
        </Row>
        {state.members.map((m) => {
          const ready = m.tickets > 0;
          return (
            <Row key={m.userId} style={styles.readyRow}>
              <Avatar avatarKey={m.avatarKey} size={34} ring={m.userId === room.hostId ? colors.gold : undefined} />
              <T variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                {m.name}
                {m.userId === me.id ? ` (${t('common.you')})` : ''}
              </T>
              <Pill
                label={ready ? `✓ ${t('lobby.readyWithTickets', { count: m.tickets })}` : t('lobby.notReady')}
                color={ready ? colors.success : colors.textMuted}
              />
              {isHost && m.userId !== me.id ? (
                <IconButton icon="person-remove" size={20} color={colors.error} onPress={() => setRemoving({ userId: m.userId, name: m.name })} />
              ) : null}
            </Row>
          );
        })}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3" style={{ flex: 1 }}>
            {t('lobby.prizes')}
          </T>
          {isHost ? <Button title={t('lobby.editPrizes')} small variant="secondary" icon="options" onPress={() => openSetup('edit')} /> : null}
        </Row>
        <PrizeList compact rows={state.prizes.map((p) => ({ prize: p.prize, amount: Number(p.amount), status: p.status, winners: [] }))} />
      </Card>

      {isHost ? (
        <View style={{ gap: spacing.sm }}>
          <Button title={t('lobby.start')} variant="gold" icon="play" disabled={game.playerCount < 2} onPress={() => openSetup('start')} />
          {game.playerCount < 2 ? (
            <T variant="small" muted center>
              {t('lobby.needTwo')}
            </T>
          ) : null}
          {room.kind === 'series' && game.gameNo > 1 ? (
            <Button title={t('room.endSeries')} variant="danger" icon="flag" onPress={onEndSeries} />
          ) : null}
        </View>
      ) : (
        <Row style={{ justifyContent: 'center' }}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} />
          <T muted>{t('lobby.waitingHost', { name: host?.name ?? t('room.host') })}</T>
        </Row>
      )}

      <PrizeSetupModal
        visible={editing}
        pot={Number(game.pot)}
        prizes={state.prizes}
        template={room.prizes}
        saving={saveAmounts.isPending}
        saveLabel={mode === 'start' ? t('lobby.saveAndStart') : undefined}
        hint={t('lobby.setAmountsHint', { players: game.playerCount, tickets: game.ticketCount })}
        onSave={(amounts) => saveAmounts.mutate(amounts)}
        onClose={() => setEditing(false)}
      />
      <ConfirmModal
        visible={removing !== null}
        icon="person-remove"
        title={t('lobby.removeTitle', { name: removing?.name ?? '' })}
        message={t('lobby.removeMessage')}
        confirmLabel={t('lobby.remove')}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.userId)}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

function PlayersPanel({
  state,
  me,
  onLeave,
  onEnd,
}: {
  state: RoomState;
  me: Me;
  onLeave: () => void;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const { room } = state;
  const isHost = room.hostId === me.id;
  const respond = useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) => roomService.respondJoin(room.id, userId, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(room.id) }),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  const running = state.game?.status === 'running';

  return (
    <View style={{ gap: spacing.sm }}>
      {isHost && state.joinRequests.length ? (
        <>
          <T variant="h3">{t('join.requestsTitle', { count: state.joinRequests.length })}</T>
          {running ? (
            <T variant="tiny" muted>
              {t('join.acceptMidGame')}
            </T>
          ) : null}
          {state.joinRequests.map((r) => (
            <Card key={r.userId} style={{ paddingVertical: spacing.sm, borderColor: colors.pink }}>
              <Row>
                <Avatar avatarKey={r.avatarKey} size={40} />
                <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                  {r.name}
                </T>
                <IconButton icon="close-circle" size={32} color={colors.error} onPress={() => respond.mutate({ userId: r.userId, accept: false })} />
                <IconButton icon="checkmark-circle" size={32} color={colors.success} onPress={() => respond.mutate({ userId: r.userId, accept: true })} />
              </Row>
            </Card>
          ))}
          <Spacer h={spacing.sm} />
        </>
      ) : null}

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
            ) : running && m.tickets === 0 ? (
              <T variant="tiny" muted>
                {t('room.watching')}
              </T>
            ) : null}
          </Row>
        </Card>
      ))}
      <Spacer />
      {room.status === 'open' && isHost ? (
        <Button title={room.kind === 'series' ? t('room.endSeries') : t('room.endRoom')} variant="danger" icon="stop-circle" onPress={onEnd} />
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
        <T style={{ fontSize: 44, lineHeight: 56 }}>{room.kind === 'series' ? '🏆' : '🎉'}</T>
        <T variant="h1" color="#fff" center>
          {room.kind === 'series' ? t('results.seriesOver') : t('results.gameOver')}
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
  const [confirm, setConfirm] = useState<'leave' | 'end' | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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
          if (e.removed && e.removed === meRef.current) {
            showToast({ variant: 'error', title: t('room.removedYou') });
            navigation.goBack();
          } else if (e.joined) showToast({ variant: 'info', title: t('room.joined', { name: e.joined }) });
          break;
        case 'join_request':
          showToast({ variant: 'info', title: t('join.requestToast', { name: e.name }) });
          break;
        default:
          break;
      }
    },
    [caller, announce, t, qc, navigation],
  );

  const roomQuery = useRoom(roomId, onEvent);
  const state = roomQuery.data;
  const isHost = !!state && state.room.hostId === me.data?.id;

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

  const runConfirm = async () => {
    setConfirmBusy(true);
    try {
      if (confirm === 'leave') {
        await roomService.leave(roomId);
        qc.invalidateQueries({ queryKey: ['myRooms'] });
        setConfirm(null);
        navigation.goBack();
        return;
      }
      await roomService.end(roomId);
      qc.invalidateQueries({ queryKey: roomKey(roomId) });
      setConfirm(null);
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setConfirmBusy(false);
    }
  };

  const onAccepted = useCallback(() => {
    qc.invalidateQueries({ queryKey: roomKey(roomId) });
  }, [qc, roomId]);

  if (roomQuery.isLoading || !me.data) return <Loading />;
  if (roomQuery.error && toAppError(roomQuery.error).code === 'NOT_IN_ROOM') {
    return <WaitingForHost roomId={roomId} onAccepted={onAccepted} onBack={() => navigation.goBack()} />;
  }
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
  const requests = isHost ? state.joinRequests.length : 0;
  const endLabel = state.room.kind === 'series' ? t('room.endSeries') : t('room.endRoom');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RoomHeader state={state} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'game', label: t('room.tabPlay') },
            { value: 'players', label: requests ? `${t('room.tabPlayers')} (${state.room.memberCount}) • ${requests}` : `${t('room.tabPlayers')} (${state.room.memberCount})` },
            { value: 'standings', label: t('room.tabStandings') },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {tab === 'game' ? (
          ended || !state.game ? (
            <EndedPanel state={state} me={me.data} onPlayAgain={() => playAgain.mutate()} busy={playAgain.isPending} />
          ) : (
            <LobbyPanel state={state} me={me.data} onOpenPicker={() => setPickerOpen(true)} onEndSeries={() => setConfirm('end')} />
          )
        ) : null}
        {tab === 'players' ? (
          <PlayersPanel state={state} me={me.data} onLeave={() => setConfirm('leave')} onEnd={() => setConfirm('end')} />
        ) : null}
        {tab === 'standings' ? <StandingsList roomId={roomId} meId={me.data.id} /> : null}
      </ScrollView>

      {state.game ? (
        <TicketPicker
          visible={pickerOpen && !ended && state.game.status === 'lobby' && state.myTickets.length === 0}
          price={Number(state.room.ticketPrice)}
          gameLabel={gameLabel(state.room, state.game.gameNo)}
          busy={setTickets.isPending}
          onPick={(n) => setTickets.mutate(n)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      <ConfirmModal
        visible={confirm !== null}
        icon={confirm === 'end' ? 'flag' : 'exit-outline'}
        gradient={confirm === 'end' ? undefined : BRAND_GRADIENT}
        title={confirm === 'end' ? endLabel : t('room.leave')}
        message={confirm === 'end' ? t('room.endRoomConfirm') : t('room.leaveConfirm')}
        confirmLabel={confirm === 'end' ? endLabel : t('room.leave')}
        loading={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
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
  waitWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  readyRow: { paddingVertical: 4 },
});
