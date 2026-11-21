import type { PrizeType } from './ticket';

/**
 * Splits the pot over prizes in proportion to their weights — same rule as the server's
 * _auto_split: round down to paise, remainder to Full Housie so the total equals the pot.
 */
export function splitPot(pot: number, prizes: { prize: PrizeType; weight: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!prizes.length) return out;
  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  for (const p of prizes) {
    const share = totalWeight > 0 ? (pot * Math.max(0, p.weight)) / totalWeight : pot / prizes.length;
    out[p.prize] = Math.floor(share * 100 + 1e-6) / 100;
  }
  const assigned = Object.values(out).reduce((s, v) => s + v, 0);
  const remainder = Math.round((pot - assigned) * 100) / 100;
  const target = out.full_house !== undefined ? 'full_house' : prizes[prizes.length - 1].prize;
  out[target] = Math.round((out[target] + remainder) * 100) / 100;
  return out;
}

/** Sum of amounts rounded to paise (avoids 0.1 + 0.2 style float noise). */
export function sumAmounts(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v * 100, 0)) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Like splitPot, but every prize except Full Housie gets WHOLE rupees (no ₹14.65 style
 * amounts); Full Housie (or the last prize) takes whatever is left so the total equals the pot.
 */
export function splitPotWhole(pot: number, prizes: { prize: PrizeType; weight: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!prizes.length) return out;
  const target = prizes.some((p) => p.prize === 'full_house') ? 'full_house' : prizes[prizes.length - 1].prize;
  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  for (const p of prizes) {
    if (p.prize === target) continue;
    const share = totalWeight > 0 ? (pot * Math.max(0, p.weight)) / totalWeight : pot / prizes.length;
    out[p.prize] = Math.floor(share + 1e-6);
  }
  out[target] = Math.max(0, round2(pot - Object.values(out).reduce((s, v) => s + v, 0)));
  return out;
}

/**
 * The host's amounts stay as they are; Full Housie becomes the balance (pot − the others),
 * never below 0. Amounts are a map prize → ₹ for the prizes that are on.
 */
export function balanceFullHouse(pot: number, amounts: Partial<Record<PrizeType, number>>): Partial<Record<PrizeType, number>> {
  if (amounts.full_house === undefined) return amounts;
  const others = sumAmounts(
    Object.entries(amounts)
      .filter(([k]) => k !== 'full_house')
      .map(([, v]) => v ?? 0),
  );
  return { ...amounts, full_house: Math.max(0, round2(pot - others)) };
}
