/**
 * Ticket looks the player can pick (Profile → Ticket style). Ticket, strike and hint colours
 * all use the SAME six colours, so every row of choices matches.
 */
export const PALETTE = ['purple', 'green', 'blue', 'pink', 'orange', 'red'] as const;
export type PaletteKey = (typeof PALETTE)[number];

export interface TicketTheme {
  /** Outer frame gradient. */
  frame: [string, string, ...string[]];
  /** Paper behind the numbers. */
  paper: string;
  /** Number circle fill / border / text. */
  cell: string;
  cellBorder: string;
  ink: string;
  /** The little dot in a blank cell, and the blank circle's fill. */
  blank: string;
  blankCell: string;
  /** Lines between the 3 rows and the 3 column groups. */
  divider: string;
  /** Faint lines between every column. */
  faint: string;
  /** Brand line text. */
  brand: string;
}

export const TICKET_THEMES: Record<PaletteKey, TicketTheme> = {
  purple: {
    frame: ['#4C1D95', '#7C3AED', '#C026D3'],
    paper: '#FAF5FF',
    cell: '#FFFFFF',
    cellBorder: '#DDD6FE',
    ink: '#2E1065',
    blank: 'rgba(124,58,237,0.3)',
    blankCell: '#EDE9FE',
    divider: 'rgba(124,58,237,0.35)',
    faint: 'rgba(124,58,237,0.22)',
    brand: 'rgba(76,29,149,0.45)',
  },
  green: {
    frame: ['#065F46', '#059669', '#34D399'],
    paper: '#ECFDF5',
    cell: '#FFFFFF',
    cellBorder: '#A7F3D0',
    ink: '#064E3B',
    blank: 'rgba(5,150,105,0.3)',
    blankCell: '#D1FAE5',
    divider: 'rgba(5,150,105,0.35)',
    faint: 'rgba(5,150,105,0.22)',
    brand: 'rgba(6,95,70,0.45)',
  },
  blue: {
    frame: ['#1E3A8A', '#2563EB', '#38BDF8'],
    paper: '#EFF6FF',
    cell: '#FFFFFF',
    cellBorder: '#BFDBFE',
    ink: '#1E3A8A',
    blank: 'rgba(37,99,235,0.3)',
    blankCell: '#DBEAFE',
    divider: 'rgba(37,99,235,0.35)',
    faint: 'rgba(37,99,235,0.22)',
    brand: 'rgba(30,58,138,0.45)',
  },
  pink: {
    frame: ['#9D174D', '#DB2777', '#F472B6'],
    paper: '#FFF1F2',
    cell: '#FFFFFF',
    cellBorder: '#FBCFE8',
    ink: '#831843',
    blank: 'rgba(219,39,119,0.3)',
    blankCell: '#FFE4E6',
    divider: 'rgba(219,39,119,0.35)',
    faint: 'rgba(219,39,119,0.22)',
    brand: 'rgba(157,23,77,0.45)',
  },
  orange: {
    frame: ['#9A3412', '#EA580C', '#FBBF24'],
    paper: '#FFFBEB',
    cell: '#FFFFFF',
    cellBorder: '#FED7AA',
    ink: '#7C2D12',
    blank: 'rgba(234,88,12,0.3)',
    blankCell: '#FFEDD5',
    divider: 'rgba(234,88,12,0.35)',
    faint: 'rgba(234,88,12,0.22)',
    brand: 'rgba(154,52,18,0.45)',
  },
  red: {
    frame: ['#7F1D1D', '#DC2626', '#F87171'],
    paper: '#FEF2F2',
    cell: '#FFFFFF',
    cellBorder: '#FECACA',
    ink: '#7F1D1D',
    blank: 'rgba(220,38,38,0.3)',
    blankCell: '#FEE2E2',
    divider: 'rgba(220,38,38,0.35)',
    faint: 'rgba(220,38,38,0.22)',
    brand: 'rgba(127,29,29,0.45)',
  },
};

/** Strike colours: disc gradient + the strike line across it. */
export const STRIKE_COLORS: Record<PaletteKey, { disc: [string, string]; line: string }> = {
  purple: { disc: ['#8B5CF6', '#6D28D9'], line: '#FDE68A' },
  green: { disc: ['#4ADE80', '#16A34A'], line: '#FFFFFF' },
  blue: { disc: ['#60A5FA', '#2563EB'], line: '#FFFFFF' },
  pink: { disc: ['#F472B6', '#DB2777'], line: '#FFFFFF' },
  orange: { disc: ['#FB923C', '#EA580C'], line: '#FFFFFF' },
  red: { disc: ['#F87171', '#DC2626'], line: '#FFFFFF' },
};

/** Hint colour: the ring on the newest number and (with Auto hint) every called number. */
export const HINT_COLORS: Record<PaletteKey, string> = {
  purple: '#8B5CF6',
  green: '#22C55E',
  blue: '#3B82F6',
  pink: '#EC4899',
  orange: '#F97316',
  red: '#EF4444',
};

/** Swatch shown for a palette colour in the pickers. */
export const PALETTE_SWATCH: Record<PaletteKey, [string, string]> = {
  purple: ['#8B5CF6', '#6D28D9'],
  green: ['#4ADE80', '#16A34A'],
  blue: ['#60A5FA', '#2563EB'],
  pink: ['#F472B6', '#DB2777'],
  orange: ['#FB923C', '#EA580C'],
  red: ['#F87171', '#DC2626'],
};

export type TicketThemeKey = PaletteKey;
export type StrikeColorKey = PaletteKey;
export type HintColorKey = PaletteKey;

export interface TicketCombo {
  key: string;
  theme: PaletteKey;
  strike: PaletteKey;
  hint: PaletteKey;
}

/** Ready-made looks where ticket, strike and hint colours suit each other. First = default. */
export const TICKET_COMBOS: TicketCombo[] = [
  { key: 'royal', theme: 'purple', strike: 'purple', hint: 'pink' },
  { key: 'emerald', theme: 'green', strike: 'green', hint: 'orange' },
  { key: 'ocean', theme: 'blue', strike: 'blue', hint: 'pink' },
  { key: 'blossom', theme: 'pink', strike: 'pink', hint: 'purple' },
  { key: 'festival', theme: 'orange', strike: 'orange', hint: 'red' },
  { key: 'ruby', theme: 'red', strike: 'red', hint: 'blue' },
];

/** Old saved values (before the shared palette) → palette colours. */
const LEGACY: Record<string, PaletteKey> = {
  classic: 'purple',
  mint: 'green',
  sky: 'blue',
  rose: 'pink',
  sunset: 'orange',
  night: 'purple',
  gold: 'orange',
  cyan: 'blue',
  lime: 'green',
  violet: 'purple',
};
export function toPalette(value: string | undefined, fallback: PaletteKey): PaletteKey {
  if (value && (PALETTE as readonly string[]).includes(value)) return value as PaletteKey;
  return (value && LEGACY[value]) || fallback;
}

/** Number cell shape: round chips, rounded squares ("semi box") or square boxes. */
export const TICKET_SHAPES = ['round', 'soft', 'box'] as const;
export type TicketShape = (typeof TICKET_SHAPES)[number];
/** Corner radius as a share of the cell size. */
export const SHAPE_RADIUS: Record<TicketShape, number> = { round: 0.5, soft: 0.28, box: 0.1 };
