import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { T } from '@/components/ui';
import { LADDERS, type Pt, shareLayout, SNAKES, snakeCurve, snlCell, snlCentre, snlLevelOf, snlSteps, type SnlBoard, type SnlLevel } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Pawn, TOKEN_COLORS } from './BoardBits';
import { GameDock, type DockPlayer } from './GameDock';
import { RollingDie } from './RollingDie';

/** Frame colour per level (easy = green, medium = maroon, hard = deep purple); the board itself is the folk board. */
export const SNL_THEME: Record<SnlLevel, { frame: string; edge: string }> = {
  easy: { frame: '#1B5E20', edge: '#F5D06F' },
  medium: { frame: '#7B1F1F', edge: '#F5D06F' },
  hard: { frame: '#4A148C', edge: '#F5D06F' },
};

const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);

/** Hand-painted Paramapadam colours: yellow, pink, leaf green, sky blue, lilac, orange, cream. */
const PAL = ['#FFF176', '#F8BBD0', '#C5E1A5', '#B3E5FC', '#E1BEE7', '#FFCC80', '#FFFDE7'];
/** A little picture in every square, like the painted boards (animals, flowers, temples, lamps). */
const ICONS = ['🐘', '🦚', '🐅', '🐄', '🌺', '🛕', '🐒', '🦜', '🐟', '🐢', '🌸', '🌴', '🪔', '🐎', '🦌', '🐇', '🦋', '🐦', '🌻', '🐊', '🦢', '🐐', '🐓', '🌳', '🌞', '🐪', '🦅', '🐃', '🌿', '🐸'];
const tileColor = (sq: number, row: number, col: number) => PAL[(row * 3 + col * 5 + Math.floor(sq / 7)) % PAL.length];

/** Snake paints: body, the light stripe down the back, outline, head. */
const SKINS = [
  { body: '#D9A86C', belly: '#F6E3C2', line: '#3E2410', head: '#E9C46A' },
  { body: '#C9B037', belly: '#F4EBA8', line: '#3B3210', head: '#B5C94A' },
  { body: '#9CB04A', belly: '#E2EDB5', line: '#26300E', head: '#C7D96B' },
  { body: '#B9773A', belly: '#F2D2A8', line: '#3A1E08', head: '#E0A458' },
] as const;

/**
 * A painted Paramapadam snake: long and slim (slimmer when short), a dark outline, a light stripe
 * down the back and fine scale lines across it, a fine pointed tail, and a narrow head a little
 * wider than the neck — joined to it — with round eyes and a red forked tongue, inside its square.
 */
