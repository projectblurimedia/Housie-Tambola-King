import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import { CHAMMA_COLORS, CHAMMA_HOME, chammaCell, chammaSteps, chammaTarget } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Chances, Token, TurnBar } from './BoardBits';
import { SeedsArt, SeedTray } from './ChammaSeeds';
import { GOLD_EDGE } from './Premium';

/** Spots inside a square when pawns share it (a lone pawn sits in the middle). */
const SPOTS: [number, number][] = [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [0, 0], [0, -0.26], [0, 0.26], [-0.26, 0]];
const INNER = new Set([6, 7, 8, 11, 13, 16, 17, 18]);
const EXTRA_SAFE = { corners: [6, 8, 16, 18], straight: [7, 11, 13, 17] } as const;
/** Name tag gutter around the board (names sit outside each side's start square). */
const GUTTER = 22;

/** Turn the board a quarter `turns` times: (r, c) → (4 − c, r). */
function rotateCell(cell: number, turns: number) {
  let c = cell;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) c = (4 - (c % 5)) * 5 + Math.floor(c / 5);
  return c;
}

/**
 * The board, drawn so MY side is at the bottom: a dark walnut floor, the outer and inner rings
 * in two tones, chalk crosses on the safe squares (start squares in their side's colour, inner
 * safe squares in gold — no coloured squares), each colour's arrow into the inner ring, and a
 * glowing flower in the centre.
 */
const BoardArt = React.memo(function BoardArt({
  size,
  sidesInUse,
  safe,
  view,
}: {
  size: number;
  sidesInUse: number[];
  safe: 'corners' | 'straight';
  /** Quarter turns that bring my side to the bottom. */
  view: number;
}) {
  const cell = size / 5;
  const chalk = 'rgba(255,248,230,0.92)';
  const at = (cellNo: number) => rotateCell(cellNo, view);
  const cross = (cellNo: number, color: string, width = 2.6) => {
    const x = (cellNo % 5) * cell;
    const y = Math.floor(cellNo / 5) * cell;
    const p = cell * 0.2;
    return (
      <G key={`x${cellNo}`}>
        <Line x1={x + p} y1={y + p} x2={x + cell - p} y2={y + cell - p} stroke={color} strokeWidth={width} strokeLinecap="round" />
        <Line x1={x + cell - p} y1={y + p} x2={x + p} y2={y + cell - p} stroke={color} strokeWidth={width} strokeLinecap="round" />
      </G>
    );
  };
  const mid = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="home" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FDE68A" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FDE68A" stopOpacity="0.05" />
        </RadialGradient>
      </Defs>
      {Array.from({ length: 25 }, (_, i) => (
        <Rect
          key={i}
          x={(i % 5) * cell + 1.5}
          y={Math.floor(i / 5) * cell + 1.5}
          width={cell - 3}
          height={cell - 3}
          rx={6}
          fill={i === 12 ? 'url(#home)' : INNER.has(i) ? '#4A3426' : '#33241B'}
        />
      ))}
      {[0, 1, 2, 3].map((side) => cross(at(chammaCell(side, 0)), sidesInUse.includes(side) ? CHAMMA_COLORS[side].hex : chalk, 3))}
      {EXTRA_SAFE[safe].map((c) => cross(at(c), '#FDE68A', 2.4))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const r = cell * 0.38;
        return (
          <Path
            key={i}
            d={`M${mid} ${mid} Q${mid + Math.cos(a - 0.45) * r * 0.8} ${mid + Math.sin(a - 0.45) * r * 0.8} ${mid + Math.cos(a) * r} ${mid + Math.sin(a) * r} Q${mid + Math.cos(a + 0.45) * r * 0.8} ${mid + Math.sin(a + 0.45) * r * 0.8} ${mid} ${mid}`}
            stroke="#FDE68A"
            strokeWidth={1.6}
            fill="rgba(253,230,138,0.15)"
          />
        );
      })}
      <Circle cx={mid} cy={mid} r={cell * 0.07} fill="#FDE68A" />
      {sidesInUse.map((side) => {
        const from = at(chammaCell(side, 15));
        const to = at(chammaCell(side, 16));
        const ax = (from % 5) * cell + cell / 2;
        const ay = Math.floor(from / 5) * cell + cell / 2;
        const bx = (to % 5) * cell + cell / 2;
        const by = Math.floor(to / 5) * cell + cell / 2;
        const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
        const len = Math.hypot(bx - ax, by - ay);
        return (
          <G key={`in${side}`} transform={`translate(${ax} ${ay}) rotate(${angle})`} opacity={0.92}>
            <Path d={`M${len * 0.14} 0 L${len * 0.62} 0`} stroke="#000" strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
            <Path d={`M${len * 0.14} 0 L${len * 0.62} 0`} stroke={CHAMMA_COLORS[side].hex} strokeWidth={4} strokeLinecap="round" />
            <Path d={`M${len * 0.6} ${-cell * 0.13} L${len * 0.84} 0 L${len * 0.6} ${cell * 0.13} Z`} fill={CHAMMA_COLORS[side].hex} stroke="#000" strokeOpacity={0.3} strokeWidth={1} />
          </G>
        );
      })}
    </Svg>
  );
});

