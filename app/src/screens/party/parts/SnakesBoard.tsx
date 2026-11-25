import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Row, T } from '@/components/ui';
import { LADDERS, SNAKES, snlCell, snlSteps } from '@/game/engine/board';
import type { PartyState } from '@/services/partyService';
import { spacing } from '@/theme';
import { Dice, PlayerPill, Token, TOKEN_COLORS, TurnBar } from './BoardBits';
import { GoldFrame } from './Premium';

const CELL_COLORS = ['#FEF3C7', '#FFE4E6', '#DCFCE7', '#DBEAFE', '#F3E8FF'];
const SNAKE_COLORS: [string, string][] = [
  ['#22C55E', '#14532D'],
  ['#F97316', '#7C2D12'],
  ['#A855F7', '#4C1D95'],
  ['#EF4444', '#7F1D1D'],
  ['#0EA5E9', '#0C4A6E'],
];
/** Where each player's token sits inside a square, so several can share it. */
const OFFSETS: [number, number][] = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.26], [0, 0.26]];

/** The drawn board: squares, numbers, ladders (wood) and snakes (curvy, with heads). */
const BoardArt = React.memo(function BoardArt({ size }: { size: number }) {
  const cell = size / 10;
  const c = (sq: number) => {
    const { row, col } = snlCell(sq);
    return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
  };
  const squares = Array.from({ length: 100 }, (_, i) => i + 1);
  return (
    <Svg width={size} height={size}>
      <Defs>
        {SNAKE_COLORS.map(([a, b], i) => (
          <SvgGradient key={i} id={`sn${i}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </SvgGradient>
        ))}
      </Defs>
      {squares.map((sq) => {
        const { row, col } = snlCell(sq);
        return (
          <G key={sq}>
            <Rect x={col * cell} y={row * cell} width={cell} height={cell} fill={CELL_COLORS[(sq + row) % CELL_COLORS.length]} />
            <SvgText x={col * cell + 3} y={row * cell + cell * 0.3} fontSize={cell * 0.24} fontWeight="bold" fill="#7C5A3A">
              {sq}
            </SvgText>
          </G>
        );
      })}
      {/* 100 — the finish */}
      <Rect x={0} y={0} width={cell} height={cell} fill="#FDE68A" />
      <SvgText x={cell / 2} y={cell * 0.66} fontSize={cell * 0.42} textAnchor="middle">
        👑
      </SvgText>
      {/* Ladders */}
      {Object.entries(LADDERS).map(([from, to]) => {
        const A = c(Number(from));
        const B = c(Number(to));
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.hypot(dx, dy);
        const px = (-dy / len) * cell * 0.2;
        const py = (dx / len) * cell * 0.2;
        const rungs = Math.max(2, Math.floor(len / (cell * 0.38)));
        return (
          <G key={`l${from}`}>
            <Line x1={A.x + px + 2} y1={A.y + py + 2} x2={B.x + px + 2} y2={B.y + py + 2} stroke="rgba(0,0,0,0.25)" strokeWidth={4} />
            <Line x1={A.x - px + 2} y1={A.y - py + 2} x2={B.x - px + 2} y2={B.y - py + 2} stroke="rgba(0,0,0,0.25)" strokeWidth={4} />
            {Array.from({ length: rungs }, (_, i) => {
              const t = (i + 0.5) / rungs;
              const x = A.x + dx * t;
              const y = A.y + dy * t;
              return <Line key={i} x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#92400E" strokeWidth={3} strokeLinecap="round" />;
            })}
            <Line x1={A.x + px} y1={A.y + py} x2={B.x + px} y2={B.y + py} stroke="#7C2D12" strokeWidth={4.5} strokeLinecap="round" />
            <Line x1={A.x - px} y1={A.y - py} x2={B.x - px} y2={B.y - py} stroke="#7C2D12" strokeWidth={4.5} strokeLinecap="round" />
            <Line x1={A.x + px} y1={A.y + py} x2={B.x + px} y2={B.y + py} stroke="#F59E0B" strokeWidth={1.6} strokeLinecap="round" />
            <Line x1={A.x - px} y1={A.y - py} x2={B.x - px} y2={B.y - py} stroke="#F59E0B" strokeWidth={1.6} strokeLinecap="round" />
          </G>
        );
      })}
      {/* Snakes: head on the higher square, an S-curve down to the tail */}
      {Object.entries(SNAKES).map(([head, tail], i) => {
        const A = c(Number(head));
        const B = c(Number(tail));
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        const amp = Math.min(cell * 1.1, len * 0.3);
        const c1x = A.x + dx * 0.33 + nx * amp;
        const c1y = A.y + dy * 0.33 + ny * amp;
        const c2x = A.x + dx * 0.66 - nx * amp;
        const c2y = A.y + dy * 0.66 - ny * amp;
        const d = `M${A.x} ${A.y} C${c1x} ${c1y} ${c2x} ${c2y} ${B.x} ${B.y}`;
        const w = cell * 0.26;
        const angle = (Math.atan2(c1y - A.y, c1x - A.x) * 180) / Math.PI + 180;
        const col = i % SNAKE_COLORS.length;
        return (
          <G key={`s${head}`}>
            <Path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth={w + 4} fill="none" strokeLinecap="round" transform="translate(2 2)" />
            <Path d={d} stroke={SNAKE_COLORS[col][1]} strokeWidth={w + 3} fill="none" strokeLinecap="round" />
            <Path d={d} stroke={`url(#sn${col})`} strokeWidth={w} fill="none" strokeLinecap="round" />
            <Path d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={w * 0.32} strokeDasharray={`${w * 0.4},${w * 0.7}`} fill="none" strokeLinecap="round" />
            <G transform={`translate(${A.x} ${A.y}) rotate(${angle})`}>
              <Path d={`M${-cell * 0.3} 0 l${-cell * 0.12} ${-cell * 0.05} m${cell * 0.12} ${cell * 0.05} l${-cell * 0.12} ${cell * 0.05}`} stroke="#DC2626" strokeWidth={1.6} fill="none" />
              <Ellipse cx={0} cy={0} rx={cell * 0.26} ry={cell * 0.2} fill={SNAKE_COLORS[col][1]} />
              <Ellipse cx={-1} cy={0} rx={cell * 0.23} ry={cell * 0.17} fill={SNAKE_COLORS[col][0]} />
              <Circle cx={-cell * 0.08} cy={-cell * 0.08} r={cell * 0.06} fill="#fff" />
              <Circle cx={-cell * 0.08} cy={cell * 0.08} r={cell * 0.06} fill="#fff" />
              <Circle cx={-cell * 0.1} cy={-cell * 0.08} r={cell * 0.03} fill="#111" />
              <Circle cx={-cell * 0.1} cy={cell * 0.08} r={cell * 0.03} fill="#111" />
            </G>
          </G>
        );
      })}
    </Svg>
  );
});

/**
 * Snakes & Ladders: the board, every player's token (walking square by square after the die
 * lands, then climbing or sliding), whose turn it is, and the Roll button on my turn.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.min(width - spacing.lg * 2 - 12, 420);
  const cell = size / 10;
  const tokenSize = cell * 0.5;
  const order = s.order ?? state.players.map((p) => p.userId);
  const pos = s.pos ?? {};
  const turnPlayer = state.players.find((p) => p.userId === s.turn);
  const colorOf = (uid?: string) => TOKEN_COLORS[Math.max(0, order.indexOf(uid ?? '')) % TOKEN_COLORS.length];
  const isMyTurn = s.turn === state.me.userId;

  const xyOf = (uid: string, sq: number) => {
    const i = Math.max(0, order.indexOf(uid));
    const [ox, oy] = OFFSETS[i % OFFSETS.length];
    if (sq <= 0) {
      const { row, col } = snlCell(1);
      return { x: col * cell + cell / 2 + ox * cell - tokenSize / 2, y: row * cell + cell / 2 + oy * cell - tokenSize / 2 };
    }
    const { row, col } = snlCell(sq);
    return { x: col * cell + cell / 2 + ox * cell - tokenSize / 2, y: row * cell + cell / 2 + oy * cell - tokenSize / 2 };
  };

  // One animated position per player; the last move walks, everything else settles.
  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const shown = useRef<Record<string, number>>({});
  const seenAt = useRef<number | undefined>(s.last?.at);
  const [moving, setMoving] = useState(false);
  for (const uid of order) {
    if (!anims.current[uid]) {
      anims.current[uid] = new Animated.ValueXY(xyOf(uid, pos[uid] ?? 0));
      shown.current[uid] = pos[uid] ?? 0;
    }
  }

  const last = s.last;
  useEffect(() => {
    const isNew = last && last.at !== seenAt.current;
    for (const uid of order) {
      const target = pos[uid] ?? 0;
      if (isNew && uid === last!.userId) continue;
      if (shown.current[uid] !== target) {
        shown.current[uid] = target;
        Animated.spring(anims.current[uid], { toValue: xyOf(uid, target), friction: 8, useNativeDriver: false }).start();
      }
    }
    if (!isNew || !last) return;
    seenAt.current = last.at;
    const uid = last.userId;
    const a = anims.current[uid];
    if (!a) return;
    const steps = snlSteps(last.from, last.mid ?? last.to);
    const seq: Animated.CompositeAnimation[] = [Animated.delay(750)];
    if (last.from === 0 && steps.length) a.setValue(xyOf(uid, 0));
    for (const sq of steps) {
      seq.push(Animated.timing(a, { toValue: xyOf(uid, sq), duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: false }));
    }
    if (last.to !== (last.mid ?? last.to)) {
      seq.push(Animated.delay(200));
      seq.push(Animated.timing(a, { toValue: xyOf(uid, last.to), duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    }
    setMoving(true);
    Animated.sequence(seq).start(() => {
      shown.current[uid] = last.to;
      setMoving(false);
    });
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
      <GoldFrame radius={18} width={2.5} colors={['#5C3A1A', '#8B5A2B', '#5C3A1A']} innerStyle={{ padding: 6, alignItems: 'center' }}>
        <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
          <BoardArt size={size} />
          {order.map((uid) => {
            const c = colorOf(uid);
            const on = (pos[uid] ?? 0) > 0 || (moving && last?.userId === uid);
            return (
              <Animated.View
                key={uid}
                pointerEvents="none"
                style={[styles.token, { opacity: on ? 1 : 0, transform: anims.current[uid].getTranslateTransform() }]}
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
        waitingLabel={isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      >
        <Dice value={last?.roll ?? 1} rollKey={last?.at} size={58} />
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
              value={String(pos[uid] ?? 0)}
              active={uid === s.turn}
              me={uid === state.me.userId}
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
