/**
 * Party games' display rules (the server decides everything; these only draw it).
 * Kept in step with supabase/migrations/20261205000001_party_games.sql.
 */

/** Find Seeta roles in dealing order, with their points (Ram / Seeta depend on the guess). */
export const SEETA_ROLES = [
  { key: 'ram', points: 1000 },
  { key: 'seeta', points: 0 },
  { key: 'lakshmana', points: 800 },
  { key: 'bharatha', points: 700 },
  { key: 'shatrughna', points: 600 },
  { key: 'anjaneya', points: 500 },
  { key: 'sugreeva', points: 450 },
  { key: 'vibhishana', points: 400 },
  { key: 'jambavantha', points: 350 },
  { key: 'angada', points: 300 },
  { key: 'nala', points: 250 },
  { key: 'neela', points: 200 },
  { key: 'dasaratha', points: 150 },
  { key: 'janaka', points: 100 },
  { key: 'guha', points: 50 },
] as const;

export const rolePoints = (role: string | null | undefined): number =>
  SEETA_ROLES.find((r) => r.key === role)?.points ?? 0;

/** Show card colours, by the server's colour number 0..9. Each has an icon too (colour-blind safe). */
export const SHOW_COLORS = [
  { key: 'red', hex: '#EF4444', dark: '#B91C1C', icon: 'heart' },
  { key: 'blue', hex: '#3B82F6', dark: '#1D4ED8', icon: 'water' },
  { key: 'green', hex: '#22C55E', dark: '#15803D', icon: 'leaf' },
  { key: 'yellow', hex: '#EAB308', dark: '#A16207', icon: 'sunny' },
  { key: 'purple', hex: '#A855F7', dark: '#7E22CE', icon: 'diamond' },
  { key: 'orange', hex: '#F97316', dark: '#C2410C', icon: 'flame' },
  { key: 'pink', hex: '#EC4899', dark: '#BE185D', icon: 'flower' },
  { key: 'teal', hex: '#14B8A6', dark: '#0F766E', icon: 'snow' },
  { key: 'brown', hex: '#A16207', dark: '#713F12', icon: 'cafe' },
  { key: 'black', hex: '#374151', dark: '#111827', icon: 'moon' },
] as const;

export const showColor = (n: number) => SHOW_COLORS[((n % SHOW_COLORS.length) + SHOW_COLORS.length) % SHOW_COLORS.length];

/** Four cards of one colour — a SHOW. */
export function isShowHand(hand: readonly number[] | null | undefined): boolean {
  return !!hand && hand.length === 4 && hand.every((c) => c === hand[0]);
}

/**
 * Seats evenly round a circle with me at the bottom, then going clockwise in seat order (so the
 * player I pass to sits on my left). Returns x / y offsets from the centre for each seat index.
 */
export function circleSeats<T extends { seat: number }>(players: readonly T[], meSeat: number, radius: number) {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const n = ordered.length;
  const myIndex = Math.max(0, ordered.findIndex((p) => p.seat === meSeat));
  return ordered.map((p, i) => {
    const step = (i - myIndex + n) % n;
    // Bottom is +90°; clockwise on screen = increasing angle.
    const angle = Math.PI / 2 + (step * 2 * Math.PI) / n;
    return { player: p, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/** The next active seat after mine (who my card goes to). */
export function nextSeatPlayer<T extends { seat: number }>(players: readonly T[], meSeat: number): T | undefined {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const i = ordered.findIndex((p) => p.seat === meSeat);
  return i < 0 || ordered.length < 2 ? undefined : ordered[(i + 1) % ordered.length];
}
