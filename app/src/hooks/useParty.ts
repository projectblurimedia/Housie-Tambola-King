import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { partyService, type PartyChatMessage, type PartyState } from '@/services/partyService';

export const partyKey = (id: string) => ['party', id] as const;
export const partyChatKey = (id: string) => ['partyChat', id] as const;

export type PartyEvent =
  | { type: 'show'; userId: string; first: boolean }
  | { type: 'reveal' }
  | { type: 'round' }
  | { type: 'turn' }
  | { type: 'move' }
  | { type: 'throw' }
  | { type: 'finished' }
  | { type: 'closed' };

/**
 * A party game's live state: one get_party_state fetch, refetched (coalesced) on every broadcast
 * on the private topic "party:<id>", on reconnect and on foreground, with a slow backup poll.
 * When a deadline passes, a phone asks the server to move on (party_nudge) — the server clock
 * does the same, whichever comes first.
 */
export function useParty(id: string, onEvent?: (e: PartyEvent) => void) {
  const qc = useQueryClient();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [channelTry, setChannelTry] = useState(0);
  const [connected, setConnected] = useState(true);
  /** Phone clock − server clock, so countdowns match the server. */
  const skew = useRef(0);

  const query = useQuery({
    queryKey: partyKey(id),
    queryFn: async () => {
      const s = await partyService.state(id);
      skew.current = Date.now() - new Date(s.serverNow).getTime();
      return s;
    },
    refetchInterval: connected ? 15000 : 4000,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!cancelled) qc.invalidateQueries({ queryKey: partyKey(id) });
      }, 60 + Math.random() * 180);
    };
    const channel = supabase.channel(`party:${id}`, { config: { private: true } });
    const on = (event: string, map?: (p: Record<string, unknown>) => PartyEvent | null) =>
      channel.on('broadcast', { event }, ({ payload }) => {
        refetch();
        const e = map?.(payload as Record<string, unknown>);
        if (e) onEventRef.current?.(e);
      });
    on('players');
    on('picked');
    on('move', () => ({ type: 'move' }));
    on('throw', () => ({ type: 'throw' }));
    on('lobby');
    on('round', () => ({ type: 'round' }));
    on('turn', () => ({ type: 'turn' }));
    on('reveal', () => ({ type: 'reveal' }));
    on('finished', () => ({ type: 'finished' }));
    on('closed', () => ({ type: 'closed' }));
    on('show', (p) => ({ type: 'show', userId: String(p.userId), first: Boolean(p.first) }));
    // Chat goes straight into the chat list (no reload of the game).
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const msg = payload as PartyChatMessage;
      qc.setQueryData<PartyChatMessage[]>(partyChatKey(id), (old) => (old?.some((m) => m.id === msg.id) ? old : [...(old ?? []), msg]));
    });

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          refetch();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
          if (!retry) retry = setTimeout(() => !cancelled && setChannelTry((n) => n + 1), 3000);
        }
      });
    })();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refetch());
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (retry) clearTimeout(retry);
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [id, qc, channelTry]);

  // Backup clock: a passed deadline → ask the server to act (random pick / guess, next round).
  const deadline = query.data?.game.deadline;
  const status = query.data?.game.status;
  useEffect(() => {
    if (status !== 'playing' || !deadline) return;
    const due = new Date(deadline).getTime() + skew.current - Date.now() + 700 + Math.random() * 600;
    const t = setTimeout(() => {
      partyService
        .nudge(id)
        .catch(() => undefined)
        .finally(() => qc.invalidateQueries({ queryKey: partyKey(id) }));
    }, Math.max(0, due));
    return () => clearTimeout(t);
  }, [id, deadline, status, qc]);

  /** Seconds left until the deadline (server clock). */
  const secondsLeft = (now: number) =>
    deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() + skew.current - now) / 1000)) : 0;

  return { ...query, connected, secondsLeft };
}
