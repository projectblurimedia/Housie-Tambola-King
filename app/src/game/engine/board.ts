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

// ─── Snakes & Ladders: the 5 boards the host picks from (same as _snl_boards() in SQL) ──────
export type SnlBoard = { ladders: Record<string, number>; snakes: Record<string, number> };
export const SNL_BOARDS: SnlBoard[] = [
  { ladders: { 2: 22, 3: 37, 39: 59, 45: 65, 68: 88, 69: 89 }, snakes: { 25: 6, 52: 28, 61: 21, 64: 43, 71: 11, 87: 35, 96: 76, 99: 77 } },
  { ladders: { 5: 25, 8: 29, 15: 35, 49: 89, 61: 81, 68: 88 }, snakes: { 41: 20, 54: 33, 70: 30, 77: 17, 85: 56, 91: 71, 94: 66, 99: 23 } },
  { ladders: { 5: 25, 9: 29, 19: 59, 35: 65, 53: 88, 54: 74 }, snakes: { 26: 7, 30: 10, 33: 8, 63: 24, 81: 40, 90: 32, 95: 75, 98: 79 } },
  { ladders: { 7: 34, 9: 28, 17: 38, 21: 41, 33: 53, 47: 87, 68: 88 }, snakes: { 31: 11, 45: 15, 75: 55, 79: 19, 81: 61, 83: 65, 91: 49 } },
  { ladders: { 5: 37, 7: 46, 20: 40, 30: 50, 51: 71, 56: 75, 64: 84 }, snakes: { 42: 2, 48: 28, 78: 18, 80: 41, 82: 59, 89: 29, 93: 67 } },
];

export type Pt = { x: number; y: number };

/** Centre of a square on a board `size` px wide. */
export function snlCentre(square: number, size: number): Pt {
  const cell = size / 10;
  const { row, col } = snlCell(square);
  return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
}

/**
 * A snake's body curve (head → tail): a gentle S. The art and the "slide down the snake"
 * animation both use this, so a bitten token follows the body exactly.
 */
export function snakeCurve(head: Pt, tail: Pt, cell: number) {
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const amp = Math.min(cell * 0.9, len * 0.22);
  const c1 = { x: head.x + dx * 0.33 + nx * amp, y: head.y + dy * 0.33 + ny * amp };
  const c2 = { x: head.x + dx * 0.67 - nx * amp, y: head.y + dy * 0.67 - ny * amp };
  const at = (t: number): Pt => {
    const u = 1 - t;
    return {
      x: u * u * u * head.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * tail.x,
      y: u * u * u * head.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * tail.y,
    };
  };
  return { c1, c2, at };
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
