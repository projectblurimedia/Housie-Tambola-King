import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { T } from '@/components/ui';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { GOLD_EDGE } from './Premium';

export type DockPlayer = {
  userId: string;
  name: string;
  avatarKey: string;
  color: { hex: string; dark: string };
  /** Right-hand value (square, pawns home…). */
  value: string;
  misses: number;
  out: boolean;
  /** Small extra line (team) and badge (⚔️). */
  sub?: { text: string; color: string };
  badge?: string;
  /** A playing piece shown in the card (e.g. a pawn still waiting to come onto the board). */
  piece?: React.ReactNode;
};

const STAGE = 112;
/** The round pad (smaller than the stage, leaving room for the label under it). */
const PAD = 80;
const CHIP_H = 40;

/**
 * The play area under a board game's board: the die / seeds in the middle on a round felt pad
 * (a ring around it counts the turn down in the player's colour), and the players' names on
 * both sides — me on this side, the others on that side. On my turn the pad glows gold and
 * says "Tap to roll" — tap the die itself. A status line underneath tells what just happened.
 * Everything has a fixed height, so the screen never jumps.
 */
export function GameDock({
  players,
  meId,
  turnId,
  center,
  canAct,
  busy,
  onAct,
  actLabel,
  seconds,
  total = 20,
  status,
  felt = 'rgba(6,40,30,0.88)',
}: {
  players: DockPlayer[];
  meId: string;
  turnId?: string;
  center: React.ReactNode;
  canAct: boolean;
  busy: boolean;
  onAct: () => void;
  actLabel: string;
  seconds: number;
  total?: number;
  status: string;
  /** The pad's colour (green felt / walnut). */
  felt?: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canAct) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canAct, pulse]);

  // Me first on this side, then the others alternate that side / this side.
  const me = players.find((p) => p.userId === meId);
  const others = players.filter((p) => p.userId !== meId);
  const left: DockPlayer[] = me ? [me] : [];
  const right: DockPlayer[] = [];
  others.forEach((p, i) => ((me ? i % 2 === 0 : i % 2 === 1) ? right : left).push(p));
  if (!me && left.length === 0 && right.length) left.push(right.shift()!);
  const rows = Math.max(1, left.length, right.length);
  const height = Math.max(STAGE + 8, rows * CHIP_H + (rows - 1) * 6 + 16);

  const turn = players.find((p) => p.userId === turnId);
  const ring = turn?.color.hex ?? '#F5D06F';
  const R = PAD / 2;

  const column = (list: DockPlayer[], side: 'left' | 'right') => (
    <View style={[styles.col, { alignItems: side === 'left' ? 'flex-start' : 'flex-end' }]}>
      {list.map((p) => (
        <Chip key={p.userId} p={p} active={p.userId === turnId} me={p.userId === meId} side={side} />
      ))}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.sm }}>
      <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.22)']} style={[styles.dock, { height }]}>
        {column(left, 'left')}
        <Pressable onPress={onAct} disabled={!canAct || busy} accessibilityLabel={actLabel} style={styles.stage}>
          {/* The pad the die / seeds land on (edge in the colour of whoever's turn it is) */}
          <Svg width={PAD + 4} height={PAD + 4} style={styles.pad}>
            <Circle cx={R + 2} cy={R + 2} r={R} stroke={canAct ? '#FACC15' : ring} strokeWidth={2.5} fill={felt} />
          </Svg>
          {canAct ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glow,
                { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] },
              ]}
            />
          ) : null}
          <View pointerEvents="none" style={styles.center}>
            {center}
          </View>
          {/* My turn: the seconds left sit on the pad's corner (the label below says what to do). */}
          {canAct ? (
            <View pointerEvents="none" style={styles.secsBadge}>
              <T style={styles.secsBadgeText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {seconds}
              </T>
            </View>
          ) : null}
          <View pointerEvents="none" style={styles.labelWrap}>
            {canAct ? (
              <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.label}>
                <T style={styles.labelText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
                  {actLabel}
                </T>
              </LinearGradient>
            ) : (
              <View style={[styles.secs, { borderColor: ring }]}>
                <Ionicons name="time-outline" size={11} color="#fff" />
                <T style={styles.secsText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                  {seconds}s
                </T>
              </View>
            )}
          </View>
        </Pressable>
        {column(right, 'right')}
      </LinearGradient>
      <View style={styles.statusRow}>
        <T variant="tiny" color="rgba(255,255,255,0.9)" center numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
          {status}
        </T>
      </View>
    </View>
  );
}

