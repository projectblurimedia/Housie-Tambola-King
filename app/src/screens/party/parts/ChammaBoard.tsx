import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import { CHAMMA_COLORS, CHAMMA_HOME, chammaCell, chammaSteps, chammaTarget } from '@/game/engine/board';
import type { PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Token, TurnBar } from './BoardBits';
import { GOLD_EDGE, GoldFrame } from './Premium';

/** Quarter spots inside a square for up to 4 pawns sharing it. */
const SPOTS: [number, number][] = [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2]];

/** Chalk on a dark slate floor: the 5×5 grid, crosses on the safe squares, a flower in the centre. */
const BoardArt = React.memo(function BoardArt({ size, sidesInUse }: { size: number; sidesInUse: number[] }) {
  const cell = size / 5;
  const chalk = 'rgba(255,250,235,0.9)';
  const cross = (cellNo: number, color?: string) => {
    const x = (cellNo % 5) * cell;
    const y = Math.floor(cellNo / 5) * cell;
    const p = cell * 0.18;
    return (
      <G key={`x${cellNo}`}>
        {color ? <Rect x={x + 2} y={y + 2} width={cell - 4} height={cell - 4} fill={color} opacity={0.28} rx={4} /> : null}
        <Line x1={x + p} y1={y + p} x2={x + cell - p} y2={y + cell - p} stroke={chalk} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={x + cell - p} y1={y + p} x2={x + p} y2={y + cell - p} stroke={chalk} strokeWidth={2.5} strokeLinecap="round" />
      </G>
    );
  };
  const mid = size / 2;
  return (
    <Svg width={size} height={size}>
      {Array.from({ length: 6 }, (_, i) => (
        <G key={i}>
          <Line x1={i * cell} y1={0} x2={i * cell} y2={size} stroke={chalk} strokeWidth={i === 0 || i === 5 ? 4 : 2} />
          <Line x1={0} y1={i * cell} x2={size} y2={i * cell} stroke={chalk} strokeWidth={i === 0 || i === 5 ? 4 : 2} />
        </G>
      ))}
      {/* Start squares (safe), tinted with their side's colour */}
      {[0, 1, 2, 3].map((side) => cross(chammaCell(side, 0), sidesInUse.includes(side) ? CHAMMA_COLORS[side].hex : undefined))}
      {/* Centre: home — a chalk flower */}
      <Rect x={2 * cell + 2} y={2 * cell + 2} width={cell - 4} height={cell - 4} fill="#FDE68A" opacity={0.18} rx={6} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <Path
            key={i}
            d={`M${mid} ${mid} Q${mid + Math.cos(a - 0.4) * cell * 0.3} ${mid + Math.sin(a - 0.4) * cell * 0.3} ${mid + Math.cos(a) * cell * 0.4} ${mid + Math.sin(a) * cell * 0.4} Q${mid + Math.cos(a + 0.4) * cell * 0.3} ${mid + Math.sin(a + 0.4) * cell * 0.3} ${mid} ${mid}`}
            stroke={chalk}
            strokeWidth={1.6}
            fill="none"
          />
        );
      })}
      <Circle cx={mid} cy={mid} r={cell * 0.08} fill={chalk} />
    </Svg>
  );
});

/** One tamarind seed: dark shiny shell side down, pale inner side up. */
function Seed({ up, angle }: { up: boolean; angle: number }) {
  return (
    <View style={{ transform: [{ rotate: `${angle}deg` }] }}>
      <LinearGradient
        colors={up ? ['#FFF8E6', '#EAD7AE', '#C9AD78'] : ['#9A5A2C', '#5A2E10', '#2E1606']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.seed}
      >
        {up ? <View style={styles.seedLine} /> : <View style={styles.seedShine} />}
      </LinearGradient>
    </View>
  );
}

