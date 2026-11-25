import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

export type PartyKind = 'seeta' | 'show';
export type PartyStatus = 'lobby' | 'playing' | 'finished' | 'closed';
/** lobby · seeta: guess, reveal · show: pass, show, reveal · done */
export type PartyPhase = 'lobby' | 'guess' | 'pass' | 'show' | 'reveal' | 'done';

export interface PartyPlayer {
  userId: string;
  name: string;
  avatarKey: string;
  seat: number;
  score: number;
  active: boolean;
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
    deadline: string | null;
  };
  players: PartyPlayer[];
  me: { userId: string; role: string | null; hand: number[] | null; pick: number | null };
  serverNow: string;
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
  async create(kind: PartyKind, rounds: number): Promise<{ id: string; code: string }> {
    return unwrap(await supabase.rpc('create_party', { p_kind: kind, p_rounds: rounds })) as { id: string; code: string };
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
  async nudge(id: string): Promise<void> {
    unwrap(await supabase.rpc('party_nudge', { p_game: id }));
  },
};
