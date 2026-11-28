import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, TextStyle, View } from 'react-native';

const SHOW_MS = 2600;
const MOVE_MS = 380;

/**
 * A search box's hint that changes by itself ("Search workers near you" → "Search shops near
 * you" → "Search job posts near you"): the current line slides up and fades out while the next
 * slides in from below. Never moves when there's only one line.
 */
export function RotatingPlaceholder({ lines, style }: { lines: string[]; style?: StyleProp<TextStyle> }) {
  const [index, setIndex] = useState(0);
  const move = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lines.length < 2) return undefined;
    const timer = setInterval(() => {
      Animated.timing(move, { toValue: 1, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
        setIndex((value) => (value + 1) % lines.length);
        move.setValue(0);
      });
    }, SHOW_MS);
    return () => clearInterval(timer);
  }, [lines.length, move]);

  const current = lines[index % Math.max(1, lines.length)] ?? '';
  const next = lines[(index + 1) % Math.max(1, lines.length)] ?? '';

  return (
    <View style={styles.box}>
      <Animated.Text
        numberOfLines={1}
        style={[
          style,
          {
            opacity: move.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ translateY: move.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }],
          },
        ]}
      >
        {current}
      </Animated.Text>
      {lines.length > 1 ? (
        <Animated.Text
          numberOfLines={1}
          style={[
            style,
            styles.next,
            {
              opacity: move,
              transform: [{ translateY: move.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          {next}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  next: { position: 'absolute', left: 0, right: 0 },
});
