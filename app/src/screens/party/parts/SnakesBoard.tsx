import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
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

/** Board colours per level: easy = mint, medium = honey, hard = rose. */
export const SNL_THEME: Record<SnlLevel, { a: string; b: string; num: string; frame: string; edge: string }> = {
  easy: { a: '#F2FBF3', b: '#BDE8C8', num: '#2E6B3E', frame: '#1F5130', edge: '#86EFAC' },
  medium: { a: '#FFF6DE', b: '#FFD98E', num: '#8A5210', frame: '#7A4513', edge: '#F5D06F' },
  hard: { a: '#FFF3F0', b: '#FFC9B8', num: '#9A3412', frame: '#7C2D12', edge: '#FDA4AF' },
};
/** Snake skins: body, outline / dark marks, light, the bright pattern. */
const SKINS = [
  { base: '#43A047', dark: '#1B5E20', light: '#B9F6CA', mark: '#FDD835' },
  { base: '#E53935', dark: '#7F0000', light: '#FFCDD2', mark: '#FFE082' },
  { base: '#1E88E5', dark: '#0D2F6B', light: '#BBDEFB', mark: '#FFF59D' },
  { base: '#FB8C00', dark: '#7A3300', light: '#FFE0B2', mark: '#5D2E0B' },
  { base: '#8E24AA', dark: '#3B0A57', light: '#F3E5F5', mark: '#FFD54F' },
];
const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);
/** Light comes from the top-left: highlights shift this way along the body. */
const LX = -0.55;
const LY = -0.83;

/**
 * A glossy snake: a round body along a natural wave (thick in the middle, a fine pointed tail),
 * lit from the top-left like a tube, with a diamond pattern down its back — and a proper head
 * (eyes with slit pupils, nostrils, a forked tongue) that stays inside its own square.
 */
