import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button, EmptyState, IconButton, Loading, Screen } from '@/components/ui';
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
  const act = async (fn: () => Promise<void>, opts?: { optimistic?: (s: PartyState) => PartyState }) => {
    if (opts?.optimistic) qc.setQueryData<PartyState>(partyKey(partyId), (old) => (old ? opts.optimistic!(old) : old));
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
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

  const title = state ? t(`party.${state.game.kind}.title`) : '';

  if (party.isLoading) {
    return (
      <Screen title="">
        <Loading />
      </Screen>
    );
  }
  if (!state || state.game.status === 'closed') {
    return (
      <Screen title={title}>
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
        <PartyFinished
          state={state}
          busy={busy}
          onAgain={() => act(() => partyService.playAgain(partyId))}
          onEnd={() => setConfirm('end')}
          onLeave={() => setConfirm('leave')}
        />
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
                act(() => partyService.movePawn(partyId, pawn));
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
          <View style={{ marginTop: spacing.md }}>
            <Button title={t('party.leave')} variant="ghost" icon="exit-outline" onPress={() => setConfirm('leave')} />
          </View>
        </>
      )}
      <View style={{ height: spacing.xl }} />
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
  );
}