function Chip({ p, active, me, side }: { p: DockPlayer; active: boolean; me: boolean; side: 'left' | 'right' }) {
  const body = (
    <View style={[styles.chip, side === 'right' ? { flexDirection: 'row-reverse' } : null]}>
      <LinearGradient colors={[p.color.hex, p.color.dark]} style={styles.avatarRing}>
        <Avatar avatarKey={p.avatarKey} size={26} />
      </LinearGradient>
      <View style={{ flex: 1, alignItems: side === 'right' ? 'flex-end' : 'flex-start' }}>
        <T style={styles.chipName} numberOfLines={1} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {p.badge ? `${p.badge} ` : ''}
          {p.name}
        </T>
        <View style={[styles.chipLine, side === 'right' ? { flexDirection: 'row-reverse' } : null]}>
          <T style={styles.chipValue} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
            {p.value}
          </T>
          {p.out ? null : (
            <View style={{ flexDirection: 'row' }}>
              {[0, 1, 2].map((i) => (
                <Ionicons key={i} name="heart" size={8} color={i < 3 - p.misses ? '#F43F5E' : 'rgba(255,255,255,0.25)'} />
              ))}
            </View>
          )}
          {p.sub ? (
            <T style={[styles.chipSub, { color: p.sub.color }]} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
              {p.sub.text}
            </T>
          ) : null}
        </View>
      </View>
      {p.piece ? <View style={styles.piece}>{p.piece}</View> : null}
      {active ? <Ionicons name={side === 'left' ? 'caret-forward' : 'caret-back'} size={12} color="#FDE68A" /> : null}
    </View>
  );
  return (
    <LinearGradient
      colors={active ? GOLD_EDGE : me ? ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.2)'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)']}
      style={[styles.chipEdge, p.out && { opacity: 0.45 }]}
    >
      {body}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  dock: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(245,208,111,0.45)', paddingHorizontal: 6 },
  col: { flex: 1, gap: 6, justifyContent: 'center' },
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  pad: { position: 'absolute', top: (STAGE - 18 - PAD) / 2 - 2, alignSelf: 'center' },
  glow: { position: 'absolute', top: (STAGE - 18 - PAD) / 2 - 4, width: PAD + 8, height: PAD + 8, borderRadius: PAD, borderWidth: 3, borderColor: '#FACC15', backgroundColor: 'rgba(250,204,21,0.12)' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 18, alignItems: 'center', justifyContent: 'center' },
  labelWrap: { position: 'absolute', bottom: 2, left: -10, right: -10, alignItems: 'center' },
  secsBadge: { position: 'absolute', top: 2, right: 6, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B91C1C', borderWidth: 2, borderColor: '#FDE68A' },
  secsBadgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: '#fff' },
  label: { paddingHorizontal: 10, height: 20, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#92400E' },
  labelText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: '#3B1D00', letterSpacing: 0.4 },
  secs: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 20, borderRadius: 10, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.55)' },
  secsText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: '#fff' },
  chipEdge: { borderRadius: 14, padding: 1.2, width: '100%', maxWidth: 160 },
  chip: { height: CHIP_H - 2.4, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 13, paddingHorizontal: 5, backgroundColor: '#1A1030' },
  piece: { paddingHorizontal: 1 },
  avatarRing: { padding: 2, borderRadius: 16 },
  chipName: { color: '#fff', fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  chipLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipValue: { color: '#FDE68A', fontFamily: fonts.bold, fontSize: 10, lineHeight: 13 },
  chipSub: { fontFamily: fonts.semibold, fontSize: 9, lineHeight: 12 },
  statusRow: { height: 22, justifyContent: 'center', marginTop: 4, paddingHorizontal: 8 },
});
