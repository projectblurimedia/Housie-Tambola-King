import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button, EmptyState, IconButton, Loading, Screen, T } from '@/components/ui';
import { partyKey, useParty, type PartyEvent } from '@/hooks/useParty';
import { isBoardGame, partyService, type PartyOptions, type PartyPlayer, type PartyState, type ShowItem } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { spacing, ThemeOverride } from '@/theme';
import type { ScreenProps } from '@/navigation/types';
import { PartyFinished, PartyLobby, ScoreStrip, useNow } from './parts/PartyCommon';
import { SeetaBoard } from './parts/SeetaBoard';
import { ShowBoard } from './parts/ShowBoard';
import { SnakesBoard } from './parts/SnakesBoard';
import { ChammaBoard } from './parts/ChammaBoard';
import { CategoryPicker } from './parts/CategoryPicker';
import { PARTY_LOOK, PARTY_THEME } from './parts/Premium';
import { RulesModal } from './parts/RulesModal';
import { PartyWinner } from './parts/PartyWinner';
import { PartyChat } from './parts/PartyChat';

/** Seconds a finished game stays on screen before everyone leaves by themselves. */
const AUTO_LEAVE_S = 12;

const buzz = (kind: 'light' | 'heavy' | 'success') => {
  if (!useSettingsStore.getState().haptics) return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

/** One party game (Find Seeta or Show): lobby → rounds → final scores, all live. */
export function PartyScreen(props: ScreenProps<'Party'>) {
  // Reads the cached game (filled by useParty inside) to theme the whole screen in its colours.
  const cached = useQuery<PartyState>({ queryKey: partyKey(props.route.params.partyId), enabled: false });
  const kind = cached.data?.game.kind;
  return (
    <ThemeOverride colors={kind ? PARTY_THEME[kind].palette : null}>
      <PartyContent {...props} />
    </ThemeOverride>
  );
}

function PartyContent({ navigation, route }: ScreenProps<'Party'>) {
  const { partyId } = route.params;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'end' | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  /** This phone is already leaving (its own End / Leave) — don't go back twice. */
  const leaving = useRef(false);

  const onEvent = (e: PartyEvent) => {
    // Entries are paid at the start and the pot at the end: refresh the coin balance.
    if (e.type === 'round' || e.type === 'finished' || e.type === 'closed') qc.invalidateQueries({ queryKey: ['me'] });
    if (e.type === 'show') buzz(e.first ? 'heavy' : 'light');
    else if (e.type === 'reveal' || e.type === 'finished') buzz('success');
    else if (e.type === 'round') buzz('light');
    if (e.type === 'closed' && !leaving.current) {
      leaving.current = true;
      showToast({ variant: 'info', title: t('party.closed') });
      navigation.goBack();
    }
  };
  const party = useParty(partyId, onEvent);
  const state = party.data;
  const playing = state?.game.status === 'playing';
  const now = useNow(playing);
  const seconds = party.secondsLeft(now);

  /** Run an action; refresh the state after it (broadcasts also do). */
  const act = async (fn: () => Promise<void>, opts?: { optimistic?: (s: PartyState) => PartyState }): Promise<boolean> => {
    if (opts?.optimistic) qc.setQueryData<PartyState>(partyKey(partyId), (old) => (old ? opts.optimistic!(old) : old));
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: partyKey(partyId) });
    }
  };

  // Fast taps (Show category, card to pass): show the latest choice at once, send only the latest
  // after a short pause, and ignore replies to older taps — so the selection never jumps back.
  const [pendingOptions, setPendingOptions] = useState<PartyOptions | null>(null);
  const [pendingPick, setPendingPick] = useState<number | null>(null);
  const optSeq = useRef(0);
  const pickSeq = useRef(0);
  const optTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (optTimer.current) clearTimeout(optTimer.current);
      if (pickTimer.current) clearTimeout(pickTimer.current);
    },
    [],
  );
  const chooseCategory = (category: string, items: ShowItem[] | null, catTitle: string | null) => {
    setPendingOptions(category === 'custom' ? { category, items: items ?? [], title: catTitle ?? '' } : { category });
    const seq = ++optSeq.current;
    if (optTimer.current) clearTimeout(optTimer.current);
    optTimer.current = setTimeout(async () => {
      try {
        await partyService.setOptions(partyId, category, items, catTitle);
      } catch (err) {
        if (seq === optSeq.current) {
          showToast({ variant: 'error', title: errorMessage(err) });
          setPendingOptions(null);
        }
        return;
      }
      if (seq !== optSeq.current) return;
      await qc.invalidateQueries({ queryKey: partyKey(partyId) });
      if (seq === optSeq.current) setPendingOptions(null);
    }, 350);
  };
  const choosePick = (index: number) => {
    setPendingPick(index);
    const seq = ++pickSeq.current;
    if (pickTimer.current) clearTimeout(pickTimer.current);
    pickTimer.current = setTimeout(async () => {
      try {
        await partyService.pick(partyId, index);
      } catch (err) {
        if (seq === pickSeq.current) {
          showToast({ variant: 'error', title: errorMessage(err) });
          setPendingPick(null);
        }
        return;
      }
      if (seq !== pickSeq.current) return;
      await qc.invalidateQueries({ queryKey: partyKey(partyId) });
      if (seq === pickSeq.current) setPendingPick(null);
    }, 250);
  };
  // A new turn (cards passed) starts with no pick.
  const turnKey = `${state?.game.roundNo}:${state?.game.turnNo}`;
  useEffect(() => {
    setPendingPick(null);
    pickSeq.current++;
  }, [turnKey]);

  const leave = async () => {
    setConfirm(null);
    leaving.current = true;
    await partyService.leave(partyId).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ['myParties'] });
    navigation.goBack();
  };

  // Game over: show the result (winner card, podium) for a while, then leave by ourselves.
  // The host's "Play again" in that time turns the game back to the lobby and stops this.
  const finished = state?.game.status === 'finished';
  const [leaveIn, setLeaveIn] = useState<number | null>(null);
  useEffect(() => {
    if (!finished) {
      setLeaveIn(null);
      return;
    }
    setLeaveIn(AUTO_LEAVE_S);
    const id = setInterval(() => setLeaveIn((n) => (n === null ? null : Math.max(0, n - 1))), 1000);
    return () => clearInterval(id);
  }, [finished]);
  useEffect(() => {
    if (leaveIn === 0 && !leaving.current) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveIn]);

  const title = state ? t(`party.${state.game.kind}.title`) : '';
  // Every state of this screen (loading, closed, finished) keeps the game's own colours.
  const kind = state?.game.kind ?? qc.getQueryData<PartyState>(partyKey(partyId))?.game.kind;
  const look = kind ? PARTY_LOOK[kind] : undefined;
  const page = kind ? PARTY_THEME[kind].page : undefined;

  if (party.isLoading) {
    return (
      <Screen title="" headerColors={look?.colors} backgroundColors={page}>
        <Loading />
      </Screen>
    );
  }
  if (!state || state.game.status === 'closed') {
    return (
      <Screen title={title} headerColors={look?.colors} backgroundColors={page}>
        <EmptyState
          icon="close-circle-outline"
          title={party.error ? errorMessage(party.error) : t('party.closed')}
          action={<Button title={t('common.back')} onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const g = state.game;
  return (
    <View style={{ flex: 1 }}>
    <Screen scroll title={title} headerColors={PARTY_LOOK[g.kind].colors} backgroundColors={PARTY_THEME[g.kind].page} right={<IconButton icon="information-circle-outline" color="#fff" onPress={() => setRulesOpen(true)} />}>
      {g.status === 'lobby' ? (
        <PartyLobby
          state={state}
          title={title}
          busy={busy}
          onStart={() => act(() => partyService.start(partyId))}
          onLeave={() => setConfirm('leave')}
          onRemove={(p: PartyPlayer) => act(() => partyService.remove(partyId, p.userId))}
          extra={
            g.kind === 'show' ? (
              <CategoryPicker
                options={pendingOptions ?? g.options ?? {}}
                isHost={g.hostId === state.me.userId}
                players={state.players.filter((p) => p.active).length}
                onPick={chooseCategory}
              />
            ) : null
          }
        />
      ) : g.status === 'finished' ? (
        <>
          <PartyFinished
            state={state}
            busy={busy}
            onAgain={() => act(() => partyService.playAgain(partyId))}
            onEnd={() => setConfirm('end')}
            onLeave={() => setConfirm('leave')}
          />
          {leaveIn !== null ? (
            <View style={{ marginTop: spacing.md, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
              <T variant="small" color="#fff" center>
                {t('party.autoLeave', { count: leaveIn })}
              </T>
            </View>
          ) : null}
        </>
      ) : (
        <>
          {g.kind === 'seeta' ? (
            <SeetaBoard state={state} seconds={seconds} onGuess={(id) => act(() => partyService.guess(partyId, id))} />
          ) : g.kind === 'snakes' ? (
            <SnakesBoard
              state={state}
              seconds={seconds}
              busy={busy}
              onRoll={() => {
                buzz('light');
                act(() => partyService.roll(partyId));
              }}
            />
          ) : g.kind === 'chamma' ? (
            <ChammaBoard
              state={state}
              seconds={seconds}
              busy={busy}
              onThrow={() => {
                buzz('light');
                act(() => partyService.throwSeeds(partyId));
              }}
              onMove={(pawn) => {
                buzz('light');
                return act(() => partyService.movePawn(partyId, pawn));
              }}
            />
          ) : (
            <ShowBoard
              state={pendingPick !== null ? { ...state, me: { ...state.me, pick: pendingPick } } : state}
              seconds={seconds}
              onPick={(i) => {
                buzz('light');
                choosePick(i);
              }}
              onShow={() => {
                buzz('heavy');
                act(() => partyService.callShow(partyId));
              }}
            />
          )}
          {isBoardGame(g.kind) ? null : <ScoreStrip players={state.players} meId={state.me.userId} />}
        </>
      )}
      {/* Room for the floating chat button below the last item. */}
      <View style={{ height: 96 }} />
      <RulesModal kind={g.kind} visible={rulesOpen} onClose={() => setRulesOpen(false)} />
      <PartyWinner state={state} />

      <ConfirmModal
        visible={confirm !== null}
        icon={confirm === 'end' ? 'stop-circle' : 'exit'}
        title={confirm === 'end' ? t('party.endGame') : t('party.leave')}
        message={confirm === 'end' ? t('party.endConfirm') : playing ? t('party.leaveMidConfirm') : t('party.leaveConfirm')}
        confirmLabel={confirm === 'end' ? t('party.endGame') : t('party.leave')}
        onConfirm={() => {
          if (confirm === 'end') {
            setConfirm(null);
            leaving.current = true;
            act(() => partyService.end(partyId)).then(() => navigation.goBack());
          } else leave();
        }}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
      {/* During a game, Leave sits at the bottom centre of the screen, not under the board. */}
      {g.status === 'playing' ? (
        <Pressable onPress={() => setConfirm('leave')} accessibilityLabel={t('party.leave')} style={({ pressed }) => [styles.leave, { bottom: spacing.lg + insets.bottom + 4 }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="exit-outline" size={18} color="#fff" />
          <T variant="smallBold" color="#fff">
            {t('party.leave')}
          </T>
        </Pressable>
      ) : null}
      <PartyChat partyId={partyId} meId={state.me.userId} colors={PARTY_LOOK[g.kind].colors} players={state.players.filter((p) => p.active).length} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Centred at the bottom (the chat button is bottom-left).
  leave: { position: 'absolute', alignSelf: 'center', height: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(185,28,28,0.92)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', elevation: 6, zIndex: 20 },
});
