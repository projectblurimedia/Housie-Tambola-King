import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import type { PartyPlayer } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { GOLD_EDGE, ShineSweep } from './Premium';

/** Token colours by turn order (Snakes & Ladders). */
export const TOKEN_COLORS = [
  { hex: '#EF4444', dark: '#991B1B' },
  { hex: '#3B82F6', dark: '#1E3A8A' },
  { hex: '#22C55E', dark: '#166534' },
  { hex: '#FACC15', dark: '#A16207' },
  { hex: '#A855F7', dark: '#6B21A8' },
  { hex: '#EC4899', dark: '#9D174D' },
  { hex: '#F97316', dark: '#9A3412' },
  { hex: '#14B8A6', dark: '#0F766E' },
  { hex: '#F8FAFC', dark: '#64748B' },
  { hex: '#1F2937', dark: '#030712' },
] as const;

let pawnSeq = 0;

/**
 * A glossy board-game pawn (Ludo style): round head on a flared body and a flat base, lit
 * from the top-left, with a soft shadow — drawn in vector so it stays crisp at any size.
 */
export function Pawn({ color, dark, size, glow }: { color: string; dark: string; size: number; glow?: boolean }) {
  const id = useRef(`pawn${++pawnSeq}`).current;
  return (
    <View style={[{ width: size, height: size * 1.2 }, glow && styles.glow]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 40 48">
        <Defs>
          <RadialGradient id={`${id}h`} cx="38%" cy="32%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={color} />
            <Stop offset="1" stopColor={dark} />
          </RadialGradient>
          <SvgGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={dark} />
            <Stop offset="0.4" stopColor={color} />
            <Stop offset="0.65" stopColor={color} />
            <Stop offset="1" stopColor={dark} />
          </SvgGradient>
        </Defs>
        {/* Coloured glow ring on the board under the pawn, then its shadow */}
        <Ellipse cx={20} cy={42.5} rx={18.5} ry={5.2} fill={color} opacity={0.35} />
        <Ellipse cx={20} cy={42.5} rx={18.5} ry={5.2} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={0.9} />
        <Ellipse cx={21} cy={44} rx={15} ry={3.6} fill="#000" opacity={0.3} />
        <Ellipse cx={20} cy={41} rx={14} ry={4.6} fill={dark} />
        <Path d="M8 41 Q11 27 16 22 L24 22 Q29 27 32 41 Z" fill={`url(#${id}b)`} stroke={dark} strokeWidth={0.8} />
        <Ellipse cx={20} cy={22.5} rx={7.5} ry={2.6} fill={dark} />
        <Circle cx={20} cy={14} r={10.3} fill="#fff" opacity={0.9} />
        <Circle cx={20} cy={14} r={9.5} fill={`url(#${id}h)`} stroke={dark} strokeWidth={0.8} />
        <Ellipse cx={16.5} cy={10} rx={3.4} ry={2.2} fill="#fff" opacity={0.75} />
        <Path d="M14 30 Q15 26 17 24" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** A glossy playing piece: coloured coin, white rim, a light spot. */
export function Token({ color, dark, size, glow }: { color: string; dark: string; size: number; glow?: boolean }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, glow && styles.glow]}>
      <LinearGradient colors={['#FFFFFF', '#D1D5DB']} style={{ flex: 1, borderRadius: size / 2, padding: Math.max(1.5, size * 0.08) }}>
        <LinearGradient colors={[color, dark]} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, borderRadius: size / 2 }}>
          <View style={[styles.spot, { width: size * 0.3, height: size * 0.2, borderRadius: size * 0.15, left: size * 0.18, top: size * 0.12 }]} />
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

