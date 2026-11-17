/**
 * Housie ticket rules — the client mirror of supabase/migrations/20261117000002_rooms_games.sql
 * (_generate_ticket / _prize_numbers / _prize_completed_at / _winning_numbers). Keep both in
 * sync; the server is always the authority for online games, this copy powers solo/caller
 * modes and the instant "your strikes completed a prize → claim" check.
 *
 * cells: 27 numbers, row-major 3 rows × 9 columns, 0 = blank. Each row has exactly 5
 * numbers, each column 1–3, column c holds 1–9 (c=0), c*10..c*10+9, 80–90 (c=8).
 * Column groups: left = columns 0–2, center = 3–5, right = 6–8.
 */

export type Cells = number[];

export const PRIZES = [
  'fast_3',
  'fast_5',
  'fast_7',
  'line_1',
  'line_2',
  'line_3',
  'col_left',
  'col_center',
  'col_right',
  'full_house',
] as const;
export type PrizeType = (typeof PRIZES)[number];

export const FAST_PRIZES: PrizeType[] = ['fast_3', 'fast_5', 'fast_7'];
export const LINE_PRIZES: PrizeType[] = ['line_1', 'line_2', 'line_3'];
export const COLUMN_PRIZES: PrizeType[] = ['col_left', 'col_center', 'col_right'];

export type Rng = () => number;

export const ROWS = 3;
export const COLS = 9;

export function fastCount(prize: PrizeType): number | null {
  return prize === 'fast_3' ? 3 : prize === 'fast_5' ? 5 : prize === 'fast_7' ? 7 : null;
}

export function prizeOrder(prize: PrizeType): number {
  return PRIZES.indexOf(prize);
}

export function columnRange(col: number): [number, number] {
  if (col === 0) return [1, 9];
  if (col === 8) return [80, 90];
  return [col * 10, col * 10 + 9];
}

/** Fisher–Yates: a shuffled copy. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

export function generateTicket(rng: Rng = Math.random): Cells {
  const allCols = range(0, COLS - 1);
  let used: boolean[][];
  let colCount: number[];
  // Pick 5 of 9 columns per row until every column is used (~2 tries on average).
  do {
    used = [];
    colCount = new Array(COLS).fill(0);
    for (let r = 0; r < ROWS; r++) {
      const picked = new Set(shuffle(allCols, rng).slice(0, 5));
      used.push(allCols.map((c) => picked.has(c)));
      picked.forEach((c) => (colCount[c] += 1));
    }
  } while (colCount.some((n) => n === 0));

  const cells: Cells = new Array(ROWS * COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    const [lo, hi] = columnRange(c);
    const nums = shuffle(range(lo, hi), rng)
      .slice(0, colCount[c])
      .sort((a, b) => a - b);
    let k = 0;
    for (let r = 0; r < ROWS; r++) {
      if (used[r][c]) cells[r * COLS + c] = nums[k++];
    }
  }
  return cells;
}

export function ticketNumbers(cells: Cells): number[] {
  return cells.filter((n) => n > 0).sort((a, b) => a - b);
}

function cellsWhere(cells: Cells, keep: (row: number, col: number) => boolean): number[] {
  const out: number[] = [];
  cells.forEach((n, i) => {
    if (n > 0 && keep(Math.floor(i / COLS), i % COLS)) out.push(n);
  });
  return out.sort((a, b) => a - b);
}

/** The numbers a prize needs on this ticket (Fast N / Full Housie: all 15). */
export function prizeNumbers(cells: Cells, prize: PrizeType): number[] {
  switch (prize) {
    case 'line_1':
      return cellsWhere(cells, (r) => r === 0);
    case 'line_2':
      return cellsWhere(cells, (r) => r === 1);
    case 'line_3':
      return cellsWhere(cells, (r) => r === 2);
    case 'col_left':
      return cellsWhere(cells, (_, c) => c <= 2);
    case 'col_center':
      return cellsWhere(cells, (_, c) => c >= 3 && c <= 5);
    case 'col_right':
      return cellsWhere(cells, (_, c) => c >= 6);
    default:
      return ticketNumbers(cells);
  }
}

/** 1-based call index at which the prize was completed, or null. */
export function prizeCompletedAt(cells: Cells, called: readonly number[], prize: PrizeType): number | null {
  const position = new Map<number, number>();
  called.forEach((n, i) => {
    if (!position.has(n)) position.set(n, i + 1);
  });
  const positions = prizeNumbers(cells, prize).map((n) => position.get(n) ?? null);
  const fast = fastCount(prize);
  if (fast) {
    const hit = positions.filter((p): p is number => p !== null).sort((a, b) => a - b);
    return hit.length >= fast ? hit[fast - 1] : null;
  }
  if (positions.some((p) => p === null)) return null;
  return Math.max(...(positions as number[]));
}

/** Is the prize complete using only the player's own strikes? */
export function isPrizeComplete(cells: Cells, struck: ReadonlySet<number>, prize: PrizeType): boolean {
  const needed = prizeNumbers(cells, prize);
  const fast = fastCount(prize);
  if (fast) return needed.filter((n) => struck.has(n)).length >= fast;
  return needed.every((n) => struck.has(n));
}

/** How many more strikes a prize needs ("1 to go!"). */
export function remainingFor(cells: Cells, struck: ReadonlySet<number>, prize: PrizeType): number {
  const needed = prizeNumbers(cells, prize);
  const have = needed.filter((n) => struck.has(n)).length;
  const fast = fastCount(prize);
  return fast ? Math.max(0, fast - have) : needed.length - have;
}

export function isValidTicket(cells: Cells): boolean {
  if (cells.length !== ROWS * COLS) return false;
  for (let r = 0; r < ROWS; r++) {
    if (cellsWhere(cells, (row) => row === r).length !== 5) return false;
  }
  const seen = new Set<number>();
  for (let c = 0; c < COLS; c++) {
    const [lo, hi] = columnRange(c);
    const col = [0, 1, 2].map((r) => cells[r * COLS + c]).filter((n) => n > 0);
    if (col.length === 0) return false;
    for (let i = 0; i < col.length; i++) {
      if (col[i] < lo || col[i] > hi || seen.has(col[i])) return false;
      if (i > 0 && col[i] <= col[i - 1]) return false;
      seen.add(col[i]);
    }
  }
  return seen.size === 15;
}

/** A new random draw order of 1–90. */
export function newDrawOrder(rng: Rng = Math.random): number[] {
  return shuffle(range(1, 90), rng);
}

/** Deterministic PRNG (mulberry32) — tests and reproducible solo games. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