function SnakeArt({ head, tail, cell, skin, lite }: { head: Pt; tail: Pt; cell: number; skin: number; lite?: boolean }) {
  const s = SKINS[skin];
  const { at } = snakeCurve(head, tail, cell);
  const rows = Math.abs(tail.y - head.y) / cell;
  const W = cell * Math.max(0.17, Math.min(0.3, 0.15 + rows * 0.025));
  const width = (t: number) => W * (t < 0.7 ? 1 : Math.max(0.08, 1 - (t - 0.7) / 0.3));
  const fr = (t: number) => {
    const p = at(t);
    const q = at(Math.min(1, t + 0.003));
    const r = at(Math.max(0, t - 0.003));
    const l = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    return { p, tx: (q.x - r.x) / l, ty: (q.y - r.y) / l, ux: -(q.y - r.y) / l, uy: (q.x - r.x) / l };
  };
  const N = lite ? 36 : 70;
  const band = (k: number, t0 = 0, t1 = 1) => {
    const L: string[] = [];
    const R: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = t0 + (i / N) * (t1 - t0);
      const { p, ux, uy } = fr(t);
      const w = (width(t) / 2) * k;
      L.push(`${f1(p.x + ux * w)} ${f1(p.y + uy * w)}`);
      R.push(`${f1(p.x - ux * w)} ${f1(p.y - uy * w)}`);
    }
    return `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
  };
  // Scale lines across the body, as one path.
  let scales = '';
  if (!lite) {
    let acc = 0;
    let prev = at(0.05);
    for (let i = 1; i <= 400; i++) {
      const t = 0.05 + (i / 400) * 0.88;
      const p = at(t);
      acc += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
      if (acc < W * 0.45) continue;
      acc = 0;
      const { tx, ty, ux, uy } = fr(t);
      const w = (width(t) / 2) * 0.95;
      scales += `M${f1(p.x + ux * w)} ${f1(p.y + uy * w)} L${f1(p.x - ux * w + tx * w * 0.5)} ${f1(p.y - uy * w + ty * w * 0.5)} `;
    }
  }
  const h0 = at(0);
  const h1 = at(0.025);
  const dl = Math.hypot(h0.x - h1.x, h0.y - h1.y) || 1;
  const ang = (Math.atan2((h0.y - h1.y) / dl, (h0.x - h1.x) / dl) * 180) / Math.PI;
  const hl = Math.min(W * 2.3, cell * 0.55);
  const hw = W * 1.45;
  const tip = hl * 0.55;
  const hp = `M${f1(tip)} 0 C${f1(tip)} ${f1(-hw * 0.25)} ${f1(hl * 0.2)} ${f1(-hw * 0.5)} ${f1(-hl * 0.15)} ${f1(-hw * 0.5)} C${f1(-hl * 0.35)} ${f1(-hw * 0.5)} ${f1(-hl * 0.45)} ${f1(-hw * 0.4)} ${f1(-hl * 0.5)} ${f1(-W * 0.5)} L${f1(-hl * 0.5)} ${f1(W * 0.5)} C${f1(-hl * 0.45)} ${f1(hw * 0.4)} ${f1(-hl * 0.35)} ${f1(hw * 0.5)} ${f1(-hl * 0.15)} ${f1(hw * 0.5)} C${f1(hl * 0.2)} ${f1(hw * 0.5)} ${f1(tip)} ${f1(hw * 0.25)} ${f1(tip)} 0 Z`;
  return (
    <G>
      <Path d={band(1)} fill="rgba(0,0,0,0.18)" transform="translate(2 2.5)" />
      <Path d={band(1)} fill={s.body} stroke={s.line} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d={band(0.38, 0.02, 0.9)} fill={s.belly} opacity={0.9} />
      {scales ? <Path d={scales} stroke={s.line} strokeWidth={0.6} opacity={0.5} /> : null}
      <G transform={`translate(${f1(h0.x)} ${f1(h0.y)}) rotate(${f1(ang)})`}>
        <Path
          d={`M${f1(tip - 1)} 0 L${f1(tip + hl * 0.25)} 0 l${f1(hl * 0.1)} ${f1(-hl * 0.08)} M${f1(tip + hl * 0.25)} 0 l${f1(hl * 0.1)} ${f1(hl * 0.08)}`}
          stroke="#D32F2F"
          strokeWidth={1.2}
          strokeLinecap="round"
          fill="none"
        />
        <Path d={hp} fill={s.head} stroke={s.line} strokeWidth={1.3} strokeLinejoin="round" />
        <Line x1={tip * 0.7} y1={0} x2={-hl * 0.35} y2={0} stroke={s.line} strokeWidth={0.7} opacity={0.5} />
        {[-1, 1].map((k) => (
          <G key={k}>
            <Circle cx={hl * 0.08} cy={k * hw * 0.27} r={hw * 0.13} fill="#fff" stroke={s.line} strokeWidth={0.8} />
            <Circle cx={hl * 0.1} cy={k * hw * 0.27} r={hw * 0.07} fill="#111" />
          </G>
        ))}
      </G>
    </G>
  );
}

/** A painted ladder: two thin dark rails and close rungs. */
function LadderArt({ from, to, cell }: { from: Pt; to: Pt; cell: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const A = { x: from.x - ux * cell * 0.2, y: from.y - uy * cell * 0.2 };
  const B = { x: to.x + ux * cell * 0.15, y: to.y + uy * cell * 0.15 };
  const px = -uy * cell * 0.17;
  const py = ux * cell * 0.17;
  const n = Math.max(4, Math.round(Math.hypot(B.x - A.x, B.y - A.y) / (cell * 0.26)));
  const sw = Math.max(0.5, cell / 40);
  return (
    <G>
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        return (
          <G key={i}>
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#3E2723" strokeWidth={2.6 * sw} strokeLinecap="round" />
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#A1887F" strokeWidth={1.1 * sw} strokeLinecap="round" />
          </G>
        );
      })}
      {[1, -1].map((k) => (
        <G key={k}>
          <Line x1={A.x + k * px} y1={A.y + k * py} x2={B.x + k * px} y2={B.y + k * py} stroke="#3E2723" strokeWidth={3.6 * sw} strokeLinecap="round" />
          <Line x1={A.x + k * px} y1={A.y + k * py} x2={B.x + k * px} y2={B.y + k * py} stroke="#8D6E63" strokeWidth={1.6 * sw} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/**
 * The board, like the painted Paramapadam boards: bright squares in folk colours (yellow, pink,
 * green, blue, lilac, orange, cream) with fine brown lines, a little picture in every square,
 * the number in its corner, a temple on 100, painted ladders and snakes.
 */
export const BoardArt = React.memo(
  function BoardArt({ size, board, numbers = true }: { size: number; board: SnlBoard; level: SnlLevel; numbers?: boolean; idPrefix?: string }) {
    const cell = size / 10;
    const c = (sq: number) => snlCentre(sq, size);
    return (
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#5D4037" />
        {Array.from({ length: 100 }, (_, i) => {
          const sq = i + 1;
          const { row, col } = snlCell(sq);
          const x0 = col * cell;
          const y0 = row * cell;
          return (
            <G key={sq}>
              <Rect x={x0 + 0.5} y={y0 + 0.5} width={cell - 1} height={cell - 1} fill={sq === 100 ? '#FFD54F' : tileColor(sq, row, col)} />
              {numbers ? (
                <>
                  <SvgText x={x0 + cell * 0.55} y={y0 + cell * 0.82} fontSize={cell * 0.42} textAnchor="middle" opacity={0.9}>
                    {sq === 100 ? '🛕' : ICONS[(sq * 7) % ICONS.length]}
                  </SvgText>
                  <SvgText x={x0 + cell * 0.07} y={y0 + cell * 0.27} fontSize={cell * 0.24} fontWeight="800" fill="#3E2723">
                    {sq}
                  </SvgText>
                </>
              ) : null}
            </G>
          );
        })}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} skin={i % SKINS.length} head={c(Number(h))} tail={c(tl)} cell={cell} lite={!numbers} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && JSON.stringify(a.board) === JSON.stringify(b.board),
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
        {/* Title banner, like the painted Paramapadam boards */}
        <View style={styles.banner}>
          <T style={styles.bannerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
            🪔  {t('party.snakes.boardTitle')}  🪔
          </T>
        </View>
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
        {/* Elephant strip, like the painted boards' bottom border */}
        <View style={styles.strip}>
          {Array.from({ length: 11 }, (_, i) => (
            <T key={i} style={styles.stripIcon} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              🐘
            </T>
          ))}
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
  banner: { height: 28, marginBottom: 5, borderRadius: 7, backgroundColor: '#FFF176', borderWidth: 1, borderColor: '#5D4037', alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: '#B71C1C', letterSpacing: 1 },
  strip: { height: 20, marginTop: 5, borderRadius: 6, backgroundColor: '#E1BEE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  stripIcon: { fontSize: 12, lineHeight: 16 },
  token: { position: 'absolute', left: 0, top: 0 },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
