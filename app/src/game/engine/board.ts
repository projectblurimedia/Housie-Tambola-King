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

// ─── Snakes & Ladders: 15 boards, 5 per level (same as _snl_boards() in SQL) ─────────────
export type SnlBoard = { ladders: Record<string, number>; snakes: Record<string, number> };
export const SNL_BOARDS: SnlBoard[] = [
  // Easy
  { ladders: { 2: 22, 4: 23, 8: 47, 40: 82, 46: 75, 50: 71, 53: 88, 57: 84 }, snakes: { 31: 10, 65: 5, 89: 9, 98: 58 } },
  { ladders: { 3: 43, 6: 26, 8: 28, 14: 34, 17: 37, 19: 80, 33: 68, 58: 83 }, snakes: { 25: 5, 74: 46, 90: 9, 97: 45 } },
  { ladders: { 2: 23, 9: 29, 10: 30, 24: 64, 31: 51, 33: 88, 36: 65, 70: 89 }, snakes: { 34: 14, 60: 40, 83: 39, 86: 15 } },
  { ladders: { 5: 25, 7: 26, 12: 53, 30: 70, 40: 81, 59: 82, 68: 88, 69: 89 }, snakes: { 24: 3, 42: 2, 94: 35, 98: 36 } },
  { ladders: { 8: 28, 9: 29, 15: 55, 21: 60, 23: 77, 62: 81, 66: 86, 70: 90 }, snakes: { 42: 22, 50: 30, 76: 16, 94: 32 } },
  // Medium
  { ladders: { 4: 37, 5: 26, 11: 69, 13: 53, 20: 40, 27: 47, 35: 55 }, snakes: { 81: 41, 87: 66, 92: 71, 93: 73, 96: 44, 98: 22 } },
  { ladders: { 14: 54, 15: 46, 22: 42, 25: 85, 57: 77, 60: 79 }, snakes: { 38: 4, 41: 20, 87: 67, 90: 28, 95: 66, 98: 43 } },
  { ladders: { 4: 44, 8: 32, 26: 74, 30: 51, 48: 68, 57: 77 }, snakes: { 56: 25, 69: 49, 78: 2, 81: 21, 85: 65, 91: 73 } },
  { ladders: { 4: 25, 10: 30, 18: 83, 20: 42, 36: 76, 44: 77 }, snakes: { 54: 34, 68: 29, 75: 26, 80: 60, 82: 59, 91: 31, 94: 72 } },
  { ladders: { 3: 43, 4: 44, 10: 30, 16: 36, 21: 81, 22: 59 }, snakes: { 26: 6, 75: 35, 87: 29, 91: 31, 97: 65, 99: 63 } },
  // Hard
  { ladders: { 10: 30, 33: 73, 37: 84, 39: 79 }, snakes: { 22: 2, 29: 7, 38: 3, 52: 31, 67: 5, 80: 20, 91: 71, 96: 74, 98: 78 } },
  { ladders: { 3: 23, 39: 83, 44: 77, 50: 69 }, snakes: { 22: 2, 24: 6, 30: 8, 32: 14, 48: 27, 61: 20, 73: 53, 91: 71, 94: 25 } },
  { ladders: { 6: 36, 7: 27, 9: 70, 61: 82 }, snakes: { 23: 3, 39: 20, 60: 40, 65: 47, 75: 55, 78: 43, 84: 17, 91: 71, 93: 34 } },
  { ladders: { 2: 22, 3: 43, 14: 53, 40: 81 }, snakes: { 59: 39, 69: 10, 71: 51, 77: 15, 82: 62, 86: 65, 94: 73, 96: 56, 98: 78 } },
  { ladders: { 7: 28, 12: 32, 30: 51, 40: 81 }, snakes: { 21: 2, 26: 6, 42: 23, 75: 53, 83: 59, 87: 33, 92: 70, 96: 17, 99: 79 } },
];
export const SNL_LEVELS = ['easy', 'medium', 'hard'] as const;
export type SnlLevel = (typeof SNL_LEVELS)[number];
/** Boards per level; board i is level floor(i / 5). */
export const SNL_PER_LEVEL = 5;
export const snlLevelOf = (board: number): SnlLevel => SNL_LEVELS[Math.max(0, Math.min(2, Math.floor(board / SNL_PER_LEVEL)))];

export type Pt = { x: number; y: number };

/** Centre of a square on a board `size` px wide. */
export function snlCentre(square: number, size: number): Pt {
  const cell = size / 10;
  const { row, col } = snlCell(square);
  return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
}

/**
 * A snake's body (head → tail): a natural wave that fades in from the neck. The art and the
 * "slide down the snake" animation both use this, so a bitten pawn follows the body exactly.
 */
export function snakeCurve(head: Pt, tail: Pt, cell: number) {
  // Keep the body on the board (the wave would poke out past the edge columns).
  const lo = cell * 0.28;
  const hi = cell * 10 - cell * 0.28;
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const waves = Math.max(1, Math.min(2.2, len / (cell * 2.6)));
  const amp = Math.min(cell * 0.7, len * 0.15);
  const at = (t: number): Pt => {
    const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.85 + 0.15;
    const off = amp * env * Math.sin(2 * Math.PI * waves * t);
    return { x: clamp(head.x + dx * t + nx * off), y: clamp(head.y + dy * t + ny * off) };
  };
  return { at };
}

/** Tokens sharing a square: offsets (in cells) and the size factor, for up to 10 of them. */
export function shareLayout(n: number): { offsets: Pt[]; scale: number } {
  if (n <= 1) return { offsets: [{ x: 0, y: 0 }], scale: 1 };
  const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const step = 0.82 / Math.max(cols, rows);
  const offsets: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    offsets.push({ x: (c - (inRow - 1) / 2) * step, y: (r - (rows - 1) / 2) * step });
  }
  return { offsets, scale: Math.max(0.34, 1.15 / Math.max(cols, rows)) };
}
