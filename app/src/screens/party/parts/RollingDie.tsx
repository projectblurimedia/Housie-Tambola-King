import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

/** Pip spots on a unit face (u, v in 0..1). */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};
/** Faces next to each value (opposite faces add up to 7), for the two side faces. */
const SIDES: Record<number, [number, number]> = { 1: [2, 3], 2: [3, 1], 3: [1, 2], 4: [5, 6], 5: [6, 4], 6: [4, 5] };

/**
 * A real-looking die: an ivory cube seen from above at an angle — the top face (the number)
 * and two side faces, each with its own shade and proper pips, rounded edges and a shadow.
 */
export function Cube({ top, size }: { top: number; size: number }) {
  const [left, right] = SIDES[top] ?? [2, 3];
  const s = size * 0.5;
  const a = s * 0.866;
  const b = s * 0.5;
  // Each face maps the unit square: top (u → +x+y, v → −x+y), left, right.
  const faces: { m: [number, number, number, number, number, number]; fill: string; n: number; pip: string }[] = [
    { m: [a, b, -a, b, 0, 0], fill: '#FFFFFF', n: top, pip: top === 1 ? '#DC2626' : '#111827' },
    { m: [a, b, 0, s, -a, b], fill: '#E9E4DA', n: left, pip: '#1F2937' },
    { m: [a, -b, 0, s, 0, 2 * b], fill: '#D8D0C2', n: right, pip: '#1F2937' },
  ];
  const pt = (m: number[], u: number, v: number) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];
  const facePath = (m: number[]) => {
    const p = [pt(m, 0, 0), pt(m, 1, 0), pt(m, 1, 1), pt(m, 0, 1)];
    return `M${p.map((q) => q.join(' ')).join(' L')} Z`;
  };
  const w = 2 * a;
  const h = 2 * b + s;
  return (
    <Svg width={size} height={size * (h / w)} viewBox={`${-a - 2} -2 ${w + 4} ${h + 4}`}>
      <G>
        {faces.map((f, i) => (
          <Path key={`f${i}`} d={facePath(f.m)} fill={f.fill} stroke="#B9AE9C" strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        {faces.map((f, i) =>
          (PIPS[f.n] ?? []).map(([u, v], k) => {
            const [x, y] = pt(f.m, u, v);
            return <Circle key={`p${i}-${k}`} cx={x} cy={y} r={s * 0.085} fill={f.pip} />;
          }),
        )}
        {/* Light on the top edge */}
        <Path d={`M${-a * 0.92} ${b} L0 ${0.06 * b} L${a * 0.92} ${b}`} stroke="#fff" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.9} />
      </G>
    </Svg>
  );
}

/**
 * The dice tray under the board: the die tumbles across it like a real roll (it hops, turns a
 * quarter at a time and shows a new face each turn, its shadow following), then lands on the
 * number with a small bounce. `rolling` = tapped Roll and waiting; a new `rollKey` = landed.
 */
export function RollingDie({ value, rollKey, rolling, size = 54 }: { value: number; rollKey?: number; rolling: boolean; size?: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(value || 1);
  const first = useRef(true);

  // Waiting for the server: keep tumbling in place.
  useEffect(() => {
    if (!rolling) return;
    x.setValue(-1);
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(turn, { toValue: 1, duration: 260, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    turn.setValue(0);
    loop.start();
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 260);
    return () => {
      loop.stop();
      clearInterval(flicker);
    };
  }, [rolling, x, hop, turn]);

  // The result: tumble across the tray (4 quarter turns), land and bounce.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setFace(value || 1);
      return;
    }
    if (!rollKey) return;
    x.setValue(-1);
    const tumble = () =>
      Animated.parallel([
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.timing(turn, { toValue: 1, duration: 220, easing: Easing.linear, useNativeDriver: true }), Animated.timing(turn, { toValue: 0, duration: 0, useNativeDriver: true })]),
      ]);
    const timers = [0, 1, 2].map((i) => setTimeout(() => setFace(1 + Math.floor(Math.random() * 6)), i * 220 + 110));
    timers.push(setTimeout(() => setFace(value || 1), 3 * 220 + 110));
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: 880, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([tumble(), tumble(), tumble(), tumble()]),
    ]).start(() => Animated.spring(hop, { toValue: 0, friction: 3, tension: 200, useNativeDriver: true }).start());
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  return (
    <View style={{ width: size * 2.6, height: size * 1.25, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size * 0.95,
            height: size * 0.22,
            borderRadius: size,
            transform: [
              { translateX: x.interpolate({ inputRange: [-1, 0], outputRange: [-size * 0.9, 0] }) },
              { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          transform: [
            { translateX: x.interpolate({ inputRange: [-1, 0], outputRange: [-size * 0.9, 0] }) },
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.35] }) },
            { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
          ],
        }}
      >
        <Cube top={face} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: 2 },
});
