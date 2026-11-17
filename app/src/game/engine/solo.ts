/**
 * Offline "Solo vs bots" game: a pure state machine (no timers, no React) so it is fully
 * unit-testable. The screen calls `callNext()` on its own interval.
 *
 * Rules match online play: a prize goes to whoever claims it first; everyone who completes
 * it on the same number shares it. Bots claim on a delay set by difficulty, so a quick
 * player can beat them.
 */
import { Cells, generateTicket, isPrizeComplete, newDrawOrder, PrizeType, prizeCompletedAt, Rng } from './ticket';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface SoloPlayer {
  id: string;
  name: string;
  avatarKey: string;
  isBot: boolean;
  tickets: Cells[];
}

export interface SoloWinner {
  playerId: string;
  ticketIndex: number;
}

export interface SoloPrize {
  prize: PrizeType;
  winners: SoloWinner[];
  wonAtCall: number | null;
}

export interface SoloState {
  drawOrder: number[];
  called: number[];
  players: SoloPlayer[];
  prizes: SoloPrize[];
  difficulty: BotDifficulty;
  finished: boolean;
  /** The bots' pending claims: prize → call index at which they will claim. */
  botClaims: { playerId: string; ticketIndex: number; prize: PrizeType; claimAtCall: number }[];
}

const BOT_NAMES = ['Ravi', 'Priya', 'Arjun', 'Sita', 'Kiran', 'Meena', 'Vijay', 'Lakshmi', 'Rahul', 'Anjali', 'Suresh', 'Divya'];

/** How many calls a bot waits after completing a prize before claiming it. */
const BOT_DELAY: Record<BotDifficulty, [number, number]> = {
  easy: [1, 3],
  medium: [0, 2],
  hard: [0, 1],
};

export function createSoloGame(params: {
  me: { id: string; name: string; avatarKey: string };
  myTickets: number;
  bots: number;
  difficulty: BotDifficulty;
  prizes: PrizeType[];
  rng?: Rng;
}): SoloState {
  const rng = params.rng ?? Math.random;
  const botNames = [...BOT_NAMES].sort(() => rng() - 0.5);
  const players: SoloPlayer[] = [
    {
      ...params.me,
      isBot: false,
      tickets: Array.from({ length: params.myTickets }, () => generateTicket(rng)),
    },
    ...Array.from({ length: params.bots }, (_, i) => ({
      id: `bot-${i}`,
      name: botNames[i % botNames.length],
      avatarKey: `a${1 + ((i * 5) % 12)}`,
      isBot: true,
      tickets: Array.from({ length: 1 + Math.floor(rng() * 3) }, () => generateTicket(rng)),
    })),
  ];
  return {
    drawOrder: newDrawOrder(rng),
    called: [],
    players,
    prizes: params.prizes.map((prize) => ({ prize, winners: [], wonAtCall: null })),
    difficulty: params.difficulty,
    finished: false,
    botClaims: [],
  };
}

function settleBotClaims(state: SoloState, rng: Rng): SoloState {
  const idx = state.called.length;
  const prizes = state.prizes.map((p) => ({ ...p, winners: [...p.winners] }));
  const due = state.botClaims.filter((c) => c.claimAtCall <= idx);
  for (const claim of due) {
    const prize = prizes.find((p) => p.prize === claim.prize)!;
    if (prize.wonAtCall === null) {
      prize.wonAtCall = idx;
      prize.winners.push({ playerId: claim.playerId, ticketIndex: claim.ticketIndex });
    } else if (prize.wonAtCall === idx && !prize.winners.some((w) => w.playerId === claim.playerId)) {
      prize.winners.push({ playerId: claim.playerId, ticketIndex: claim.ticketIndex });
    }
  }
  const pending = state.botClaims.filter((c) => c.claimAtCall > idx);

  // New completions on this call → schedule a claim.
  const [minDelay, maxDelay] = BOT_DELAY[state.difficulty];
  for (const player of state.players.filter((p) => p.isBot)) {
    player.tickets.forEach((cells, ticketIndex) => {
      for (const prize of prizes) {
        if (prize.wonAtCall !== null) continue;
        if (pending.some((c) => c.playerId === player.id && c.prize === prize.prize)) continue;
        if (prizeCompletedAt(cells, state.called, prize.prize) === idx) {
          const delay = minDelay + Math.floor(rng() * (maxDelay - minDelay + 1));
          if (delay === 0) {
            prize.wonAtCall = idx;
            prize.winners.push({ playerId: player.id, ticketIndex });
          } else {
            pending.push({ playerId: player.id, ticketIndex, prize: prize.prize, claimAtCall: idx + delay });
          }
        }
      }
    });
  }
  return { ...state, prizes, botClaims: pending };
}

function isOver(state: SoloState): boolean {
  const fullHouse = state.prizes.find((p) => p.prize === 'full_house');
  return state.called.length >= 90 || (fullHouse ? fullHouse.wonAtCall !== null : state.prizes.every((p) => p.wonAtCall !== null));
}

/** Calls the next number and lets the bots act. */
export function callNext(state: SoloState, rng: Rng = Math.random): SoloState {
  if (state.finished) return state;
  if (state.called.length >= 90) {
    // No more numbers: bots that were about to claim do so now.
    const due = { ...state, botClaims: state.botClaims.map((c) => ({ ...c, claimAtCall: 90 })) };
    return { ...settleBotClaims(due, rng), finished: true };
  }
  // A full house claimed on the previous number ends the game before another call.
  if (isOver(state)) return { ...state, finished: true };
  const next = state.drawOrder[state.called.length];
  const withCall = { ...state, called: [...state.called, next] };
  return settleBotClaims(withCall, rng);
}

export type ClaimResult = 'won' | 'shared' | 'already_claimed' | 'not_complete';

/** The human player's claim, checked against their own marks (like a real paper ticket). */
export function claimForMe(
  state: SoloState,
  prize: PrizeType,
  marked: ReadonlySet<number>[],
): { state: SoloState; result: ClaimResult } {
  const me = state.players[0];
  const idx = state.called.length;
  const calledSet = new Set(state.called);
  const ticketIndex = me.tickets.findIndex((cells, i) => {
    const validMarks = new Set([...(marked[i] ?? [])].filter((n) => calledSet.has(n)));
    return isPrizeComplete(cells, validMarks, prize);
  });
  if (ticketIndex === -1) return { state, result: 'not_complete' };

  const prizes = state.prizes.map((p) => ({ ...p, winners: [...p.winners] }));
  const target = prizes.find((p) => p.prize === prize);
  if (!target) return { state, result: 'not_complete' };
  let result: ClaimResult;
  if (target.wonAtCall === null) {
    target.wonAtCall = idx;
    target.winners.push({ playerId: me.id, ticketIndex });
    result = 'won';
  } else if (target.wonAtCall === idx && !target.winners.some((w) => w.playerId === me.id)) {
    target.winners.push({ playerId: me.id, ticketIndex });
    result = 'shared';
  } else {
    return { state, result: 'already_claimed' };
  }
  // The player beat the bots to it: their pending claims for this prize are dropped
  // unless they also completed it on this exact number (then they share).
  const botClaims = state.botClaims.filter((c) => c.prize !== prize);
  for (const c of state.botClaims.filter((c) => c.prize === prize)) {
    const bot = state.players.find((p) => p.id === c.playerId)!;
    if (prizeCompletedAt(bot.tickets[c.ticketIndex], state.called, prize) === idx) {
      target.winners.push({ playerId: c.playerId, ticketIndex: c.ticketIndex });
    }
  }
  return { state: { ...state, prizes, botClaims }, result };
}
