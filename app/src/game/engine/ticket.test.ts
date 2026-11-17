import { describe, expect, it } from 'vitest';
import {
  generateTicket,
  isPrizeComplete,
  isValidTicket,
  newDrawOrder,
  prizeCompletedAt,
  prizeNumbers,
  remainingFor,
  seededRng,
  ticketNumbers,
} from './ticket';

// A fixed, hand-checked ticket.
//   row0:  4 . 21 . 45 . 63 . 85   (cols 0,2,4,6,8)
//   row1:  . 12 . 33 . 57 . 71 88  (cols 1,3,5,7,8)
//   row2:  7 18 . 39 . . 66 79 .   (cols 0,1,3,6,7)
const T = [
  4, 0, 21, 0, 45, 0, 63, 0, 85,
  0, 12, 0, 33, 0, 57, 0, 71, 88,
  7, 18, 0, 39, 0, 0, 66, 79, 0,
];

describe('generateTicket', () => {
  it('always produces valid tickets', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 2000; i++) expect(isValidTicket(generateTicket(rng))).toBe(true);
  });

  it('has 15 distinct numbers', () => {
    expect(new Set(ticketNumbers(generateTicket())).size).toBe(15);
  });
});

describe('isValidTicket', () => {
  it('accepts the reference ticket', () => expect(isValidTicket(T)).toBe(true));
  it('rejects a row with 4 numbers', () => {
    const bad = T.slice();
    bad[0] = 0;
    expect(isValidTicket(bad)).toBe(false);
  });
  it('rejects a number in the wrong column', () => {
    const bad = T.slice();
    bad[2] = 31;
    expect(isValidTicket(bad)).toBe(false);
  });
});

describe('prize numbers', () => {
  it('lines', () => {
    expect(prizeNumbers(T, 'line_1')).toEqual([4, 21, 45, 63, 85]);
    expect(prizeNumbers(T, 'line_2')).toEqual([12, 33, 57, 71, 88]);
    expect(prizeNumbers(T, 'line_3')).toEqual([7, 18, 39, 66, 79]);
  });
  it('column groups (left 1–3, center 4–6, right 7–9)', () => {
    expect(prizeNumbers(T, 'col_left')).toEqual([4, 7, 12, 18, 21]);
    expect(prizeNumbers(T, 'col_center')).toEqual([33, 39, 45, 57]);
    expect(prizeNumbers(T, 'col_right')).toEqual([63, 66, 71, 79, 85, 88]);
  });
  it('column groups together cover the full ticket', () => {
    const all = [...prizeNumbers(T, 'col_left'), ...prizeNumbers(T, 'col_center'), ...prizeNumbers(T, 'col_right')];
    expect(all.sort((a, b) => a - b)).toEqual(ticketNumbers(T));
  });
});

describe('completion', () => {
  it('lines complete on their last number', () => {
    expect(prizeCompletedAt(T, [90, 4, 21, 1, 45, 63, 85], 'line_1')).toBe(7);
    expect(prizeCompletedAt(T, [90, 4, 21], 'line_1')).toBeNull();
  });

  it('fast 3 / 5 / 7 count any of the ticket numbers', () => {
    const called = [12, 4, 66, 2, 88, 33, 90, 7, 85];
    expect(prizeCompletedAt(T, called, 'fast_3')).toBe(3);
    expect(prizeCompletedAt(T, called, 'fast_5')).toBe(6);
    expect(prizeCompletedAt(T, called, 'fast_7')).toBe(9);
    expect(prizeCompletedAt(T, called.slice(0, 8), 'fast_7')).toBeNull();
  });

  it('column groups', () => {
    expect(prizeCompletedAt(T, [33, 39, 1, 45, 57], 'col_center')).toBe(5);
  });

  it('full house completes on the last needed number', () => {
    const order = newDrawOrder(seededRng(7));
    const at = prizeCompletedAt(T, order, 'full_house')!;
    const needed = new Set(ticketNumbers(T));
    expect(needed.has(order[at - 1])).toBe(true);
    expect(order.slice(0, at).filter((n) => needed.has(n))).toHaveLength(15);
  });

  it('checks strikes and remaining counts', () => {
    const struck = new Set([4, 21, 45, 63]);
    expect(isPrizeComplete(T, struck, 'line_1')).toBe(false);
    expect(remainingFor(T, struck, 'line_1')).toBe(1);
    expect(isPrizeComplete(T, struck, 'fast_3')).toBe(true);
    expect(remainingFor(T, struck, 'fast_7')).toBe(3);
    struck.add(85);
    expect(isPrizeComplete(T, struck, 'line_1')).toBe(true);
    expect(isPrizeComplete(T, struck, 'fast_5')).toBe(true);
    expect(remainingFor(T, struck, 'full_house')).toBe(10);
  });
});

describe('newDrawOrder', () => {
  it('is a permutation of 1..90', () => {
    const d = newDrawOrder();
    expect([...d].sort((a, b) => a - b)).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
  });
});
