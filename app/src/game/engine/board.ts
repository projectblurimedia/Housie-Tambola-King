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
  { ladders: { 4: 25, 10: 52, 13: 33, 41: 61, 42: 78, 46: 86, 53: 73, 69: 90 }, snakes: { 23: 2, 35: 6, 74: 7, 85: 37 } },
  { ladders: { 3: 77, 7: 27, 29: 51, 34: 53, 39: 62, 56: 85, 68: 88, 69: 89 }, snakes: { 28: 8, 45: 16, 81: 21, 95: 35 } },
  { ladders: { 9: 29, 10: 30, 17: 85, 20: 41, 32: 70, 35: 66, 58: 83, 61: 81 }, snakes: { 28: 6, 43: 23, 87: 33, 99: 22 } },
  { ladders: { 6: 26, 7: 47, 19: 39, 20: 40, 35: 86, 42: 61, 65: 85, 67: 88 }, snakes: { 45: 25, 48: 8, 72: 30, 97: 23 } },
  { ladders: { 6: 26, 22: 42, 27: 87, 46: 75, 48: 88, 59: 79, 61: 81, 69: 89 }, snakes: { 33: 12, 41: 21, 63: 16, 71: 11 } },
  // Medium
  { ladders: { 4: 24, 18: 43, 35: 75, 37: 84, 58: 82, 70: 90 }, snakes: { 25: 5, 31: 11, 39: 2, 74: 12, 80: 20, 85: 56 } },
  { ladders: { 9: 29, 25: 76, 34: 74, 48: 88, 61: 81, 64: 84 }, snakes: { 27: 8, 46: 6, 60: 40, 69: 32, 83: 2, 90: 30 } },
  { ladders: { 6: 26, 10: 29, 14: 74, 24: 64, 35: 55, 40: 79 }, snakes: { 21: 2, 28: 8, 58: 23, 73: 48, 85: 25, 92: 31 } },
  { ladders: { 2: 59, 5: 25, 17: 43, 28: 48, 54: 73, 61: 81 }, snakes: { 31: 11, 41: 20, 70: 50, 78: 56, 86: 26, 89: 9 } },
  { ladders: { 15: 35, 23: 78, 31: 71, 46: 75, 64: 84, 65: 85 }, snakes: { 30: 10, 49: 29, 56: 17, 72: 52, 79: 20, 87: 8 } },
  // Hard
  { ladders: { 2: 22, 29: 72, 45: 66, 48: 88 }, snakes: { 26: 4, 34: 7, 36: 16, 57: 39, 70: 50, 78: 18, 84: 64, 87: 54, 99: 41 } },
  { ladders: { 2: 21, 7: 68, 17: 37, 51: 71 }, snakes: { 23: 3, 30: 10, 52: 32, 60: 38, 76: 15, 82: 57, 86: 66, 89: 69, 97: 43 } },
  { ladders: { 18: 83, 46: 85, 54: 88, 59: 79 }, snakes: { 34: 6, 36: 16, 39: 2, 44: 4, 48: 29, 72: 51, 77: 57, 80: 21, 91: 11 } },
  { ladders: { 10: 30, 20: 60, 24: 85, 31: 72 }, snakes: { 26: 6, 29: 9, 54: 35, 73: 8, 75: 46, 79: 18, 81: 61, 83: 63, 87: 67 } },
  { ladders: { 3: 23, 28: 53, 34: 86, 38: 78 }, snakes: { 27: 5, 37: 16, 59: 21, 72: 11, 81: 41, 84: 65, 88: 68, 90: 51, 96: 36 } },
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
  const lo = cell * 0.3;
  const hi = cell * 10 - cell * 0.3;
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const waves = Math.max(1, Math.min(2.2, len / (cell * 2.6)));
  const make = (amp: number, lean = 0) => (t: number): Pt => {
    const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.85 + 0.15;
    // The lean fades out at both ends, so the curve starts exactly on the head square's centre.
    const off = amp * (env * Math.sin(2 * Math.PI * waves * t) + lean * Math.sin(Math.PI * t));
    return { x: head.x + dx * t + nx * off, y: head.y + dy * t + ny * off };
  };
  const fits = (f: (t: number) => Pt) => {
    for (let i = 0; i <= 40; i++) {
      const p = f(i / 40);
      if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) return false;
    }
    return true;
  };
  // Near an edge the wave would leave the board: try it the other way round, then a gentler
  // wave — never flatten it against the edge (that drew straight lines).
  let amp = Math.min(cell * 0.7, len * 0.15);
  let at = make(amp);
  // Along an edge the body leans inward (the whole wave on the board side) so it still curves.
  search: for (let k = 0; k < 12 && !fits(at); k++) {
    for (const [sign, lean] of [[-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const f = make(sign * amp, lean);
      if (fits(f)) {
        at = f;
        break search;
      }
    }
    amp *= 0.85;
    at = make(amp);
  }
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
