import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Row, T } from '@/components/ui';
import { LADDERS, type Pt, shareLayout, SNAKES, snakeCurve, snlCell, snlCentre, snlSteps, type SnlBoard } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Chances, Dice, DiceDrop, Pawn, PlayerPill, TOKEN_COLORS, TurnBar } from './BoardBits';
import { GoldFrame } from './Premium';

/** Snake skins: light → mid → dark, and the colour of the markings along the back. */
const SKINS = [
  { a: '#86EFAC', b: '#15803D', d: '#14532D', spot: '#FDE047' },
  { a: '#FDBA74', b: '#EA580C', d: '#7C2D12', spot: '#1F2937' },
  { a: '#D8B4FE', b: '#9333EA', d: '#581C87', spot: '#FDE68A' },
  { a: '#FCA5A5', b: '#DC2626', d: '#7F1D1D', spot: '#FEF3C7' },
  { a: '#7DD3FC', b: '#0284C7', d: '#0C4A6E', spot: '#FDE047' },
];
const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);

/**
 * A snake that reads as 3D: a dark outline body, a lighter tube inside it (light at the back,
 * dark at the belly), a shine running along the side facing the light, alternating markings,
 * and a shaded head with glossy eyes, nostrils and a flicking tongue — on a soft shadow.
 */
