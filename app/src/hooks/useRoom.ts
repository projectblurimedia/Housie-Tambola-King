import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { roomService } from '@/services/roomService';
import type { RoomState, Winner } from '@/types/api';
import type { PrizeType } from '@/game/engine/ticket';

export type RoomEvent =
  | { type: 'call'; gameId: string; n: number; index: number }
  | { type: 'prize'; gameId: string; prize: PrizeType; amount: number; callIndex: number; winners: Winner[] }
  | { type: 'prize_settled'; gameId: string; prize: PrizeType; each: number; winners: number; amount: number; callIndex: number; winnerList: Winner[] }
  | { type: 'claim_check'; gameId: string; prize: PrizeType; callIndex: number; winners: Winner[]; deadline: string }
  | { type: 'speed'; seconds: number }
  | { type: 'paused'; paused: boolean }
  | { type: 'phase'; phase: 'tickets' }
  | { type: 'state'; gameId: string; gameNo: number; status: 'running' | 'finished' }
  | { type: 'game'; gameId: string; gameNo: number }
  | { type: 'members'; memberCount: number; joined?: string; removed?: string }
  | { type: 'room_ended'; reason: string }
  | { type: 'join_request'; userId: string; name: string };

/** How late a number may be before this phone nudges the server clock itself. */
const NUDGE_GRACE_MS = 2500;

export const roomKey = (roomId: string) => ['room', roomId] as const;
export const standingsKey = (roomId: string) => ['standings', roomId] as const;

/**
 * Live room state: one get_room_state fetch + the private realtime topic "room:<id>".
 * A called number is applied to the cache immediately (no refetch wait); anything that
 * changes several fields triggers a refetch. Missed messages (background, network blip)
 * are covered by refetch-on-subscribe, refetch-on-foreground and a slow poll.
 */
