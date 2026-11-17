import { describe, expect, it } from 'vitest';
import { callNext, claimForMe, createSoloGame } from './solo';
import { PRIZES, prizeCompletedAt, seededRng } from './ticket';

const me = { id: 'me', name: 'Me', avatarKey: 'a1' };

describe('solo game', () => {
  it('always finishes with a full house winner', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seededRng(seed);
      let s = createSoloGame({ me, myTickets: 1, bots: 4, difficulty: 'hard', prizes: [...PRIZES], rng });
      let guard = 0;
      while (!s.finished && guard++ < 200) s = callNext(s, rng);
      expect(s.finished).toBe(true);
      const fh = s.prizes.find((p) => p.prize === 'full_house')!;
      // Bots only (the human never claims here), and hard bots claim at most 1 call late.
      expect(fh.winners.length).toBeGreaterThan(0);
    }
  });

  it('every bot win is genuine', () => {
    const rng = seededRng(99);
    let s = createSoloGame({ me, myTickets: 2, bots: 6, difficulty: 'medium', prizes: [...PRIZES], rng });
    while (!s.finished) s = callNext(s, rng);
    for (const prize of s.prizes) {
      for (const w of prize.winners) {
        const player = s.players.find((p) => p.id === w.playerId)!;
        const doneAt = prizeCompletedAt(player.tickets[w.ticketIndex], s.called, prize.prize);
        expect(doneAt).not.toBeNull();
        expect(doneAt!).toBeLessThanOrEqual(prize.wonAtCall!);
      }
    }
  });

  it('rejects a claim the player has not marked', () => {
    const rng = seededRng(3);
    let s = createSoloGame({ me, myTickets: 1, bots: 0, difficulty: 'easy', prizes: [...PRIZES], rng });
    for (let i = 0; i < 30; i++) s = callNext(s, rng);
    const { result } = claimForMe(s, 'line_1', [new Set()]);
    expect(result).toBe('not_complete');
  });

  it('lets the player win with correct marks, ignoring marks on uncalled numbers', () => {
    const rng = seededRng(5);
    let s = createSoloGame({ me, myTickets: 1, bots: 0, difficulty: 'easy', prizes: [...PRIZES], rng });
    const cells = s.players[0].tickets[0];
    while (prizeCompletedAt(cells, s.called, 'fast_5') === null) s = callNext(s, rng);
    const marks = new Set(cells.filter((n) => n > 0)); // marks everything, even uncalled
    const first = claimForMe(s, 'fast_5', [marks]);
    expect(first.result).toBe('won');
    expect(claimForMe(first.state, 'fast_5', [marks]).result).toBe('already_claimed');
    // Uncalled marks don't count: full house can't be claimed yet.
    expect(claimForMe(first.state, 'full_house', [marks]).result).toBe('not_complete');
  });
});
