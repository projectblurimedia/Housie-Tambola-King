import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { T } from '@/components/ui';
import { LADDERS, type Pt, shareLayout, SNAKES, snakeCurve, snlCell, snlCentre, snlLevelOf, snlSteps, type SnlBoard, type SnlLevel } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Pawn, TOKEN_COLORS } from './BoardBits';
import { GameDock, type DockPlayer } from './GameDock';
import { RollingDie } from './RollingDie';

/** Board colours per level (easy = mint, medium = honey, hard = rose): tiles, grout, numbers, frame. */
export const SNL_THEME: Record<SnlLevel, { a: string; b: string; b2: string; grout: string; num: string; frame: string; edge: string }> = {
  easy: { a: '#F3FBF4', b: '#B7E4C2', b2: '#D7F2DE', grout: '#9FD3AE', num: '#1F5130', frame: '#163D24', edge: '#F5D06F' },
  medium: { a: '#FFF8E8', b: '#F6D9A0', b2: '#FCE7BE', grout: '#E6C58A', num: '#7A4A12', frame: '#4A2A10', edge: '#F5D06F' },
  hard: { a: '#FFF4F1', b: '#F7C1B2', b2: '#FCDCD3', grout: '#E9A897', num: '#7C2D12', frame: '#4C150B', edge: '#F5D06F' },
};
const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);

/** Real snake skins: shades from dark edge to bright sheen, and the species' pattern. */
const SKINS = [
  { base: '#16A34A', dark: '#052E16', mid: '#0F6B32', light: '#86EFAC', hi: '#F0FFF4', blot: '#FACC15', kind: 'diamond' },
  { base: '#2563EB', dark: '#0B1B4D', mid: '#1D3F9E', light: '#93C5FD', hi: '#EFF6FF', blot: '#F8FAFC', kind: 'dots' },
  { base: '#DC2626', dark: '#3F0707', mid: '#991B1B', light: '#FCA5A5', hi: '#FFF1F2', blot: '#111827', kind: 'rings2' },
  { base: '#D97706', dark: '#3B1A02', mid: '#92400E', light: '#FCD34D', hi: '#FFFBEB', blot: '#431407', kind: 'saddle' },
  { base: '#7C3AED', dark: '#1E0B4B', mid: '#5B21B6', light: '#C4B5FD', hi: '#F5F3FF', blot: '#FDE047', kind: 'rings' },
] as const;
/** Light comes from the top-left: shading shifts this way across the body. */
const LX = -0.55;
const LY = -0.83;

/**
 * A realistic snake: one smooth body along a natural wave (thick in the middle, tapering to a
 * fine tail), shaded across its width like a real round body — dark edge, colour, a lit side and
 * a glossy streak — with its species' pattern (python saddles, tree-snake spots, krait bands,
 * coral rings, viper diamonds) and a real head: a scaled crown, narrow golden eyes with slit
 * pupils, nostrils and a forked tongue, kept inside its own square.
 */