/** An ivory die with red / black pips; tumbles whenever rollKey changes. */
export function Dice({ value, rollKey, size = 64 }: { value: number; rollKey: string | number | undefined; size?: number }) {
  const spin = useRef(new Animated.Value(1)).current;
  const [face, setFace] = useState(value || 1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setFace(value || 1);
      return;
    }
    if (!rollKey) return;
    spin.setValue(0);
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    Animated.timing(spin, { toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      clearInterval(flicker);
      setFace(value || 1);
    });
    return () => clearInterval(flicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);
  const pip = size * 0.17;
  return (
    <Animated.View
      style={{
        transform: [
          { perspective: 500 },
          { translateY: spin.interpolate({ inputRange: [0, 0.35, 0.7, 0.85, 1], outputRange: [0, -size * 0.8, 0, -size * 0.15, 0] }) },
          { rotateX: spin.interpolate({ inputRange: [0, 1], outputRange: ['720deg', '0deg'] }) },
          { rotateY: spin.interpolate({ inputRange: [0, 1], outputRange: ['-360deg', '0deg'] }) },
          { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
        ],
      }}
    >
      <LinearGradient colors={['#FFFFFF', '#F3EBDD', '#D9CDB8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.die, { width: size, height: size, borderRadius: size * 0.2 }]}>
        {(PIPS[face] ?? PIPS[1]).map(([r, c], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: pip,
              height: pip,
              borderRadius: pip / 2,
              backgroundColor: face === 1 ? '#DC2626' : '#1F2937',
              left: size * (0.2 + c * 0.3) - pip / 2,
              top: size * (0.2 + r * 0.3) - pip / 2,
            }}
          />
        ))}
      </LinearGradient>
    </Animated.View>
  );
}

/**
 * A big die thrown onto the middle of the board: it drops in spinning, bounces twice (squashing
 * a little on each landing, its shadow growing as it falls), settles on the number with a gold
 * pop, then fades so the token's walk is clear.
 */
export function DiceDrop({
  value,
  rollKey,
  size,
  spinning,
}: {
  value: number;
  rollKey: string | number | undefined;
  size: number;
  /** Tapped Roll, waiting for the result: the die tumbles in the middle right away. */
  spinning?: boolean;
}) {
  const p = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(value || 1);
  const first = useRef(true);

  useEffect(() => {
    if (!spinning) return;
    fade.setValue(1);
    pop.setValue(0);
    p.setValue(0.35);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => {
      loop.stop();
      spin.setValue(0);
      clearInterval(flicker);
    };
  }, [spinning, spin, fade, pop, p]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!rollKey) return;
    p.setValue(0);
    pop.setValue(0);
    fade.setValue(1);
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 80);
    Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 950, easing: Easing.linear, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    const settle = setTimeout(() => {
      clearInterval(flicker);
      setFace(value || 1);
    }, 700);
    return () => {
      clearInterval(flicker);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);
  const pip = size * 0.17;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: fade }]}>
      {/* Shadow on the board */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: size * 0.22,
          borderRadius: size,
          backgroundColor: 'rgba(0,0,0,0.3)',
          transform: [
            { translateY: size * 0.55 },
            { scale: p.interpolate({ inputRange: [0, 0.35, 0.55, 0.72, 0.84, 1], outputRange: [0.3, 1, 0.7, 1, 0.92, 1] }) },
          ],
        }}
      />
      <Animated.View
        style={{
          transform: [
            { translateY: p.interpolate({ inputRange: [0, 0.35, 0.55, 0.72, 0.84, 1], outputRange: [-size * 2.4, 0, -size * 0.55, 0, -size * 0.14, 0] }) },
            { rotate: p.interpolate({ inputRange: [0, 0.35, 0.72, 1], outputRange: ['-300deg', '-60deg', '-10deg', '0deg'] }) },
            { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            { scaleY: p.interpolate({ inputRange: [0, 0.33, 0.36, 0.42, 0.7, 0.73, 0.78, 1], outputRange: [1, 1, 0.84, 1, 1, 0.92, 1, 1] }) },
            { scale: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) },
          ],
        }}
      >
        <View style={[styles.dropGlow, { width: size * 1.3, height: size * 1.3, borderRadius: size, left: -size * 0.15, top: -size * 0.15 }]} />
        <LinearGradient
          colors={['#FFFFFF', '#F8F4EC', '#E2D7C3']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.die, { width: size, height: size, borderRadius: size * 0.22, borderWidth: 2, borderColor: '#D6C7AA' }]}
        >
          <View style={[styles.dieBevel, { borderRadius: size * 0.18 }]} />
          {(PIPS[face] ?? PIPS[1]).map(([r, c], i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: pip,
                height: pip,
                borderRadius: pip / 2,
                backgroundColor: face === 1 ? '#DC2626' : '#111827',
                left: size * (0.22 + c * 0.28) - pip / 2,
                top: size * (0.22 + r * 0.28) - pip / 2,
              }}
            />
          ))}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

/** Chances left (3 hearts): a heart greys out each time the server had to play for them. */
export function Chances({ misses }: { misses: number }) {
  return (
    <Row gap={1}>
      {[0, 1, 2].map((i) => (
        <Ionicons key={i} name={i < 3 - misses ? 'heart' : 'heart-outline'} size={10} color={i < 3 - misses ? '#F43F5E' : 'rgba(255,255,255,0.35)'} />
      ))}
    </Row>
  );
}

