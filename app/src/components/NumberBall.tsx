import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/localization/i18n';
import { fonts } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

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

/**
 * Before the first number: a gold ball with a softly pulsing star and "READY", and a slow
 * glowing ring — instead of an empty "–".
 */
function WaitingBall({ size }: { size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: '#FDE68A',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
          },
        ]}
      />
      <LinearGradient
        colors={['#FFF1A8', '#F5B700', '#B87400']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.inner, styles.waitingFace, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}>
          <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }] }}>
            <Ionicons name="star" size={size * 0.24} color="#FDE68A" />
          </Animated.View>
          <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1} adjustsFontSizeToFit style={[styles.waitingText, { fontSize: size * 0.1 }]}>
            {i18n.t('game.ballReady').toUpperCase()}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/**
 * The big called-number ball. The ball itself stays still (no spinning or jumping): a new
 * number fades in and soft rings ripple out from the ball.
 */
export function NumberBall({ number, size = 120, subtitle }: { number: number | null; size?: number; subtitle?: string | null }) {
  const fade = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (number === null) return;
    fade.setValue(0.25);
    ring1.setValue(0);
    ring2.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(ring2, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [number, fade, ring1, ring2]);

  const [light, dark] = number ? ballColors(number) : ['#E5E7EB', '#9CA3AF'];
  const ring = (v: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: light,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
  });

  if (number === null) {
    return (
      <View style={{ alignItems: 'center' }}>
        <WaitingBall size={size} />
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[styles.ring, ring(ring1)]} />
        <Animated.View pointerEvents="none" style={[styles.ring, ring(ring2)]} />
        <LinearGradient
          colors={[light, dark]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={[styles.inner, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}>
            <Animated.Text
              maxFontSizeMultiplier={FIXED_SHAPE_SCALE}
              style={[styles.text, { opacity: fade, fontSize: size * 0.34, lineHeight: size * 0.5, includeFontPadding: false }]}
            >
              {number ?? '–'}
            </Animated.Text>
          </View>
        </LinearGradient>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Small ball for the "previous numbers" strip. */
export function MiniBall({ n, size = 34 }: { n: number; size?: number }) {
  const [light, dark] = ballColors(n);
  return (
    <LinearGradient
      colors={[light, dark]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={{ fontFamily: fonts.bold, color: '#fff', fontSize: size * 0.42 }}>
        {n}
      </Text>
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
  ring: { position: 'absolute', borderWidth: 3 },
  inner: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.display, color: '#1B1030' },
  waitingFace: { backgroundColor: '#3B0764', gap: 2 },
  waitingText: { fontFamily: fonts.bold, color: '#FDE68A', letterSpacing: 1.5, includeFontPadding: false, maxWidth: '86%' },
  subtitle: { marginTop: 8, fontFamily: fonts.medium, fontSize: 14, color: '#fff', opacity: 0.9, fontStyle: 'italic' },
});
