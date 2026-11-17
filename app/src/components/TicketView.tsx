import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLS, Cells } from '@/game/engine/ticket';
import { fonts, goldGradient, heroGradient, radius } from '@/theme';

interface Props {
  cells: Cells;
  /** Numbers shown as struck / circled. */
  marked: ReadonlySet<number>;
  /** Pulsing ring on the most recent call (if it's on this ticket and not struck yet). */
  lastCalled?: number | null;
  onPressNumber?: (n: number) => void;
  /** When given, tapping a number this returns false for just shakes the tile (not called yet). */
  canStrike?: (n: number) => boolean;
  label?: string;
  /** Prize names won with this ticket, shown as a ribbon. */
  badge?: string;
  compact?: boolean;
}

const INK = '#2E1065';
const TILE_BORDER = '#E8DCBF';

/** One number tile: raised white tile; struck = purple disc + gold strike, with a pop. */
function Tile({
  n,
  struck,
  isLast,
  height,
  fontSize,
  onPress,
  canStrike,
}: {
  n: number;
  struck: boolean;
  isLast: boolean;
  height: number;
  fontSize: number;
  onPress?: (n: number) => void;
  canStrike?: (n: number) => boolean;
}) {
  const pop = useRef(new Animated.Value(struck ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

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

  const press = () => {
    if (!onPress) return;
    if (canStrike && !canStrike(n)) {
      // Not called yet: a small "no" wiggle, nothing else.
      Haptics.selectionAsync().catch(() => undefined);
      shake.setValue(0);
      Animated.sequence(
        [6, -6, 4, -4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true })),
      ).start();
      return;
    }
    onPress(n);
  };

  const disc = height - 10;
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: shake }] }}>
      <Pressable onPress={press} disabled={!onPress} accessibilityLabel={`${n}${struck ? ' struck' : ''}`} style={[styles.tile, { height }]}>
        {isLast && !struck ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.lastGlow,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
            ]}
          />
        ) : null}
        <Animated.View style={[styles.disc, { width: disc, height: disc, opacity: pop, transform: [{ scale: pop }] }]}>
          <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Text style={[styles.num, { fontSize, color: struck ? '#fff' : INK }]}>{n}</Text>
        <Animated.View style={[styles.strike, { width: disc * 0.9, opacity: pop, transform: [{ rotate: '-35deg' }, { scaleX: pop }] }]} />
      </Pressable>
    </Animated.View>
  );
}

/** A classic 3×9 housie ticket: gradient frame, gold tag, raised number tiles. */
export const TicketView = memo(function TicketView({ cells, marked, lastCalled, onPressNumber, canStrike, label, badge, compact }: Props) {
  const height = compact ? 34 : 46;
  const fontSize = compact ? 15 : 19;
  const gap = compact ? 3 : 4;

  return (
    <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View style={styles.card}>
        <View style={styles.header}>
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tag}>
            <Text style={styles.tagText}>🎫 {label ?? ''}</Text>
          </LinearGradient>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                🏆 {badge}
              </Text>
            </View>
          ) : (
            <Text style={styles.brand}>♛ HOUSIE TAMBOLA KING</Text>
          )}
        </View>
        <View style={{ gap }}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={styles.row}>
              {[0, 1, 2].map((group) => (
                <View key={group} style={[styles.group, { gap }]}>
                  {[0, 1, 2].map((k) => {
                    const c = group * 3 + k;
                    const n = cells[r * COLS + c];
                    return n === 0 ? (
                      <View key={c} style={[styles.blank, { height }]}>
                        <Text style={styles.blankMark}>✦</Text>
                      </View>
                    ) : (
                      <Tile
                        key={c}
                        n={n}
                        struck={marked.has(n)}
                        isLast={lastCalled === n}
                        height={height}
                        fontSize={fontSize}
                        onPress={onPressNumber}
                        canStrike={canStrike}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    padding: 3,
    shadowColor: '#2E1065',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  card: { backgroundColor: '#FFF8E7', borderRadius: radius.lg - 3, padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bold, fontSize: 12, color: '#3B1D00', includeFontPadding: false },
  brand: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, color: 'rgba(76,29,149,0.45)', includeFontPadding: false },
  badge: { backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 1 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff', includeFontPadding: false },
  row: { flexDirection: 'row', gap: 8 },
  group: { flex: 3, flexDirection: 'row' },
  tile: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: TILE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#7C5A12',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  },
  lastGlow: { borderRadius: 9, borderWidth: 2.5, borderColor: '#EC4899' },
  blank: { flex: 1, borderRadius: 9, backgroundColor: '#F3E6C5', alignItems: 'center', justifyContent: 'center' },
  blankMark: { fontSize: 9, color: 'rgba(180,83,9,0.28)' },
  disc: { position: 'absolute', borderRadius: 999, overflow: 'hidden' },
  strike: { position: 'absolute', height: 2.5, borderRadius: 2, backgroundColor: '#FDE68A' },
  num: { fontFamily: fonts.bold, includeFontPadding: false },
});
