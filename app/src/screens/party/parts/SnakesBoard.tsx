import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Row, T } from '@/components/ui';
import { LADDERS, SNAKES, snlCell, snlSteps } from '@/game/engine/board';
import type { PartyState } from '@/services/partyService';
import { spacing } from '@/theme';
import { Chances, Dice, DiceDrop, PlayerPill, Token, TOKEN_COLORS, TurnBar } from './BoardBits';
import { GoldFrame } from './Premium';

/** Snake skins: body light → dark, and the pattern colour. */
const SKINS = [
  { a: '#4ADE80', b: '#15803D', spot: '#FDE047' },
  { a: '#FB923C', b: '#C2410C', spot: '#1F2937' },
  { a: '#C084FC', b: '#7E22CE', spot: '#FDE68A' },
  { a: '#F87171', b: '#B91C1C', spot: '#FEF3C7' },
  { a: '#38BDF8', b: '#0369A1', spot: '#FDE047' },
];
/** Where tokens sit when several share a square (a lone token sits in the middle). */
const SHARE: [number, number][] = [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.2], [0.2, 0.2], [0, -0.24], [0, 0.26]];

type P = { x: number; y: number };
const bez = (a: P, c1: P, c2: P, b: P, t: number): P => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
};

/** A snake as a filled body that tapers from head to tail, with spots along its back. */
function SnakeArt({ head, tail, cell, skin, id }: { head: P; tail: P; cell: number; skin: (typeof SKINS)[number]; id: string }) {
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const amp = Math.min(cell * 1.3, len * 0.3);
  const c1 = { x: head.x + dx * 0.3 + nx * amp, y: head.y + dy * 0.3 + ny * amp };
  const c2 = { x: head.x + dx * 0.7 - nx * amp, y: head.y + dy * 0.7 - ny * amp };
  const N = 28;
  const W = cell * 0.46;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = 0.06 + (i / N) * 0.94;
    const p = bez(head, c1, c2, tail, t);
    const q = bez(head, c1, c2, tail, Math.min(1, t + 0.01));
    const tl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const ux = -(q.y - p.y) / tl;
    const uy = (q.x - p.x) / tl;
    const w = (W / 2) * (1 - t * 0.85);
    left.push({ x: p.x + ux * w, y: p.y + uy * w });
    right.push({ x: p.x - ux * w, y: p.y - uy * w });
  }
  const body = `M${left.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} L${right
    .reverse()
    .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' L')} Z`;
  const spots = Array.from({ length: 7 }, (_, i) => bez(head, c1, c2, tail, 0.16 + i * 0.11));
  const h0 = bez(head, c1, c2, tail, 0.06);
  const angle = (Math.atan2(head.y - h0.y, head.x - h0.x) * 180) / Math.PI;
  return (
    <G>
      <Path d={body} fill="rgba(0,0,0,0.22)" transform="translate(2 3)" />
      <Path d={body} fill={`url(#${id})`} stroke={skin.b} strokeWidth={1.2} />
      {spots.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={(W / 2) * (0.42 - i * 0.04)} fill={skin.spot} opacity={0.75} />
      ))}
      <G transform={`translate(${head.x} ${head.y}) rotate(${angle})`}>
        <Path d={`M${cell * 0.2} 0 l${cell * 0.13} ${-cell * 0.05} M${cell * 0.2} 0 l${cell * 0.13} ${cell * 0.05}`} stroke="#E11D48" strokeWidth={1.8} strokeLinecap="round" />
        <Ellipse cx={0} cy={0} rx={cell * 0.3} ry={cell * 0.24} fill={skin.b} />
        <Ellipse cx={0.5} cy={0} rx={cell * 0.27} ry={cell * 0.21} fill={skin.a} />
        <Circle cx={cell * 0.06} cy={-cell * 0.08} r={cell * 0.055} fill="#fff" />
        <Circle cx={cell * 0.06} cy={cell * 0.08} r={cell * 0.055} fill="#fff" />
        <Circle cx={cell * 0.08} cy={-cell * 0.08} r={cell * 0.028} fill="#111" />
        <Circle cx={cell * 0.08} cy={cell * 0.08} r={cell * 0.028} fill="#111" />
      </G>
    </G>
  );
}