/** Whose turn it is, with their colour, and (on my turn) the big gold action button. */
export function TurnBar({
  player,
  color,
  isMe,
  seconds,
  actionLabel,
  actionIcon,
  canAct,
  busy,
  onAct,
  waitingLabel,
  actionArt,
  children,
}: {
  player?: PartyPlayer;
  color: { hex: string; dark: string };
  isMe: boolean;
  seconds: number;
  actionLabel: string;
  actionIcon: keyof typeof Ionicons.glyphMap;
  canAct: boolean;
  busy: boolean;
  onAct: () => void;
  waitingLabel: string;
  /** Drawn inside the round action button (a die, seeds…). */
  actionArt?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canAct) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canAct, pulse]);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Row gap={spacing.md} style={{ alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Row gap={spacing.sm}>
            <LinearGradient colors={[color.hex, color.dark]} style={styles.turnRing}>
              <Avatar avatarKey={player?.avatarKey ?? 'a1'} size={36} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium" numberOfLines={1}>
                {isMe ? t('party.board.yourTurn') : t('party.board.theirTurn', { name: player?.name ?? '' })}
              </T>
              <T variant="tiny" muted numberOfLines={1}>
                {isMe ? (canAct ? t('party.board.autoIn', { count: seconds }) : waitingLabel) : waitingLabel}
              </T>
            </View>
          </Row>
        </View>
        {/* A fixed slot: the Roll / Throw button on my turn, otherwise a countdown — same size, so
            nothing above or below moves when the turn changes. */}
        <View style={styles.slot}>
        {isMe && canAct ? (
          /* My turn: a round gold button with a pulsing ring, the art inside, the label under it. */
          <Pressable onPress={onAct} disabled={busy} style={{ alignItems: 'center' }} accessibilityLabel={actionLabel}>
            <View style={styles.roundWrap}>
              <Animated.View
                style={[
                  styles.ring,
                  { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
                ]}
              />
              <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
                <LinearGradient colors={['#FFF1A8', '#F5B700', '#B45309']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.round}>
                  <ShineSweep width={80} every={1200} />
                  <View style={styles.roundInner}>{actionArt ?? <Ionicons name={actionIcon} size={30} color="#3B1D00" />}</View>
                </LinearGradient>
              </Animated.View>
            </View>
            <T style={styles.roundLabel}>{actionLabel}</T>
          </Pressable>
        ) : (
          children ?? (
            <View style={[styles.timer, { borderColor: color.hex }]}>
              <T style={styles.timerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {seconds}
              </T>
              <T variant="tiny" color="rgba(255,255,255,0.7)" maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                s
              </T>
            </View>
          )
        )}
        </View>
      </Row>
    </View>
  );
}

/** Small player pill: colour token, name, a value on the right (square, pawns home…). */
export function PlayerPill({
  player,
  color,
  value,
  active,
  me,
  extra,
}: {
  player: PartyPlayer;
  color: { hex: string; dark: string };
  value: string;
  active: boolean;
  me: boolean;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <LinearGradient colors={active ? GOLD_EDGE : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)']} style={styles.pillEdge}>
      <View style={styles.pill}>
        <Token color={color.hex} dark={color.dark} size={18} />
        <T variant="tiny" color="#fff" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold }} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {me ? t('party.you') : player.name}
        </T>
        {extra}
        <T variant="tiny" color="#FDE68A" maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={{ fontFamily: fonts.bold }}>
          {value}
        </T>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  slot: { width: 92, height: 104, alignItems: 'center', justifyContent: 'center' },
  timer: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  timerText: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: '#fff' },
  roundWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: '#F5B700' },
  round: { width: 72, height: 72, borderRadius: 36, padding: 4, overflow: 'hidden', borderWidth: 2, borderColor: '#92400E' },
  roundInner: { flex: 1, borderRadius: 32, backgroundColor: 'rgba(59,29,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  roundLabel: { fontFamily: fonts.display, fontSize: 13, lineHeight: 18, color: '#FCD34D', marginTop: 2 },
  dropGlow: { position: 'absolute', backgroundColor: 'rgba(253,230,138,0.35)' },
  dieBevel: { position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  glow: { shadowColor: '#FDE68A', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  spot: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.6)' },
  die: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, borderWidth: 1, borderColor: '#C8B89C' },
  turnRing: { padding: 2.5, borderRadius: 22 },
  action: { height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, overflow: 'hidden', borderWidth: 2, borderColor: '#B45309' },
  actionText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: '#3B1D00', letterSpacing: 1 },
  pillEdge: { borderRadius: 14, padding: 1.2, width: '48.5%' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#1A1030' },
});
