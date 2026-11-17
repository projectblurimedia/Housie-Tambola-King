import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLS, Cells } from '@/game/engine/ticket';
import { fonts, goldGradient, radius, useThemeColors } from '@/theme';

interface Props {
  cells: Cells;
  /** Numbers shown as struck. */
  marked: ReadonlySet<number>;
  /** Pulsing ring on the most recent call (if it's on this ticket and not struck yet). */
  lastCalled?: number | null;
  onPressNumber?: (n: number) => void;
  label?: string;
  /** Prize names won with this ticket, shown as a ribbon. */
  badge?: string;
  compact?: boolean;
}

const GROUP_EDGE = new Set([2, 5]); // thicker line after columns 3 and 6 (column-group prizes)

/** One number box: a purple daub pops in with a gold strike line when struck. */
function Cell({
  n,
  struck,
  isLast,
  height,
  fontSize,
  onPress,
}: {
  n: number;
  struck: boolean;
  isLast: boolean;
  height: number;
  fontSize: number;
  onPress?: (n: number) => void;
}) {
  const { colors } = useThemeColors();
  const pop = useRef(new Animated.Value(struck ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: struck ? 1 : 0, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [struck, pop]);

  useEffect(() => {
    if (!isLast || struck) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLast, struck, pulse]);

  const size = height - 8;
  return (
    <Pressable
      onPress={onPress ? () => onPress(n) : undefined}
      disabled={!onPress}
      accessibilityLabel={`${n}${struck ? ' struck' : ''}`}
      style={({ pressed }) => [styles.cellInner, { height }, pressed && onPress && !struck && { backgroundColor: colors.surfaceAlt }]}
    >
      {isLast && !struck ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderColor: colors.pink,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] }) }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.daub, { width: size, height: size, backgroundColor: colors.marked, opacity: pop, transform: [{ scale: pop }] }]} />
      <Text style={[styles.num, { fontSize, color: struck ? '#fff' : colors.ticketNumber }]}>{n}</Text>
      <Animated.View style={[styles.strike, { width: size * 0.85, opacity: pop, transform: [{ rotate: '-35deg' }, { scaleX: pop }] }]} />
    </Pressable>
  );
}

/** A classic 3×9 housie ticket in boxes, with a gold header strip. */
export const TicketView = memo(function TicketView({ cells, marked, lastCalled, onPressNumber, label, badge, compact }: Props) {
  const { colors } = useThemeColors();
  const cellHeight = compact ? 34 : 48;
  const fontSize = compact ? 15 : 20;
  const line = colors.goldDark;

  return (
    <View style={[styles.ticket, { borderColor: line, backgroundColor: colors.ticketBg }]}>
      <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <Text style={styles.headerText}>🎫 {label ?? ''}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.success }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              🏆 {badge}
            </Text>
          </View>
        ) : (
          <Text style={styles.headerBrand}>HOUSIE</Text>
        )}
      </LinearGradient>
      {[0, 1, 2].map((r) => (
        <View key={r} style={[styles.row, r < 2 && { borderBottomWidth: 1, borderBottomColor: line }]}>
          {cells.slice(r * COLS, r * COLS + COLS).map((n, c) => (
            <View
              key={c}
              style={[
                styles.cell,
                c < COLS - 1 && { borderRightWidth: GROUP_EDGE.has(c) ? 2.5 : 1, borderRightColor: line },
                n === 0 && { backgroundColor: colors.ticketBlank },
              ]}
            >
              {n === 0 ? (
                <View style={[styles.blankDot, { backgroundColor: line }]} />
              ) : (
                <Cell n={n} struck={marked.has(n)} isLast={lastCalled === n} height={cellHeight} fontSize={fontSize} onPress={onPressNumber} />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  ticket: {
    borderWidth: 2.5,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#3B1D00',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5, gap: 8 },
  headerText: { fontFamily: fonts.bold, fontSize: 13, color: '#3B1D00', includeFontPadding: false },
  headerBrand: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, color: 'rgba(59,29,0,0.55)', includeFontPadding: false },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 1 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff', includeFontPadding: false },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cellInner: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  blankDot: { width: 4, height: 4, borderRadius: 2, opacity: 0.25 },
  daub: { position: 'absolute', borderRadius: 999 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2.5 },
  strike: { position: 'absolute', height: 2.5, borderRadius: 2, backgroundColor: '#FDE68A' },
  num: { fontFamily: fonts.bold, includeFontPadding: false },
});
