import type { PrizeType } from '@/game/engine/ticket';

export type RoomKind = 'normal' | 'series';
export type RoomVisibility = 'public' | 'private';
export type RoomStatus = 'open' | 'ended';
export type GameStatus = 'lobby' | 'running' | 'finished' | 'cancelled';
export type PrizeStatus = 'open' | 'won' | 'settled' | 'unclaimed';

export interface Me {
  id: string;
  displayName: string;
  avatarKey: string;
  phone: string | null;
  isGuest: boolean;
  language: 'en' | 'te';
  role: 'player' | 'admin';
  isBanned: boolean;
  bannedReason: string | null;
  gamesPlayed: number;
  prizesWon: number;
  amountWon: number;
  createdAt: string;
}

export interface Winner {
  userId: string;
  name: string;
  avatarKey: string;
  ticketSerial: number;
  numbers: number[];
  amount?: number;
}

export interface GamePrize {
  prize: PrizeType;
  weight: number;
  amount: number;
  status: PrizeStatus;
  wonAtCall: number | null;
  winners: Winner[];
}

export interface Ticket {
  id: string;
  serial: number;
  cells: number[];
}

export interface RoomMember {
  userId: string;
  name: string;
  avatarKey: string;
  tickets: number;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  kind: RoomKind;
  visibility: RoomVisibility;
  status: RoomStatus;
  hostId: string | null;
  maxPlayers: number;
  ticketPrice: number;
  callIntervalSeconds: number;
  prizes: Partial<Record<PrizeType, number>>;
  seriesLength: number;
  totalGames: number;
  gamesPlayed: number;
  memberCount: number;
  /** 'fastest' = first tap wins; 'fair' = server awards everyone completing on that number. */
  claimMode: ClaimMode;
  /** Called numbers are circled on tickets automatically. */
  autoMark: boolean;
  /** Fastest finger: a claim waits ~10 s for others to check their tickets before announcing. */
  checkClaims: boolean;
}

export type ClaimMode = 'fastest' | 'fair';

export interface Game {
  id: string;
  gameNo: number;
  status: GameStatus;
  /** Lobby step: players joining, then everyone picks tickets. */
  phase: 'joining' | 'tickets';
  ticketPrice: number;
  pot: number;
  prizesCustom: boolean;
  ticketCount: number;
  playerCount: number;
  calledNumbers: number[];
  lastCalledAt: string | null;
  nextCallAt: string | null;
  paused: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RoomState {
  serverTime: string;
  room: Room;
  game: Game | null;
  prizes: GamePrize[];
  previousGameId: string | null;
  myTickets: Ticket[];
  members: RoomMember[];
  /** Pending join requests — only filled for the host. */
  joinRequests: { userId: string; name: string; avatarKey: string; requestedAt: string }[];
}

export type JoinStatus = 'member' | 'pending' | 'rejected' | 'none';

export interface JoinResult {
  roomId: string;
  status: 'member' | 'pending';
}

export interface MyJoinStatus {
  status: JoinStatus;
  roomStatus: RoomStatus;
  title: string;
  code: string;
  hostName: string | null;
  hostAvatar: string | null;
}

export interface GameResults {
  gameId: string;
  gameNo: number;
  status: GameStatus;
  pot: number;
  calledCount: number;
  finishedAt: string | null;
  prizes: GamePrize[];
  /** Each player's result for this game, best first. */
  players: { userId: string; name: string; avatarKey: string; tickets: number; spent: number; won: number; net: number }[];
}

export interface StandingRow {
  userId: string;
  name: string;
  avatarKey: string;
  games: number;
  tickets: number;
  spent: number;
  wins: number;
  won: number;
  net: number;
  list: { gameNo: number; prize: PrizeType; amount: number; numbers: number[] }[];
}

export interface PublicRoomSummary {
  id: string;
  code: string;
  title: string;
  kind: RoomKind;
  ticketPrice: number;
  maxPlayers: number;
  memberCount: number;
  seriesLength: number;
  gamesPlayed: number;
  hostName: string | null;
  hostAvatar: string | null;
  gameStatus: GameStatus | null;
  gameNo: number | null;
  isMember: boolean;
}

export interface MyRoomSummary {
  id: string;
  code: string;
  title: string;
  kind: RoomKind;
  status: RoomStatus;
  isHost: boolean;
  gamesPlayed: number;
  totalGames: number;
  memberCount: number;
  joinedAt: string;
  gameStatus: GameStatus | null;
  myWon: number;
}

export interface AppSettings {
  min_app_version: string;
  maintenance_message: string | null;
}
