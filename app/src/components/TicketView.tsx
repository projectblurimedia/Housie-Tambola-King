import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLS, Cells } from '@/game/engine/ticket';
import { fonts, goldGradient, radius } from '@/theme';
import { HINT_COLORS, STRIKE_COLORS, TICKET_THEMES, TicketTheme } from '@/theme/ticketThemes';
import { useSettingsStore } from '@/state/settingsStore';

interface Props {
  cells: Cells;
  /** Numbers shown as struck. */
  marked: ReadonlySet<number>;
  /** Pulsing ring on the most recent call (if it's on this ticket and not struck yet). */
  lastCalled?: number | null;
  /** Auto hint: called numbers not struck yet get a steady ring in the hint colour. */
  hinted?: ReadonlySet<number>;
  onPressNumber?: (n: number) => void;
  /** When given, tapping a number this returns false for just shakes the cell (not called yet). */
  canStrike?: (n: number) => boolean;
  label?: string;
  /** Prize names won with this ticket, shown as a ribbon. */
  badge?: string;
  compact?: boolean;
}

type Strike = (typeof STRIKE_COLORS)[keyof typeof STRIKE_COLORS];

/** One number: a round chip; struck = coloured disc pops in with a strike line. */
function Cell({
  n,
  struck,
  isLast,
  isHinted,
  hint,
  fontSize,
  theme,
  strike,
  onPress,
  canStrike,
}: {
  n: number;
  struck: boolean;
  isLast: boolean;
  isHinted: boolean;
  hint: string;
  fontSize: number;
  theme: TicketTheme;
  strike: Strike;
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
        [5, -5, 3, -3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true })),
      ).start();
      return;
    }
    onPress(n);
  };

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.circleWrap, { transform: [{ translateX: shake }] }]}>
        <Pressable
          onPress={press}
          disabled={!onPress}
          accessibilityLabel={`${n}${struck ? ' struck' : ''}`}
          style={[
            styles.circle,
            { backgroundColor: theme.cell, borderColor: theme.cellBorder },
            isHinted && !struck && { borderColor: hint, borderWidth: 2.5, backgroundColor: hint + '22' },
          ]}
        >
          {isLast && !struck ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.lastGlow,
                { borderColor: hint, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
              ]}
            />
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, styles.disc, { opacity: pop, transform: [{ scale: pop }] }]}>
            <LinearGradient colors={strike.disc} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Text style={[styles.num, { fontSize, color: struck ? '#fff' : theme.ink }]}>{n}</Text>
          <Animated.View
            style={[styles.strike, { backgroundColor: strike.line, opacity: pop, transform: [{ rotate: '-40deg' }, { scaleX: pop }] }]}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** A 3×9 housie ticket of round number chips, in the player's chosen colours. */
export const TicketView = memo(function TicketView({ cells, marked, lastCalled, hinted, onPressNumber, canStrike, label, badge, compact }: Props) {
  const themeKey = useSettingsStore((s) => s.ticketTheme);
  const strikeKey = useSettingsStore((s) => s.strikeColor);
  const theme: TicketTheme = TICKET_THEMES[themeKey] ?? TICKET_THEMES.classic;
  const strike = STRIKE_COLORS[strikeKey] ?? STRIKE_COLORS.purple;
  const hintKey = useSettingsStore((s) => s.hintColor);
  const hint = HINT_COLORS[hintKey] ?? HINT_COLORS.pink;
  const fontSize = compact ? 13 : 16;
  const gap = compact ? 3 : 4;

  return (
    <LinearGradient colors={theme.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View style={[styles.card, { backgroundColor: theme.paper }]}>
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
            <Text style={[styles.brand, { color: theme.brand }]}>♛ HOUSIE TAMBOLA KING</Text>
          )}
        </View>
        <View style={{ gap }}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={[styles.row, { gap: compact ? 6 : 8 }]}>
              {[0, 1, 2].map((group) => (
                <View key={group} style={[styles.group, { gap }]}>
                  {[0, 1, 2].map((k) => {
                    const c = group * 3 + k;
                    const n = cells[r * COLS + c];
                    return n === 0 ? (
                      <View key={c} style={styles.slot}>
                        <View style={[styles.circleWrap, styles.blankCircle, { backgroundColor: theme.blankCell }]}>
                          <View style={[styles.blankDot, { backgroundColor: theme.blank }]} />
                        </View>
                      </View>
                    ) : (
                      <Cell
                        key={c}
                        n={n}
                        struck={marked.has(n)}
                        isLast={lastCalled === n}
                        isHinted={!!hinted?.has(n)}
                        hint={hint}
                        fontSize={fontSize}
                        theme={theme}
                        strike={strike}
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
  card: { borderRadius: radius.lg - 3, padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bold, fontSize: 12, color: '#3B1D00', includeFontPadding: false },
  brand: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, includeFontPadding: false },
  badge: { backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 1 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff', includeFontPadding: false },
  row: { flexDirection: 'row' },
  group: { flex: 3, flexDirection: 'row' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circleWrap: { width: '100%', maxWidth: 46, aspectRatio: 1 },
  circle: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  },
  lastGlow: { borderRadius: 999, borderWidth: 3 },
  blankCircle: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  blankDot: { width: 6, height: 6, borderRadius: 3 },
  disc: { borderRadius: 999, overflow: 'hidden' },
  strike: { position: 'absolute', width: '80%', height: 2.5, borderRadius: 2 },
  num: { fontFamily: fonts.bold, includeFontPadding: false },
});
