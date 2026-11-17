import { supabase } from '@/lib/supabase';
import type { PrizeType } from '@/game/engine/ticket';
import type {
  GameResults,
  JoinResult,
  MyJoinStatus,
  MyRoomSummary,
  PublicRoomSummary,
  RoomKind,
  RoomState,
  RoomVisibility,
  StandingRow,
  Ticket,
} from '@/types/api';
import { unwrap } from './errors';

export interface CreateRoomInput {
  title: string;
  kind: RoomKind;
  visibility: RoomVisibility;
  maxPlayers: number;
  ticketPrice: number;
  callIntervalSeconds: number;
  seriesLength: number;
  /** Enabled prizes → template amount (₹). */
  prizes: Partial<Record<PrizeType, number>>;
}

export type ClaimResult = 'won' | 'shared' | 'already_claimed' | 'already_yours' | 'not_complete';

export const roomService = {
  async create(input: CreateRoomInput): Promise<{ roomId: string; code: string }> {
    return unwrap(
      await supabase.rpc('create_room', {
        p_title: input.title,
        p_kind: input.kind,
        p_visibility: input.visibility,
        p_max_players: input.maxPlayers,
        p_ticket_price: input.ticketPrice,
        p_call_interval_seconds: input.callIntervalSeconds,
        p_series_length: input.seriesLength,
        p_prizes: input.prizes,
      }),
    ) as { roomId: string; code: string };
  },

  /** Asks to join; the host must accept (members get 'member' straight away). */
  async joinByCode(code: string): Promise<JoinResult> {
    return unwrap(await supabase.rpc('join_room_by_code', { p_code: code })) as JoinResult;
  },

  async joinPublic(roomId: string): Promise<JoinResult> {
    return unwrap(await supabase.rpc('join_public_room', { p_room: roomId })) as JoinResult;
  },

  async myJoinStatus(roomId: string): Promise<MyJoinStatus> {
    return unwrap(await supabase.rpc('my_join_status', { p_room: roomId })) as MyJoinStatus;
  },

  async respondJoin(roomId: string, userId: string, accept: boolean): Promise<void> {
    unwrap(await supabase.rpc('respond_join_request', { p_room: roomId, p_user: userId, p_accept: accept }));
  },

  async leave(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('leave_room', { p_room: roomId }));
  },

  async end(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('end_room', { p_room: roomId }));
  },

  async playAgain(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('play_again', { p_room: roomId }));
  },

  async getState(roomId: string): Promise<RoomState> {
    return unwrap(await supabase.rpc('get_room_state', { p_room: roomId })) as RoomState;
  },

  async getResults(gameId: string): Promise<GameResults> {
    return unwrap(await supabase.rpc('get_game_results', { p_game: gameId })) as GameResults;
  },

  async getStandings(roomId: string): Promise<StandingRow[]> {
    return unwrap(await supabase.rpc('get_room_standings', { p_room: roomId })) as StandingRow[];
  },

  async listPublic(): Promise<PublicRoomSummary[]> {
    return unwrap(await supabase.rpc('list_public_rooms')) as PublicRoomSummary[];
  },

  async myRooms(): Promise<MyRoomSummary[]> {
    return unwrap(await supabase.rpc('get_my_rooms', { p_limit: 30 })) as MyRoomSummary[];
  },

  async setMyTickets(gameId: string, count: number): Promise<Ticket[]> {
    return unwrap(await supabase.rpc('set_my_tickets', { p_game: gameId, p_count: count })) as Ticket[];
  },

  async setPrizeAmounts(gameId: string, amounts: Partial<Record<PrizeType, number>>): Promise<void> {
    unwrap(await supabase.rpc('set_game_prizes', { p_game: gameId, p_amounts: amounts }));
  },

  async start(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('start_game', { p_game: gameId }));
  },

  async claim(ticketId: string, prize: PrizeType): Promise<ClaimResult> {
    const res = unwrap(await supabase.rpc('claim_prize', { p_ticket: ticketId, p_prize: prize })) as {
      result: ClaimResult;
    };
    return res.result;
  },

  /** Backup clock when a number is overdue; failures are harmless (cron is the main clock). */
  async nudge(gameId: string): Promise<void> {
    await supabase.rpc('nudge_game', { p_game: gameId });
  },
};