function SnakeArt({ head, tail, cell, skin, lite }: { head: Pt; tail: Pt; cell: number; skin: number; lite?: boolean }) {
  const s = SKINS[skin];
  const { at } = snakeCurve(head, tail, cell);
  // Short snakes are slim, long ones thick.
  const rows = Math.abs(tail.y - head.y) / cell;
  const W = cell * Math.max(0.24, Math.min(0.46, 0.2 + rows * 0.04));
  const width = (t: number) => W * (t < 0.1 ? 0.78 + (t / 0.1) * 0.22 : t < 0.5 ? 1 : Math.max(0.06, 1 - Math.pow((t - 0.5) / 0.5, 1.3)));
  const fr = (t: number) => {
    const p = at(t);
    const q = at(Math.min(1, t + 0.003));
    const r = at(Math.max(0, t - 0.003));
    const l = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    return { p, tx: (q.x - r.x) / l, ty: (q.y - r.y) / l, ux: -(q.y - r.y) / l, uy: (q.x - r.x) / l };
  };
  const N = lite ? 36 : 70;
  const T0 = 0; // the neck runs right under the head, so they always join
  const band = (k: number, shift: number, t1 = 1) => {
    const L: string[] = [];
    const R: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = T0 + (i / N) * (t1 - T0);
      const { p, ux, uy } = fr(t);
      const w = width(t) / 2;
      const cx = p.x + LX * w * shift;
      const cy = p.y + LY * w * shift;
      L.push(`${f1(cx + ux * w * k)} ${f1(cy + uy * w * k)}`);
      R.push(`${f1(cx - ux * w * k)} ${f1(cy - uy * w * k)}`);
    }
    return `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
  };
  // The pattern, following the body.
  const marks: React.ReactNode[] = [];
  const step = W * (s.kind === 'dots' ? 0.9 : 1.15);
  let acc = 0;
  let prev = at(T0);
  for (let i = 1, k = 0; i <= 300; i++) {
    const t = T0 + (i / 300) * (0.9 - T0);
    const p = at(t);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    if (acc < step) continue;
    acc = 0;
    k++;
    const { tx, ty, ux, uy } = fr(t);
    const w = width(t) / 2;
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
    if (s.kind === 'saddle') marks.push(<Ellipse key={k} cx={p.x} cy={p.y} rx={w * 0.55} ry={w * 0.8} transform={`rotate(${f1(ang)} ${f1(p.x)} ${f1(p.y)})`} fill={s.blot} opacity={0.75} />);
    else if (s.kind === 'dots') {
      const side = k % 2 ? 1 : -1;
      marks.push(<Circle key={k} cx={p.x + ux * w * 0.35 * side} cy={p.y + uy * w * 0.35 * side} r={w * 0.18} fill={s.blot} opacity={0.9} />);
    } else if (s.kind === 'rings' || s.kind === 'rings2')
      marks.push(
        <Path
          key={k}
          d={`M${f1(p.x + ux * w * 0.92 - tx * w * 0.18)} ${f1(p.y + uy * w * 0.92 - ty * w * 0.18)} Q${f1(p.x + tx * w * 0.12)} ${f1(p.y + ty * w * 0.12)} ${f1(p.x - ux * w * 0.92 - tx * w * 0.18)} ${f1(p.y - uy * w * 0.92 - ty * w * 0.18)}`}
          stroke={s.blot}
          strokeWidth={w * (s.kind === 'rings' ? 0.28 : 0.42)}
          fill="none"
          opacity={0.92}
        />,
      );
    else
      marks.push(
        <Path
          key={k}
          d={`M${f1(p.x + tx * w * 0.7)} ${f1(p.y + ty * w * 0.7)} L${f1(p.x + ux * w * 0.55)} ${f1(p.y + uy * w * 0.55)} L${f1(p.x - tx * w * 0.7)} ${f1(p.y - ty * w * 0.7)} L${f1(p.x - ux * w * 0.55)} ${f1(p.y - uy * w * 0.55)} Z`}
          fill={s.blot}
          opacity={0.75}
        />,
      );
  }
  // Head: pinned on the body's very first point (so it always sits on the neck), pointing along
  // it, sized to the body (slim snake = small head) but never bigger than its square.
  const h0 = at(0);
  const h1 = at(0.025);
  const dl = Math.hypot(h0.x - h1.x, h0.y - h1.y) || 1;
  const dx = (h0.x - h1.x) / dl;
  const dy = (h0.y - h1.y) / dl;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const hl = Math.min(W * 1.55, cell * 0.52);
  const hw = Math.min(W * 1.2, cell * 0.44);
  const tip = hl * 0.48;
  const gid = `hd${skin}_${Math.round(head.x)}_${Math.round(head.y)}_${Math.round(cell)}`;
  // A viper's head: wide at the jaws, narrowing to a rounded snout.
  const hp = `M${f1(tip)} 0 C${f1(tip)} ${f1(-hw * 0.26)} ${f1(hl * 0.18)} ${f1(-hw * 0.42)} ${f1(-hl * 0.12)} ${f1(-hw * 0.5)} C${f1(-hl * 0.36)} ${f1(-hw * 0.56)} ${f1(-hl * 0.52)} ${f1(-hw * 0.42)} ${f1(-hl * 0.56)} ${f1(-hw * 0.3)} L${f1(-hl * 0.56)} ${f1(hw * 0.3)} C${f1(-hl * 0.52)} ${f1(hw * 0.42)} ${f1(-hl * 0.36)} ${f1(hw * 0.56)} ${f1(-hl * 0.12)} ${f1(hw * 0.5)} C${f1(hl * 0.18)} ${f1(hw * 0.42)} ${f1(tip)} ${f1(hw * 0.26)} ${f1(tip)} 0 Z`;
  return (
    <G>
      <Defs>
        <RadialGradient id={gid} cx="40%" cy="35%" r="75%">
          <Stop offset="0" stopColor={s.light} />
          <Stop offset="0.5" stopColor={s.base} />
          <Stop offset="1" stopColor={s.mid} />
        </RadialGradient>
      </Defs>
      <Path d={band(1, 0)} fill="rgba(0,0,0,0.25)" transform="translate(3 4)" />
      <Path d={band(1, 0)} fill={s.dark} />
      <Path d={band(0.9, 0.05)} fill={s.mid} />
      <Path d={band(0.72, 0.15)} fill={s.base} />
      {marks}
      <Path d={band(0.5, -0.75)} fill={s.dark} opacity={0.22} />
      <Path d={band(0.42, 0.42)} fill={s.light} opacity={0.38} />
      <Path d={band(0.16, 0.62, 0.82)} fill={s.hi} opacity={0.55} />
      <G transform={`translate(${f1(h0.x)} ${f1(h0.y)}) rotate(${f1(ang)})`}>
        <Path
          d={`M${f1(tip - 1)} 0 L${f1(tip + hl * 0.2)} 0 l${f1(hl * 0.09)} ${f1(-hl * 0.07)} M${f1(tip + hl * 0.2)} 0 l${f1(hl * 0.09)} ${f1(hl * 0.07)}`}
          stroke="#DC2626"
          strokeWidth={Math.max(1, hl * 0.05)}
          strokeLinecap="round"
          fill="none"
        />
        <Path d={hp} fill="rgba(0,0,0,0.3)" transform="translate(2 3)" />
        <Path d={hp} fill={`url(#${gid})`} stroke={s.dark} strokeWidth={1.1} />
        {/* Head scales: a centre plate, brow lines and the mouth line */}
        <Path d={`M${f1(tip * 0.55)} 0 L${f1(-hl * 0.05)} ${f1(-hw * 0.12)} L${f1(-hl * 0.4)} 0 L${f1(-hl * 0.05)} ${f1(hw * 0.12)} Z`} fill={s.dark} opacity={0.3} />
        {[-1, 1].map((k) => (
          <G key={k}>
            <Path d={`M${f1(hl * 0.22)} ${f1(k * hw * 0.2)} Q${f1(hl * 0.02)} ${f1(k * hw * 0.48)} ${f1(-hl * 0.22)} ${f1(k * hw * 0.3)}`} stroke={s.dark} strokeWidth={1} fill="none" opacity={0.5} />
            <Path d={`M${f1(tip * 0.92)} ${f1(k * hw * 0.12)} Q${f1(hl * 0.05)} ${f1(k * hw * 0.5)} ${f1(-hl * 0.3)} ${f1(k * hw * 0.46)}`} stroke={s.dark} strokeWidth={0.9} fill="none" opacity={0.55} />
            <Ellipse cx={hl * 0.06} cy={k * hw * 0.3} rx={hw * 0.15} ry={hw * 0.12} fill="#FDE047" stroke={s.dark} strokeWidth={0.9} />
            <Ellipse cx={hl * 0.07} cy={k * hw * 0.3} rx={hw * 0.035} ry={hw * 0.1} fill="#0A0A0A" />
            <Circle cx={hl * 0.03} cy={k * hw * 0.3 - hw * 0.04} r={hw * 0.035} fill="#fff" />
            <Circle cx={tip * 0.82} cy={k * hw * 0.09} r={hw * 0.03} fill={s.dark} />
          </G>
        ))}
      </G>
    </G>
  );
}