function SnakeArt({ head, tail, cell, skin, id }: { head: Pt; tail: Pt; cell: number; skin: (typeof SKINS)[number]; id: string }) {
  const { at } = snakeCurve(head, tail, cell);
  const W = cell * 0.42;
  const width = (t: number) => W * (t < 0.12 ? 0.75 + (t / 0.12) * 0.25 : t < 0.55 ? 1 : Math.max(0.07, 1 - (t - 0.55) / 0.45));
  const fr = (t: number) => {
    const p = at(t);
    const q = at(Math.min(1, t + 0.004));
    const r = at(Math.max(0, t - 0.004));
    const l = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    return { p, tx: (q.x - r.x) / l, ty: (q.y - r.y) / l, ux: -(q.y - r.y) / l, uy: (q.x - r.x) / l };
  };
  const N = 60;
  const T0 = 0.05;
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
  // Diamond pattern down the back.
  const marks: React.ReactNode[] = [];
  const step = W * 0.6;
  let acc = 0;
  let prev = at(T0 + 0.03);
  for (let i = 1, k = 0; i <= 300; i++) {
    const t = T0 + 0.03 + (i / 300) * (0.92 - T0);
    const p = at(t);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    if (acc < step) continue;
    acc = 0;
    k++;
    const { tx, ty, ux, uy } = fr(t);
    const w = width(t) / 2;
    const a = w * 0.6;
    const b = w * 0.52;
    marks.push(
      <Path
        key={k}
        d={`M${f1(p.x + tx * a)} ${f1(p.y + ty * a)} L${f1(p.x + ux * b)} ${f1(p.y + uy * b)} L${f1(p.x - tx * a)} ${f1(p.y - ty * a)} L${f1(p.x - ux * b)} ${f1(p.y - uy * b)} Z`}
        fill={k % 2 ? skin.mark : skin.dark}
        opacity={k % 2 ? 0.9 : 0.45}
      />,
    );
  }
  // Head: points away from the neck, set back a little so the tongue stays in the square.
  const h0 = at(0);
  const h1 = at(0.05);
  const dl = Math.hypot(h0.x - h1.x, h0.y - h1.y) || 1;
  const dx = (h0.x - h1.x) / dl;
  const dy = (h0.y - h1.y) / dl;
  const hl = cell * 0.5;
  const hw = cell * 0.44;
  const cx = head.x - dx * cell * 0.1;
  const cy = head.y - dy * cell * 0.1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const tip = hl * 0.5;
  const headPath = `M${f1(tip)} 0 C${f1(tip)} ${f1(-hw * 0.4)} ${f1(hl * 0.05)} ${f1(-hw * 0.56)} ${f1(-hl * 0.28)} ${f1(-hw * 0.44)} C${f1(-hl * 0.52)} ${f1(-hw * 0.34)} ${f1(-hl * 0.52)} ${f1(hw * 0.34)} ${f1(-hl * 0.28)} ${f1(hw * 0.44)} C${f1(hl * 0.05)} ${f1(hw * 0.56)} ${f1(tip)} ${f1(hw * 0.4)} ${f1(tip)} 0 Z`;
  return (
    <G>
      <Defs>
        <RadialGradient id={id} cx="35%" cy="40%" r="70%">
          <Stop offset="0" stopColor={skin.light} />
          <Stop offset="0.5" stopColor={skin.base} />
          <Stop offset="1" stopColor={skin.dark} />
        </RadialGradient>
      </Defs>
      <Path d={band(1, 0)} fill="rgba(0,0,0,0.3)" transform="translate(2.5 3.5)" />
      <Path d={band(1, 0)} fill={skin.dark} />
      <Path d={band(0.84, 0)} fill={skin.base} />
      {marks}
      <Path d={band(0.42, -0.5)} fill="#000" opacity={0.16} />
      <Path d={band(0.3, 0.5)} fill={skin.light} opacity={0.45} />
      <Path d={band(0.1, 0.6, 0.85)} fill="#fff" opacity={0.6} />
      <G transform={`translate(${f1(cx)} ${f1(cy)}) rotate(${f1(ang)})`}>
        <Path
          d={`M${f1(tip - 1)} 0 L${f1(tip + cell * 0.1)} 0 l${f1(cell * 0.06)} ${f1(-cell * 0.05)} M${f1(tip + cell * 0.1)} 0 l${f1(cell * 0.06)} ${f1(cell * 0.05)}`}
          stroke="#E11D48"
          strokeWidth={cell * 0.04}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d={headPath} fill="rgba(0,0,0,0.3)" transform="translate(2 3)" />
        <Path d={headPath} fill={`url(#${id})`} stroke={skin.dark} strokeWidth={1.5} />
        <Line x1={-hl * 0.3} y1={0} x2={hl * 0.15} y2={0} stroke={skin.dark} strokeWidth={1} opacity={0.35} />
        {[-1, 1].map((s) => {
          const ex = hl * 0.02;
          const ey = s * hw * 0.27;
          return (
            <G key={s}>
              <Circle cx={ex} cy={ey} r={cell * 0.09} fill="#FFEE58" stroke={skin.dark} strokeWidth={1.1} />
              <Ellipse cx={ex + 0.5} cy={ey} rx={cell * 0.064} ry={cell * 0.025} fill="#111" />
              <Circle cx={ex - cell * 0.03} cy={ey - cell * 0.03} r={cell * 0.022} fill="#fff" />
              <Circle cx={tip * 0.72} cy={s * hw * 0.1} r={cell * 0.018} fill={skin.dark} />
            </G>
          );
        })}
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

/** The board: a soft two-tone checker (colour by level), small corner numbers, ladders, snakes. */
export const BoardArt = React.memo(
  function BoardArt({ size, board, level, numbers = true, idPrefix = 'b' }: { size: number; board: SnlBoard; level: SnlLevel; numbers?: boolean; idPrefix?: string }) {
    const cell = size / 10;
    const th = SNL_THEME[level];
    const c = (sq: number) => snlCentre(sq, size);
    return (
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={th.a} />
        {Array.from({ length: 100 }, (_, i) => {
          const sq = i + 1;
          const { row, col } = snlCell(sq);
          const fill = sq === 100 ? '#FFC93C' : (row + col) % 2 ? th.b : th.a;
          return (
            <G key={sq}>
              {fill === th.a ? null : <Rect x={col * cell} y={row * cell} width={cell} height={cell} fill={fill} />}
              {numbers ? (
                <SvgText x={col * cell + cell * 0.08} y={row * cell + cell * 0.3} fontSize={cell * 0.26} fontWeight="700" fill={th.num} opacity={0.8}>
                  {sq}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {numbers ? (
          <SvgText x={cell * 0.5} y={cell * 0.8} fontSize={cell * 0.36} textAnchor="middle">
            👑
          </SvgText>
        ) : null}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} id={`${idPrefix}s${h}`} head={c(Number(h))} tail={c(tl)} cell={cell} skin={SKINS[i % SKINS.length]} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && a.level === b.level && JSON.stringify(a.board) === JSON.stringify(b.board),
);

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
  const size = Math.min(width - 16, 560);
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
        value: outOf(uid) ? t('party.board.out') : sq === 0 ? t('party.snakes.notIn') : `#${sq}`,
        misses: s.misses?.[uid] ?? 0,
        out: outOf(uid),
      },
    ];
  });

  return (
    <View>
      <View style={[styles.boardWrap, { width: size + 10, marginHorizontal: -(spacing.lg - 3), backgroundColor: theme.frame, borderColor: theme.edge }]}>
        <View style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden' }}>
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
  boardWrap: { alignSelf: 'center', padding: 5, borderRadius: 12, borderWidth: 2 },
  token: { position: 'absolute', left: 0, top: 0 },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