export function useRoom(roomId: string, onEvent?: (event: RoomEvent) => void) {
  const qc = useQueryClient();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [connected, setConnected] = useState(false);
  /** serverNow ≈ Date.now() + offset */
  const offsetRef = useRef(0);

  const query = useQuery({
    queryKey: roomKey(roomId),
    queryFn: async () => {
      const t0 = Date.now();
      const state = await roomService.getState(roomId);
      const rtt = Date.now() - t0;
      offsetRef.current = new Date(state.serverTime).getTime() + rtt / 2 - Date.now();
      return state;
    },
    refetchInterval: (q) => (q.state.data?.game?.status === 'running' ? 20000 : 8000),
  });

  useEffect(() => {
    let cancelled = false;
    const refetch = () => qc.invalidateQueries({ queryKey: roomKey(roomId) });
    const refetchStandings = () => qc.invalidateQueries({ queryKey: standingsKey(roomId) });
    const channel = supabase.channel(`room:${roomId}`, { config: { private: true } });
    const emit = (e: RoomEvent) => onEventRef.current?.(e);

    channel
      .on('broadcast', { event: 'call' }, ({ payload }) => {
        const p = payload as { gameId: string; n: number; index: number; nextCallAt: string };
        let applied = false;
        qc.setQueryData<RoomState>(roomKey(roomId), (old) => {
          if (!old?.game || old.game.id !== p.gameId || old.game.calledNumbers.length + 1 !== p.index) return old;
          applied = true;
          return {
            ...old,
            game: {
              ...old.game,
              status: 'running',
              calledNumbers: [...old.game.calledNumbers, p.n],
              lastCalledAt: new Date().toISOString(),
              nextCallAt: p.nextCallAt,
            },
          };
        });
        if (!applied) refetch();
        emit({ type: 'call', gameId: p.gameId, n: p.n, index: p.index });
      })
      .on('broadcast', { event: 'prize' }, ({ payload }) => {
        const p = payload as { gameId: string; prize: PrizeType; amount: number; callIndex: number; winners: Winner[] };
        qc.setQueryData<RoomState>(roomKey(roomId), (old) =>
          old && old.game?.id === p.gameId
            ? {
                ...old,
                prizes: old.prizes.map((x) =>
                  x.prize === p.prize ? { ...x, status: 'won', wonAtCall: p.callIndex, winners: p.winners } : x,
                ),
              }
            : old,
        );
        emit({ type: 'prize', gameId: p.gameId, prize: p.prize, amount: p.amount, callIndex: p.callIndex, winners: p.winners });
        // The clock pauses for the announcement — pick up the new nextCallAt.
        refetch();
      })
      .on('broadcast', { event: 'prize_settled' }, ({ payload }) => {
        refetch();
        refetchStandings();
        emit({ type: 'prize_settled', ...(payload as Omit<Extract<RoomEvent, { type: 'prize_settled' }>, 'type'>) });
      })
      .on('broadcast', { event: 'lobby' }, ({ payload }) => {
        const p = payload as { gameId: string; ticketCount: number; playerCount: number; pot: number };
        qc.setQueryData<RoomState>(roomKey(roomId), (old) =>
          old?.game && old.game.id === p.gameId
            ? { ...old, game: { ...old.game, ticketCount: p.ticketCount, playerCount: p.playerCount, pot: p.pot } }
            : old,
        );
        refetch();
      })
      .on('broadcast', { event: 'members' }, ({ payload }) => {
        refetch();
        emit({ type: 'members', ...(payload as { memberCount: number; joined?: string; removed?: string }) });
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        refetch();
        refetchStandings();
        emit({ type: 'state', ...(payload as { gameId: string; gameNo: number; status: 'running' | 'finished' }) });
      })
      .on('broadcast', { event: 'game' }, ({ payload }) => {
        refetch();
        emit({ type: 'game', ...(payload as { gameId: string; gameNo: number }) });
      })
      .on('broadcast', { event: 'join_request' }, ({ payload }) => {
        refetch();
        emit({ type: 'join_request', ...(payload as { userId: string; name: string }) });
      })
      .on('broadcast', { event: 'join_decided' }, () => refetch())
      .on('broadcast', { event: 'paused' }, ({ payload }) => {
        refetch();
        emit({ type: 'paused', paused: (payload as { paused: boolean }).paused });
      })
      .on('broadcast', { event: 'speed' }, ({ payload }) => {
        refetch();
        emit({ type: 'speed', seconds: (payload as { seconds: number }).seconds });
      })
      .on('broadcast', { event: 'phase' }, () => {
        refetch();
        emit({ type: 'phase', phase: 'tickets' });
      })
      .on('broadcast', { event: 'claim_check' }, ({ payload }) => {
        refetch();
        emit({ type: 'claim_check', ...(payload as Omit<Extract<RoomEvent, { type: 'claim_check' }>, 'type'>) });
      })
      .on('broadcast', { event: 'room_ended' }, ({ payload }) => {
        refetch();
        refetchStandings();
        emit({ type: 'room_ended', ...(payload as { reason: string }) });
      });

    (async () => {
      // Private channels authorize with the user's JWT (RLS on realtime.messages).
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') refetch(); // cover anything missed while connecting
      });
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  // Backup clock: if a number is overdue (late cron run), ask the server to advance.
  const gameId = query.data?.game?.id;
  const status = query.data?.game?.status;
  const nextCallAt = query.data?.game?.nextCallAt;
  const paused = query.data?.game?.paused ?? false;
  useEffect(() => {
    if (status !== 'running' || !nextCallAt || !gameId || paused) return;
    let lastNudge = 0;
    const timer = setInterval(() => {
      const serverNow = Date.now() + offsetRef.current;
      if (serverNow > new Date(nextCallAt).getTime() + NUDGE_GRACE_MS && Date.now() - lastNudge > 3000) {
        lastNudge = Date.now();
        roomService
          .nudge(gameId)
          .catch(() => undefined)
          .finally(() => qc.invalidateQueries({ queryKey: roomKey(roomId) }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status, nextCallAt, gameId, paused, roomId, qc]);

  return {
    ...query,
    connected,
    serverNow: () => Date.now() + offsetRef.current,
  };
}
