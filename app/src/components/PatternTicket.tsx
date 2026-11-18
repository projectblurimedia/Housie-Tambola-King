import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { PrizeType } from '@/game/engine/ticket';

/** Positions (0–26, row-major 3×9) of a sample ticket's 15 numbers: 5 per row, 5 per column group. */
const FILLED = [0, 2, 4, 6, 8, 10, 12, 14, 16, 17, 18, 19, 21, 22, 24];
/** Spread-out order for Fast 3/5/7. */
const FAST_ORDER = [0, 12, 24, 6, 19, 16, 21];

function highlighted(prize: PrizeType): Set<number> {
  const row = (r: number) => FILLED.filter((i) => Math.floor(i / 9) === r);
  const cols = (from: number) => FILLED.filter((i) => i % 9 >= from && i % 9 < from + 3);
  switch (prize) {
    case 'fast_3':
      return new Set(FAST_ORDER.slice(0, 3));
    case 'fast_5':
      return new Set(FAST_ORDER.slice(0, 5));
    case 'fast_7':
      return new Set(FAST_ORDER.slice(0, 7));
    case 'line_1':
      return new Set(row(0));
    case 'line_2':
      return new Set(row(1));
    case 'line_3':
      return new Set(row(2));
    case 'col_left':
      return new Set(cols(0));
    case 'col_center':
      return new Set(cols(3));
    case 'col_right':
      return new Set(cols(6));
    default:
      return new Set(FILLED);
  }
}

/**
 * A tiny number-less ticket that shows what a prize means: the cells that make it light up
 * gold one after another (5 for Fast 5, the first row for First Line, …).
 */
export function PatternTicket({ prize, width = 132 }: { prize: PrizeType; width?: number }) {
  const on = highlighted(prize);
  const cell = (width - 12 - 8 * 2) / 9;
  const order = [...on];
  const anim = useRef(order.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      90,
      anim.map((v) => Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [anim]);

  return (
    <View style={[styles.ticket, { width }]}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: 9 }, (_, c) => {
            const i = r * 9 + c;
            const filled = FILLED.includes(i);
            const k = order.indexOf(i);
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  {
                    width: cell,
                    height: cell,
                    borderRadius: cell / 2,
                    backgroundColor: filled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)',
                  },
                ]}
              >
                {k >= 0 ? (
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.lit,
                      {
                        borderRadius: cell / 2,
                        opacity: anim[k],
                        transform: [{ scale: anim[k].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                      },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: 6, gap: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { overflow: 'hidden' },
  lit: { backgroundColor: '#FDE68A' },
});
