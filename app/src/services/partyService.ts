import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

export type PartyKind = 'seeta' | 'show' | 'snakes' | 'chamma';

/** Players per game: [min, max]. Board games are one game (no rounds). */
export const PARTY_LIMITS: Record<PartyKind, [number, number]> = { seeta: [3, 15], show: [3, 10], snakes: [2, 10], chamma: [2, 4] };
export const isBoardGame = (k: PartyKind) => k === 'snakes' || k === 'chamma';
export type PartyStatus = 'lobby' | 'playing' | 'finished' | 'closed';
/** lobby · seeta: guess, reveal · show: pass, show, reveal · done */
export type PartyPhase = 'lobby' | 'guess' | 'pass' | 'show' | 'reveal' | 'turn' | 'throw' | 'move' | 'done';

export interface PartyPlayer {
  userId: string;
  name: string;
  avatarKey: string;
  seat: number;
  score: number;
  active: boolean;
  paid: number;
  /** Show: this player has chosen the card to pass this turn. */
  picked: boolean | null;
}

export interface SeetaRoleResult {
  userId: string;
  role: string;
  points: number;
}

export interface ShowResult {
  userId: string;
  place: number | null;
  points: number;
}

/** Public round state — never another player's role or hand. */
export interface PartyRoundState {
  ramId?: string;
  guessId?: string;
  seetaId?: string;
  correct?: boolean;
  roles?: SeetaRoleResult[];
  firstId?: string;
  color?: number;
  shows?: string[];
  results?: ShowResult[];
  // Board games
  order?: string[];
  turn?: string;
  winnerId?: string;
  /** Snakes & Ladders: square per player (0 = not on the board yet). */
  pos?: Record<string, number>;
  roll?: number;
  sixes?: number;
  /** Last move (both board games); at = server time in seconds. */
  last?: {
    userId: string;
    at: number;
    roll?: number;
    from: number;
    mid?: number;
    to: number;
    pawn?: number;
    throw?: number;
    captured?: { userId: string; pawn: number }[];
  };
  /** Ashta Chamma */
  pawns?: Record<string, number[]>;
  cut?: Record<string, boolean>;
  sides?: Record<string, number>;
  throw?: number | null;
  seeds?: boolean[];
  thrownAt?: number;
  thrownBy?: string;
  /** Board games: turns the server had to play for each player (3 = out). */
  misses?: Record<string, number>;
  winners?: string[];
  payout?: { pot: number; each: number };
  /** Ashta Chamma options (copied in at the start). */
  start?: 'enter' | 'board';
  safe?: 'corners' | 'straight';
  teams?: boolean;
  needCut?: boolean;
}

export interface ShowItem {
  e?: string;
  n: string;
}

/** Show's card category: built-in, or the host's own items. */
export interface PartyOptions {
  // Snakes & Ladders: layout (level + 1 of 5), board design (0–8) and pictures in the squares
  board?: number;
  theme?: number;
  icons?: boolean;
  // Ashta Chamma
  start?: 'enter' | 'board';
  safe?: 'corners' | 'straight';
  teams?: boolean;
  needCut?: boolean;
  // Show
  category?: string;
  title?: string;
  items?: ShowItem[];
}

export interface PartyState {
  game: {
    id: string;
    code: string;
    kind: PartyKind;
    hostId: string | null;
    status: PartyStatus;
    rounds: number;
    roundNo: number;
    phase: PartyPhase;
    turnNo: number;
    state: PartyRoundState;
    options: PartyOptions;
    deadline: string | null;
    /** Play coins each player pays at the start (0 = free); the winners share the pot. */
    entryCoins: number;
    pot: number;
  };
  players: PartyPlayer[];
  me: { userId: string; role: string | null; hand: number[] | null; pick: number | null; coins: number };
  serverNow: string;
}

export interface PartyChatMessage {
  id: number;
  userId: string;
  name: string;
  avatarKey: string;
  body: string;
  at: string;
}

export interface MyParty {
  id: string;
  code: string;
  kind: PartyKind;
  status: PartyStatus;
  isHost: boolean;
  players: number;
}

/** Party games (Find Seeta, Show): points only. Every rule runs on the server. */
export const partyService = {
  async create(kind: PartyKind, rounds: number, entry = 0, options: PartyOptions | null = null): Promise<{ id: string; code: string }> {
    return unwrap(await supabase.rpc('create_party', { p_kind: kind, p_rounds: rounds, p_entry: entry, p_options: options })) as { id: string; code: string };
  },
  async joinByCode(code: string): Promise<string> {
    return unwrap(await supabase.rpc('join_party_by_code', { p_code: code })) as string;
  },
  async state(id: string): Promise<PartyState> {
    return unwrap(await supabase.rpc('get_party_state', { p_game: id })) as PartyState;
  },
  async mine(): Promise<MyParty[]> {
    return (unwrap(await supabase.rpc('get_my_parties')) as MyParty[]) ?? [];
  },
  async leave(id: string): Promise<void> {
    unwrap(await supabase.rpc('leave_party', { p_game: id }));
  },
  async remove(id: string, userId: string): Promise<void> {
    unwrap(await supabase.rpc('remove_party_player', { p_game: id, p_user: userId }));
  },
  async start(id: string): Promise<void> {
    unwrap(await supabase.rpc('start_party', { p_game: id }));
  },
  async playAgain(id: string): Promise<void> {
    unwrap(await supabase.rpc('play_party_again', { p_game: id }));
  },
  async end(id: string): Promise<void> {
    unwrap(await supabase.rpc('end_party', { p_game: id }));
  },
  async guess(id: string, target: string): Promise<void> {
    unwrap(await supabase.rpc('seeta_guess', { p_game: id, p_target: target }));
  },
  async pick(id: string, index: number): Promise<void> {
    unwrap(await supabase.rpc('show_pick', { p_game: id, p_index: index }));
  },
  async callShow(id: string): Promise<void> {
    unwrap(await supabase.rpc('show_call', { p_game: id }));
  },
  async setOptions(id: string, category: string, items: ShowItem[] | null, title: string | null): Promise<void> {
    unwrap(await supabase.rpc('set_party_options', { p_game: id, p_category: category, p_items: items, p_title: title }));
  },
  async roll(id: string): Promise<void> {
    unwrap(await supabase.rpc('snakes_roll', { p_game: id }));
  },
  async throwSeeds(id: string): Promise<void> {
    unwrap(await supabase.rpc('chamma_throw', { p_game: id }));
  },
  async movePawn(id: string, pawn: number): Promise<void> {
    unwrap(await supabase.rpc('chamma_move', { p_game: id, p_pawn: pawn }));
  },
  async chat(id: string): Promise<PartyChatMessage[]> {
    return ((unwrap(await supabase.rpc('get_party_chat', { p_game: id })) as PartyChatMessage[] | null) ?? []);
  },
  async sendChat(id: string, body: string): Promise<PartyChatMessage> {
    return unwrap(await supabase.rpc('send_party_chat', { p_game: id, p_body: body })) as PartyChatMessage;
  },
  async chatTyping(id: string): Promise<void> {
    unwrap(await supabase.rpc('party_chat_typing', { p_game: id }));
  },
  async nudge(id: string): Promise<void> {
    unwrap(await supabase.rpc('party_nudge', { p_game: id }));
  },
};
