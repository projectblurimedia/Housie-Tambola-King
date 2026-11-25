import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PartyKind } from '@/services/partyService';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/** Each party game's look: a vivid two-tone gradient, a soft tint, and its emblem. */
export const PARTY_LOOK: Record<PartyKind, { emoji: string; colors: [string, string]; tint: string }> = {
  seeta: { emoji: '🏹', colors: ['#F97316', '#BE123C'], tint: '#FFEDD5' },
  show: { emoji: '🃏', colors: ['#6366F1', '#7C3AED'], tint: '#E0E7FF' },
  snakes: { emoji: '🐍', colors: ['#10B981', '#047857'], tint: '#D1FAE5' },
  chamma: { emoji: '🌰', colors: ['#F59E0B', '#B45309'], tint: '#FEF3C7' },
};

export const GOLD_EDGE = ['#FFF1A8', '#D4A017', '#8A6100', '#F5D06F'] as const;
export const GOLD_FILL = ['#FFF1A8', '#F5B700', '#B87400'] as const;

/** A thin metallic gold edge around anything (the "premium" frame used across party games). */
export function GoldFrame({
  radius = 22,
  width = 1.5,
  style,
  innerStyle,
  colors,
  children,
}: {
  radius?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  /** Inner gradient (defaults to a deep purple). */
  colors?: readonly [string, string, ...string[]];
  children: React.ReactNode;
}) {
  return (
    <LinearGradient colors={GOLD_EDGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: radius, padding: width }, style]}>
      <LinearGradient
        colors={colors ?? ['#140A24', '#2E1065', '#4C1D95']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: radius - width, overflow: 'hidden' }, innerStyle]}
      >
        {/* A soft diagonal sheen across the top-left. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </LinearGradient>
    </LinearGradient>
  );
}

/** A round emblem: gold ring, dark glass centre, the emoji gently floating. */
export function Medallion({ emoji, size = 56, float = true }: { emoji: string; size?: number; float?: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, float]);
  return (
    <LinearGradient colors={GOLD_EDGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, padding: 2 }}>
      <View style={[styles.medInner, { borderRadius: size / 2 }]}>
        <Animated.Text
          maxFontSizeMultiplier={FIXED_SHAPE_SCALE}
          style={{
            fontSize: size * 0.5,
            lineHeight: size * 0.64,
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [1.5, -1.5] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
            ],
          }}
        >
          {emoji}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

/** A light sweep that glides across its parent every few seconds (for gold buttons). */
export function ShineSweep({ width = 320, every = 2600 }: { width?: number; every?: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(every),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x, every]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sweep,
        { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-80, width] }) }, { skewX: '-20deg' }] },
      ]}
    >
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  medInner: { flex: 1, backgroundColor: 'rgba(10,5,20,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 60 },
});
