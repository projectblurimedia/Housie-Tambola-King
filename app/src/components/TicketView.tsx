import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLS, Cells } from '@/game/engine/ticket';
import { fonts, goldGradient, radius } from '@/theme';
import { HINT_COLORS, STRIKE_COLORS, TICKET_THEMES, TicketTheme, toPalette } from '@/theme/ticketThemes';
import { useSettingsStore } from '@/state/settingsStore';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

interface Props {
  cells: Cells;
  /** Numbers shown as struck. */
  marked: ReadonlySet<number>;
  /** Pulsing ring on the most recent call (if it's on this ticket and not struck yet). */
  lastCalled?: number | null;
  /** Auto hint: called numbers not struck yet get a ring in the hint colour and gently pulse. */
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
  hintPulse,
  hint,
  corner,
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
  hintPulse: Animated.Value;
  hint: string;
  /** Corner radius from the player's ticket shape. */
  corner: number;
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
    Animated.spring(pop, {
      toValue: struck ? 1 : 0,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [struck, pop]);

  useEffect(() => {
    if (!isLast || struck) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLast, struck, pulse]);

  const press = () => {
    if (!onPress) return;
    if (canStrike && !canStrike(n)) {
      // Not called yet: a small "no" wiggle, nothing else.
      if (useSettingsStore.getState().haptics) Haptics.selectionAsync().catch(() => undefined);
      shake.setValue(0);
      Animated.sequence(
        [5, -5, 3, -3, 0].map((x) =>
          Animated.timing(shake, {
            toValue: x,
            duration: 45,
            useNativeDriver: true,
          }),
        ),
      ).start();
      return;
    }
    onPress(n);
  };

  const hinting = isHinted && !struck;
  const rippling = hinting || (isLast && !struck);

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.circleWrap, { transform: [{ translateX: shake }] }]}>
        {/* The number stays still; a soft ring ripples around it. */}
        {rippling ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.ripple,
              { borderRadius: corner },
              {
                borderColor: hint,
                opacity: hintPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: hintPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.22],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
        <Pressable
          onPress={press}
          disabled={!onPress}
          accessibilityLabel={`${n}${struck ? ' struck' : ''}`}
          style={[
            styles.circle,
            { borderRadius: corner },
            { backgroundColor: theme.cell, borderColor: theme.cellBorder },
            // Solid fill and no elevation: a see-through fill over Android's elevation shadow
            // showed as a dark smudge inside the hinted circle.
            hinting && {
              borderColor: hint,
              borderWidth: 2.5,
              elevation: 0,
              shadowOpacity: 0,
            },
          ]}
        >
          {isLast && !struck ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.lastGlow,
                { borderRadius: corner },
                {
                  borderColor: hint,
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                },
              ]}
            />
          ) : null}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.disc, { borderRadius: corner, opacity: pop, transform: [{ scale: pop }] }]}
          >
            <LinearGradient colors={strike.disc} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={[styles.num, { fontSize, color: struck ? '#fff' : theme.ink }]}>
            {n}
          </Text>
          <Animated.View
            style={[
              styles.strike,
              {
                backgroundColor: strike.line,
                opacity: pop,
                transform: [{ rotate: '-40deg' }, { scaleX: pop }],
              },
            ]}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** A 3×9 housie ticket of round number chips, lines between rows and column groups. */