/** The four seeds: tossed up and spun whenever a new throw comes in, then they land. */
function Seeds({ seeds, throwKey, value }: { seeds: boolean[]; throwKey?: number; value: number | null }) {
  const { t } = useTranslation();
  const toss = useRef(new Animated.Value(1)).current;
  const [flying, setFlying] = useState(false);
  const first = useRef(true);
  const angles = useRef([-18, 12, -6, 22]).current;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!throwKey) return;
    toss.setValue(0);
    setFlying(true);
    Animated.timing(toss, { toValue: 1, duration: 800, easing: Easing.out(Easing.bounce), useNativeDriver: true }).start(() => setFlying(false));
  }, [throwKey, toss]);
  const label = value === 8 ? t('party.chamma.ashta') : value === 4 ? t('party.chamma.chamma') : null;
  return (
    <View style={{ alignItems: 'center' }}>
      <Row gap={6}>
        {[0, 1, 2, 3].map((i) => (
          <Animated.View
            key={i}
            style={{
              transform: [
                { translateY: toss.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -46 - i * 6, 0] }) },
                { rotate: toss.interpolate({ inputRange: [0, 1], outputRange: [`${(i % 2 ? 1 : -1) * 720}deg`, '0deg'] }) },
              ],
            }}
          >
            <Seed up={flying ? i % 2 === 0 : !!seeds[i]} angle={angles[i]} />
          </Animated.View>
        ))}
      </Row>
      {value ? (
        <T style={styles.throwValue} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {flying ? '…' : label ? `${value} · ${label}` : String(value)}
        </T>
      ) : null}
    </View>
  );
}

