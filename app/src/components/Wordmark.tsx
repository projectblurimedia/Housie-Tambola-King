import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** The Housie Tambola King logo (assets/logo.png — the owner's artwork, transparent corners). */
export const LOGO = require('../../assets/logo.png');

/** Fonts matching the logo's lettering (loaded in App): chunky Lilita One + Lobster script. */
const CHUNKY = 'LilitaOne_400Regular';
const SCRIPT = 'Lobster_400Regular';
const OUTLINE = '#3B0764';

/**
 * Text with a thick outline, like the logo's lettering: the text is drawn several times,
 * shifted around in the outline colour, with the coloured face on top and a drop shadow.
 */
function OutlinedText({ children, style, outline = 2.5 }: { children: string; style: TextStyle; outline?: number }) {
  const offsets: [number, number][] = [
    [-outline, 0],
    [outline, 0],
    [0, -outline],
    [0, outline],
    [-outline * 0.7, -outline * 0.7],
    [outline * 0.7, -outline * 0.7],
    [-outline * 0.7, outline * 0.7],
    [outline * 0.7, outline * 0.7],
  ];
  return (
    <View>
      {/* Drop shadow */}
      <Text style={[style, styles.layer, { color: 'rgba(20,0,40,0.55)', transform: [{ translateY: outline * 1.6 }] }]}>{children}</Text>
      {offsets.map(([x, y], i) => (
        <Text key={i} style={[style, styles.layer, { color: OUTLINE, transform: [{ translateX: x }, { translateY: y }] }]}>
          {children}
        </Text>
      ))}
      <Text style={style}>{children}</Text>
    </View>
  );
}

/**
 * The title, lettered like the logo, one word per line:
 *   Housie  — chunky white
 *   Tambola — chunky gold, leaning forward
 *   King    — gold script
 */
export function TitleStack({ scale = 1 }: { scale?: number }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <OutlinedText
        style={{ ...styles.word, fontFamily: CHUNKY, fontSize: 22 * scale, lineHeight: 25 * scale, color: '#FFFFFF' }}
        outline={2 * scale}
      >
        Housie
      </OutlinedText>
      <OutlinedText
        style={{
          ...styles.word,
          fontFamily: CHUNKY,
          fontSize: 24 * scale,
          lineHeight: 27 * scale,
          color: '#FFD43B',
          transform: [{ skewX: '-8deg' }],
        }}
        outline={2 * scale}
      >
        Tambola
      </OutlinedText>
      <OutlinedText
        style={{ ...styles.word, fontFamily: SCRIPT, fontSize: 27 * scale, lineHeight: 32 * scale, color: '#FFC21A' }}
        outline={2 * scale}
      >
        King
      </OutlinedText>
    </View>
  );
}

/**
 * The app's brand mark.
 *  - "small" (Home header): the logo + the lettered title stacked beside it
 *  - "large" (Welcome): the logo big and centred
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  if (size === 'small') {
    return (
      <View style={styles.smallRow}>
        <Image source={LOGO} style={styles.smallLogo} resizeMode="contain" accessibilityLabel="Housie Tambola King" />
        <TitleStack scale={0.95} />
      </View>
    );
  }
  return (
    <View style={[styles.largeWrap, { alignSelf: 'center' }]}>
      <Image source={LOGO} style={{ width: 200, height: 200 }} resizeMode="contain" accessibilityLabel="Housie Tambola King" />
    </View>
  );
}

/**
 * Opening screen when the app starts: the logo zooms in over the purple background with a
 * soft glow, holds a moment, then everything fades into the app.
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const zoom = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(zoom, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [zoom, fade, onDone]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100, elevation: 100 }]} pointerEvents="none">
      <LinearGradient colors={['#1E0B3B', '#4C1D95', '#7E22CE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.intro}>
        <Animated.View
          style={{
            opacity: zoom,
            transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        >
          <View style={styles.glow} />
          <Image source={LOGO} style={{ width: 240, height: 240 }} resizeMode="contain" />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  word: { includeFontPadding: false },
  layer: { position: 'absolute', left: 0, top: 0 },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallLogo: { width: 70, height: 70 },
  largeWrap: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 120,
    backgroundColor: 'rgba(252,211,77,0.35)',
    shadowColor: '#FCD34D',
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 30,
  },
});
