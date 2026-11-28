import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Pip spots on a face (u, v in 0..1). */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

let dieSeq = 0;

/**
 * A glossy ivory die seen face-on: rounded corners, a soft top-left light, a bevelled rim and
 * sunk pips (a big red one for 1) — crisp vector art at any size.
 */
export function DieFace({ value, size }: { value: number; size: number }) {
  const id = useRef(`die${++dieSeq}`).current;
  const pips = PIPS[value] ?? PIPS[1];
  const one = value === 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.55" stopColor="#F7F2E8" />
          <Stop offset="1" stopColor="#DCD1BD" />
        </SvgGradient>
        <SvgGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#B9AB92" />
        </SvgGradient>
        <RadialGradient id={`${id}p`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor={one ? '#F87171' : '#4B5563'} />
          <Stop offset="1" stopColor={one ? '#991B1B' : '#0B1220'} />
        </RadialGradient>
      </Defs>
      <Rect x={4} y={4} width={92} height={92} rx={22} fill={`url(#${id}r)`} />
      <Rect x={8} y={8} width={84} height={84} rx={18} fill={`url(#${id}b)`} />
      <Rect x={14} y={12} width={44} height={14} rx={7} fill="#fff" opacity={0.55} />
      {pips.map(([u, v], i) => (
        <React.Fragment key={i}>
          <Circle cx={8 + u * 84} cy={8 + v * 84 + 1} r={one ? 13 : 8.5} fill="#fff" opacity={0.8} />
          <Circle cx={8 + u * 84} cy={8 + v * 84} r={one ? 12.5 : 8} fill={`url(#${id}p)`} />
          <Circle cx={8 + u * 84 - (one ? 4 : 2.6)} cy={8 + v * 84 - (one ? 4 : 2.6)} r={one ? 3 : 1.8} fill="#fff" opacity={0.45} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/** Small die for buttons / thumbnails. */
export function Cube({ top, size }: { top: number; size: number }) {
  return <DieFace value={top} size={size} />;
}

/**
 * The die in the middle of the dock. While waiting for the server (`rolling`) it tumbles in
 * place; when the result lands (new `rollKey`) it spins down smoothly — turning in 3D, the faces
 * flicking slower and slower — bounces twice on its shadow and settles on the number with a
 * gold flash.
 */
export function RollingDie({ value, rollKey, rolling, size = 54 }: { value: number; rollKey?: number; rolling: boolean; size?: number }) {
  // 1 = at rest (flat, face-on) — the first die shown is whole, not mid-spin.
  const spin = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(value || 1);
  const first = useRef(true);
  const busyLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Waiting for the result: keep tumbling.
  useEffect(() => {
    if (!rolling) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(spin, { toValue: 1, duration: 520, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    busyLoop.current = loop;
    loop.start();
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 110);
    return () => {
      loop.stop();
      busyLoop.current = null;
      clearInterval(flicker);
    };
  }, [rolling, spin, hop]);

  // The result: spin down, bounce, settle.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setFace(value || 1);
      return;
    }
    if (!rollKey) return;
    busyLoop.current?.stop();
    spin.setValue(0);
    hop.setValue(1);
    flash.setValue(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (const gap of [60, 70, 80, 95, 115, 140, 170]) {
      at += gap;
      timers.push(setTimeout(() => setFace(1 + Math.floor(Math.random() * 6)), at));
    }
    timers.push(setTimeout(() => setFace(value || 1), at + 40));
    Animated.parallel([
      Animated.timing(spin, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0.4, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0.12, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]).start();
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.flash,
          {
            width: size * 1.45,
            height: size * 1.45,
            borderRadius: size,
            opacity: flash,
            transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.05] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size * 0.9,
            height: size * 0.2,
            borderRadius: size,
            top: size * 1.18,
            transform: [{ scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
            opacity: hop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.15] }),
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { perspective: 600 },
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.45] }) },
            { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-540deg', '0deg'] }) },
            { rotateX: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['50deg', '-30deg', '0deg'] }) },
            { rotateY: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-40deg', '25deg', '0deg'] }) },
          ],
        }}
      >
        <View style={styles.dieShadow}>
          <DieFace value={face} size={size} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', backgroundColor: '#000' },
  flash: { position: 'absolute', backgroundColor: 'rgba(253,224,71,0.45)' },
  dieShadow: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
});
