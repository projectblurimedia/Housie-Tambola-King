import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
] as const;

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
              <T variant="tiny" muted>
                {isMe ? (canAct ? t('party.board.autoIn', { count: seconds }) : waitingLabel) : waitingLabel}
              </T>
            </View>
          </Row>
        </View>
        {children}
      </Row>
      {isMe && canAct ? (
        <Animated.View style={{ marginTop: spacing.md, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>
          <Pressable onPress={onAct} disabled={busy}>
            <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
              <ShineSweep every={1400} />
              <Ionicons name={actionIcon} size={22} color="#3B1D00" />
              <T style={styles.actionText}>{actionLabel}</T>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : null}
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
  glow: { shadowColor: '#FDE68A', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  spot: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.6)' },
  die: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, borderWidth: 1, borderColor: '#C8B89C' },
  turnRing: { padding: 2.5, borderRadius: 22 },
  action: { height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, overflow: 'hidden', borderWidth: 2, borderColor: '#B45309' },
  actionText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: '#3B1D00', letterSpacing: 1 },
  pillEdge: { borderRadius: 14, padding: 1.2, width: '48.5%' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#1A1030' },
});