export const TicketView = memo(function TicketView({
  cells,
  marked,
  lastCalled,
  hinted,
  onPressNumber,
  canStrike,
  label,
  badge,
  compact,
}: Props) {
  const theme =
    TICKET_THEMES[
      toPalette(
        useSettingsStore((s) => s.ticketTheme),
        'purple',
      )
    ];
  const strike =
    STRIKE_COLORS[
      toPalette(
        useSettingsStore((s) => s.strikeColor),
        'purple',
      )
    ];
  const hint =
    HINT_COLORS[
      toPalette(
        useSettingsStore((s) => s.hintColor),
        'purple',
      )
    ];
  const shape = useSettingsStore((s) => s.ticketShape) ?? 'round';
  const corner = shape === 'box' ? 4 : shape === 'soft' ? 11 : 999;
  // Numbers fit their circle at any screen width / display zoom (and ignore the phone's font
  // size — the circle can't grow): about half the circle, never bigger than the design size.
  const [cardWidth, setCardWidth] = useState(0);
  const baseSize = compact ? 15 : 19;
  const circle = cardWidth ? Math.min(54, (cardWidth - 8 - 3 - 6) / 9 - 3) : 0;
  const fontSize = circle ? Math.max(10, Math.min(baseSize, Math.floor(circle * 0.48))) : baseSize;

  // One shared, gentle zoom for every hinted number on this ticket.
  const hintPulse = useRef(new Animated.Value(0)).current;
  const pulsing = !!hinted?.size || (lastCalled != null && cells.includes(lastCalled) && !marked.has(lastCalled));
  useEffect(() => {
    if (!pulsing) {
      hintPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(hintPulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, hintPulse]);

  return (
    <LinearGradient colors={theme.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View
        style={[styles.card, { backgroundColor: theme.paper }]}
        onLayout={(e) => setCardWidth(Math.round(e.nativeEvent.layout.width))}
      >
        <View style={styles.header}>
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tag}>
            <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={styles.tagText}>🎫 {label ?? ''}</Text>
          </LinearGradient>
          {badge ? (
            <View style={styles.badge}>
              <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={styles.badgeText} numberOfLines={1}>
                🏆 {badge}
              </Text>
            </View>
          ) : (
            <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1} style={[styles.brand, { color: theme.brand }]}>♛ HOUSIE TAMBOLA KING</Text>
          )}
        </View>
        {[0, 1, 2].map((r) => (
          <View key={r}>
            {r > 0 ? <View style={[styles.hLine, { backgroundColor: theme.divider }]} /> : null}
            <View style={styles.row}>
              {[0, 1, 2].map((group) => (
                <React.Fragment key={group}>
                  {group > 0 ? <View style={[styles.vLine, { backgroundColor: theme.divider }]} /> : null}
                  <View style={styles.group}>
                    {[0, 1, 2].map((k) => {
                      const c = group * 3 + k;
                      const n = cells[r * COLS + c];
                      const line = k > 0 ? <View style={[styles.fLine, { backgroundColor: theme.faint }]} /> : null;
                      return n === 0 ? (
                        <React.Fragment key={c}>
                          {line}
                          <View style={styles.slot}>
                            <View
                              style={[styles.circleWrap, styles.blankCircle, { borderRadius: corner, backgroundColor: theme.blankCell }]}
                            >
                              <View style={[styles.blankDot, { backgroundColor: theme.blank }]} />
                            </View>
                          </View>
                        </React.Fragment>
                      ) : (
                        <React.Fragment key={c}>
                          {line}
                          <Cell
                            n={n}
                            struck={marked.has(n)}
                            isLast={lastCalled === n}
                            isHinted={!!hinted?.has(n)}
                            hintPulse={hintPulse}
                            hint={hint}
                            corner={corner}
                            fontSize={fontSize}
                            theme={theme}
                            strike={strike}
                            onPress={onPressNumber}
                            canStrike={canStrike}
                          />
                        </React.Fragment>
                      );
                    })}
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
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
  card: {
    borderRadius: radius.lg - 3,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
    paddingHorizontal: 4,
  },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#3B1D00',
    includeFontPadding: false,
  },
  brand: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  badge: {
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 1,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: '#fff',
    includeFontPadding: false,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  group: { flex: 3, flexDirection: 'row' },
  hLine: {
    height: 1.5,
    marginVertical: 3,
    marginHorizontal: 2,
    borderRadius: 1,
  },
  vLine: {
    width: 1.5,
    alignSelf: 'stretch',
    marginHorizontal: 2,
    borderRadius: 1,
  },
  fLine: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  ripple: { borderRadius: 999, borderWidth: 2.5 },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.5,
  },
  circleWrap: { width: '100%', maxWidth: 54, aspectRatio: 1 },
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
  blankCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankDot: { width: 6, height: 6, borderRadius: 3 },
  disc: { borderRadius: 999, overflow: 'hidden' },
  strike: { position: 'absolute', width: '80%', height: 2.5, borderRadius: 2 },
  num: { fontFamily: fonts.bold, includeFontPadding: false },
});