function SnakeArt({ head, tail, cell, skin, id }: { head: Pt; tail: Pt; cell: number; skin: (typeof SKINS)[number]; id: string }) {
  const curve = snakeCurve(head, tail, cell);
  const W = cell * 0.42;
  const width = (t: number) => W * (t < 0.1 ? 0.78 + 2.2 * t : 1 - 0.92 * Math.pow((t - 0.1) / 0.9, 1.3));
  const N = 36;
  const frame = (t: number) => {
    const p = curve.at(t);
    const q = curve.at(Math.min(1, t + 0.01));
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { p, ux: -(q.y - p.y) / l, uy: (q.x - p.x) / l, ang: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
  };
  const outline = (k: number) => {
    const L: string[] = [];
    const R: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = 0.05 + (i / N) * 0.95;
      const { p, ux, uy } = frame(t);
      const w = (width(t) / 2) * k;
      L.push(`${f1(p.x + ux * w)} ${f1(p.y + uy * w)}`);
      R.push(`${f1(p.x - ux * w)} ${f1(p.y - uy * w)}`);
    }
    return `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
  };
  const shine: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = 0.08 + (i / N) * 0.8;
    const { p, ux, uy } = frame(t);
    const side = -ux - uy > 0 ? 1 : -1;
    const w = width(t) * 0.22 * side;
    shine.push(`${f1(p.x + ux * w)} ${f1(p.y + uy * w)}`);
  }
  const h0 = curve.at(0.08);
  const headAng = (Math.atan2(head.y - h0.y, head.x - h0.x) * 180) / Math.PI;
  const hs = cell * 0.3;
  const headPath = `M${-hs * 0.7} ${-hs * 0.62} Q${hs * 0.5} ${-hs * 0.95} ${hs * 1.2} 0 Q${hs * 0.5} ${hs * 0.95} ${-hs * 0.7} ${hs * 0.62} Q${-hs * 0.95} 0 ${-hs * 0.7} ${-hs * 0.62} Z`;
  return (
    <G>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={skin.a} />
          <Stop offset="0.55" stopColor={skin.b} />
          <Stop offset="1" stopColor={skin.d} />
        </SvgGradient>
        <RadialGradient id={`${id}h`} cx="35%" cy="30%" r="80%">
          <Stop offset="0" stopColor={skin.a} />
          <Stop offset="0.6" stopColor={skin.b} />
          <Stop offset="1" stopColor={skin.d} />
        </RadialGradient>
      </Defs>
      <Path d={outline(1)} fill="rgba(0,0,0,0.28)" transform="translate(2.5 3.5)" />
      <Path d={outline(1)} fill={skin.d} />
      <Path d={outline(0.78)} fill={`url(#${id})`} />
      {Array.from({ length: 13 }, (_, i) => {
        const t = 0.12 + (i + 1) * 0.062;
        const { p, ang } = frame(t);
        const w = width(t);
        return (
          <Ellipse
            key={i}
            cx={p.x}
            cy={p.y}
            rx={w * 0.16}
            ry={w * 0.3}
            fill={i % 2 ? skin.d : skin.spot}
            opacity={i % 2 ? 0.35 : 0.8}
            transform={`rotate(${ang.toFixed(0)} ${f1(p.x)} ${f1(p.y)})`}
          />
        );
      })}
      <Path d={`M${shine.join(' L')}`} stroke="#fff" strokeOpacity={0.45} strokeWidth={W * 0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <G transform={`translate(${f1(head.x)} ${f1(head.y)}) rotate(${headAng.toFixed(0)})`}>
        <Path d={`M${hs * 1.15} 0 l${hs * 0.45} ${-hs * 0.14} M${hs * 1.15} 0 l${hs * 0.45} ${hs * 0.14}`} stroke="#E11D48" strokeWidth={1.6} strokeLinecap="round" />
        <Path d={headPath} fill="rgba(0,0,0,0.25)" transform="translate(2 3)" />
        <Path d={headPath} fill={`url(#${id}h)`} stroke={skin.d} strokeWidth={1.2} />
        <Ellipse cx={hs * 0.15} cy={-hs * 0.32} rx={hs * 0.42} ry={hs * 0.16} fill="#fff" opacity={0.35} />
        {[-1, 1].map((k) => (
          <G key={k}>
            <Circle cx={hs * 0.35} cy={k * hs * 0.38} r={hs * 0.22} fill="#FEF9C3" stroke={skin.d} strokeWidth={0.8} />
            <Ellipse cx={hs * 0.42} cy={k * hs * 0.38} rx={hs * 0.07} ry={hs * 0.16} fill="#111" />
            <Circle cx={hs * 0.3} cy={k * hs * 0.38 - hs * 0.07} r={hs * 0.05} fill="#fff" />
            <Circle cx={hs} cy={k * hs * 0.12} r={hs * 0.04} fill={skin.d} />
          </G>
        ))}
      </G>
    </G>
  );
}

/** An upright wooden ladder: dark-edged rails with a light grain line, rungs, a soft shadow. */
function LadderArt({ from, to, cell }: { from: Pt; to: Pt; cell: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const A = { x: from.x + ux * cell * 0.15, y: from.y + uy * cell * 0.15 };
  const B = { x: to.x - ux * cell * 0.15, y: to.y - uy * cell * 0.15 };
  const px = -uy * cell * 0.2;
  const py = ux * cell * 0.2;
  const rungs = Math.max(2, Math.round((len - cell * 0.3) / (cell * 0.3)));
  const rail = (k: number) => ({ x1: A.x + k * px, y1: A.y + k * py, x2: B.x + k * px, y2: B.y + k * py });
  return (
    <G>
      {[1, -1].map((k) => (
        <Line key={`s${k}`} {...rail(k)} stroke="rgba(0,0,0,0.22)" strokeWidth={5} strokeLinecap="round" transform="translate(2 3)" />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        return (
          <G key={i}>
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#7C4A1E" strokeWidth={3.4} strokeLinecap="round" />
            <Line x1={x + px * 0.85} y1={y + py * 0.85 - 0.8} x2={x - px * 0.85} y2={y - py * 0.85 - 0.8} stroke="#F3D3A1" strokeWidth={0.9} />
          </G>
        );
      })}
      {[1, -1].map((k) => (
        <G key={`r${k}`}>
          <Line {...rail(k)} stroke="#5C3310" strokeWidth={5.2} strokeLinecap="round" />
          <Line {...rail(k)} stroke="#B9783C" strokeWidth={3} strokeLinecap="round" />
          <Line {...rail(k)} stroke="#F3D3A1" strokeWidth={1} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/** The board: ivory checks, square numbers, the crown at 100, upright ladders, 3D snakes. */
export const BoardArt = React.memo(
  function BoardArt({ size, board, numbers = true, idPrefix = 'b' }: { size: number; board: SnlBoard; numbers?: boolean; idPrefix?: string }) {
    const cell = size / 10;
    const c = (sq: number) => snlCentre(sq, size);
    return (
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFF8EC" />
        {Array.from({ length: 100 }, (_, i) => {
          const sq = i + 1;
          const { row, col } = snlCell(sq);
          return (
            <G key={sq}>
              <Rect x={col * cell} y={row * cell} width={cell} height={cell} fill={(row + col) % 2 === 0 ? '#F6E3C6' : '#FFF8EC'} />
              {numbers ? (
                <SvgText x={col * cell + cell * 0.08} y={row * cell + cell * 0.28} fontSize={cell * 0.22} fontWeight="600" fill="#A47B52">
                  {sq}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        <Rect x={0} y={0} width={cell} height={cell} fill="#FDE68A" />
        <SvgText x={cell / 2} y={cell * 0.7} fontSize={cell * 0.46} textAnchor="middle">
          👑
        </SvgText>
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} head={c(Number(h))} tail={c(tl)} cell={cell} skin={SKINS[i % SKINS.length]} id={`${idPrefix}sk${i}`} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && JSON.stringify(a.board) === JSON.stringify(b.board),
);

const STEP_MS = 230;

/**
 * Snakes & Ladders. Everyone starts off the board (a 1 brings you onto square 1). Tap Roll: the
 * die tumbles on the board at once and lands on the number; your pawn hops square by square
 * (a tick each), climbs a ladder or slides down the snake's own body, with matching sounds.
 * Up to 10 pawns share a square, smaller the more there are.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.min(width - spacing.lg * 2 - 14, 420);
  const cell = size / 10;
  const pawnSize = cell * 0.62;
  const order = s.order ?? state.players.map((p) => p.userId);
  const pos = s.pos ?? {};
  const board = (s as { board?: SnlBoard }).board ?? CLASSIC;
  const turnPlayer = state.players.find((p) => p.userId === s.turn);
  const colorOf = (uid?: string) => TOKEN_COLORS[Math.max(0, order.indexOf(uid ?? '')) % TOKEN_COLORS.length];
  const isMyTurn = s.turn === state.me.userId;
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;
  const last = s.last;

  // I tapped Roll: the die tumbles until the result comes back.
  const [spinning, setSpinning] = useState(false);
  useEffect(() => setSpinning(false), [last?.at]);
  useEffect(() => {
    if (!spinning) return;
    const t1 = setTimeout(() => setSpinning(false), 6000);
    return () => clearTimeout(t1);
  }, [spinning]);
  const roll = () => {
    setSpinning(true);
    playGameSound('dice');
    onRoll();
  };

  // Where each pawn rests: centred, or spread (and smaller) when several share a square.
  const onBoard = order.filter((u) => !outOf(u) && (pos[u] ?? 0) > 0);
  const groups: Record<number, string[]> = {};
  for (const u of onBoard) (groups[pos[u]] ??= []).push(u);
  const restOf = (uid: string): { x: number; y: number; scale: number } => {
    const sq = pos[uid] ?? 0;
    const sharers = groups[sq] ?? [uid];
    const { offsets, scale } = shareLayout(sharers.length);
    const o = offsets[Math.max(0, sharers.indexOf(uid))];
    const c = snlCentre(Math.max(1, sq), size);
    return { x: c.x + o.x * cell - pawnSize / 2, y: c.y + o.y * cell - pawnSize * 0.6 - pawnSize * 0.15, scale };
  };
  const at = (p: Pt) => ({ x: p.x - pawnSize / 2, y: p.y - pawnSize * 0.75 });

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const scales = useRef<Record<string, Animated.Value>>({});
  const hops = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(last?.at);
  const [moving, setMoving] = useState<string | null>(null);
  for (const uid of order) {
    if (!anims.current[uid]) {
      const r = restOf(uid);
      anims.current[uid] = new Animated.ValueXY({ x: r.x, y: r.y });
      scales.current[uid] = new Animated.Value(r.scale);
      hops.current[uid] = new Animated.Value(0);
    }
  }

  useEffect(() => {
    const isNew = last && last.at !== seenAt.current;
    for (const uid of order) {
      if (isNew && uid === last!.userId) continue;
      const r = restOf(uid);
      Animated.parallel([
        Animated.spring(anims.current[uid], { toValue: { x: r.x, y: r.y }, friction: 8, useNativeDriver: false }),
        Animated.spring(scales.current[uid], { toValue: r.scale, friction: 8, useNativeDriver: false }),
      ]).start();
    }
    if (!isNew || !last) return;
    seenAt.current = last.at;
    const uid = last.userId;
    const a = anims.current[uid];
    const hop = hops.current[uid];
    const sc = scales.current[uid];
    if (!a || !hop || !sc) return;
    if (uid !== state.me.userId) playGameSound('dice');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sound = (kind: Parameters<typeof playGameSound>[0], ms: number) => timers.push(setTimeout(() => playGameSound(kind), ms));

    const mid = last.mid ?? last.to;
    const steps = last.from === 0 ? (mid === 1 ? [1] : []) : snlSteps(last.from, mid);
    const seq: Animated.CompositeAnimation[] = [Animated.delay(1150)];
    let t0 = 1150;
    if (last.from === 0 && steps.length) {
      // Onto the board: from the start area to square 1.
      a.setValue(at({ x: snlCentre(1, size).x - cell, y: snlCentre(1, size).y + cell * 0.6 }));
    }
    seq.push(Animated.timing(sc, { toValue: 1, duration: 120, useNativeDriver: false }));
    t0 += 120;
    for (const sq of steps) {
      seq.push(
        Animated.parallel([
          Animated.timing(a, { toValue: at(snlCentre(sq, size)), duration: STEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: STEP_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(hop, { toValue: 0, duration: STEP_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          ]),
        ]),
      );
      sound('step', t0 + STEP_MS - 30);
      t0 += STEP_MS;
    }
    if (last.to > mid) {
      // Ladder: climb straight up the ladder.
      seq.push(Animated.delay(200));
      sound('ladder', t0 + 200);
      seq.push(Animated.timing(a, { toValue: at(snlCentre(last.to, size)), duration: 1000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    } else if (last.to < mid) {
      // Snake: slide down along its own body, head to tail.
      seq.push(Animated.delay(200));
      sound('snake', t0 + 200);
      const curve = snakeCurve(snlCentre(mid, size), snlCentre(last.to, size), cell);
      const N = 18;
      for (let i = 1; i <= N; i++) {
        const k = i / N;
        seq.push(Animated.timing(a, { toValue: at(curve.at(k)), duration: 1300 / N, easing: Easing.linear, useNativeDriver: false }));
      }
    }
    const r = restOf(uid);
    seq.push(
      Animated.parallel([
        Animated.spring(a, { toValue: { x: r.x, y: r.y }, friction: 7, useNativeDriver: false }),
        Animated.spring(sc, { toValue: r.scale, friction: 7, useNativeDriver: false }),
      ]),
    );
    setMoving(uid);
    Animated.sequence(seq).start(() => setMoving(null));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pos), size]);

  const lastMover = state.players.find((p) => p.userId === last?.userId);
  const message = useMemo(() => {
    if (!last) return t('party.snakes.start');
    const name = last.userId === state.me.userId ? t('party.you') : lastMover?.name ?? '';
    const mid = last.mid ?? last.to;
    if (last.from === 0 && mid === 0) return t('party.snakes.needOne', { name, roll: last.roll });
    if (last.from === 0) return t('party.snakes.entered', { name });
    if (last.to > mid) return t('party.snakes.climbed', { name, to: last.to });
    if (last.to < mid) return t('party.snakes.bitten', { name, to: last.to });
    if (mid === last.from) return t('party.snakes.tooHigh', { name });
    return t('party.snakes.moved', { name, roll: last.roll, to: last.to });
  }, [last, lastMover, state.me.userId, t]);

  const waiting = order.filter((u) => !outOf(u) && (pos[u] ?? 0) === 0 && moving !== u);

  return (
    <View>
      <GoldFrame radius={20} width={2} colors={['#3E2723', '#5D4037', '#3E2723']} innerStyle={{ padding: 7, alignItems: 'center' }}>
        <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden' }}>
          <BoardArt size={size} board={board} />
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
                      { translateY: hops.current[uid].interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 0.4] }) },
                      { scale: scales.current[uid] },
                    ],
                  },
                ]}
              >
                <Pawn color={c.hex} dark={c.dark} size={pawnSize} glow={uid === s.turn} />
              </Animated.View>
            );
          })}
          <DiceDrop value={last?.roll ?? 1} rollKey={last?.at} size={cell * 1.9} spinning={spinning} />
        </View>
      </GoldFrame>

      {/* Start area: pawns still waiting for a 1 */}
      {waiting.length ? (
        <View style={styles.startArea}>
          <T variant="tiny" muted style={{ marginRight: 6 }}>
            {t('party.snakes.startArea')}
          </T>
          <Row gap={4} style={{ flexWrap: 'wrap', flex: 1 }}>
            {waiting.map((u) => (
              <Pawn key={u} color={colorOf(u).hex} dark={colorOf(u).dark} size={18} />
            ))}
          </Row>
        </View>
      ) : null}

      <T variant="small" muted center style={{ marginTop: spacing.sm }}>
        {message}
      </T>

      <TurnBar
        player={turnPlayer}
        color={colorOf(s.turn)}
        isMe={isMyTurn}
        seconds={seconds}
        actionLabel={t('party.snakes.roll')}
        actionIcon="dice"
        actionArt={<Dice value={5} rollKey={undefined} size={38} />}
        canAct={isMyTurn && g.phase === 'turn' && !moving && !spinning}
        busy={busy}
        onAct={roll}
        waitingLabel={isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      >
        <Dice value={last?.roll ?? 1} rollKey={undefined} size={48} />
      </TurnBar>

      <Row style={styles.pills}>
        {order.map((uid) => {
          const p = state.players.find((x) => x.userId === uid);
          if (!p) return null;
          const sq = pos[uid] ?? 0;
          return (
            <PlayerPill
              key={uid}
              player={p}
              color={colorOf(uid)}
              value={outOf(uid) ? t('party.board.out') : sq === 0 ? t('party.snakes.notIn') : String(sq)}
              active={uid === s.turn}
              me={uid === state.me.userId}
              extra={<Chances misses={s.misses?.[uid] ?? 0} />}
            />
          );
        })}
      </Row>
    </View>
  );
}

/** A small preview of one of the 5 boards (for choosing at create). */
export function BoardThumb({ index, board, size }: { index: number; board: SnlBoard; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
      <BoardArt size={size} board={board} numbers={false} idPrefix={`t${index}`} />
      <View style={styles.thumbNum}>
        <T style={styles.thumbNumText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {index + 1}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  token: { position: 'absolute', left: 0, top: 0 },
  pills: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: spacing.md },
  startArea: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)' },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
