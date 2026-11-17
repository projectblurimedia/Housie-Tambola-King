import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLS, Cells } from '@/game/engine/ticket';
import { fonts, radius, useThemeColors } from '@/theme';

interface Props {
  cells: Cells;
  /** Numbers shown as struck. */
  marked: ReadonlySet<number>;
  /** Highlight ring on the most recent call (if it's on this ticket and not struck yet). */
  lastCalled?: number | null;
  onPressNumber?: (n: number) => void;
  label?: string;
  /** Prize names won with this ticket, shown as a ribbon. */
  badge?: string;
  compact?: boolean;
}

/** One number: a daub that pops in with a strike line when struck. */
function Cell({
  n,
  struck,
  isLast,
  height,
  compact,
  onPress,
}: {
  n: number;
  struck: boolean;
  isLast: boolean;
  height: number;
  compact?: boolean;
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

  const size = height - 6;
  return (
    <Pressable
      onPress={onPress ? () => onPress(n) : undefined}
      disabled={!onPress}
      accessibilityLabel={`${n}${struck ? ' struck' : ''}`}
      style={[styles.cell, { height, backgroundColor: colors.ticketBg }]}
    >
      {isLast && !struck ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderColor: colors.pink,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.daub,
          { width: size, height: size, backgroundColor: colors.marked, opacity: pop, transform: [{ scale: pop }] },
        ]}
      />
      <Text style={[styles.num, { fontSize: compact ? 14 : 18, color: struck ? '#fff' : colors.ticketNumber }]}>{n}</Text>
      <Animated.View
        style={[
          styles.strike,
          { width: size * 0.9, opacity: pop, transform: [{ rotate: '-35deg' }, { scaleX: pop }] },
        ]}
      />
    </Pressable>
  );
}

/** A classic 3×9 housie ticket. */
export const TicketView = memo(function TicketView({ cells, marked, lastCalled, onPressNumber, label, badge, compact }: Props) {
  const { colors } = useThemeColors();
  const cellHeight = compact ? 30 : 42;
  return (
    <View style={[styles.ticket, { backgroundColor: colors.ticketBg, borderColor: colors.gold }]}>
      {label || badge ? (
        <View style={styles.labelRow}>
          {label ? <Text style={[styles.label, { color: colors.goldDark }]}>{label}</Text> : <View />}
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.success }]}>
              <Text style={styles.badgeText} numberOfLines={1}>
                🏆 {badge}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * COLS, r * COLS + COLS).map((n, c) =>
            n === 0 ? (
              <View key={c} style={[styles.cell, { height: cellHeight, backgroundColor: colors.ticketBlank }]} />
            ) : (
              <Cell
                key={c}
                n={n}
                struck={marked.has(n)}
                isLast={lastCalled === n}
                height={cellHeight}
                compact={compact}
                onPress={onPressNumber}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  ticket: { borderWidth: 2, borderRadius: radius.md, padding: 4, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 3, gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 11 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, flexShrink: 1 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, margin: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  daub: { position: 'absolute', borderRadius: 999 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2.5 },
  strike: { position: 'absolute', height: 2.5, borderRadius: 2, backgroundColor: '#FDE68A' },
  num: { fontFamily: fonts.bold },
});
