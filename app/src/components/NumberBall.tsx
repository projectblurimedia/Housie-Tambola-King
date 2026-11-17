import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme';

/** Ball colour by decade, like a real tambola set. */
const DECADE_COLORS: [string, string][] = [
  ['#F87171', '#B91C1C'],
  ['#FB923C', '#C2410C'],
  ['#FACC15', '#A16207'],
  ['#4ADE80', '#15803D'],
  ['#2DD4BF', '#0F766E'],
  ['#60A5FA', '#1D4ED8'],
  ['#A78BFA', '#6D28D9'],
  ['#F472B6', '#BE185D'],
  ['#94A3B8', '#334155'],
];

export function ballColors(n: number): [string, string] {
  return DECADE_COLORS[Math.min(8, Math.floor((n === 90 ? 89 : n) / 10))];
}

/** The big called-number ball. Pops in whenever `number` changes. */
export function NumberBall({ number, size = 120, subtitle }: { number: number | null; size?: number; subtitle?: string | null }) {
  const scale = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (number === null) return;
    scale.setValue(0.3);
    spin.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [number, scale, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  const [light, dark] = number ? ballColors(number) : ['#E5E7EB', '#9CA3AF'];

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
        <LinearGradient
          colors={[light, dark]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={[styles.inner, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}>
            <Text style={[styles.text, { fontSize: size * 0.36, lineHeight: size * 0.44 }]}>{number ?? '–'}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Small ball for the "previous numbers" strip. */
export function MiniBall({ n, size = 34 }: { n: number; size?: number }) {
  const [light, dark] = ballColors(n);
  return (
    <LinearGradient colors={[light, dark]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: size * 0.42 }}>{n}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  inner: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.display, color: '#1B1030' },
  subtitle: { marginTop: 8, fontFamily: fonts.medium, fontSize: 14, color: '#fff', opacity: 0.9, fontStyle: 'italic' },
});
