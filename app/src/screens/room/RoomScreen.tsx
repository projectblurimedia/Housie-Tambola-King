import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CoinAmount } from '@/components/CoinIcon';
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
import { useClaimCheckStore } from '@/state/claimCheckStore';
import { useSettingsStore } from '@/state/settingsStore';
import { usePauseRequestStore } from '@/state/pauseRequestStore';
import { ReadySheet } from './parts/ReadySheet';
import { isCoinsRoom, isFreeRoom, useStakeStore } from '@/state/stakeStore';
import * as Haptics from 'expo-haptics';
import { playPrizeSound, soundFor } from '@/services/sounds';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RoomChat } from './parts/RoomChat';
import { RoomSettingsCard } from './parts/RoomSettingsModal';
import { APP_NAME, JOIN_LINK_BASE } from '@/constants/config';
import type { PrizeType } from '@/game/engine/ticket';
import { gameLabel } from '@/utils/gameLabel';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import { ShineSweep } from '@/screens/party/parts/Premium';
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
  const { room } = state;
  const share = () =>
    Share.share({ message: t('room.shareMessage', { title: room.title, app: APP_NAME, code: room.code, link: JOIN_LINK_BASE + room.code }) }).catch(() => undefined);
  const copy = () => Clipboard.setStringAsync(room.code).then(() => showToast({ variant: 'success', title: t('common.copied') }));

  // Just back · room code (tap to copy) · share. Everything else is in the card below.
  return (
    <LinearGradient colors={heroGradient} style={styles.header}>
      <SafeAreaView edges={['top']}>
        <Row style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg - 4, minHeight: 56, alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="chevron-back" color="#fff" onPress={onBack} />
          <Pressable onPress={copy} style={({ pressed }) => [styles.codePill, { opacity: pressed ? 0.8 : 1 }]}>
            <T variant="tiny" color="rgba(255,255,255,0.8)" style={styles.codeText}>
              {t('room.code')}
            </T>
            <T variant="h2" color="#FDE68A" style={[styles.codeText, { letterSpacing: 5 }]}>
              {room.code}
            </T>
            <Ionicons name="copy-outline" size={15} color="#FDE68A" />
          </Pressable>
          <IconButton icon="share-social" color="#fff" onPress={share} />
        </Row>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** The room's name, mode, visibility and game — under the header. */
function RoomInfoCard({ state }: { state: RoomState }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { room, game } = state;
  const gameNo = game?.gameNo ?? room.gamesPlayed;
  const series = room.kind === 'series';
  return (
    <Card style={{ paddingVertical: spacing.md }}>
      <Row gap={spacing.md}>
        <LinearGradient
          colors={series ? ['#F472B6', '#DB2777'] : ['#8B5CF6', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoTile}
        >
          <Ionicons name={series ? 'layers' : 'grid'} size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="h2" numberOfLines={1}>
            {room.title}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={t(`kind.${room.kind}`)} color={series ? '#DB2777' : colors.primary} style={styles.rowPill} />
            <Pill label={t(`visibility.${room.visibility}`)} color={colors.textMuted} style={styles.rowPill} />
            {gameNo > 0 ? <Pill label={gameLabel(room, gameNo)} color={colors.goldDark} style={styles.rowPill} /> : null}
          </Row>
        </View>
      </Row>
    </Card>
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

/** 1 Players → 2 Tickets → 3 Prizes & play. */
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const labels = [t('lobby.step1'), t('lobby.step2'), t('lobby.step3')];
  return (
    <Row gap={6} style={{ justifyContent: 'space-between' }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <React.Fragment key={label}>
            <Row gap={6} style={{ flexShrink: 1 }}>
              <View style={[styles.stepDot, { backgroundColor: done ? colors.success : active ? colors.primary : colors.border }]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <T variant="tiny" color="#fff">
                    {n}
                  </T>
                )}
              </View>
              <T variant="tiny" color={active ? colors.primary : colors.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {label}
              </T>
            </Row>
            {i < 2 ? <View style={[styles.stepLine, { backgroundColor: done ? colors.success : colors.border }]} /> : null}
          </React.Fragment>
        );
      })}
    </Row>
  );
}

