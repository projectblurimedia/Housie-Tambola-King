import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PartyKind } from '@/services/partyService';
import { darkColors, type ThemeColors } from '@/theme/colors';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/** Each party game's look: a deep jewel-tone gradient, an accent, its emblem (illustrations: gameArt.ts). */
export const PARTY_LOOK: Record<PartyKind, { emoji: string; colors: [string, string]; accent: string }> = {
  seeta: { emoji: '🏹', colors: ['#4A0D2E', '#9F1239'], accent: '#FDE68A' },
  show: { emoji: '🃏', colors: ['#1E1B4B', '#4338CA'], accent: '#A5F3FC' },
  snakes: { emoji: '🐍', colors: ['#052E2B', '#0F766E'], accent: '#D9F99D' },
  chamma: { emoji: '🌰', colors: ['#3B1A06', '#9A3412'], accent: '#FDE68A' },
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

/**
 * Each party game's whole-screen palette (background, cards, text, borders) in its own colours,
 * used through ThemeOverride so pages, cards and pop-ups all match the header.
 */
const partyPalette = (bg: string, surface: string, surfaceAlt: string, border: string, primary: string): ThemeColors => ({
  ...darkColors,
  primary,
  goldDark: '#FCD34D',
  background: bg,
  surface,
  surfaceAlt,
  border,
  text: '#FFF8F0',
  textMuted: 'rgba(255,248,240,0.68)',
  overlay: 'rgba(0,0,0,0.65)',
});
export const PARTY_THEME: Record<PartyKind, { palette: ThemeColors; page: [string, string] }> = {
  seeta: { palette: partyPalette('#2A0718', '#3D0F26', '#521633', '#6B2343', '#FB7185'), page: ['#3A0A22', '#1C0410'] },
  show: { palette: partyPalette('#110F33', '#1E1B4B', '#2A2770', '#3B3790', '#818CF8'), page: ['#1B1850', '#0B0A24'] },
  snakes: { palette: partyPalette('#03201E', '#06332F', '#0A4842', '#11605A', '#34D399'), page: ['#06302C', '#021513'] },
  chamma: { palette: partyPalette('#241004', '#3A1A07', '#4F250C', '#6B3413', '#F59E0B'), page: ['#3A1A07', '#1A0B02'] },
};