/**
 * Ashta Chamma: chalk board, everyone's pawns (walking square by square), the seeds, and on my
 * turn Throw, then tap a glowing pawn to move it. Waiting pawns sit in each player's tray.
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
  const size = Math.min(width - spacing.lg * 2 - 16, 360);
  const cell = size / 5;
  const pawnSize = cell * 0.36;
  const order = s.order ?? [];
  const sides = s.sides ?? {};
  const pawns = s.pawns ?? {};
  const cut = s.cut ?? {};
  const me = state.me.userId;
  const isMyTurn = s.turn === me;
  const turnPlayer = state.players.find((p) => p.userId === s.turn);
  const colorOf = (uid?: string) => CHAMMA_COLORS[(sides[uid ?? ''] ?? 0) % 4];
  const throwValue = s.throw ?? null;
  const canMove = isMyTurn && g.phase === 'move' && throwValue !== null;
  const myPawns = pawns[me] ?? [];
  const legal = canMove ? myPawns.map((p) => chammaTarget(p, throwValue!, !!cut[me]) !== null) : [false, false, false, false];

  // Where each pawn on the board is drawn (pawns sharing a square spread out).
  const layout = () => {
    const out: Record<string, { x: number; y: number }> = {};
    const count: Record<number, number> = {};
    for (const uid of order) {
      (pawns[uid] ?? []).forEach((idx, k) => {
        if (idx < 0) return;
        const cellNo = chammaCell(sides[uid] ?? 0, idx);
        const n = (count[cellNo] = (count[cellNo] ?? 0) + 1) - 1;
        const [ox, oy] = SPOTS[n % 4];
        out[`${uid}:${k}`] = {
          x: (cellNo % 5) * cell + cell / 2 + ox * cell - pawnSize / 2,
          y: Math.floor(cellNo / 5) * cell + cell / 2 + oy * cell - pawnSize / 2,
        };
      });
    }
    return out;
  };
  const targets = layout();
  const cellXY = (uid: string, idx: number) => {
    const cellNo = chammaCell(sides[uid] ?? 0, idx);
    return { x: (cellNo % 5) * cell + cell / 2 - pawnSize / 2, y: Math.floor(cellNo / 5) * cell + cell / 2 - pawnSize / 2 };
  };

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const seenAt = useRef<number | undefined>(s.last?.at);
  for (const [key, xy] of Object.entries(targets)) if (!anims.current[key]) anims.current[key] = new Animated.ValueXY(xy);

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
    if (!a) return;
    const wrapped = last.from >= 0 && last.to < last.from;
    const steps = chammaSteps(last.from, last.to, !wrapped);
    if (last.from < 0) a.setValue(cellXY(last.userId, 0));
    Animated.sequence([
      ...steps.slice(0, -1).map((idx) =>
        Animated.timing(a, { toValue: cellXY(last.userId, idx), duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ),
      Animated.timing(a, { toValue: targets[movingKey] ?? cellXY(last.userId, last.to), duration: 220, easing: Easing.out(Easing.back(1.5)), useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pawns)]);

  // Glow for pawns I can move.
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canMove) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canMove, glow]);

  const sidesInUse = order.map((u) => sides[u] ?? 0);
  const firstWaiting = myPawns.findIndex((p) => p === -1);
  const captured = last?.captured?.length ? last : null;

  return (
    <View>
      <GoldFrame radius={18} width={2.5} colors={['#3B2A20', '#2A1E17', '#1C130E']} innerStyle={{ padding: 8, alignItems: 'center' }}>
        <View style={{ width: size, height: size }}>
          <BoardArt size={size} sidesInUse={sidesInUse} />
          {Object.keys(targets).map((key) => {
            const [uid, k] = key.split(':');
            const c = colorOf(uid);
            const idx = (pawns[uid] ?? [])[Number(k)];
            const movable = uid === me && legal[Number(k)] && idx >= 0;
            return (
              <Animated.View key={key} style={[styles.pawn, { transform: anims.current[key]?.getTranslateTransform() ?? [] }]}>
                <Pressable onPress={() => movable && onMove(Number(k))} disabled={!movable || busy} hitSlop={6}>
                  {movable ? (
                    <Animated.View
                      style={[
                        styles.halo,
                        { width: pawnSize + 12, height: pawnSize + 12, borderRadius: pawnSize, left: -6, top: -6, opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }] },
                      ]}
                    />
                  ) : null}
                  <Token color={c.hex} dark={c.dark} size={pawnSize} glow={idx === CHAMMA_HOME} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </GoldFrame>

      {captured ? (
        <T variant="smallBold" center color="#DC2626" style={{ marginTop: 6 }}>
          {t('party.chamma.cutMsg', { name: captured.userId === me ? t('party.you') : state.players.find((p) => p.userId === captured.userId)?.name ?? '' })}
        </T>
      ) : null}

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
        waitingLabel={canMove ? t('party.chamma.tapPawn', { count: seconds }) : isMyTurn ? t('party.board.moving') : t('party.board.waitTurn')}
      >
        <Seeds seeds={s.seeds ?? [true, false, true, false]} throwKey={s.thrownAt} value={throwValue ?? null} />
      </TurnBar>

      {/* Players: colour, waiting pawns (tap to bring one in on 4 / 8), pawns home, cut */}
      <View style={styles.panels}>
        {order.map((uid) => {
          const p = state.players.find((x) => x.userId === uid);
          if (!p) return null;
          const c = colorOf(uid);
          const pw = pawns[uid] ?? [];
          const waiting = pw.filter((x) => x === -1).length;
          const home = pw.filter((x) => x === CHAMMA_HOME).length;
          const canEnter = uid === me && firstWaiting >= 0 && legal[firstWaiting];
          return (
            <LinearGradient key={uid} colors={uid === s.turn ? GOLD_EDGE : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)']} style={styles.panelEdge}>
              <View style={[styles.panel, { borderLeftColor: c.hex }]}>
                <Row gap={6}>
                  <Avatar avatarKey={p.avatarKey} size={26} />
                  <T variant="tiny" color="#fff" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold }} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                    {uid === me ? t('party.you') : p.name}
                  </T>
                  {cut[uid] ? (
                    <T style={styles.cutBadge} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                      ⚔️
                    </T>
                  ) : null}
                </Row>
                <Pressable onPress={() => canEnter && onMove(firstWaiting)} disabled={!canEnter || busy}>
                  <Row gap={4} style={{ marginTop: 6 }}>
                    {Array.from({ length: waiting }, (_, i) => (
                      <Animated.View key={i} style={canEnter && i === 0 ? { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }] } : { opacity: 0.85 }}>
                        <Token color={c.hex} dark={c.dark} size={16} />
                      </Animated.View>
                    ))}
                    <View style={{ flex: 1 }} />
                    <T variant="tiny" color="#FDE68A" maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                      🏠 {home}/4
                    </T>
                  </Row>
                </Pressable>
              </View>
            </LinearGradient>
          );
        })}
      </View>
      <T variant="tiny" muted center style={{ marginTop: spacing.sm }}>
        {cut[me] ? t('party.chamma.innerOpen') : t('party.chamma.needCut')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  pawn: { position: 'absolute', left: 0, top: 0 },
  halo: { position: 'absolute', backgroundColor: 'rgba(253,230,138,0.55)' },
  seed: { width: 15, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.35)' },
  seedLine: { width: 1.5, height: 18, borderRadius: 1, backgroundColor: 'rgba(120,80,30,0.45)' },
  seedShine: { position: 'absolute', left: 3, top: 4, width: 4, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  throwValue: { fontFamily: fonts.display, fontSize: 14, lineHeight: 20, color: '#B45309', marginTop: 4 },
  panels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: spacing.md },
  panelEdge: { width: '48.5%', borderRadius: 14, padding: 1.2 },
  panel: { borderRadius: 13, padding: 8, backgroundColor: '#1A1030', borderLeftWidth: 4 },
  cutBadge: { fontSize: 12, lineHeight: 16 },
});
