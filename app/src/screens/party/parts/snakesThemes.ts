/**
 * Snakes & Ladders board designs (the owner's 9 picks, 2026-11-28). The host picks one when
 * creating (options.theme 0–8) and whether the squares show pictures (options.icons). The design
 * is only the look — the snakes and ladders positions come from the board layout (level + 1 of 5).
 */

export type SnakeStyle = 'bands' | 'dots' | 'python' | 'cute' | 'neon';
export type LadderStyle = 'rope' | 'rainbow' | 'gold' | 'candy' | 'white';

export type SnakePaint = { body: string; line: string; head: string; mark?: string; belly?: string; bands?: string[] };

export type BoardDesign = {
  key: string;
  /** Frame around the board. */
  frame: string;
  edge: string;
  /** Squares: one colour list (mixed so neighbours differ), or sea rows checkered with a light colour. */
  tiles: { mode: 'mixed'; pal: string[] } | { mode: 'rows'; rows: string[]; light: string };
  grout: string;
  gap?: number;
  rx?: number;
  bevel?: boolean;
  waves?: string;
  bubbles?: string;
  /** Number colour, and the little badge behind it. */
  numC: string;
  badge: string;
  badgeLine?: string;
  top: string;
  topIcon: string;
  icons: string[];
  snake: SnakeStyle;
  ladder: LadderStyle;
};

const FOLK = ['🐘', '🦚', '🐅', '🐄', '🌺', '🛕', '🐒', '🦜', '🐟', '🐢', '🌸', '🌴', '🪔', '🐎', '🦌', '🐇', '🦋', '🐦', '🌻', '🦢', '🐊', '🐐', '🐓', '🌳', '🌞', '🐪', '🦅', '🐃', '🌿', '🐸'];
const FLOWERS = ['🌺', '🌸', '🌻', '🌼', '🪷', '🌷', '💐', '🍀', '🌹', '🦋', '🐝', '🌿', '🏵️', '🥀', '🍁', '🌱', '🐞', '🍄', '🌾', '🪻'];
const KIDS = ['🍎', '🍌', '🍇', '🍉', '🎈', '⭐', '🌈', '🧸', '🚂', '🎁', '🍭', '⚽', '🍓', '🍒', '🪁', '🎨', '🚲', '🏀', '🍦', '🧁', '🐶', '🐱', '🐰', '🦄'];
const FEST = ['🪔', '🎆', '🎇', '🪁', '🎉', '🍬', '🌙', '⭐', '🪅', '🎊', '🌼', '🥭', '🎶', '🥁', '🪷', '🍯', '🌺', '✨', '🎀', '🕯️'];
const SEA = ['🐠', '🐟', '🐡', '🐙', '🦑', '🦀', '🦞', '🦐', '🐚', '🐬', '🐳', '🐋', '🦈', '🪼', '🪸', '🐢', '🦭', '🐧', '⚓', '🌊', '⛵', '🚤', '🛳️', '🚢', '⛴️', '🏝️', '🏖️', '🌴', '🦩', '🦢', '🦆', '🎣', '🧜‍♀️', '🔱', '🗺️', '🧭', '💎', '🪙', '🦦', '🐸', '🌅', '☀️', '⛱️', '🥥', '🍹', '🌺', '🪝', '🛟', '🐊', '🦜'];
const FOLKPAL = ['#FFF176', '#F8BBD0', '#C5E1A5', '#B3E5FC', '#E1BEE7', '#FFCC80', '#FFFDE7'];
const SEAROWS = ['#7DD3FC', '#67E8F9', '#5EEAD4', '#7DD3FC', '#93C5FD', '#67E8F9', '#5EEAD4', '#93C5FD', '#7DD3FC', '#67E8F9'];

