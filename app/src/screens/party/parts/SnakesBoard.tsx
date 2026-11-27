import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import { LADDERS, type Pt, shareLayout, SNAKES, snakeCurve, snlCell, snlCentre, snlSteps, type SnlBoard } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Chances, Pawn, PlayerPill, TOKEN_COLORS, TurnBar } from './BoardBits';
import { Cube, RollingDie } from './RollingDie';

/** Classic bright squares (face, edge). */
const TILES: [string, string][] = [
  ['#EF5350', '#C62828'],
  ['#FFCA28', '#F9A825'],
  ['#66BB6A', '#2E7D32'],
  ['#42A5F5', '#1565C0'],
];
/** Cartoon snake skins: body, stripes / outline, the light stripe, the belly. */
const SKINS = [
  { base: '#7CB342', band: '#33691E', light: '#C5E1A5', belly: '#F1F8E9' },
  { base: '#FB8C00', band: '#BF360C', light: '#FFCC80', belly: '#FFF3E0' },
  { base: '#8E24AA', band: '#4A148C', light: '#CE93D8', belly: '#F3E5F5' },
  { base: '#E53935', band: '#8E0000', light: '#EF9A9A', belly: '#FFEBEE' },
  { base: '#00ACC1', band: '#006064', light: '#80DEEA', belly: '#E0F7FA' },
];
const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);

/**
 * A cartoon snake (classic game style): a chunky striped body along a natural wave, tapering to
 * the tail, a light stripe down the back, on a soft shadow — and a round, friendly head that
 * sits upright inside its own square, tongue and all.
 */