/** A wooden ladder: rounded rails with a light edge, evenly spaced rungs, a soft shadow. */
function LadderArt({ from, to, cell }: { from: P; to: P; cell: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Start / end a little inside the squares so the feet and tops sit neatly in them.
  const A = { x: from.x + ux * cell * 0.12, y: from.y + uy * cell * 0.12 };
  const B = { x: to.x - ux * cell * 0.12, y: to.y - uy * cell * 0.12 };
  const px = -uy * cell * 0.17;
  const py = ux * cell * 0.17;
  const inner = len - cell * 0.24;
  const rungs = Math.max(2, Math.round(inner / (cell * 0.32)));
  const rail = (s: number) => ({ x1: A.x + s * px, y1: A.y + s * py, x2: B.x + s * px, y2: B.y + s * py });
  return (
    <G>
      {[1, -1].map((s) => (
        <Line key={`sh${s}`} {...rail(s)} stroke="rgba(0,0,0,0.2)" strokeWidth={5} strokeLinecap="round" transform="translate(2 3)" />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        return (
          <G key={i}>
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#7C4A1E" strokeWidth={3.6} strokeLinecap="round" />
            <Line x1={x + px * 0.8} y1={y + py * 0.8 - 0.8} x2={x - px * 0.8} y2={y - py * 0.8 - 0.8} stroke="#E8B77A" strokeWidth={1} strokeLinecap="round" />
          </G>
        );
      })}
      {[1, -1].map((s) => (
        <G key={`r${s}`}>
          <Line {...rail(s)} stroke="#6B3E17" strokeWidth={5} strokeLinecap="round" />
          <Line {...rail(s)} stroke="#C98A4B" strokeWidth={2.6} strokeLinecap="round" />
          <Line {...rail(s)} stroke="#F3D3A1" strokeWidth={0.9} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/** The board: ivory two-tone squares, fine lines, numbers, the crown at 100, ladders, snakes. */
type BoardMap = { ladders: Record<string, number>; snakes: Record<string, number> };
const CLASSIC: BoardMap = { ladders: LADDERS, snakes: SNAKES };

const BoardArt = React.memo(function BoardArt({ size, board }: { size: number; board: BoardMap }) {
  const cell = size / 10;
  const c = (sq: number): P => {
    const { row, col } = snlCell(sq);
    return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
  };
  return (
    <Svg width={size} height={size}>
      <Defs>
        {SKINS.map((s, i) => (
          <SvgGradient key={i} id={`skin${i}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={s.a} />
            <Stop offset="1" stopColor={s.b} />
          </SvgGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="#FFF8EC" />
      {Array.from({ length: 100 }, (_, i) => {
        const sq = i + 1;
        const { row, col } = snlCell(sq);
        const dark = (row + col) % 2 === 0;
        return (
          <G key={sq}>
            <Rect x={col * cell} y={row * cell} width={cell} height={cell} fill={dark ? '#F6E3C6' : '#FFF8EC'} />
            <SvgText x={col * cell + cell * 0.08} y={row * cell + cell * 0.28} fontSize={cell * 0.22} fontWeight="600" fill="#A47B52">
              {sq}
            </SvgText>
          </G>
        );
      })}
      {Array.from({ length: 11 }, (_, i) => (
        <G key={`g${i}`}>
          <Line x1={i * cell} y1={0} x2={i * cell} y2={size} stroke="#E2C9A6" strokeWidth={0.8} />
          <Line x1={0} y1={i * cell} x2={size} y2={i * cell} stroke="#E2C9A6" strokeWidth={0.8} />
        </G>
      ))}
      {/* Start and finish */}
      <Rect x={0} y={0} width={cell} height={cell} fill="#FDE68A" />
      <SvgText x={cell / 2} y={cell * 0.7} fontSize={cell * 0.46} textAnchor="middle">
        👑
      </SvgText>
      {Object.entries(board.ladders).map(([f, to]) => (
        <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
      ))}
      {Object.entries(board.snakes).map(([h, tl], i) => (
        <SnakeArt key={`s${h}`} head={c(Number(h))} tail={c(tl)} cell={cell} skin={SKINS[i % SKINS.length]} id={`skin${i % SKINS.length}`} />
      ))}
    </Svg>
  );
}, (a, b) => a.size === b.size && JSON.stringify(a.board) === JSON.stringify(b.board));

/**
 * Snakes & Ladders: the board, every player's token (walking square by square after the die
 * lands, then climbing or sliding), whose turn it is, chances left, and Roll on my turn.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.min(width - spacing.lg * 2 - 14, 420);
  const cell = size / 10;
  const tokenSize = cell * 0.56;
  const order = s.order ?? state.players.map((p) => p.userId);
  const pos = s.pos ?? {};
  const board = (s as { board?: BoardMap }).board ?? CLASSIC;
  const turnPlayer = state.players.find((p) => p.userId === s.turn);
  const colorOf = (uid?: string) => TOKEN_COLORS[Math.max(0, order.indexOf(uid ?? '')) % TOKEN_COLORS.length];
  const isMyTurn = s.turn === state.me.userId;
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;

  /** Centre of a square, nudged only when other tokens share it. */
  const xyOf = (uid: string, sq: number) => {
    const square = Math.max(1, sq);
    const sharers = order.filter((u) => Math.max(1, pos[u] ?? 0) === square && (pos[u] ?? 0) > 0);
    const k = sharers.indexOf(uid);
    const [ox, oy] = sharers.length > 1 && k >= 0 ? SHARE[k % SHARE.length] : [0, 0];
    const { row, col } = snlCell(square);
    return { x: col * cell + cell / 2 + ox * cell - tokenSize / 2, y: row * cell + cell / 2 + oy * cell - tokenSize / 2 };
  };
  const centreOf = (sq: number) => {
    const { row, col } = snlCell(Math.max(1, sq));
    return { x: col * cell + cell / 2 - tokenSize / 2, y: row * cell + cell / 2 - tokenSize / 2 };
  };

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const hops = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(s.last?.at);
  const [moving, setMoving] = useState<string | null>(null);
  for (const uid of order) {
    if (!anims.current[uid]) anims.current[uid] = new Animated.ValueXY(xyOf(uid, pos[uid] ?? 0));
    if (!hops.current[uid]) hops.current[uid] = new Animated.Value(0);
  }

  const last = s.last;
  useEffect(() => {
    const isNew = last && last.at !== seenAt.current;
    for (const uid of order) {
      if (isNew && uid === last!.userId) continue;
      Animated.spring(anims.current[uid], { toValue: xyOf(uid, pos[uid] ?? 0), friction: 8, useNativeDriver: false }).start();
    }
    if (!isNew || !last) return;
    seenAt.current = last.at;
    const uid = last.userId;
    const a = anims.current[uid];
    const hop = hops.current[uid];
    if (!a) return;
    const steps = snlSteps(last.from, last.mid ?? last.to);
    if (last.from === 0 && steps.length) a.setValue(centreOf(1));
    const seq: Animated.CompositeAnimation[] = [Animated.delay(1250)];
    // Each square: move to its centre with a little hop.
    for (const sq of steps) {
      seq.push(
        Animated.parallel([
          Animated.timing(a, { toValue: centreOf(sq), duration: 200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(hop, { toValue: 0, duration: 100, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          ]),
        ]),
      );
    }
    if (last.to !== (last.mid ?? last.to)) {
      seq.push(Animated.delay(260));
      seq.push(Animated.timing(a, { toValue: centreOf(last.to), duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    }
    seq.push(Animated.spring(a, { toValue: xyOf(uid, last.to), friction: 7, useNativeDriver: false }));
    setMoving(uid);
    Animated.sequence(seq).start(() => setMoving(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pos)]);

  const lastMover = state.players.find((p) => p.userId === last?.userId);
  const message = useMemo(() => {
    if (!last) return t('party.snakes.start');
    const name = last.userId === state.me.userId ? t('party.you') : lastMover?.name ?? '';
    if (last.to > (last.mid ?? last.to)) return t('party.snakes.climbed', { name, to: last.to });
    if (last.to < (last.mid ?? last.to)) return t('party.snakes.bitten', { name, to: last.to });
    if (last.mid === last.from) return t('party.snakes.tooHigh', { name });
    return t('party.snakes.moved', { name, roll: last.roll, to: last.to });
  }, [last, lastMover, state.me.userId, t]);

  return (
    <View>
      <GoldFrame radius={20} width={2} colors={['#3E2723', '#5D4037', '#3E2723']} innerStyle={{ padding: 7, alignItems: 'center' }}>
        <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden' }}>
          <BoardArt size={size} board={board} />
          <DiceDrop value={last?.roll ?? 1} rollKey={last?.at} size={cell * 1.9} />
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
                      { translateY: hops.current[uid].interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 0.35] }) },
                      { scale: hops.current[uid].interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                    ],
                  },
                ]}
              >
                <Token color={c.hex} dark={c.dark} size={tokenSize} glow={uid === s.turn} />
              </Animated.View>
            );
          })}
        </View>
      </GoldFrame>

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
        canAct={isMyTurn && g.phase === 'turn' && !moving}
        busy={busy}
        onAct={onRoll}
        actionArt={<Dice value={5} rollKey={undefined} size={38} />}
        waitingLabel={isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      >
        <Dice value={last?.roll ?? 1} rollKey={undefined} size={48} />
      </TurnBar>

      <Row style={styles.pills}>
        {order.map((uid) => {
          const p = state.players.find((x) => x.userId === uid);
          if (!p) return null;
          return (
            <PlayerPill
              key={uid}
              player={p}
              color={colorOf(uid)}
              value={outOf(uid) ? t('party.board.out') : String(pos[uid] ?? 0)}
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

const styles = StyleSheet.create({
  token: { position: 'absolute', left: 0, top: 0 },
  pills: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: spacing.md },
});
