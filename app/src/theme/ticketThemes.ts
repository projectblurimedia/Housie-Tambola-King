/** Ticket looks the player can pick (Profile → Ticket style, or in-game settings). */
export interface TicketTheme {
  /** Outer frame gradient. */
  frame: [string, string, ...string[]];
  /** Paper behind the numbers. */
  paper: string;
  /** Number circle fill / border / text. */
  cell: string;
  cellBorder: string;
  ink: string;
  /** The little dot in a blank cell. */
  blank: string;
  /** Brand line text. */
  brand: string;
}

export const TICKET_THEMES = {
  classic: {
    frame: ['#4C1D95', '#7C3AED', '#C026D3'],
    paper: '#FFF8E7',
    cell: '#FFFFFF',
    cellBorder: '#E8DCBF',
    ink: '#2E1065',
    blank: 'rgba(180,83,9,0.22)',
    brand: 'rgba(76,29,149,0.45)',
  },
  mint: {
    frame: ['#065F46', '#059669', '#34D399'],
    paper: '#ECFDF5',
    cell: '#FFFFFF',
    cellBorder: '#A7F3D0',
    ink: '#064E3B',
    blank: 'rgba(5,150,105,0.25)',
    brand: 'rgba(6,95,70,0.45)',
  },
  sky: {
    frame: ['#1E3A8A', '#2563EB', '#38BDF8'],
    paper: '#EFF6FF',
    cell: '#FFFFFF',
    cellBorder: '#BFDBFE',
    ink: '#1E3A8A',
    blank: 'rgba(37,99,235,0.25)',
    brand: 'rgba(30,58,138,0.45)',
  },
  rose: {
    frame: ['#9D174D', '#DB2777', '#F472B6'],
    paper: '#FFF1F2',
    cell: '#FFFFFF',
    cellBorder: '#FBCFE8',
    ink: '#831843',
    blank: 'rgba(219,39,119,0.25)',
    brand: 'rgba(157,23,77,0.45)',
  },
  sunset: {
    frame: ['#9A3412', '#EA580C', '#FBBF24'],
    paper: '#FFFBEB',
    cell: '#FFFFFF',
    cellBorder: '#FDE68A',
    ink: '#7C2D12',
    blank: 'rgba(234,88,12,0.25)',
    brand: 'rgba(154,52,18,0.45)',
  },
  night: {
    frame: ['#0F172A', '#334155', '#64748B'],
    paper: '#1E293B',
    cell: '#0F172A',
    cellBorder: '#475569',
    ink: '#F8FAFC',
    blank: 'rgba(148,163,184,0.35)',
    brand: 'rgba(226,232,240,0.45)',
  },
} satisfies Record<string, TicketTheme>;
export type TicketThemeKey = keyof typeof TICKET_THEMES;

/** Strike colours: disc gradient + the strike line across it. */
export const STRIKE_COLORS = {
  purple: { disc: ['#8B5CF6', '#6D28D9'], line: '#FDE68A' },
  red: { disc: ['#F87171', '#DC2626'], line: '#FFFFFF' },
  green: { disc: ['#4ADE80', '#16A34A'], line: '#FFFFFF' },
  blue: { disc: ['#60A5FA', '#2563EB'], line: '#FFFFFF' },
  orange: { disc: ['#FB923C', '#EA580C'], line: '#FFFFFF' },
  pink: { disc: ['#F472B6', '#DB2777'], line: '#FFFFFF' },
  gold: { disc: ['#FDE68A', '#F5B700'], line: '#7C2D12' },
} satisfies Record<string, { disc: [string, string]; line: string }>;
export type StrikeColorKey = keyof typeof STRIKE_COLORS;
