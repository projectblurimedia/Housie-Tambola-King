import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { T } from '@/components/ui';
import { CHAMMA_COLORS, CHAMMA_HOME, chammaCell, chammaSteps, chammaTarget } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { spacing } from '@/theme';
import { Token } from './BoardBits';
import { GameDock, type DockPlayer } from './GameDock';
import { SeedPad } from './ChammaSeeds';

/** Spots inside a square when pawns share it (a lone pawn sits in the middle). */
const SPOTS: [number, number][] = [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [0, 0], [0, -0.26], [0, 0.26], [-0.26, 0]];
const EXTRA_SAFE = { corners: [6, 8, 16, 18], straight: [7, 11, 13, 17] } as const;
const SQUARE = '#33241B';
const SAFE_SQUARE = '#5C4331';
const CHALK = '#F3E3C3';
/** Gutter around the board (the semicircles where waiting pawns sit), as a share of the board. */
const GUTTER = 0.14;
/** Frame (padding + border) around the drawn board. */
const FRAME = 6;
const STEP = 200;

/** Turn the board a quarter `turns` times: (r, c) → (4 − c, r). */
function rotateCell(cell: number, turns: number) {
  let c = cell;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) c = (4 - (c % 5)) * 5 + Math.floor(c / 5);
  return c;
}

/** Which edge of the screen a start square is on. */
function edgeOf(cell: number): 'bottom' | 'top' | 'left' | 'right' {
  const r = Math.floor(cell / 5);
  return r === 4 ? 'bottom' : r === 0 ? 'top' : cell % 5 === 0 ? 'left' : 'right';
}

