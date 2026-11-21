import { describe, expect, it } from 'vitest';
import { balanceFullHouse, splitPot, splitPotWhole, sumAmounts } from './split';

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

describe('splitPotWhole', () => {
  it('gives whole rupees and the rest to Full Housie', () => {
    const out = splitPotWhole(100, [
      { prize: 'fast_5', weight: 10 },
      { prize: 'line_1', weight: 10 },
      { prize: 'line_2', weight: 10 },
      { prize: 'full_house', weight: 30 },
    ]);
    expect(out).toEqual({ fast_5: 16, line_1: 16, line_2: 16, full_house: 52 });
    expect(Object.values(out).reduce((s, v) => s + v, 0)).toBe(100);
  });
  it('keeps paise of the pot on Full Housie only', () => {
    const out = splitPotWhole(50.5, [
      { prize: 'fast_5', weight: 10 },
      { prize: 'full_house', weight: 30 },
    ]);
    expect(out).toEqual({ fast_5: 12, full_house: 38.5 });
  });
});

describe('balanceFullHouse', () => {
  it('Full Housie takes the balance and other amounts stay', () => {
    expect(balanceFullHouse(100, { fast_5: 10, line_1: 15, full_house: 5 })).toEqual({ fast_5: 10, line_1: 15, full_house: 75 });
  });
  it('never goes below zero', () => {
    expect(balanceFullHouse(100, { fast_5: 80, line_1: 40, full_house: 10 })).toEqual({ fast_5: 80, line_1: 40, full_house: 0 });
  });
});
