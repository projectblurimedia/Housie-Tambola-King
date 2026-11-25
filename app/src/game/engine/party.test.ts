import { describe, expect, it } from 'vitest';
import { circleSeats, isShowHand, nextSeatPlayer, rolePoints, SEETA_ROLES, showColor } from './party';

describe('party games', () => {
  it('has 15 Seeta roles with Ram first and Seeta second', () => {
    expect(SEETA_ROLES).toHaveLength(15);
    expect(SEETA_ROLES[0].key).toBe('ram');
    expect(SEETA_ROLES[1].key).toBe('seeta');
    expect(rolePoints('lakshmana')).toBe(800);
    expect(rolePoints('unknown')).toBe(0);
  });

  it('spots a SHOW only with four of one colour', () => {
    expect(isShowHand([2, 2, 2, 2])).toBe(true);
    expect(isShowHand([2, 2, 2, 1])).toBe(false);
    expect(isShowHand(null)).toBe(false);
  });

  it('wraps colour numbers', () => {
    expect(showColor(0).key).toBe('red');
    expect(showColor(11).key).toBe('blue');
  });

  it('puts me at the bottom and spreads seats evenly', () => {
    const players = [0, 1, 2, 3].map((seat) => ({ seat }));
    const seats = circleSeats(players, 2, 100);
    const me = seats.find((s) => s.player.seat === 2)!;
    expect(Math.round(me.x)).toBe(0);
    expect(Math.round(me.y)).toBe(100);
    // The next seat is a quarter turn clockwise (left side of the screen).
    const next = seats.find((s) => s.player.seat === 3)!;
    expect(Math.round(next.x)).toBe(-100);
    expect(Math.round(next.y)).toBe(0);
  });

  it('passes to the next seat, wrapping round', () => {
    const players = [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
    expect(nextSeatPlayer(players, 2)?.seat).toBe(0);
    expect(nextSeatPlayer(players, 0)?.seat).toBe(1);
  });
});