function SnakeArt({ head, tail, cell, skin }: { head: Pt; tail: Pt; cell: number; skin: (typeof SKINS)[number] }) {
  const { at } = snakeCurve(head, tail, cell);
  const W = cell * 0.48;
  const width = (t: number) => W * (t < 0.65 ? 1 : Math.max(0.05, 1 - (t - 0.65) / 0.35));
  const fr = (t: number) => {
    const p = at(t);
    const q = at(Math.min(1, t + 0.005));
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { p, ux: -(q.y - p.y) / l, uy: (q.x - p.x) / l };
  };
  const N = 54;
  const outline = (k: number) => {
    const L: string[] = [];
    const R: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = 0.08 + (i / N) * 0.919;
      const { p, ux, uy } = fr(t);
      const w = (width(t) / 2) * k;
      L.push(`${f1(p.x + ux * w)} ${f1(p.y + uy * w)}`);
      R.push(`${f1(p.x - ux * w)} ${f1(p.y - uy * w)}`);
    }
    return `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
  };
  const stripes: React.ReactNode[] = [];
  for (let i = 1; i < 16; i++) {
    const t = 0.12 + i * 0.055;
    if (t > 0.92) break;
    const { p, ux, uy } = fr(t);
    const w = (width(t) / 2) * 0.82;
    stripes.push(<Line key={i} x1={p.x + ux * w} y1={p.y + uy * w} x2={p.x - ux * w} y2={p.y - uy * w} stroke={skin.band} strokeWidth={W * 0.16} strokeLinecap="round" />);
  }
  const back: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = 0.1 + (i / N) * 0.75;
    const { p, ux, uy } = fr(t);
    const side = -ux - uy > 0 ? 1 : -1;
    const w = width(t) * 0.22 * side;
    back.push(`${f1(p.x + ux * w)} ${f1(p.y + uy * w)}`);
  }
  // Head: upright in its square (the tongue too).
  const hx = head.x;
  const hy = head.y + cell * 0.06;
  const rx = cell * 0.33;
  const ry = cell * 0.27;
  return (
    <G>
      <Path d={outline(1)} fill="rgba(0,0,0,0.25)" transform="translate(3 4)" />
      <Path d={outline(1)} fill={skin.band} />
      <Path d={outline(0.82)} fill={skin.base} />
      {stripes}
      <Path d={`M${back.join(' L')}`} stroke={skin.light} strokeOpacity={0.9} strokeWidth={W * 0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d={`M${hx} ${hy - ry * 0.9} l0 ${-cell * 0.1} l${-cell * 0.05} ${-cell * 0.05} M${hx} ${hy - ry * 0.9 - cell * 0.1} l${cell * 0.05} ${-cell * 0.05}`}
        stroke="#E11D48"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={hx + 2} cy={hy + 3} rx={rx} ry={ry} fill="rgba(0,0,0,0.25)" />
      <Ellipse cx={hx} cy={hy} rx={rx} ry={ry} fill={skin.band} />
      <Ellipse cx={hx} cy={hy - 1} rx={rx * 0.9} ry={ry * 0.86} fill={skin.base} />
      <Ellipse cx={hx - rx * 0.3} cy={hy - ry * 0.45} rx={rx * 0.35} ry={ry * 0.18} fill="#fff" opacity={0.35} />
      <Ellipse cx={hx} cy={hy + ry * 0.35} rx={rx * 0.55} ry={ry * 0.38} fill={skin.belly} opacity={0.9} />
      <Path d={`M${hx - rx * 0.3} ${hy + ry * 0.35} Q${hx} ${hy + ry * 0.62} ${hx + rx * 0.3} ${hy + ry * 0.35}`} stroke={skin.band} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {[-1, 1].map((k) => (
        <G key={k}>
          <Circle cx={hx + k * rx * 0.42} cy={hy - ry * 0.25} r={cell * 0.11} fill="#fff" stroke={skin.band} strokeWidth={1} />
          <Circle cx={hx + k * rx * 0.42 + 1} cy={hy - ry * 0.2} r={cell * 0.06} fill="#111" />
          <Circle cx={hx + k * rx * 0.42 - cell * 0.02} cy={hy - ry * 0.3} r={cell * 0.025} fill="#fff" />
          <Circle cx={hx + k * rx * 0.12} cy={hy + ry * 0.12} r={1} fill={skin.band} />
        </G>
      ))}
    </G>
  );
}

/** A chunky wooden ladder: thick rails with a light grain, sturdy rungs, a soft shadow. */
function LadderArt({ from, to, cell }: { from: Pt; to: Pt; cell: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const A = { x: from.x + ux * cell * 0.1, y: from.y + uy * cell * 0.1 };
  const B = { x: to.x - ux * cell * 0.1, y: to.y - uy * cell * 0.1 };
  const px = -uy * cell * 0.24;
  const py = ux * cell * 0.24;
  const rungs = Math.max(2, Math.round((len - cell * 0.2) / (cell * 0.3)));
  const rail = (k: number) => ({ x1: A.x + k * px, y1: A.y + k * py, x2: B.x + k * px, y2: B.y + k * py });
  return (
    <G>
      {[1, -1].map((k) => (
        <Line key={`s${k}`} {...rail(k)} stroke="rgba(0,0,0,0.25)" strokeWidth={7} strokeLinecap="round" transform="translate(3 4)" />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        return (
          <G key={i}>
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#5D3A1A" strokeWidth={5.5} strokeLinecap="round" />
            <Line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#C8894A" strokeWidth={3} strokeLinecap="round" />
          </G>
        );
      })}
      {[1, -1].map((k) => (
        <G key={`r${k}`}>
          <Line {...rail(k)} stroke="#5D3A1A" strokeWidth={7.5} strokeLinecap="round" />
          <Line {...rail(k)} stroke="#B8763A" strokeWidth={5} strokeLinecap="round" />
          <Line {...rail(k)} stroke="#F0C48A" strokeWidth={1.6} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/** The board: bright rounded squares with bold white numbers, wooden ladders, cartoon snakes. */
export const BoardArt = React.memo(
  function BoardArt({ size, board, numbers = true }: { size: number; board: SnlBoard; numbers?: boolean; idPrefix?: string }) {
    const cell = size / 10;
    const c = (sq: number) => snlCentre(sq, size);
    return (
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFF8E7" />
        {Array.from({ length: 100 }, (_, i) => {
          const sq = i + 1;
          const { row, col } = snlCell(sq);
          const [face, edge] = sq === 100 ? ['#FFD54F', '#F9A825'] : TILES[(row + col * 3) % 4];
          return (
            <G key={sq}>
              <Rect x={col * cell + 1.5} y={row * cell + 1.5} width={cell - 3} height={cell - 3} rx={4} fill={edge} />
              <Rect x={col * cell + 1.5} y={row * cell + 1.5} width={cell - 3} height={cell - 5} rx={4} fill={face} />
              <Rect x={col * cell + 3} y={row * cell + 3} width={cell - 6} height={cell * 0.35} rx={3} fill="#fff" opacity={0.22} />
              {numbers ? (
                <SvgText
                  x={col * cell + cell / 2}
                  y={row * cell + cell * 0.62}
                  fontSize={cell * 0.34}
                  fontWeight="900"
                  fill="#fff"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={0.8}
                  textAnchor="middle"
                  opacity={0.92}
                >
                  {sq === 100 ? '👑' : sq}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} head={c(Number(h))} tail={c(tl)} cell={cell} skin={SKINS[i % SKINS.length]} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && JSON.stringify(a.board) === JSON.stringify(b.board),
);

const STEP_MS = 230;

/**
 * Snakes & Ladders. Everyone starts off the board (a 1 brings you onto square 1). Tap Roll: the
 * die rolls in the tray under the board and lands; your pawn hops square by square (a pop each),
 * climbs a ladder or slides down along the snake's body, with matching sounds. Up to 10 pawns
 * share a square, smaller the more there are. The tray, start row and turn bar keep a fixed
 * height, so nothing on the screen jumps while the game moves.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  // Big board: almost the full width (the screen's side padding is pulled back below).
  const size = Math.min(width - 16, 560);
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

  const [rolling, setRolling] = useState(false);
  useEffect(() => setRolling(false), [last?.at]);
  useEffect(() => {
    if (!rolling) return;
    const t1 = setTimeout(() => setRolling(false), 6000);
    return () => clearTimeout(t1);
  }, [rolling]);
  const roll = () => {
    setRolling(true);
    playGameSound('dice');
    onRoll();
  };

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
    // Start after the die has rolled and landed in the tray.
    const seq: Animated.CompositeAnimation[] = [Animated.delay(1050)];
    let t0 = 1050;
    if (last.from === 0 && steps.length) a.setValue(at({ x: snlCentre(1, size).x - cell, y: snlCentre(1, size).y + cell * 0.6 }));
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
      sound('step', t0 + STEP_MS - 40);
      t0 += STEP_MS;
    }
    if (last.to > mid) {
      seq.push(Animated.delay(200));
      sound('ladder', t0 + 200);
      seq.push(Animated.timing(a, { toValue: at(snlCentre(last.to, size)), duration: 1000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    } else if (last.to < mid) {
      seq.push(Animated.delay(200));
      sound('snake', t0 + 200);
      const curve = snakeCurve(snlCentre(mid, size), snlCentre(last.to, size), cell);
      const N = 22;
      for (let i = 1; i <= N; i++) {
        seq.push(Animated.timing(a, { toValue: at(curve.at(i / N)), duration: 1300 / N, easing: Easing.linear, useNativeDriver: false }));
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
      <View style={[styles.boardWrap, { width: size + 8, marginHorizontal: -(spacing.lg - 4) }]}>
        <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
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
        </View>
      </View>

      {/* Start row (fixed height): pawns still waiting for a 1 */}
      <View style={styles.startArea}>
        {waiting.length ? (
          <>
            <T variant="tiny" muted style={{ marginRight: 6 }} numberOfLines={1}>
              {t('party.snakes.startArea')}
            </T>
            <Row gap={4} style={{ flex: 1 }}>
              {waiting.slice(0, 10).map((u) => (
                <Pawn key={u} color={colorOf(u).hex} dark={colorOf(u).dark} size={16} />
              ))}
            </Row>
          </>
        ) : (
          <T variant="tiny" muted numberOfLines={1}>
            {t('party.snakes.allIn')}
          </T>
        )}
      </View>

      {/* Dice tray (fixed height): who rolled, what happened, the rolling die */}
      <View style={styles.tray}>
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={6}>
            <Avatar avatarKey={lastMover?.avatarKey ?? turnPlayer?.avatarKey ?? 'a1'} size={24} />
            <T variant="smallBold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
              {last ? (last.userId === state.me.userId ? t('party.you') : lastMover?.name ?? '') : t('party.snakes.firstRoll')}
            </T>
          </Row>
          <T variant="tiny" color="rgba(255,255,255,0.85)" numberOfLines={2} style={styles.trayMsg}>
            {message}
          </T>
        </View>
        <RollingDie value={last?.roll ?? 1} rollKey={last?.at} rolling={rolling} size={46} />
      </View>

      <TurnBar
        player={turnPlayer}
        color={colorOf(s.turn)}
        isMe={isMyTurn}
        seconds={seconds}
        actionLabel={t('party.snakes.roll')}
        actionIcon="dice"
        actionArt={<Cube top={5} size={40} />}
        canAct={isMyTurn && g.phase === 'turn' && !moving && !rolling}
        busy={busy}
        onAct={roll}
        waitingLabel={isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      />

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
      <BoardArt size={size} board={board} numbers={false} />
      <View style={styles.thumbNum}>
        <T style={styles.thumbNumText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {index + 1}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: { alignSelf: 'center', padding: 4, borderRadius: 12, backgroundColor: '#5D4037', borderWidth: 2, borderColor: '#F5D06F' },
  token: { position: 'absolute', left: 0, top: 0 },
  pills: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: spacing.md },
  startArea: { height: 34, flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
  tray: { height: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingLeft: 14, paddingRight: 6, borderRadius: 18, backgroundColor: '#0B3B2E', borderWidth: 2, borderColor: 'rgba(245,208,111,0.5)' },
  trayMsg: { fontFamily: fonts.medium, minHeight: 30 },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
