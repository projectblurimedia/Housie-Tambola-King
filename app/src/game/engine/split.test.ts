import { describe, expect, it } from 'vitest';
import { splitPot, sumAmounts } from './split';

describe('splitPot', () => {
  it('splits in proportion and always totals the pot', () => {
    const prizes = [
      { prize: 'fast_5' as const, weight: 10 },
      { prize: 'line_1' as const, weight: 10 },
      { prize: 'full_house' as const, weight: 30 },
    ];
    expect(splitPot(100, prizes)).toEqual({ fast_5: 20, line_1: 20, full_house: 60 });
    const odd = splitPot(70, prizes);
    expect(sumAmounts(Object.values(odd))).toBe(70);
    expect(odd.fast_5).toBe(14);
  });

  it('gives the paise remainder to Full Housie', () => {
    const prizes = [
      { prize: 'line_1' as const, weight: 1 },
      { prize: 'line_2' as const, weight: 1 },
      { prize: 'full_house' as const, weight: 1 },
    ];
    const r = splitPot(10, prizes);
    expect(r.line_1).toBe(3.33);
    expect(r.full_house).toBe(3.34);
    expect(sumAmounts(Object.values(r))).toBe(10);
  });

  it('equal split when all weights are zero', () => {
    expect(
      splitPot(30, [
        { prize: 'line_1', weight: 0 },
        { prize: 'full_house', weight: 0 },
      ]),
    ).toEqual({ line_1: 15, full_house: 15 });
  });
});