/**
 * The one thing a player should do next (Choose tickets, I'm ready): a big glossy gold button
 * with the icon on a dark badge, a bold title and a short line under it, a light sweeping
 * across it, and a soft glow that breathes behind it.
 */
function PulseButton({
  title,
  sub,
  icon,
  onPress,
  loading,
}: {
  title: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }}>
      <Animated.View style={[styles.pulseGlow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] }) }]} />
      <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }} accessibilityRole="button" accessibilityLabel={title}>
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigAction}>
          <ShineSweep every={1800} />
          <View style={styles.bigActionIcon}>
            <Ionicons name={icon} size={22} color="#FDE68A" />
          </View>
          <View style={{ flex: 1 }}>
            <T style={styles.bigActionTitle} numberOfLines={1}>
              {loading ? '…' : title}
            </T>
            {sub ? (
              <T variant="tiny" color="#5B3A00" numberOfLines={1}>
                {sub}
              </T>
            ) : null}
          </View>
          <View style={styles.bigActionArrow}>
            <Ionicons name="chevron-forward" size={18} color="#3B1D00" />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The pot, minimal and premium: a slim dark strip with a gold hairline — "POT" in small gold
 * letters, the amount large, and how it's made up as a small pill. Free rooms: no money at all.
 */
function PotBadge({ pot, tickets, price }: { pot: number; tickets: number; price: number }) {
  const { t } = useTranslation();
  if (isFreeRoom()) {
    return (
      <View style={styles.potStrip}>
        <Ionicons name="sparkles" size={18} color="#FDE68A" />
        <T variant="smallBold" color="#fff" style={{ flex: 1 }}>
          {t('lobby.freeGame')}
        </T>
      </View>
    );
  }
  return (
    <View style={styles.potStrip}>
      <View style={{ flex: 1 }}>
        <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 2 }}>
          {t('lobby.pot').toUpperCase()}
        </T>
        {isCoinsRoom() ? (
          <CoinAmount value={pot} variant="h1" color="#fff" gap={8} />
        ) : (
          <T variant="h1" color="#fff" numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(pot)}
          </T>
        )}
      </View>
      <View style={styles.potPill}>
        <T variant="tiny" color="#FDE68A">
          {t('lobby.potFormula', { tickets, price: formatRupees(price) })}
        </T>
      </View>
    </View>
  );
}