export const BOARD_DESIGNS: BoardDesign[] = [
  { key: 'folkBright', frame: '#5D2E0B', edge: '#FDE047', tiles: { mode: 'mixed', pal: ['#FFD54F', '#F48FB1', '#AED581', '#81D4FA', '#CE93D8', '#FFB74D'] }, grout: '#5D4037', bevel: true, numC: '#3E2723', badge: '#FFFFFF', top: '#FFD54F', topIcon: '🛕', icons: FOLK, snake: 'bands', ladder: 'rope' },
  { key: 'flowerGarden', frame: '#9D174D', edge: '#FBCFE8', tiles: { mode: 'mixed', pal: ['#FCE4EC', '#F8BBD0', '#FFE0B2', '#E1BEE7', '#FFF9C4', '#DCEDC8'] }, grout: '#AD1457', gap: 1, rx: 4, numC: '#880E4F', badge: '#FFFFFF', top: '#FFD54F', topIcon: '🏵️', icons: FLOWERS, snake: 'dots', ladder: 'rainbow' },
  { key: 'royalFolk', frame: '#3B0A0A', edge: '#F5D06F', tiles: { mode: 'mixed', pal: FOLKPAL }, grout: '#C9A227', bevel: true, numC: '#3E2723', badge: '#FFFDE7', badgeLine: '#C9A227', top: '#FFD54F', topIcon: '👑', icons: FOLK, snake: 'python', ladder: 'gold' },
  { key: 'kidsFolk', frame: '#EC4899', edge: '#FFFFFF', tiles: { mode: 'mixed', pal: ['#FFEB3B', '#FF80AB', '#B2FF59', '#80D8FF', '#EA80FC', '#FFAB40'] }, grout: '#FFFFFF', gap: 1.4, rx: 6, numC: '#3E2723', badge: '#FFFFFF', top: '#FFD54F', topIcon: '🏆', icons: KIDS, snake: 'cute', ladder: 'candy' },
  { key: 'festivalFolk', frame: '#3B0764', edge: '#FDBA74', tiles: { mode: 'mixed', pal: ['#E1BEE7', '#FFCC80', '#F8BBD0', '#FFF59D', '#D1C4E9'] }, grout: '#4A148C', bevel: true, numC: '#4A148C', badge: '#FFFFFF', top: '#FFD54F', topIcon: '🎆', icons: FEST, snake: 'dots', ladder: 'rainbow' },
  { key: 'folkSea', frame: '#0C4A6E', edge: '#F5D06F', tiles: { mode: 'mixed', pal: FOLKPAL }, grout: '#5D4037', bevel: true, numC: '#3E2723', badge: '#FFFFFF', top: '#FFD54F', topIcon: '🛕', icons: FOLK, snake: 'bands', ladder: 'rope' },
  { key: 'ocean', frame: '#0C4A6E', edge: '#67E8F9', tiles: { mode: 'rows', rows: SEAROWS, light: '#E0F7FF' }, grout: '#0E7490', numC: '#0C4A6E', badge: '#FFFFFF', badgeLine: '#0E7490', top: '#FDE68A', topIcon: '🏝️', icons: SEA, snake: 'bands', ladder: 'rope' },
  { key: 'deepSea', frame: '#082F49', edge: '#22D3EE', tiles: { mode: 'rows', rows: ['#0C4A6E', '#075985', '#0369A1', '#0284C7', '#0EA5E9'], light: '#164E63' }, grout: '#082F49', bubbles: '#BAE6FD', numC: '#E0F2FE', badge: 'rgba(8,47,73,0.7)', badgeLine: '#22D3EE', top: '#FDE68A', topIcon: '🏝️', icons: SEA, snake: 'neon', ladder: 'white' },
  { key: 'waves', frame: '#1E40AF', edge: '#BFDBFE', tiles: { mode: 'mixed', pal: ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#E0F2FE', '#CFFAFE', '#F0FDFA', '#C7D2FE'] }, grout: '#1D4ED8', waves: '#2563EB', numC: '#1E3A8A', badge: '#FFFFFF', badgeLine: '#1D4ED8', top: '#FDE68A', topIcon: '⛵', icons: SEA, snake: 'bands', ladder: 'white' },
];

/** Snake colours per style — every snake on a board gets its own. */
export const SNAKE_PAINTS: Record<SnakeStyle, SnakePaint[]> = {
  bands: [
    { body: '#15803D', line: '#052E16', head: '#16A34A', bands: ['#15803D', '#FDE047'] },
    { body: '#1D4ED8', line: '#0B1F4D', head: '#2563EB', bands: ['#1D4ED8', '#F8FAFC'] },
    { body: '#DC2626', line: '#450A0A', head: '#EF4444', bands: ['#DC2626', '#FFFFFF'] },
    { body: '#0F172A', line: '#000000', head: '#1E293B', bands: ['#0F172A', '#FACC15'] },
    { body: '#7C3AED', line: '#2E1065', head: '#8B5CF6', bands: ['#7C3AED', '#EDE9FE'] },
    { body: '#EA580C', line: '#431407', head: '#F97316', bands: ['#EA580C', '#1C1917'] },
    { body: '#0F766E', line: '#042F2E', head: '#0D9488', bands: ['#0F766E', '#CCFBF1'] },
  ],
  dots: [
    { body: '#DB2777', line: '#500724', head: '#EC4899', mark: '#FDE68A' },
    { body: '#7C3AED', line: '#2E1065', head: '#8B5CF6', mark: '#FDE68A' },
    { body: '#0D9488', line: '#042F2E', head: '#14B8A6', mark: '#FFFFFF' },
    { body: '#EA580C', line: '#431407', head: '#F97316', mark: '#FFF7ED' },
    { body: '#DC2626', line: '#450A0A', head: '#EF4444', mark: '#FDE047' },
    { body: '#16A34A', line: '#052E16', head: '#22C55E', mark: '#FBCFE8' },
  ],
  python: [
    { body: '#D4A24C', line: '#3B2208', head: '#C99A44', mark: '#7A4E1C' },
    { body: '#7C8B3A', line: '#232A0C', head: '#6F7D35', mark: '#3E4A16' },
    { body: '#B4532A', line: '#2E0F04', head: '#A3461F', mark: '#5C1F0A' },
    { body: '#9CA3AF', line: '#1F2937', head: '#8B929C', mark: '#374151' },
    { body: '#E8C547', line: '#3D2E05', head: '#D9B53A', mark: '#8A6A12' },
    { body: '#6B4226', line: '#1E0F05', head: '#5C381F', mark: '#C08A5A' },
  ],
  cute: [
    { body: '#7ED957', line: '#2E5E1A', head: '#8FE36A', mark: '#C8F7A8' },
    { body: '#FF8A3D', line: '#6B2A00', head: '#FF9A55', mark: '#FFD3A8' },
    { body: '#38BDF8', line: '#0C4A6E', head: '#5BC8FA', mark: '#E0F2FE' },
    { body: '#F472B6', line: '#701A45', head: '#F78BC4', mark: '#FCE7F3' },
    { body: '#A78BFA', line: '#3F1D7A', head: '#B9A2FB', mark: '#EDE9FE' },
    { body: '#FACC15', line: '#6B4F00', head: '#FBD54A', mark: '#FEF9C3' },
  ],
  neon: [
    { body: '#22D3EE', line: '#22D3EE', head: '#22D3EE', belly: '#E0FFFF' },
    { body: '#F472B6', line: '#F472B6', head: '#F472B6', belly: '#FFE4F1' },
    { body: '#A3E635', line: '#A3E635', head: '#A3E635', belly: '#F0FFD0' },
    { body: '#A78BFA', line: '#A78BFA', head: '#A78BFA', belly: '#EDE9FE' },
    { body: '#FB923C', line: '#FB923C', head: '#FB923C', belly: '#FFEDD5' },
    { body: '#FACC15', line: '#FACC15', head: '#FACC15', belly: '#FFF7CC' },
  ],
};

export type LadderLook = { rail: number; railC: string; edge?: string; rung: string | string[]; rungW: number; half?: number; gap?: number; shine?: boolean; kind?: 'rope' | 'candy' };
export const LADDER_LOOKS: Record<LadderStyle, LadderLook> = {
  rope: { kind: 'rope', rail: 3, railC: '#D7C29B', edge: '#7A6243', rung: '#A0522D', rungW: 2.6, half: 0.2, gap: 0.34 },
  rainbow: { rail: 3.4, railC: '#6D4C41', edge: '#2E1B12', rung: ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA'], rungW: 2.4 },
  gold: { rail: 3.4, railC: '#F5C518', edge: '#8A6100', rung: '#FFE27A', rungW: 2, shine: true },
  candy: { kind: 'candy', rail: 4, railC: '#E53935', edge: '#8E1B1B', rung: '#FFFFFF', rungW: 2.4, half: 0.2, gap: 0.32 },
  white: { rail: 3.2, railC: '#FFFFFF', edge: '#0C4A6E', rung: '#F0F9FF', rungW: 2, half: 0.19 },
};

const cellOfSq = (sq: number) => {
  const i = sq - 1;
  const fb = Math.floor(i / 10);
  const al = i % 10;
  return { row: 9 - fb, col: fb % 2 === 0 ? al : 9 - al };
};

/** The square colour (mixed lists vary so neighbours differ; sea rows alternate with the light colour). */
export function designTile(d: BoardDesign, sq: number): string {
  if (sq === 100) return d.top;
  const { row, col } = cellOfSq(sq);
  if (d.tiles.mode === 'mixed') return d.tiles.pal[(row * 3 + col * 5 + Math.floor(sq / 7)) % d.tiles.pal.length];
  return (row + col) % 2 ? d.tiles.rows[(9 - row) % d.tiles.rows.length] : d.tiles.light;
}

const iconCache = new Map<string, string[]>();
/** One picture per square, chosen so no square repeats a picture within two squares of it. */
export function designIcons(d: BoardDesign): string[] {
  const hit = iconCache.get(d.key);
  if (hit) return hit;
  const list = d.icons;
  const grid: Record<string, string> = {};
  const out: string[] = [];
  let k = 0;
  for (let sq = 1; sq <= 99; sq++) {
    const { row, col } = cellOfSq(sq);
    const near = new Set<string>();
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const v = grid[`${row + dr},${col + dc}`];
      if (v) near.add(v);
    }
    let pick = list[k % list.length];
    for (let tries = 0; near.has(pick) && tries < list.length; tries++) {
      k++;
      pick = list[k % list.length];
    }
    k += 7;
    grid[`${row},${col}`] = pick;
    out.push(pick);
  }
  out.push(d.topIcon);
  iconCache.set(d.key, out);
  return out;
}
