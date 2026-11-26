import { supabase } from '@/lib/supabase';
import type { PrizeType } from '@/game/engine/ticket';
import type {
  ChatMessage,
  ChatRead,
  CoinLedgerRow,
  HintMode,
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
  LedgerGame,
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
  hintMode: HintMode;
  /** Normal rule: how many numbers late an earlier-finished claim may come; 0 = off. */
  lateClaimCalls: number;
  /** Free (no price) / Coins (play coins) / Amount (casual ₹ for scoring). */
  stakeMode: 'free' | 'coins' | 'amount';
  /** Most tickets per player, 1–10. */
  maxTickets: number;
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
  hintMode: HintMode;
  lateClaimCalls: number;
  /** Seconds between called numbers (1–10). */
  callIntervalSeconds: number;
  /** Series rooms only: 0 = no limit, else 2–50 games. */
  seriesLength?: number;
  stakeMode: 'free' | 'coins' | 'amount';
  maxTickets: number;
}

/** The room's values before editing — only what changed is sent. */
export interface RoomSettingsBefore {
  lateClaimCalls: number;
  callIntervalSeconds: number;
  seriesLength: number;
  stakeMode: 'free' | 'coins' | 'amount';
  maxTickets: number;
}

export type ClaimResult = 'won' | 'shared' | 'too_late' | 'already_claimed' | 'already_yours' | 'not_complete' | 'auto';

export const roomService = {
  async create(input: CreateRoomInput): Promise<{ roomId: string; code: string }> {
    const created = unwrap(
      await supabase.rpc('create_room', {
        p_title: input.title,
        p_kind: input.kind,
        p_visibility: input.visibility,
        p_max_players: input.maxPlayers,
        p_ticket_price: input.ticketPrice,
        p_call_interval_seconds: input.callIntervalSeconds,
        p_series_length: input.seriesLength,
        p_prizes: input.prizes,
        p_claim_mode: input.rule === 'auto' ? 'fair' : 'fastest',
        p_auto_mark: input.autoMark,
        p_check_claims: input.rule === 'normal',
        p_chat_enabled: input.chatEnabled,
        p_check_seconds: input.checkSeconds,
      }),
    ) as { roomId: string; code: string };
    // 'struck' is the default on the server.
    if (input.autoMark && input.hintMode === 'next') await this.setHintMode(created.roomId, 'next');
    // 0 (off) is the default on the server.
    if (input.rule === 'normal' && input.lateClaimCalls > 0) await this.setLateClaim(created.roomId, input.lateClaimCalls);
    // Rooms start as '₹ amount' with 3 tickets each on the server.
    // New rooms start Free on the server; Coins / ₹ Amount are set here (₹ Amount only for approved numbers).
    if (input.stakeMode !== 'free') await this.setStakeMode(created.roomId, input.stakeMode);
    if (input.maxTickets !== 3) await this.setMaxTickets(created.roomId, input.maxTickets);
    return created;
  },

  /** Host, lobby: a series' number of games (0 = no limit). */
  async setSeriesLength(roomId: string, len: number): Promise<void> {
    unwrap(await supabase.rpc('set_series_length', { p_room: roomId, p_len: len }));
  },

  /** ₹ Amount access for me: 0 none, 1 may join ₹ rooms, 2 may also create them (set by the admin). */
  async amountAccess(): Promise<number> {
    return Number(unwrap(await supabase.rpc('my_amount_access')) ?? 0);
  },

  /** Host, lobby, before tickets: Free / Coins / ₹ amount. */
  async setStakeMode(roomId: string, mode: 'free' | 'coins' | 'amount'): Promise<void> {
    unwrap(await supabase.rpc('set_stake_mode', { p_room: roomId, p_mode: mode }));
  },

  /** Host, lobby: most tickets per player (1–10). */
  async setMaxTickets(roomId: string, max: number): Promise<void> {
    unwrap(await supabase.rpc('set_max_tickets', { p_room: roomId, p_max: max }));
  },

  async markChatRead(roomId: string, lastId: number): Promise<void> {
    unwrap(await supabase.rpc('mark_chat_read', { p_room: roomId, p_last_id: lastId }));
  },

  async getChatReads(roomId: string): Promise<ChatRead[]> {
    return (unwrap(await supabase.rpc('get_chat_reads', { p_room: roomId })) as ChatRead[] | null) ?? [];
  },

  /** "I'm typing" — the server tells the room; called at most every few seconds. */
  async chatTyping(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('chat_typing', { p_room: roomId }));
  },

  async deleteChatMessage(id: number): Promise<void> {
    unwrap(await supabase.rpc('delete_chat_message', { p_id: id }));
  },

  async coinLedger(): Promise<CoinLedgerRow[]> {
    return (unwrap(await supabase.rpc('get_my_coin_ledger', {})) as CoinLedgerRow[] | null) ?? [];
  },

  /** A player tells the host about a problem (lobby); sent live to the host only. */
  async tellHost(roomId: string, text: string): Promise<void> {
    unwrap(await supabase.rpc('tell_host', { p_room: roomId, p_text: text }));
  },

  /** A player asks the host to pause the running game (once per 30 s). */
  async requestPause(gameId: string): Promise<void> {
    unwrap(await supabase.rpc('request_pause', { p_game: gameId }));
  },

  /** Remove an ended (or left) room from my "My rooms". */
  async hideRoom(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('hide_room', { p_room: roomId }));
  },

  /** Host: Normal rule "Late claim" (0 = off). */
  async setLateClaim(roomId: string, calls: number): Promise<void> {
    unwrap(await supabase.rpc('set_late_claim', { p_room: roomId, p_calls: calls }));
  },

  async setHintMode(roomId: string, mode: HintMode): Promise<void> {
    unwrap(await supabase.rpc('set_hint_mode', { p_room: roomId, p_mode: mode }));
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

  async updateSettings(roomId: string, input: RoomSettingsInput, before: RoomSettingsBefore): Promise<void> {
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
        p_claim_mode: input.rule === 'auto' ? 'fair' : 'fastest',
      }),
    );
    await this.setHintMode(roomId, input.hintMode);
    if (input.lateClaimCalls !== before.lateClaimCalls) await this.setLateClaim(roomId, input.lateClaimCalls);
    if (input.callIntervalSeconds !== before.callIntervalSeconds) await this.setSpeed(roomId, input.callIntervalSeconds);
    if (input.stakeMode !== before.stakeMode) await this.setStakeMode(roomId, input.stakeMode);
    if (input.maxTickets !== before.maxTickets) await this.setMaxTickets(roomId, input.maxTickets);
    if (input.seriesLength !== undefined && input.seriesLength !== before.seriesLength) {
      await this.setSeriesLength(roomId, input.seriesLength);
    }
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

  async getLedger(roomId: string): Promise<LedgerGame[]> {
    return (unwrap(await supabase.rpc('get_room_ledger', { p_room: roomId })) as LedgerGame[] | null) ?? [];
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