/**
 * The board, drawn so MY side is at the bottom: all squares the same dark walnut, only the safe
 * squares a lighter wood, with chalk crosses drawn corner to corner — so the outer crosses run
 * on into the inner ones — each colour's arrow into the inner ring and a flower in the centre.
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
  view: number;
}) {
  const cell = size / 5;
  const at = (cellNo: number) => rotateCell(cellNo, view);
  const safeCells = new Set<number>([12, ...[0, 1, 2, 3].map((side) => at(chammaCell(side, 0))), ...EXTRA_SAFE[safe].map(at)]);
  const mid = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="home" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FDE68A" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FDE68A" stopOpacity="0.06" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="#1C120C" />
      {Array.from({ length: 25 }, (_, i) => (
        <Rect key={i} x={(i % 5) * cell + 1.5} y={Math.floor(i / 5) * cell + 1.5} width={cell - 3} height={cell - 3} rx={5} fill={safeCells.has(i) ? SAFE_SQUARE : SQUARE} />
      ))}
      <Rect x={2 * cell + 1.5} y={2 * cell + 1.5} width={cell - 3} height={cell - 3} rx={5} fill="url(#home)" />
      {/* Crosses corner to corner: they meet the next safe square's cross at the corners. */}
      {[...safeCells].map((n) => {
        const x = (n % 5) * cell;
        const y = Math.floor(n / 5) * cell;
        return (
          <G key={`x${n}`}>
            <Line x1={x + 1} y1={y + 1} x2={x + cell - 1} y2={y + cell - 1} stroke={CHALK} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
            <Line x1={x + cell - 1} y1={y + 1} x2={x + 1} y2={y + cell - 1} stroke={CHALK} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
          </G>
        );
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const r = cell * 0.36;
        return (
          <Path
            key={i}
            d={`M${mid} ${mid} Q${mid + Math.cos(a - 0.45) * r * 0.8} ${mid + Math.sin(a - 0.45) * r * 0.8} ${mid + Math.cos(a) * r} ${mid + Math.sin(a) * r} Q${mid + Math.cos(a + 0.45) * r * 0.8} ${mid + Math.sin(a + 0.45) * r * 0.8} ${mid} ${mid}`}
            stroke="#FDE68A"
            strokeWidth={1.6}
            fill="rgba(60,40,20,0.85)"
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
 * Ashta Chamma: the board turned so my side is at the bottom; each player's waiting pawns sit
 * in a half-circle just outside their start square. Throw by tapping the seeds under the board
 * (names either side). Tapping a pawn moves it at once (the server confirms behind it); when
 * only one move is possible it is made for you, like in Ludo.
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
  /** Resolves true when the server accepted the move. */
  onMove: (pawn: number) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  const size = Math.round(Math.min((width - 16 - FRAME * 2) / (1 + GUTTER * 2), 440));
  const gut = Math.round(size * GUTTER);
  const off = gut + FRAME;
  const total = size + 2 * off;
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
  const colorOf = (uid?: string) => CHAMMA_COLORS[(sides[uid ?? ''] ?? 0) % 4];
  const throwValue = s.throw ?? null;
  const canMove = isMyTurn && g.phase === 'move' && throwValue !== null;
  const myPawns = pawns[me] ?? [];
  const myCut = !!cut[me] || s.needCut === false;
  const legal = canMove ? myPawns.map((p) => chammaTarget(p, throwValue!, myCut) !== null) : [false, false, false, false];
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;
  const nameOf = (uid?: string) => (uid === me ? t('party.you') : state.players.find((p) => p.userId === uid)?.name ?? '');

  /** The pawn I tapped (moving already, waiting for the server). */
  const [pending, setPending] = useState<number | null>(null);
  const optimistic = useRef<{ key: string; from: number; to: number; endAt: number } | null>(null);
  useEffect(() => setPending(null), [s.thrownAt, s.last?.at]);

  // Positions, in the wrap's coordinates (board + gutter).
  const cellOf = (uid: string, idx: number) => rotateCell(chammaCell(sides[uid] ?? 0, idx), view);
  const cellXY = (n: number, ox = 0, oy = 0) => ({ x: off + (n % 5) * cell + cell / 2 + ox * cell - pawnSize / 2, y: off + Math.floor(n / 5) * cell + cell / 2 + oy * cell - pawnSize / 2 });
  const semiR = gut * 0.98;
  /** Centre of a side's half-circle (on the frame's outer edge, outside its start square). */
  const semiCentre = (uid: string) => {
    const start = cellOf(uid, 0);
    const e = edgeOf(start);
    const cx = off + (start % 5) * cell + cell / 2;
    const cy = off + Math.floor(start / 5) * cell + cell / 2;
    const edge = { bottom: { x: cx, y: off + size + FRAME, dx: 0, dy: 1 }, top: { x: cx, y: gut, dx: 0, dy: -1 }, left: { x: gut, y: cy, dx: -1, dy: 0 }, right: { x: off + size + FRAME, y: cy, dx: 1, dy: 0 } }[e];
    return edge;
  };
  const semiSpot = (uid: string, i: number) => {
    const c = semiCentre(uid);
    const base = Math.atan2(c.dy, c.dx);
    const a = base + [-1.2, -0.4, 0.4, 1.2][i % 4];
    const r = semiR * 0.58;
    const ps = pawnSize * 0.7;
    return { x: c.x + Math.cos(a) * r - ps / 2, y: c.y + Math.sin(a) * r - ps / 2 };
  };

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
    keys.forEach((key, i) => {
      const [ox, oy] = keys.length > 1 ? SPOTS[i % SPOTS.length] : [0, 0];
      targets[key] = cellXY(Number(cellNo), ox, oy);
    });
  }

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const lifts = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(s.last?.at);
  const ensure = (key: string, xy: { x: number; y: number }) => {
    if (!anims.current[key]) anims.current[key] = new Animated.ValueXY(xy);
    if (!lifts.current[key]) lifts.current[key] = new Animated.Value(0);
  };
  for (const [key, xy] of Object.entries(targets)) ensure(key, xy);

  /** Walk a pawn square by square (from its half-circle if it is coming in). Returns the time. */
  const walk = (key: string, uid: string, from: number, to: number, delay: number) => {
    const [, k] = key.split(':');
    ensure(key, semiSpot(uid, Number(k)));
    const a = anims.current[key];
    const lift = lifts.current[key];
    const wrapped = from >= 0 && to < from;
    const steps = chammaSteps(from, to, !wrapped);
    if (from < 0) a.setValue(semiSpot(uid, Number(k)));
    Animated.sequence([
      Animated.delay(delay),
      ...steps.map((idx) =>
        Animated.parallel([
          Animated.timing(a, { toValue: cellXY(cellOf(uid, idx)), duration: STEP, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 1, duration: STEP / 2, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(lift, { toValue: 0, duration: STEP / 2, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          ]),
        ]),
      ),
    ]).start();
    return { steps: steps.length, ms: delay + steps.length * STEP };
  };

  // Seeds sound for every throw (anyone's).
  const thrownSeen = useRef(s.thrownAt);
  const [throwing, setThrowing] = useState(false);
  useEffect(() => {
    setThrowing(false);
    if (s.thrownAt && s.thrownAt !== thrownSeen.current) playGameSound('seeds');
    thrownSeen.current = s.thrownAt;
  }, [s.thrownAt]);
  useEffect(() => {
    if (!throwing) return;
    const t1 = setTimeout(() => setThrowing(false), 6000);
    return () => clearTimeout(t1);
  }, [throwing]);

  const last = s.last;
  useEffect(() => {
    const isNew = last && last.at !== seenAt.current && last.pawn !== undefined;
    const movingKey = isNew ? `${last!.userId}:${last!.pawn}` : null;
    const opt = optimistic.current;
    for (const [key, xy] of Object.entries(targets)) {
      if (key === movingKey || key === opt?.key) continue;
      Animated.spring(anims.current[key], { toValue: xy, friction: 8, useNativeDriver: false }).start();
    }
    if (!isNew || !last || !movingKey) return;
    seenAt.current = last.at;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (wait: number) => {
      timers.push(
        setTimeout(() => {
          const xy = targets[movingKey];
          if (xy && anims.current[movingKey]) Animated.spring(anims.current[movingKey], { toValue: xy, friction: 7, useNativeDriver: false }).start();
          if (last.captured?.length) playGameSound('cut');
          else if (last.to === CHAMMA_HOME) playGameSound('home');
        }, wait),
      );
    };
    if (opt && opt.key === movingKey && opt.from === last.from && opt.to === last.to) {
      // My own move: already walking — just settle it when the walk ends.
      optimistic.current = null;
      finish(Math.max(0, opt.endAt - Date.now()));
    } else {
      optimistic.current = null;
      const { steps, ms } = walk(movingKey, last.userId, last.from, last.to, 0);
      for (let i = 0; i < steps; i++) timers.push(setTimeout(() => playGameSound('move'), i * STEP + STEP - 30));
      finish(ms);
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pawns), size, view]);

  /** Tap a pawn: it moves straight away; the server confirms behind it. */
  const tapPawn = (k: number) => {
    if (!canMove || pending !== null || !legal[k]) return;
    const from = myPawns[k];
    const to = chammaTarget(from, throwValue!, myCut);
    if (to === null) return;
    const key = `${me}:${k}`;
    setPending(k);
    const { steps, ms } = walk(key, me, from, to, 0);
    for (let i = 0; i < steps; i++) setTimeout(() => playGameSound('move'), i * STEP + STEP - 30);
    optimistic.current = { key, from, to, endAt: Date.now() + ms };
    onMove(k).then((ok) => {
      if (ok) return;
      // Refused: put everything back where the server has it.
      optimistic.current = null;
      setPending(null);
      if (from < 0) anims.current[key]?.setValue(semiSpot(me, k));
      else if (targets[key]) Animated.spring(anims.current[key], { toValue: targets[key], friction: 8, useNativeDriver: false }).start();
    });
  };

  // Only one possible move (or all the same): make it for me, like in Ludo.
  const autoFor = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!canMove || pending !== null || autoFor.current === s.thrownAt) return;
    const options = myPawns.map((p, k) => ({ p, k })).filter(({ k }) => legal[k]);
    const distinct = new Set(options.map((o) => o.p));
    if (distinct.size !== 1) return;
    autoFor.current = s.thrownAt;
    const id = setTimeout(() => tapPawn(options[0].k), 850);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove, s.thrownAt, pending]);

  const glow = useRef(new Animated.Value(0)).current;
  const showGlow = canMove && pending === null;
  useEffect(() => {
    if (!showGlow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 450, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 450, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showGlow, glow]);

  const sidesInUse = order.map((u) => sides[u] ?? 0);
  const lastValue = s.thrownAt ? (s.seeds ?? []).filter(Boolean).length || 8 : null;
  const canThrow = isMyTurn && g.phase === 'throw' && !throwing;
  const pendingKey = pending !== null ? `${me}:${pending}` : null;
  const boardKeys = Object.keys(targets);
  if (pendingKey && !boardKeys.includes(pendingKey)) boardKeys.push(pendingKey);

  const status = (() => {
    if (throwing) return t('party.chamma.throwing');
    if (canMove && pending === null) return t('party.chamma.tapPawn', { count: seconds });
    if (canThrow) return t('party.chamma.yourThrow');
    if (last?.captured?.length) return t('party.chamma.cutMsg', { name: nameOf(last.userId) });
    if (s.thrownAt && lastValue) {
      const label = lastValue === 8 ? ` · ${t('party.chamma.ashta')}` : lastValue === 4 ? ` · ${t('party.chamma.chamma')}` : '';
      return `${nameOf(s.thrownBy)} ${t('party.chamma.threwN', { count: lastValue })}${label}`;
    }
    return t('party.chamma.firstThrow');
  })();

  const dockPlayers: DockPlayer[] = order.flatMap((uid) => {
    const p = state.players.find((x) => x.userId === uid);
    if (!p) return [];
    const home = (pawns[uid] ?? []).filter((x) => x === CHAMMA_HOME).length;
    return [
      {
        userId: uid,
        name: nameOf(uid),
        avatarKey: p.avatarKey,
        color: colorOf(uid),
        value: outOf(uid) ? t('party.board.out') : `🏠 ${home}/4`,
        misses: s.misses?.[uid] ?? 0,
        out: outOf(uid),
        badge: cut[uid] ? '⚔️' : undefined,
        sub: teams ? { text: t((sides[uid] ?? 0) % 2 ? 'party.chamma.teamB' : 'party.chamma.teamA'), color: (sides[uid] ?? 0) % 2 ? '#93C5FD' : '#FCA5A5' } : undefined,
      },
    ];
  });

  return (
    <View>
      <View style={{ width: total, height: total, alignSelf: 'center', marginHorizontal: -(spacing.lg - 8) }}>
        {/* Half-circles outside each start square (behind the frame, so only the outer half shows) */}
        <Svg width={total} height={total} style={StyleSheet.absoluteFill}>
          {order.map((uid) => {
            if (outOf(uid)) return null;
            const c = semiCentre(uid);
            const col = colorOf(uid);
            return (
              <G key={uid}>
                <Circle cx={c.x} cy={c.y} r={semiR} fill={col.dark} stroke={col.hex} strokeWidth={2} opacity={uid === s.turn ? 1 : 0.85} />
                <Circle cx={c.x} cy={c.y} r={semiR * 0.8} fill="rgba(0,0,0,0.25)" />
              </G>
            );
          })}
        </Svg>
        <View style={[styles.frame, { left: gut, top: gut, width: size + FRAME * 2, height: size + FRAME * 2 }]}>
          <BoardArt size={size} sidesInUse={sidesInUse} safe={s.safe ?? 'corners'} view={view} />
        </View>

        {/* Waiting pawns in each half-circle (mine glow when a 4 / 8 lets one in) */}
        {order.map((uid) => {
          if (outOf(uid)) return null;
          const c = colorOf(uid);
          return (pawns[uid] ?? []).map((idx, k) => {
            if (idx !== -1 || (uid === me && pending === k)) return null;
            const spot = semiSpot(uid, k);
            const movable = uid === me && legal[k] && pending === null;
            return (
              <Pressable key={`w${uid}${k}`} onPress={() => tapPawn(k)} disabled={!movable} hitSlop={6} style={[styles.abs, { left: spot.x, top: spot.y }]}>
                {movable ? <Animated.View style={[styles.halo, haloStyle(pawnSize * 0.7, glow)]} /> : null}
                <Token color={c.hex} dark={c.dark} size={pawnSize * 0.7} />
              </Pressable>
            );
          });
        })}

        {/* Pawns on the board */}
        {boardKeys.map((key) => {
          const [uid, k] = key.split(':');
          const c = colorOf(uid);
          const idx = (pawns[uid] ?? [])[Number(k)];
          const movable = uid === me && legal[Number(k)] && idx >= 0 && pending === null;
          const chosen = key === pendingKey;
          const a = anims.current[key];
          const lift = lifts.current[key];
          if (!a || !lift) return null;
          return (
            <Animated.View
              key={key}
              style={[
                styles.abs,
                {
                  zIndex: chosen ? 5 : 1,
                  transform: [...a.getTranslateTransform(), { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [chosen ? 1.12 : 1, 1.3] }) }],
                },
              ]}
            >
              <Pressable onPress={() => tapPawn(Number(k))} disabled={!movable} hitSlop={10}>
                {movable ? <Animated.View style={[styles.halo, haloStyle(pawnSize, glow)]} /> : null}
                <Token color={c.hex} dark={c.dark} size={pawnSize} glow={idx === CHAMMA_HOME || chosen} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <GameDock
        players={dockPlayers}
        meId={me}
        turnId={s.turn}
        canAct={canThrow}
        busy={busy}
        onAct={() => {
          if (!canThrow) return;
          setThrowing(true);
          onThrow();
        }}
        actLabel={t('party.board.tapThrow')}
        seconds={seconds}
        felt="rgba(42,27,18,0.92)"
        status={status}
        center={<SeedPad seeds={s.seeds ?? [true, false, true, false]} throwKey={s.thrownAt} throwing={throwing} value={lastValue} />}
      />
      <T variant="tiny" muted center>
        {s.needCut === false ? t('party.chamma.noCutNeeded') : myCut ? t('party.chamma.innerOpen') : t('party.chamma.needCut')}
      </T>
    </View>
  );
}

const haloStyle = (size: number, glow: Animated.Value) => ({
  width: size + 14,
  height: size + 14,
  borderRadius: size,
  left: -7,
  top: -7,
  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
  transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.2] }) }],
});

const styles = StyleSheet.create({
  frame: { position: 'absolute', padding: FRAME - 2, borderRadius: 12, backgroundColor: '#1C120C', borderWidth: 2, borderColor: '#F5D06F' },
  abs: { position: 'absolute', left: 0, top: 0 },
  halo: { position: 'absolute', backgroundColor: 'rgba(253,230,138,0.6)' },
});