function LobbyPanel({
  state,
  me,
  onOpenPicker,
  onEndSeries,
  onLeave,
}: {
  state: RoomState;
  me: Me;
  onOpenPicker: () => void;
  onEndSeries: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const { room } = state;
  const game = state.game!;
  const isHost = room.hostId === me.id;
  const host = state.members.find((m) => m.userId === room.hostId);
  const hostName = host?.name ?? t('room.host');
  /** 'set' = first time (then everyone is asked to be ready); 'edit' = change before starting. */
  const [prizeMode, setPrizeMode] = useState<'set' | 'edit' | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: roomKey(room.id) });
  const onError = (err: unknown) => showToast({ variant: 'error', title: errorMessage(err) });

  const phase = game.phase;
  const step: 1 | 2 | 3 = phase === 'joining' ? 1 : phase === 'tickets' ? 2 : 3;
  const readySet = new Set(state.readyUserIds);
  const holders = state.members.filter((m) => m.tickets > 0);
  /** Who is holding things up at this step. */
  const notReady =
    phase === 'tickets'
      ? state.members.filter((m) => m.tickets === 0)
      : phase === 'ready'
        ? holders.filter((m) => !readySet.has(m.userId))
        : [];
  const allHaveTickets = phase === 'tickets' && notReady.length === 0 && holders.length >= 2;
  const allReady = phase === 'ready' && notReady.length === 0 && holders.length >= 2;
  const myTickets = state.myTickets.length;
  const iAmReady = readySet.has(me.id);
  const nameOf = (m: { userId: string; name: string }) => (m.userId === me.id ? t('common.you') : m.name.split(' ')[0]);

  const savePrizes = useMutation({
    mutationFn: async (amounts: Partial<Record<PrizeType, number>>) => {
      await roomService.setPrizeAmounts(game.id, amounts);
      if (prizeMode === 'set') await roomService.openReady(game.id);
    },
    onSuccess: () => {
      setPrizeMode(null);
      refresh();
    },
    onError,
  });
  const openTickets = useMutation({ mutationFn: () => roomService.openTickets(game.id), onSuccess: refresh, onError });
  // Step 3: the "get ready" card pops up once per game for players with tickets (the I'm ready
  // button opens it again).
  const [readyOpen, setReadyOpen] = useState(false);
  const readyShownFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'ready' && myTickets > 0 && !iAmReady && readyShownFor.current !== game.id) {
      readyShownFor.current = game.id;
      setReadyOpen(true);
    }
  }, [phase, myTickets, iAmReady, game.id]);
  const ready = useMutation({
    mutationFn: () => roomService.setReady(game.id),
    onSuccess: () => {
      setReadyOpen(false);
      refresh();
    },
    onError,
  });
  const start = useMutation({ mutationFn: () => roomService.start(game.id), onSuccess: refresh, onError });

  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const remove = useMutation({
    mutationFn: (userId: string) => roomService.removeMember(room.id, userId),
    onSuccess: () => {
      setRemoving(null);
      refresh();
    },
    onError,
  });

  const statusOf = (m: RoomState['members'][number]) => {
    if (phase === 'joining') return m.userId === room.hostId ? { label: `👑 ${t('room.host')}`, color: colors.goldDark } : null;
    // While tickets are being taken, how many each player took stays private (until the host's Next).
    if (phase === 'tickets')
      return m.tickets > 0
        ? { label: m.userId === me.id ? `✓ ${t('lobby.readyWithTickets', { count: m.tickets })}` : `✓ ${t('lobby.ticketsTaken')}`, color: colors.success }
        : { label: t('lobby.notReady'), color: colors.warning };
    if (m.tickets === 0) return { label: t('lobby.watching'), color: colors.textMuted };
    return readySet.has(m.userId)
      ? { label: `✓ ${t('lobby.ready')}`, color: colors.success }
      : { label: t('lobby.notReadyYet'), color: colors.warning };
  };

  return (
    <View style={{ gap: spacing.md }}>
      {state.previousGameId ? (
        <>
          <ResultsCard gameId={state.previousGameId} meId={me.id} highlight={t('results.nextGame')} />
          {isHost ? null : <Button title={t('room.exitRoom')} variant="secondary" icon="exit-outline" onPress={onLeave} />}
        </>
      ) : null}

      <Card style={{ paddingVertical: spacing.md }}>
        <StepBar step={step} />
      </Card>

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

      {phase === 'ready' ? (
        <Card>
          <PotBadge pot={Number(game.pot)} tickets={game.ticketCount} price={Number(game.ticketPrice)} />
        </Card>
      ) : null}

      {phase === 'ready' ? (
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3" style={{ flex: 1 }}>
              {t('lobby.prizesThisGame')}
            </T>
            {isHost ? (
              <Button title={t('lobby.editPrizes')} small variant="secondary" icon="create-outline" onPress={() => setPrizeMode('edit')} />
            ) : null}
          </Row>
          <PrizeList
            compact
            rows={state.prizes.map((p) => ({ prize: p.prize, amount: Number(p.amount), status: p.status, winners: [] }))}
          />
        </Card>
      ) : null}

      <RoomSettingsCard state={state} isHost={isHost} />

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3" style={{ flex: 1 }}>
            {phase === 'joining'
              ? t('lobby.playersJoined', { count: state.members.length, max: room.maxPlayers })
              : t('lobby.playersThisGame')}
          </T>
          {phase !== 'joining' ? (
            <Pill
              label={t('lobby.readyCount', {
                ready: (phase === 'tickets' ? state.members.length : holders.length) - notReady.length,
                total: phase === 'tickets' ? state.members.length : holders.length,
              })}
              color={colors.primary}
              style={styles.rowPill}
            />
          ) : null}
        </Row>
        {state.members.map((m) => {
          const status = statusOf(m);
          return (
            <Row key={m.userId} style={styles.readyRow}>
              <Avatar avatarKey={m.avatarKey} size={34} ring={m.userId === room.hostId ? colors.gold : undefined} />
              <T variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                {m.name}
                {m.userId === me.id ? ` (${t('common.you')})` : ''}
              </T>
              {status ? <Pill label={status.label} color={status.color} style={styles.rowPill} /> : null}
              {isHost && m.userId !== me.id ? (
                <Pressable
                  onPress={() => setRemoving({ userId: m.userId, name: m.name })}
                  accessibilityLabel={t('lobby.remove')}
                  hitSlop={6}
                  style={({ pressed }) => [styles.kick, { backgroundColor: colors.error, opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
              ) : null}
            </Row>
          );
        })}
        {notReady.length ? (
          <Row style={[styles.waitingBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
            <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
            <T variant="small" color={colors.warning} style={{ flex: 1 }}>
              {t('lobby.stillNotReady', { names: notReady.map(nameOf).join(', ') })}
              {isHost && notReady.some((m) => m.userId !== me.id) ? ' ' + t('lobby.kickHint') : ''}
            </T>
          </Row>
        ) : null}
      </Card>

      {/* What I do now — right above the main button. */}
      {phase === 'tickets' ? (
        <Card style={[{ gap: spacing.sm }, myTickets === 0 && { borderColor: colors.gold, borderWidth: 2 }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">{t('lobby.yourTickets')}</T>
            {myTickets ? <Pill label={t('lobby.tickets', { count: myTickets })} color={colors.success} style={styles.rowPill} /> : null}
          </Row>
          {myTickets === 0 ? (
            <>
              <T muted>{t('lobby.noTickets')}</T>
              <PulseButton title={t('lobby.chooseTickets')} sub={t('lobby.chooseTicketsSub', { count: room.maxTickets ?? 3 })} icon="ticket" onPress={onOpenPicker} />
            </>
          ) : (
            // The tickets themselves appear once the game starts.
            <Row style={[styles.waitingBox, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
              <Ionicons name="ticket" size={18} color={colors.success} />
              <T variant="small" color={colors.success} style={{ flex: 1 }}>
                {t('lobby.ticketsAtStart', { count: myTickets })}
              </T>
            </Row>
          )}
        </Card>
      ) : null}
      {phase === 'ready' ? (
        myTickets > 0 ? (
          iAmReady ? (
            <Card style={[styles.readyCard, { borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={26} color={colors.success} />
              <T variant="bodyMedium" style={{ flex: 1 }}>
                {isHost ? t('lobby.hostReady') : t('lobby.youAreReady')}
              </T>
            </Card>
          ) : (
            <PulseButton title={t('lobby.readyButton')} sub={t('lobby.readySub')} icon="checkmark-done" onPress={() => setReadyOpen(true)} loading={ready.isPending} />
          )
        ) : (
          <T muted center>
            {t('lobby.watchingThisGame')}
          </T>
        )
      ) : null}

      {isHost ? (
        <View style={{ gap: spacing.sm }}>
          {phase === 'joining' ? (
            <>
              <Button
                title={t('lobby.startGame')}
                variant="gold"
                icon="play-circle"
                loading={openTickets.isPending}
                disabled={state.members.length < 2}
                onPress={() => openTickets.mutate()}
              />
              <T variant="small" muted center>
                {state.members.length < 2 ? t('lobby.needTwoJoined') : t('lobby.nextTakeTicketsHint')}
              </T>
            </>
          ) : phase === 'tickets' ? (
            <>
              <Button
                title={t('lobby.nextSetPrizes')}
                variant="gold"
                icon="trophy"
                disabled={!allHaveTickets}
                onPress={() => setPrizeMode('set')}
              />
              {!allHaveTickets ? (
                <T variant="small" muted center>
                  {notReady.length > 0 ? t('lobby.waitingForTickets', { count: notReady.length }) : t('lobby.needTwo')}
                </T>
              ) : null}
            </>
          ) : allReady ? (
            <PulseButton title={t('lobby.startNow')} icon="play" onPress={() => start.mutate()} loading={start.isPending} />
          ) : (
            <>
              <Button title={t('lobby.startNow')} variant="gold" icon="play" disabled onPress={() => undefined} />
              <T variant="small" muted center>
                {t('lobby.hostStartsWhenReady')}
              </T>
            </>
          )}
        </View>
      ) : (
        <Row style={{ justifyContent: 'center' }}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} />
          <T muted style={{ flexShrink: 1 }}>
            {phase === 'joining'
              ? t('lobby.waitingHostTickets', { name: hostName })
              : phase === 'tickets'
                ? t('lobby.waitingHost', { name: hostName })
                : allReady
                  ? t('lobby.waitingHostStart', { name: hostName })
                  : t('lobby.hostStartsWhenReady')}
          </T>
        </Row>
      )}

      <PrizeSetupModal
        visible={prizeMode !== null}
        pot={Number(game.pot)}
        prizes={state.prizes}
        template={room.prizes}
        saving={savePrizes.isPending}
        saveLabel={prizeMode === 'set' ? t('lobby.setPrizesAskReady') : t('common.save')}
        hint={t('lobby.setAmountsHint', { players: game.playerCount, tickets: game.ticketCount })}
        onSave={(amounts) => savePrizes.mutate(amounts)}
        onClose={() => setPrizeMode(null)}
      />
      <ReadySheet
        visible={readyOpen && phase === 'ready' && !iAmReady && myTickets > 0}
        state={state}
        gameLabel={gameLabel(room, game.gameNo)}
        busy={ready.isPending}
        onReady={() => ready.mutate()}
        onClose={() => setReadyOpen(false)}
      />
      <ConfirmModal
        visible={removing !== null}
        icon="close-circle"
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

function PlayersPanel({ state, me, onLeave, onEnd }: { state: RoomState; me: Me; onLeave: () => void; onEnd: () => void }) {
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
                <IconButton
                  icon="close-circle"
                  size={32}
                  color={colors.error}
                  onPress={() => respond.mutate({ userId: r.userId, accept: false })}
                />
                <IconButton
                  icon="checkmark-circle"
                  size={32}
                  color={colors.success}
                  onPress={() => respond.mutate({ userId: r.userId, accept: true })}
                />
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
                {m.tickets ? (state.game.phase === 'tickets' && m.userId !== me.id ? `✓ ${t('lobby.ticketsTaken')}` : `🎫 ${m.tickets}`) : t('lobby.noTicketsYet')}
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
      {/* The host runs the room: they end / dismiss it from the Play tab instead of leaving. */}
      {isHost ? null : <Button title={t('room.leave')} variant="ghost" icon="exit-outline" onPress={onLeave} />}
    </View>
  );
}

function EndedPanel({
  state,
  me,
  onPlayAgain,
  busy,
  onChat,
  onRemove,
}: {
  state: RoomState;
  me: Me;
  onPlayAgain: () => void;
  busy: boolean;
  onChat: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { room } = state;
  const lastGameId = state.game?.status === 'finished' ? state.game.id : state.previousGameId;
  // When the nightly clean-up deletes this room (from My rooms, which carries the date).
  const myRooms = useQuery({ queryKey: ['myRooms'], queryFn: roomService.myRooms });
  const deleteAt = myRooms.data?.find((r) => r.id === room.id)?.deleteAt;
  const daysLeft = deleteAt ? Math.max(0, Math.ceil((new Date(deleteAt).getTime() - Date.now()) / 86_400_000)) : null;
  // The app's own confirmation (same style as NearbyU), never a system alert.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const askDelete = () => setConfirmDelete(true);
  return (
    <View style={{ gap: spacing.md }}>
      {/* Minimal, premium "completed" card: gold trophy, title, one line. */}
      <View style={styles.doneCard}>
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#B87400']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneIcon}>
          <Ionicons name="trophy" size={26} color="#3B1D00" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <T variant="h2" color="#fff">
            {room.kind === 'series' ? t('results.seriesOver') : t('results.gameOver')}
          </T>
          <T variant="small" color="rgba(255,255,255,0.75)">
            {room.kind === 'series' ? t('results.gamesPlayed', { count: room.gamesPlayed }) : t('results.thanksForPlaying')}
          </T>
        </View>
      </View>
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
      {/* The room has ended: no Quit — just its chat and a simple Delete (from my rooms). */}
      <Row gap={spacing.sm}>
        {room.chatEnabled ? <ActionTile icon="chatbubbles" label={t('chat.title')} tint={['#7C3AED', '#C026D3']} onPress={onChat} /> : null}
        <ActionTile icon="trash" label={t('room.delete')} tint={['#F87171', '#DC2626']} onPress={askDelete} />
        <ConfirmModal
          visible={confirmDelete}
          icon="trash"
          title={t('room.delete')}
          message={t('room.deleteConfirm', { title: room.title })}
          confirmLabel={t('room.delete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onRemove();
          }}
        />
      </Row>
      {daysLeft !== null ? (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <T variant="tiny" muted>
            {daysLeft === 0 ? t('room.autoDeleteToday') : t('room.autoDeleteIn', { count: daysLeft })}
          </T>
        </Row>
      ) : null}
    </View>
  );
}

/** A square-ish gradient action tile (ended room: chat / delete). */
function ActionTile({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: [string, string];
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.actionTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIcon}>
          <Ionicons name={icon} size={22} color="#fff" />
        </LinearGradient>
        <T variant="smallBold">{label}</T>
      </View>
    </Pressable>
  );
}

export function RoomScreen(props: ScreenProps<'Room'>) {
  return (
    <ErrorBoundary onBack={() => props.navigation.goBack()}>
      <RoomScreenInner {...props} />
    </ErrorBoundary>
  );
}

function RoomScreenInner({ route, navigation }: ScreenProps<'Room'>) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const meRef = useRef<string | undefined>(undefined);
  meRef.current = me.data?.id;
  // The caller voice can be switched mid-game from the side panel (English / Telugu / both).
  const callLanguage = useSettingsStore((s) => s.callLanguage);
  const caller = useCaller(callLanguage === 'en' || callLanguage === 'te' ? callLanguage : undefined, { stopOnUnmount: true });
  const announce = useWinnerStore((s) => s.announce);
  const [tab, setTab] = useState<Tab>('game');
  const [pickerOpen, setPickerOpen] = useState(false);
  const promptedGame = useRef<string | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'end' | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  /** Read inside the realtime handler (which is created before the first fetch). */
  const checkClaimsRef = useRef(false);
  const isHostRef = useRef(false);
  const onEvent = useCallback(
    (e: RoomEvent) => {
      switch (e.type) {
        case 'call':
          caller.announce(e.n);
          break;
        case 'prize':
          announce({ gameId: e.gameId, callIndex: e.callIndex, prize: e.prize, amount: Number(e.amount), winners: e.winners });
          if (e.winners.some((w) => w.userId === meRef.current)) caller.celebrate();
          break;
        case 'claim_check': {
          const before = useClaimCheckStore.getState().checks.find((c) => c.gameId === e.gameId && c.prize === e.prize);
          const fresh = !before;
          // Late claim: someone who finished on an earlier number took the prize from me.
          const me = meRef.current;
          if (e.earlier && me && before?.winners.some((w) => w.userId === me) && !e.winners.some((w) => w.userId === me)) {
            showToast({
              variant: 'info',
              title: t('game.claimBeatenEarlier', { name: e.winners[0]?.name ?? '', prize: t(`prizes.${e.prize}`) }),
            });
          }
          useClaimCheckStore.getState().add(e);
          const { sounds, haptics } = useSettingsStore.getState();
          if (fresh && sounds) playPrizeSound(soundFor(e.prize), haptics);
          break;
        }
        case 'prize_settled':
          useClaimCheckStore.getState().remove(e.gameId, e.prize);
          // Checked rooms announce only now, once everyone had the chance to claim too.
          if (checkClaimsRef.current && e.winnerList?.length) {
            announce({ gameId: e.gameId, callIndex: e.callIndex, prize: e.prize, amount: Number(e.amount), winners: e.winnerList });
            if (e.winnerList.some((w) => w.userId === meRef.current)) caller.celebrate();
          }
          break;
        case 'speed':
          showToast({ variant: 'info', title: t('game.speedChanged', { seconds: e.seconds }) });
          break;
        case 'paused':
          showToast({ variant: e.paused ? 'error' : 'info', title: e.paused ? t('game.pausedToast') : t('game.resumedToast') });
          break;
        case 'player_issue':
          // A player's problem in the lobby — only the host sees it.
          if (isHostRef.current) {
            showToast({ variant: 'error', title: `${e.name}: ${e.text}` });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
          break;
        case 'pause_request':
          // Only the host can pause: a banner on the game screen (with a buzz) until they act.
          if (isHostRef.current) {
            usePauseRequestStore.getState().add({ gameId: e.gameId, userId: e.userId, name: e.name, at: new Date().toISOString() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
          break;
        case 'room_settings':
          if (!isHostRef.current) showToast({ variant: 'info', title: t('lobby.settingsUpdated') });
          break;
        case 'phase':
          showToast({ variant: 'info', title: e.phase === 'ready' ? t('lobby.readyOpenToast') : t('lobby.ticketsOpenToast') });
          break;
        case 'final_check': {
          const { sounds, haptics } = useSettingsStore.getState();
          if (sounds) playPrizeSound('fullhouse', haptics);
          break;
        }
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
  checkClaimsRef.current = !!state && state.room.checkClaims;
  const isHost = !!state && state.room.hostId === me.data?.id;
  isHostRef.current = isHost;
  // Amounts inside this room follow its stake (free / coins / ₹); back to ₹ when we leave.
  const stakeMode = state?.room.stakeMode ?? 'amount';
  useEffect(() => {
    useStakeStore.getState().setMode(stakeMode);
  }, [stakeMode]);
  useEffect(() => () => useStakeStore.getState().setMode('amount'), []);
  // Home's "My rooms" shows status / game number: mark it stale whenever those change here.
  const roomStatus = state?.room.status;
  const gamesPlayed = state?.room.gamesPlayed;
  const gameStatus = state?.game?.status;
  useEffect(() => {
    if (roomStatus) qc.invalidateQueries({ queryKey: ['myRooms'] });
  }, [roomStatus, gamesPlayed, gameStatus, qc]);

  useEffect(
    () => () => {
      useWinnerStore.getState().clear();
      useClaimCheckStore.getState().clear();
    },
    [],
  );

  // Ask once per game, when the host opens the ticket step.
  const lobbyGameId =
    state?.game?.status === 'lobby' && state.game.phase === 'tickets' && state.room.status === 'open' ? state.game.id : null;
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
      // Coins rooms: the balance just changed.
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const [endedChat, setEndedChat] = useState(false);
  const removeRoom = useMutation({
    mutationFn: () => roomService.hideRoom(roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myRooms'] });
      showToast({ variant: 'success', title: t('room.removedFromMine') });
      navigation.goBack();
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
    return (
      <View style={{ flex: 1 }}>
        {/* Chat, pause and voice live in the game's side panel (no floating buttons). */}
        <LiveView state={state} me={me.data} serverNow={roomQuery.serverNow} connected={roomQuery.connected} />
      </View>
    );
  }

  const ended = state.room.status === 'ended';
  const requests = isHost ? state.joinRequests.length : 0;
  // Nothing played yet: the host just dismisses the room.
  const notStarted = state.room.gamesPlayed === 0;
  const endLabel = notStarted ? t('room.dismissRoom') : state.room.kind === 'series' ? t('room.endSeries') : t('room.endRoom');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RoomHeader state={state} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'game', label: t('room.tabPlay') },
            {
              value: 'players',
              label: `${t('room.tabPlayers')} (${state.room.memberCount})`,
              dot: requests > 0,
            },
            { value: 'standings', label: t('room.tabStandings') },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom + (state.room.chatEnabled ? 72 : 0) }}
      >
        <View style={{ marginBottom: spacing.md }}>
          <RoomInfoCard state={state} />
        </View>
        {tab === 'game' ? (
          ended || !state.game ? (
            <EndedPanel
              state={state}
              me={me.data}
              onPlayAgain={() => playAgain.mutate()}
              busy={playAgain.isPending}
              onChat={() => setEndedChat(true)}
              onRemove={() => removeRoom.mutate()}
            />
          ) : (
            <>
              <LobbyPanel
                state={state}
                me={me.data}
                onOpenPicker={() => setPickerOpen(true)}
                onEndSeries={() => setConfirm('end')}
                onLeave={() => setConfirm('leave')}
              />
              {/* Host: dismiss a room made by mistake (or end it) — last on the Play tab, same gap above and below. */}
              {isHost ? (
                <Button
                  title={endLabel}
                  variant="danger"
                  icon={notStarted ? 'close-circle' : 'stop-circle'}
                  onPress={() => setConfirm('end')}
                  style={{ marginVertical: spacing.lg }}
                />
              ) : null}
            </>
          )
        ) : null}
        {tab === 'players' ? (
          <PlayersPanel state={state} me={me.data} onLeave={() => setConfirm('leave')} onEnd={() => setConfirm('end')} />
        ) : null}
        {tab === 'standings' ? <StandingsList roomId={roomId} meId={me.data.id} /> : null}
      </ScrollView>

      {state.room.chatEnabled && !ended ? <RoomChat state={state} meId={me.data.id} raised={false} /> : null}
      {/* Ended rooms: the chat history, read only. */}
      {state.room.chatEnabled && ended ? (
        <RoomChat state={state} meId={me.data.id} showFab={false} readOnly open={endedChat} onClose={() => setEndedChat(false)} />
      ) : null}
      {state.game ? (
        <TicketPicker
          visible={pickerOpen && !ended && state.game.status === 'lobby' && state.game.phase === 'tickets' && state.myTickets.length === 0}
          price={Number(state.room.ticketPrice)}
          maxTickets={state.room.maxTickets ?? 3}
          coins={me.data?.coins}
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
        message={confirm === 'end' ? (notStarted ? t('room.dismissConfirm') : t('room.endRoomConfirm')) : t('room.leaveConfirm')}
        confirmLabel={confirm === 'end' ? endLabel : t('room.leave')}
        loading={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  potStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1E0B3B',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  potPill: { backgroundColor: 'rgba(253,230,138,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  actionTile: { alignItems: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: 16, borderWidth: 1.5 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  // A little taller: room to breathe around the code.
  // Taller, with the row centred in it: equal space above and below.
  header: { paddingBottom: spacing.lg, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  infoTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Poppins carries extra top/bottom padding on Android: drop it so the text sits centred.
  codeText: { includeFontPadding: false, textAlignVertical: 'center' },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  potCard: { borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  endedBanner: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#1E0B3B',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.55)',
    padding: spacing.md,
  },
  doneIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  waitWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  pulseGlow: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 26, backgroundColor: '#F5B700' },
  bigAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 68, borderRadius: 22, paddingHorizontal: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#B45309' },
  bigActionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#3B1D00', alignItems: 'center', justifyContent: 'center' },
  bigActionTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: '#3B1D00' },
  bigActionArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  readyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 2 },
  waitingBox: { borderRadius: radius.md, padding: spacing.sm, marginTop: 4 },
  potCoin: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FDE68A',
    elevation: 6,
    shadowColor: '#B45309',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  readyRow: { paddingVertical: 4, alignItems: 'center' },
  rowPill: { alignSelf: 'center', paddingVertical: 4 },
  kick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2, borderRadius: 1, minWidth: 8 },
});
