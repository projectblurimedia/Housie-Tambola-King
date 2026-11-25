/**
 * Board games' geometry, kept in step with supabase/migrations/20261206000001_board_games.sql.
 * The server decides every roll and move; these only draw and animate them.
 */

// ─── Snakes & Ladders ─────────────────────────────────────────────────────────────
export const LADDERS: Record<number, number> = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
export const SNAKES: Record<number, number> = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

export const snlJump = (p: number) => LADDERS[p] ?? SNAKES[p] ?? p;

/** Square 1–100 → row (0 = top) and column, zig-zag from the bottom-left like a real board. */
export function snlCell(square: number): { row: number; col: number } {
  const i = Math.max(1, Math.min(100, square)) - 1;
  const fromBottom = Math.floor(i / 10);
  const along = i % 10;
  return { row: 9 - fromBottom, col: fromBottom % 2 === 0 ? along : 9 - along };
}

/** The squares a token walks through, one by one (then the jump is animated separately). */
export function snlSteps(from: number, mid: number): number[] {
  const out: number[] = [];
  for (let p = from + 1; p <= mid; p++) out.push(p);
  return out;
}

// ─── Ashta Chamma ─────────────────────────────────────────────────────────────────
/** Side 0's path: outer ring anticlockwise from the start square, inner ring clockwise, centre. */
const CHAMMA_BASE = [22, 23, 24, 19, 14, 9, 4, 3, 2, 1, 0, 5, 10, 15, 20, 21, 16, 11, 6, 7, 8, 13, 18, 17, 12];
export const CHAMMA_HOME = 24;
export const CHAMMA_OUTER = 16;
/** Start squares of the 4 sides + the centre. */
export const CHAMMA_SAFE = new Set([22, 14, 2, 10, 12]);
/** Side colours: bottom, right, top, left. */
export const CHAMMA_COLORS = [
  { key: 'red', hex: '#EF4444', dark: '#991B1B' },
  { key: 'green', hex: '#22C55E', dark: '#166534' },
  { key: 'yellow', hex: '#FACC15', dark: '#A16207' },
  { key: 'blue', hex: '#3B82F6', dark: '#1E3A8A' },
] as const;

/** Board cell (row × 5 + col) of a pawn at path index idx for a side; rotated a quarter per side. */
export function chammaCell(side: number, idx: number): number {
  let cell = CHAMMA_BASE[Math.max(0, Math.min(24, idx))];
  for (let i = 0; i < side % 4; i++) {
    const r = Math.floor(cell / 5);
    const c = cell % 5;
    cell = (4 - c) * 5 + r;
  }
  return cell;
}

/** Where a pawn goes with a throw (null = it can't). −1 = not in yet, 24 = home. */
export function chammaTarget(idx: number, throwValue: number, cut: boolean): number | null {
  if (idx === CHAMMA_HOME) return null;
  if (idx === -1) return throwValue === 4 || throwValue === 8 ? 0 : null;
  if (!cut) return (idx + throwValue) % CHAMMA_OUTER;
  return idx + throwValue > CHAMMA_HOME ? null : idx + throwValue;
}

/** Path indexes a pawn walks through from → to (wrapping the outer ring before a cut). */
export function chammaSteps(from: number, to: number, cut: boolean): number[] {
  if (from === -1) return [0];
  const out: number[] = [];
  let p = from;
  for (let guard = 0; p !== to && guard < 30; guard++) {
    p = !cut && p === CHAMMA_OUTER - 1 ? 0 : p + 1;
    if (cut && p > CHAMMA_HOME) break;
    out.push(p);
  }
  return out;
}

/** Seeds → value: n up = n, none up = 8 (Ashta). */
export const seedsValue = (seeds: readonly boolean[]) => {
  const up = seeds.filter(Boolean).length;
  return up === 0 ? 8 : up;
};
