import { supabase } from '@/lib/supabase';
import type { PrizeType } from '@/game/engine/ticket';
import type {
  ChatMessage,
  ClaimRule,
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
  rule: ClaimRule;
  /** Auto hint (highlight called numbers). */
  autoMark: boolean;
  chatEnabled: boolean;
  checkSeconds: number;
}

export interface RoomSettingsInput {
  title: string;
  visibility: RoomVisibility;
  maxPlayers: number;
  ticketPrice: number;
  rule: ClaimRule;
  checkSeconds: number;
  autoMark: boolean;
  chatEnabled: boolean;
}

export type ClaimResult = 'won' | 'shared' | 'already_claimed' | 'already_yours' | 'not_complete' | 'auto';

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
        p_claim_mode: 'fastest',
        p_auto_mark: input.autoMark,
        p_check_claims: input.rule === 'normal',
        p_chat_enabled: input.chatEnabled,
        p_check_seconds: input.checkSeconds,
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

  /** Host: joining step → everyone picks tickets. */
  async openTickets(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('open_tickets', { p_game: gameId }));
  },

  /** Host: prizes are set → everyone confirms they're ready (the game starts when all are). */
  async openReady(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('open_ready', { p_game: gameId }));
  },

  async setReady(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('set_ready', { p_game: gameId }));
  },

  /** "I've checked my tickets" during a check round. */
  async checkDone(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('check_done', { p_game: gameId }));
  },

  /** Host: stop waiting for the check round. */
  async endCheck(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('end_check', { p_game: gameId }));
  },

  async setPaused(gameId: string, paused: boolean): Promise<void> {
    unwrap(await supabase.rpc('set_game_paused', { p_game: gameId, p_paused: paused }));
  },

  async updateSettings(roomId: string, input: RoomSettingsInput): Promise<void> {
    unwrap(
      await supabase.rpc('update_room_settings', {
        p_room: roomId,
        p_title: input.title,
        p_visibility: input.visibility,
        p_max_players: input.maxPlayers,
        p_ticket_price: input.ticketPrice,
        p_check_claims: input.rule === 'normal',
        p_check_seconds: input.checkSeconds,
        p_auto_mark: input.autoMark,
        p_chat_enabled: input.chatEnabled,
      }),
    );
  },

  async getChat(roomId: string): Promise<ChatMessage[]> {
    return (unwrap(await supabase.rpc('get_chat', { p_room: roomId })) as ChatMessage[] | null) ?? [];
  },

  async sendChat(roomId: string, body: string): Promise<ChatMessage> {
    return unwrap(await supabase.rpc('send_chat', { p_room: roomId, p_body: body })) as ChatMessage;
  },

  async setSpeed(roomId: string, seconds: number): Promise<void> {
    unwrap(await supabase.rpc('set_call_speed', { p_room: roomId, p_seconds: seconds }));
  },

  async removeMember(roomId: string, userId: string): Promise<void> {
    unwrap(await supabase.rpc('remove_member', { p_room: roomId, p_user: userId }));
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
