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