/**
 * Ashta Chamma: a big board turned so my side is always at the bottom, each player's name just
 * outside their start square, pawns walking square by square (a tap sound each, a knock on a
 * cut, a chime at home), the seed tray underneath (the only place throws show), and a turn bar
 * that never changes height. On my turn: Throw, then tap a glowing pawn.
 */
export function ChammaBoard({
  state,
  seconds,
  busy,
  onThrow,
  onMove,
}: {
  state: PartyState;
  seconds: number;
  busy: boolean;
  onThrow: () => void;
  onMove: (pawn: number) => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.min(width - 16 - GUTTER * 2, 480);
  const cell = size / 5;
  const pawnSize = cell * 0.4;
  const order = s.order ?? [];
  const sides = s.sides ?? {};
  const pawns = s.pawns ?? {};
  const cut = s.cut ?? {};
  const teams = !!s.teams;
  const me = state.me.userId;
  const mySide = sides[me] ?? 0;
  const view = (4 - mySide) % 4;
  const isMyTurn = s.turn === me;
  const turnPlayer = state.players.find((p) => p.userId === s.turn);
  const colorOf = (uid?: string) => CHAMMA_COLORS[(sides[uid ?? ''] ?? 0) % 4];
  const throwValue = s.throw ?? null;
  const canMove = isMyTurn && g.phase === 'move' && throwValue !== null;
  const myPawns = pawns[me] ?? [];
  const myCut = !!cut[me] || s.needCut === false;
  const legal = canMove ? myPawns.map((p) => chammaTarget(p, throwValue!, myCut) !== null) : [false, false, false, false];
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;
  const nameOf = (uid: string) => (uid === me ? t('party.you') : state.players.find((p) => p.userId === uid)?.name ?? '');

  // Screen cell of a pawn (board turned so my side is at the bottom).
  const cellOf = (uid: string, idx: number) => rotateCell(chammaCell(sides[uid] ?? 0, idx), view);
  const occupancy: Record<number, string[]> = {};
  for (const uid of order) {
    if (outOf(uid)) continue;
    (pawns[uid] ?? []).forEach((idx, k) => {
      if (idx < 0) return;
      (occupancy[cellOf(uid, idx)] ??= []).push(`${uid}:${k}`);
    });
  }
  const targets: Record<string, { x: number; y: number }> = {};
  for (const [cellNo, keys] of Object.entries(occupancy)) {
    const n = Number(cellNo);
    keys.forEach((key, i) => {
      const [ox, oy] = keys.length > 1 ? SPOTS[i % SPOTS.length] : [0, 0];
      targets[key] = { x: (n % 5) * cell + cell / 2 + ox * cell - pawnSize / 2, y: Math.floor(n / 5) * cell + cell / 2 + oy * cell - pawnSize / 2 };
    });
  }
  const cellXY = (uid: string, idx: number) => {
    const n = cellOf(uid, idx);
    return { x: (n % 5) * cell + cell / 2 - pawnSize / 2, y: Math.floor(n / 5) * cell + cell / 2 - pawnSize / 2 };
  };

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const hops = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(s.last?.at);
  for (const [key, xy] of Object.entries(targets)) {
    if (!anims.current[key]) anims.current[key] = new Animated.ValueXY(xy);
    if (!hops.current[key]) hops.current[key] = new Animated.Value(0);
  }

  // Seeds sound for every throw (anyone's).
  const thrownSeen = useRef(s.thrownAt);
  useEffect(() => {
    if (s.thrownAt && s.thrownAt !== thrownSeen.current) playGameSound('seeds');
    thrownSeen.current = s.thrownAt;
  }, [s.thrownAt]);

  const last = s.last;
  useEffect(() => {
    const isNew = last && last.at !== seenAt.current && last.pawn !== undefined;
    const movingKey = isNew ? `${last!.userId}:${last!.pawn}` : null;
    for (const [key, xy] of Object.entries(targets)) {
      if (key === movingKey) continue;
      Animated.spring(anims.current[key], { toValue: xy, friction: 8, useNativeDriver: false }).start();
    }
    if (!isNew || !last || !movingKey) return;
    seenAt.current = last.at;
    const a = anims.current[movingKey];
    const hop = hops.current[movingKey];
    if (!a || !hop) return;
    const wrapped = last.from >= 0 && last.to < last.from;
    const steps = chammaSteps(last.from, last.to, !wrapped);
    if (last.from < 0) a.setValue(cellXY(last.userId, 0));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const STEP = 220;
    steps.forEach((_, i) => timers.push(setTimeout(() => playGameSound('move'), 650 + i * STEP + STEP - 40)));
    const endAt = 650 + steps.length * STEP;
    if (last.captured?.length) timers.push(setTimeout(() => playGameSound('cut'), endAt));
    else if (last.to === CHAMMA_HOME) timers.push(setTimeout(() => playGameSound('home'), endAt));
    Animated.sequence([
      Animated.delay(650),
      ...steps.slice(0, -1).map((idx) =>
        Animated.parallel([
          Animated.timing(a, { toValue: cellXY(last.userId, idx), duration: STEP, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: STEP / 2, useNativeDriver: false }),
            Animated.timing(hop, { toValue: 0, duration: STEP / 2, useNativeDriver: false }),
          ]),
        ]),
      ),
      Animated.timing(a, { toValue: targets[movingKey] ?? cellXY(last.userId, last.to), duration: 260, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
    ]).start();
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pawns), size, view]);

  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canMove) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canMove, glow]);

  const sidesInUse = order.map((u) => sides[u] ?? 0);
  const firstWaiting = myPawns.findIndex((p) => p === -1);
  const thrower = s.thrownBy ? state.players.find((p) => p.userId === s.thrownBy) : undefined;
  const lastValue = s.thrownAt ? (s.seeds ?? []).filter(Boolean).length || 8 : null;

  // Name tags outside each player's start square (bottom / right / top / left on screen).
  const tagFor = (uid: string) => {
    const startCell = rotateCell(chammaCell(sides[uid] ?? 0, 0), view);
    const r = Math.floor(startCell / 5);
    return r === 4 ? 'bottom' : r === 0 ? 'top' : startCell % 5 === 0 ? 'left' : 'right';
  };

  return (
    <View>
      <View style={[styles.boardWrap, { width: size + GUTTER * 2 + 8, height: size + GUTTER * 2 + 8, marginHorizontal: -(spacing.lg - 8) }]}>
        {order.map((uid) => {
          const where = tagFor(uid);
          const c = colorOf(uid);
          const label = (
            <View style={[styles.tag, { backgroundColor: c.dark, borderColor: c.hex }, uid === s.turn && styles.tagTurn]}>
              <T style={styles.tagText} numberOfLines={1} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {nameOf(uid)}
              </T>
            </View>
          );
          const common = { position: 'absolute' as const, alignItems: 'center' as const, justifyContent: 'center' as const };
          return where === 'bottom' ? (
            <View key={uid} style={[common, { left: 0, right: 0, bottom: 0, height: GUTTER }]}>
              {label}
            </View>
          ) : where === 'top' ? (
            <View key={uid} style={[common, { left: 0, right: 0, top: 0, height: GUTTER }]}>
              {label}
            </View>
          ) : (
            <View key={uid} style={[common, { top: 0, bottom: 0, width: GUTTER, [where]: 0 }]}>
              <View style={{ width: size, alignItems: 'center', transform: [{ rotate: where === 'left' ? '-90deg' : '90deg' }] }}>{label}</View>
            </View>
          );
        })}
        <View style={[styles.board, { width: size + 8, height: size + 8 }]}>
          <View style={{ width: size, height: size }}>
            <BoardArt size={size} sidesInUse={sidesInUse} safe={s.safe ?? 'corners'} view={view} />
            {Object.keys(targets).map((key) => {
              const [uid, k] = key.split(':');
              const c = colorOf(uid);
              const idx = (pawns[uid] ?? [])[Number(k)];
              const movable = uid === me && legal[Number(k)] && idx >= 0;
              return (
                <Animated.View
                  key={key}
                  style={[
                    styles.pawn,
                    {
                      transform: [
                        ...(anims.current[key]?.getTranslateTransform() ?? []),
                        { translateY: hops.current[key]?.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 0.25] }) ?? 0 },
                      ],
                    },
                  ]}
                >
                  <Pressable onPress={() => movable && onMove(Number(k))} disabled={!movable || busy} hitSlop={8}>
                    {movable ? (
                      <Animated.View
                        style={[
                          styles.halo,
                          {
                            width: pawnSize + 14,
                            height: pawnSize + 14,
                            borderRadius: pawnSize,
                            left: -7,
                            top: -7,
                            opacity: glow,
                            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
                          },
                        ]}
                      />
                    ) : null}
                    <Token color={c.hex} dark={c.dark} size={pawnSize} glow={idx === CHAMMA_HOME} />
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </View>

      {/* The throw — only here, under the board (fixed height). */}
      <SeedTray
        seeds={s.seeds ?? [true, false, true, false]}
        throwKey={s.thrownAt}
        value={lastValue}
        name={thrower ? nameOf(thrower.userId) : t('party.chamma.noThrowYet')}
        avatar={<Avatar avatarKey={thrower?.avatarKey ?? turnPlayer?.avatarKey ?? 'a1'} size={24} />}
      />

      <TurnBar
        player={turnPlayer}
        color={colorOf(s.turn)}
        isMe={isMyTurn}
        seconds={seconds}
        actionLabel={t('party.chamma.throw')}
        actionIcon="hand-right"
        canAct={isMyTurn && g.phase === 'throw'}
        busy={busy}
        onAct={onThrow}
        actionArt={<SeedsArt />}
        waitingLabel={canMove ? t('party.chamma.tapPawn', { count: seconds }) : isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      />

      {/* Players: colour, team, waiting pawns (tap one to bring it in on 4 / 8), pawns home, cut, chances */}
      <View style={styles.panels}>
        {order.map((uid) => {
          const p = state.players.find((x) => x.userId === uid);
          if (!p) return null;
          const c = colorOf(uid);
          const pw = pawns[uid] ?? [];
          const waiting = pw.filter((x) => x === -1).length;
          const home = pw.filter((x) => x === CHAMMA_HOME).length;
          const canEnter = uid === me && firstWaiting >= 0 && legal[firstWaiting];
          const out = outOf(uid);
          return (
            <LinearGradient key={uid} colors={uid === s.turn ? GOLD_EDGE : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)']} style={[styles.panelEdge, out && { opacity: 0.45 }]}>
              <View style={[styles.panel, { borderLeftColor: c.hex }]}>
                <Row gap={6}>
                  <Avatar avatarKey={p.avatarKey} size={26} />
                  <View style={{ flex: 1 }}>
                    <T variant="tiny" color="#fff" numberOfLines={1} style={{ fontFamily: fonts.semibold }} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                      {nameOf(uid)}
                    </T>
                    {teams ? (
                      <T variant="tiny" color={(sides[uid] ?? 0) % 2 ? '#93C5FD' : '#FCA5A5'} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                        {t((sides[uid] ?? 0) % 2 ? 'party.chamma.teamB' : 'party.chamma.teamA')}
                      </T>
                    ) : null}
                  </View>
                  {cut[uid] ? (
                    <T style={styles.cutBadge} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                      ⚔️
                    </T>
                  ) : null}
                </Row>
                <Pressable onPress={() => canEnter && onMove(firstWaiting)} disabled={!canEnter || busy}>
                  <Row gap={4} style={{ marginTop: 6 }}>
                    {Array.from({ length: waiting }, (_, i) => (
                      <Animated.View
                        key={i}
                        style={
                          canEnter && i === 0
                            ? { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }
                            : { opacity: 0.85 }
                        }
                      >
                        <Token color={c.hex} dark={c.dark} size={16} />
                      </Animated.View>
                    ))}
                    <View style={{ flex: 1 }} />
                    {out ? (
                      <T variant="tiny" color="#FCA5A5">
                        {t('party.board.out')}
                      </T>
                    ) : (
                      <Chances misses={s.misses?.[uid] ?? 0} />
                    )}
                    <T variant="tiny" color="#FDE68A" maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                      {' '}🏠 {home}/4
                    </T>
                  </Row>
                </Pressable>
              </View>
            </LinearGradient>
          );
        })}
      </View>
      <T variant="tiny" muted center style={{ marginTop: spacing.sm }}>
        {s.needCut === false ? t('party.chamma.noCutNeeded') : myCut ? t('party.chamma.innerOpen') : t('party.chamma.needCut')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  board: { padding: 4, borderRadius: 14, backgroundColor: '#1C120C', borderWidth: 2, borderColor: '#F5D06F', alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 10, height: 18, borderRadius: 9, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  tagTurn: { borderColor: '#FDE68A', borderWidth: 2 },
  tagText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  pawn: { position: 'absolute', left: 0, top: 0 },
  halo: { position: 'absolute', backgroundColor: 'rgba(253,230,138,0.6)' },
  panels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: spacing.md },
  panelEdge: { width: '48.5%', borderRadius: 14, padding: 1.2 },
  panel: { borderRadius: 13, padding: 8, backgroundColor: '#1A1030', borderLeftWidth: 4 },
  cutBadge: { fontSize: 12, lineHeight: 16 },
});
