import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useThemeColors } from '@/theme';

/** The 1–90 board (10 per row) with called numbers lit up. */
export const CalledBoard = memo(function CalledBoard({
  called,
  last,
  cellSize = 30,
}: {
  called: ReadonlySet<number>;
  last?: number | null;
  cellSize?: number;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.board}>
      {Array.from({ length: 9 }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: 10 }, (_, c) => {
            const n = r * 10 + c + 1;
            const on = called.has(n);
            const isLast = n === last;
            return (
              <View
                key={n}
                style={[
                  styles.cell,
                  {
                    height: cellSize,
                    backgroundColor: isLast ? colors.pink : on ? colors.primary : colors.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: on ? fonts.bold : fonts.medium,
                    fontSize: cellSize * 0.42,
                    color: on ? colors.white : colors.textMuted,
                  }}
                >
                  {n}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  board: { gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