/** A wooden ladder: rounded rails with a light edge, evenly spaced rungs, a soft shadow. */
function LadderArt({ from, to, cell }: { from: Pt; to: Pt; cell: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const A = { x: from.x - ux * cell * 0.2, y: from.y - uy * cell * 0.2 };
  const B = { x: to.x + ux * cell * 0.12, y: to.y + uy * cell * 0.12 };
  const px = -uy * cell * 0.22;
  const py = ux * cell * 0.22;
  const L = Math.hypot(B.x - A.x, B.y - A.y);
  const rungs = Math.max(3, Math.round(L / (cell * 0.36)));
  const rail = (k: number, sx = 0, sy = 0) => ({ x1: A.x + k * px + sx, y1: A.y + k * py + sy, x2: B.x + k * px + sx, y2: B.y + k * py + sy });
  const sw = Math.max(0.5, cell / 40);
  return (
    <G>
      {[1, -1].map((k) => (
        <Line key={`s${k}`} {...rail(k, 3, 4)} stroke="rgba(0,0,0,0.22)" strokeWidth={6 * sw} strokeLinecap="round" />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        return (
          <G key={i}>
            <Line x1={x + px + 2} y1={y + py + 3} x2={x - px + 2} y2={y - py + 3} stroke="rgba(0,0,0,0.2)" strokeWidth={4 * sw} />
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#6D3D14" strokeWidth={4.6 * sw} strokeLinecap="round" />
            <Line x1={x + px} y1={y + py - 0.6} x2={x - px} y2={y - py - 0.6} stroke="#E0A060" strokeWidth={2.2 * sw} strokeLinecap="round" />
          </G>
        );
      })}
      {[1, -1].map((k) => (
        <G key={`r${k}`}>
          <Line {...rail(k)} stroke="#5A3210" strokeWidth={6.5 * sw} strokeLinecap="round" />
          <Line {...rail(k)} stroke="#B9732F" strokeWidth={4.2 * sw} strokeLinecap="round" />
          <Line {...rail(k, -0.9)} stroke="#F6C98A" strokeWidth={1.4 * sw} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/**
 * The board: polished tiles (a soft light from the top), thin grout lines, numbers set into the
 * middle of each tile, a gold 100 with a crown, wooden ladders and real snakes. Tile colours by
 * level: easy = mint, medium = honey, hard = rose.
 */
export const BoardArt = React.memo(
  function BoardArt({ size, board, level, numbers = true, idPrefix = 'b' }: { size: number; board: SnlBoard; level: SnlLevel; numbers?: boolean; idPrefix?: string }) {
    const cell = size / 10;
    const th = SNL_THEME[level];
    const c = (sq: number) => snlCentre(sq, size);
    return (
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`${idPrefix}ta`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor={th.a} />
          </LinearGradient>
          <LinearGradient id={`${idPrefix}tb`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={th.b2} />
            <Stop offset="1" stopColor={th.b} />
          </LinearGradient>
          <RadialGradient id={`${idPrefix}gold`} cx="50%" cy="40%" r="70%">
            <Stop offset="0" stopColor="#FFF3B0" />
            <Stop offset="1" stopColor="#E0A100" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={th.grout} />
        {Array.from({ length: 100 }, (_, i) => {
          const sq = i + 1;
          const { row, col } = snlCell(sq);
          const fill = sq === 100 ? `url(#${idPrefix}gold)` : tileColor(sq, row, col);
          const x0 = col * cell;
          const y0 = row * cell;
          return (
            <G key={sq}>
              <Rect x={col * cell + 0.8} y={row * cell + 0.8} width={cell - 1.6} height={cell - 1.6} rx={3} fill={fill} />
              {/* Raised tile: light top-left edge, soft shadow bottom-right */}
              <Path d={`M${x0 + 2} ${y0 + cell - 2} L${x0 + 2} ${y0 + 2} L${x0 + cell - 2} ${y0 + 2}`} stroke="#fff" strokeOpacity={0.85} strokeWidth={1.2} fill="none" />
              <Path d={`M${x0 + cell - 2} ${y0 + 2} L${x0 + cell - 2} ${y0 + cell - 2} L${x0 + 2} ${y0 + cell - 2}`} stroke="#000" strokeOpacity={0.12} strokeWidth={1.2} fill="none" />
              {/* Danger / lucky squares: a snake's head tile glows red, a ladder's foot tile green */}
              {board.snakes[sq] ? <Rect x={x0 + 3} y={y0 + 3} width={cell - 6} height={cell - 6} rx={4} fill="#EF4444" opacity={0.18} /> : null}
              {board.ladders[sq] ? <Rect x={x0 + 3} y={y0 + 3} width={cell - 6} height={cell - 6} rx={4} fill="#22C55E" opacity={0.22} /> : null}
              {numbers && sq !== 100 ? (
                <SvgText x={col * cell + cell / 2} y={row * cell + cell * 0.64} fontSize={cell * 0.38} fontWeight="800" fill={th.num} textAnchor="middle" opacity={0.5}>
                  {sq}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {numbers ? (
          <SvgText x={cell * 0.5} y={cell * 0.68} fontSize={cell * 0.42} textAnchor="middle">
            👑
          </SvgText>
        ) : null}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} skin={i % SKINS.length} head={c(Number(h))} tail={c(tl)} cell={cell} lite={!numbers} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && a.level === b.level && JSON.stringify(a.board) === JSON.stringify(b.board),
);

/** A soft rainbow across the board (warm at the start, cool and violet near 100), checkered light / lighter. */
function tileColor(sq: number, row: number, col: number) {
  const h = (((9 - row) * 10 + col) * 2.9) % 360;
  const l = (row + col) % 2 ? 0.8 : 0.9;
  const sat = 0.85;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const ch = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(8)}${ch(4)}`;
}

/** Which level a running game's board belongs to. */
function levelOfBoard(board: SnlBoard, option?: number): SnlLevel {
  if (typeof option === 'number') return snlLevelOf(option);
  const n = Object.keys(board.snakes).length;
  return n <= 4 ? 'easy' : n >= 9 ? 'hard' : 'medium';
}

const STEP_MS = 210;
/** Time the die needs to land before the pawn starts walking. */
const LAND_MS = 820;

/**
 * Snakes & Ladders. Everyone starts off the board (a 1 brings you onto square 1). On your turn
 * tap the die under the board: it spins down and lands, then your pawn glides square by square
 * (lifting a little on each, with a pop), climbs a ladder or slides down along the snake's body.
 * Up to 10 pawns share a square, smaller the more there are. Names sit either side of the die.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.min(width - 26, 560);
  const cell = size / 10;
  const pawnSize = cell * 0.62;
  const order = s.order ?? state.players.map((p) => p.userId);
  const pos = s.pos ?? {};
  const board = (s as { board?: SnlBoard }).board ?? CLASSIC;
  const level = levelOfBoard(board, (g.options as { board?: number } | undefined)?.board);
  const theme = SNL_THEME[level];
  const colorOf = (uid?: string) => TOKEN_COLORS[Math.max(0, order.indexOf(uid ?? '')) % TOKEN_COLORS.length];
  const isMyTurn = s.turn === state.me.userId;
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;
  const last = s.last;

  const [rolling, setRolling] = useState(false);
  useEffect(() => setRolling(false), [last?.at]);
  useEffect(() => {
    if (!rolling) return;
    const t1 = setTimeout(() => setRolling(false), 6000);
    return () => clearTimeout(t1);
  }, [rolling]);

  const onBoard = order.filter((u) => !outOf(u) && (pos[u] ?? 0) > 0);
  const groups: Record<number, string[]> = {};
  for (const u of onBoard) (groups[pos[u]] ??= []).push(u);
  const restOf = (uid: string): { x: number; y: number; scale: number } => {
    const sq = pos[uid] ?? 0;
    const sharers = groups[sq] ?? [uid];
    const { offsets, scale } = shareLayout(sharers.length);
    const o = offsets[Math.max(0, sharers.indexOf(uid))];
    const c = snlCentre(Math.max(1, sq), size);
    return { x: c.x + o.x * cell - pawnSize / 2, y: c.y + o.y * cell - pawnSize * 0.75, scale };
  };
  const at = (p: Pt) => ({ x: p.x - pawnSize / 2, y: p.y - pawnSize * 0.75 });

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const scales = useRef<Record<string, Animated.Value>>({});
  const lifts = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(last?.at);
  const [moving, setMoving] = useState<string | null>(null);
  const movingRef = useRef<string | null>(null);
  for (const uid of order) {
    if (!anims.current[uid]) {
      const r = restOf(uid);
      anims.current[uid] = new Animated.ValueXY({ x: r.x, y: r.y });
      scales.current[uid] = new Animated.Value(r.scale);
      lifts.current[uid] = new Animated.Value(0);
    }
  }

  useEffect(() => {
    const isNew = last && last.at !== seenAt.current;
    for (const uid of order) {
      // Never pull back a pawn that is still walking.
      if ((isNew && uid === last!.userId) || movingRef.current === uid) continue;
      const r = restOf(uid);
      Animated.parallel([
        Animated.spring(anims.current[uid], { toValue: { x: r.x, y: r.y }, friction: 9, useNativeDriver: false }),
        Animated.spring(scales.current[uid], { toValue: r.scale, friction: 9, useNativeDriver: false }),
      ]).start();
    }
    if (!isNew || !last) return;
    seenAt.current = last.at;
    const uid = last.userId;
    const a = anims.current[uid];
    const lift = lifts.current[uid];
    const sc = scales.current[uid];
    if (!a || !lift || !sc) return;
    if (uid !== state.me.userId) playGameSound('dice');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sound = (kind: Parameters<typeof playGameSound>[0], ms: number) => timers.push(setTimeout(() => playGameSound(kind), ms));

    const mid = last.mid ?? last.to;
    const steps = last.from === 0 ? (mid === 1 ? [1] : []) : snlSteps(last.from, mid);
    // Still waiting for a 1, or no move at all: the pawn stays where it is (off the board, under
    // the board in the dock) — never shown on square 1 and taken back.
    if (steps.length === 0 && last.to === last.from) return () => timers.forEach(clearTimeout);
    const seq: Animated.CompositeAnimation[] = [Animated.delay(LAND_MS)];
    let t0 = LAND_MS;
    // Coming onto the board: from just left of square 1.
    if (last.from === 0 && steps.length) a.setValue(at({ x: snlCentre(1, size).x - cell * 0.9, y: snlCentre(1, size).y }));
    seq.push(Animated.timing(sc, { toValue: 1, duration: 120, useNativeDriver: false }));
    t0 += 120;
    for (const sq of steps) {
      // Glide to the next square, lifting slightly towards you (never a jump up the board).
      seq.push(
        Animated.parallel([
          Animated.timing(a, { toValue: at(snlCentre(sq, size)), duration: STEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 1, duration: STEP_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(lift, { toValue: 0, duration: STEP_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          ]),
        ]),
      );
      sound('step', t0 + STEP_MS - 30);
      t0 += STEP_MS;
    }
    if (last.to > mid) {
      seq.push(Animated.delay(180));
      sound('ladder', t0 + 180);
      seq.push(Animated.timing(a, { toValue: at(snlCentre(last.to, size)), duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    } else if (last.to < mid) {
      seq.push(Animated.delay(180));
      sound('snake', t0 + 180);
      const curve = snakeCurve(snlCentre(mid, size), snlCentre(last.to, size), cell);
      const N = 24;
      for (let i = 1; i <= N; i++) {
        seq.push(Animated.timing(a, { toValue: at(curve.at(i / N)), duration: 1300 / N, easing: Easing.linear, useNativeDriver: false }));
      }
    }
    const r = restOf(uid);
    seq.push(
      Animated.parallel([
        Animated.spring(a, { toValue: { x: r.x, y: r.y }, friction: 8, useNativeDriver: false }),
        Animated.spring(sc, { toValue: r.scale, friction: 8, useNativeDriver: false }),
      ]),
    );
    movingRef.current = uid;
    setMoving(uid);
    Animated.sequence(seq).start(() => {
      movingRef.current = null;
      setMoving(null);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pos), size]);

  const nameOf = (uid?: string) => (uid === state.me.userId ? t('party.you') : state.players.find((p) => p.userId === uid)?.name ?? '');
  const message = useMemo(() => {
    if (!last) return t('party.snakes.start');
    const name = nameOf(last.userId);
    const mid = last.mid ?? last.to;
    if (last.from === 0 && mid === 0) return t('party.snakes.needOne', { name, roll: last.roll });
    if (last.from === 0) return t('party.snakes.entered', { name });
    if (last.to > mid) return t('party.snakes.climbed', { name, to: last.to });
    if (last.to < mid) return t('party.snakes.bitten', { name, to: last.to });
    if (mid === last.from) return t('party.snakes.tooHigh', { name });
    return t('party.snakes.moved', { name, roll: last.roll, to: last.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, state.players, state.me.userId, t]);

  const canRoll = isMyTurn && g.phase === 'turn' && !moving && !rolling;
  const roll = () => {
    if (!canRoll) return;
    setRolling(true);
    playGameSound('dice');
    onRoll();
  };

  const dockPlayers: DockPlayer[] = order.flatMap((uid) => {
    const p = state.players.find((x) => x.userId === uid);
    if (!p) return [];
    const sq = pos[uid] ?? 0;
    return [
      {
        userId: uid,
        name: nameOf(uid),
        avatarKey: p.avatarKey,
        color: colorOf(uid),
        value: outOf(uid) ? t('party.board.out') : sq === 0 ? '' : `#${sq}`,
        misses: s.misses?.[uid] ?? 0,
        out: outOf(uid),
        // Not on the board yet (needs a 1): the pawn waits here, under the board.
        piece: !outOf(uid) && sq === 0 && moving !== uid ? <Pawn color={colorOf(uid).hex} dark={colorOf(uid).dark} size={18} /> : undefined,
      },
    ];
  });

  return (
    <View>
      <View style={[styles.boardWrap, { width: size + 19, marginHorizontal: -(spacing.lg - 1), backgroundColor: theme.frame, borderColor: theme.edge }]}>
        <View style={{ width: size + 4, padding: 2, borderRadius: 7, backgroundColor: '#1E1006' }}>
        <View style={{ width: size, height: size, borderRadius: 5, overflow: 'hidden' }}>
          <BoardArt size={size} board={board} level={level} />
          {order.map((uid) => {
            const c = colorOf(uid);
            const on = !outOf(uid) && ((pos[uid] ?? 0) > 0 || moving === uid);
            return (
              <Animated.View
                key={uid}
                pointerEvents="none"
                style={[
                  styles.token,
                  {
                    opacity: on ? 1 : 0,
                    transform: [
                      ...anims.current[uid].getTranslateTransform(),
                      { scale: Animated.multiply(scales.current[uid], lifts.current[uid].interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] })) },
                    ],
                  },
                ]}
              >
                <Pawn color={c.hex} dark={c.dark} size={pawnSize} glow={uid === s.turn} />
              </Animated.View>
            );
          })}
          </View>
        </View>
      </View>

      <GameDock
        players={dockPlayers}
        meId={state.me.userId}
        turnId={s.turn}
        canAct={canRoll}
        busy={busy}
        onAct={roll}
        actLabel={t('party.board.tapRoll')}
        seconds={seconds}
        status={rolling ? t('party.board.rolling') : !moving && canRoll ? t('party.board.yourTurnRoll') : message}
        center={<RollingDie value={last?.roll ?? 1} rollKey={last?.at} rolling={rolling} size={50} />}
      />
    </View>
  );
}

/** A small preview of one board (for choosing at create). */
export function BoardThumb({ index, board, size }: { index: number; board: SnlBoard; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
      <BoardArt size={size} board={board} level={snlLevelOf(index)} numbers={false} idPrefix={`t${index}`} />
      <View style={styles.thumbNum}>
        <T style={styles.thumbNumText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {(index % 5) + 1}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: { alignSelf: 'center', padding: 5, borderRadius: 14, borderWidth: 2.5 },
  token: { position: 'absolute', left: 0, top: 0 },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
