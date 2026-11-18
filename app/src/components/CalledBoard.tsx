import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useThemeColors } from '@/theme';

/** The 1–90 board (10 per row) with called numbers lit up. */
export const CalledBoard = memo(function CalledBoard({
  called,
  last,
  cellSize = 30,
  cellWidth,
}: {
  called: ReadonlySet<number>;
  last?: number | null;
  cellSize?: number;
  /** Fixed cell width (Caller Mode's big board); otherwise cells stretch to fill the width. */
  cellWidth?: number;
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
                  cellWidth ? { flex: 0, width: cellWidth } : null,
                  {
                    height: cellSize,
                    backgroundColor: isLast ? colors.pink : on ? colors.primary : colors.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: on ? fonts.bold : fonts.medium,
                    fontSize: cellSize * 0.46,
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

/** "Semi box": rounded rectangle corners. */
export const BOARD_CELL_RADIUS = 9;
export const BOARD_GAP = 3;

const styles = StyleSheet.create({
  board: { gap: BOARD_GAP },
  row: { flexDirection: 'row', gap: BOARD_GAP },
  cell: { flex: 1, borderRadius: BOARD_CELL_RADIUS, alignItems: 'center', justifyContent: 'center' },
});
