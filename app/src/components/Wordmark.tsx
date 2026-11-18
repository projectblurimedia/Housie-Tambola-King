import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { MiniBall } from './NumberBall';

/** The Housie Tambola King logo (assets/logo.png — the owner's artwork). */
export const LOGO = require('../../assets/logo.png');

/** Fonts matching the logo's lettering (loaded in App). */
const CHUNKY = 'LilitaOne_400Regular';
const SCRIPT = 'Lobster_400Regular';
const OUTLINE = '#3B0764';

/** Text with a thick outline + drop shadow, like the logo's lettering. */
function OutlinedText({ children, style, outline = 2.5 }: { children: string; style: TextStyle; outline?: number }) {
  const o = outline;
  const offsets: [number, number][] = [
    [-o, 0],
    [o, 0],
    [0, -o],
    [0, o],
    [-o * 0.7, -o * 0.7],
    [o * 0.7, -o * 0.7],
    [-o * 0.7, o * 0.7],
    [o * 0.7, o * 0.7],
  ];
  return (
    <View>
      <Text style={[style, styles.layer, { color: 'rgba(20,0,40,0.55)', transform: [{ translateY: o * 1.6 }] }]}>{children}</Text>
      {offsets.map(([x, y], i) => (
        <Text key={i} style={[style, styles.layer, { color: OUTLINE, transform: [{ translateX: x }, { translateY: y }] }]}>
          {children}
        </Text>
      ))}
      <Text style={style}>{children}</Text>
    </View>
  );
}

/** Housie / Tambola / King lettered like the logo, one word per line (opening screen). */
function TitleStack({ scale = 1 }: { scale?: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <OutlinedText
        style={{ ...styles.word, fontFamily: CHUNKY, fontSize: 30 * scale, lineHeight: 34 * scale, color: '#FFFFFF' }}
        outline={2.6 * scale}
      >
        Housie
      </OutlinedText>
      <OutlinedText
        style={{
          ...styles.word,
          fontFamily: CHUNKY,
          fontSize: 33 * scale,
          lineHeight: 37 * scale,
          color: '#FFD43B',
          transform: [{ skewX: '-8deg' }],
        }}
        outline={2.6 * scale}
      >
        Tambola
      </OutlinedText>
      <OutlinedText
        style={{ ...styles.word, fontFamily: SCRIPT, fontSize: 38 * scale, lineHeight: 46 * scale, color: '#FFC21A' }}
        outline={2.6 * scale}
      >
        King
      </OutlinedText>
    </View>
  );
}

/** A jewelled gold crown, drawn in vector. */
function Crown({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.72} viewBox="0 0 100 72">
      <Defs>
        <SvgGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3B0" />
          <Stop offset="0.5" stopColor="#F5C542" />
          <Stop offset="1" stopColor="#B7791F" />
        </SvgGradient>
      </Defs>
      <Path
        d="M8 56 L4 18 L28 38 L50 6 L72 38 L96 18 L92 56 Z"
        fill="url(#crownGold)"
        stroke="#8A5A00"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Rect x={8} y={56} width={84} height={12} rx={3} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={2} />
      <Circle cx={4} cy={16} r={5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={50} cy={6} r={5.5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={96} cy={16} r={5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={30} cy={62} r={3.2} fill="#2563EB" />
      <Circle cx={50} cy={62} r={3.8} fill="#E11D48" />
      <Circle cx={70} cy={62} r={3.2} fill="#06B6D4" />
    </Svg>
  );
}

/** Soft light rays fanning out from the centre (the logo's backdrop), drawn in vector. */
function Rays({ size }: { size: number }) {
  const c = size / 2;
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const b = a + Math.PI / 32;
    const r = size;
    return `M${c} ${c} L${c + Math.cos(a) * r} ${c + Math.sin(a) * r} L${c + Math.cos(b) * r} ${c + Math.sin(b) * r} Z`;
  });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G opacity={0.12}>
        {rays.map((d, i) => (
          <Path key={i} d={d} fill="#FFFFFF" />
        ))}
      </G>
    </Svg>
  );
}

/**
 * The app title for headers: one icon (the logo, small) and "Housie Tambola King" on one line
 * in a clean chunky font — King in gold. Shrinks to fit narrow phones.
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const large = size === 'large';
  const font = large ? 28 : 23;
  return (
    <View style={[styles.row, large && { justifyContent: 'center' }]}>
      <Image source={LOGO} style={{ width: large ? 52 : 40, height: large ? 52 : 40 }} resizeMode="contain" />
      <Text style={[styles.line, { fontSize: font, lineHeight: font * 1.2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        Housie Tambola <Text style={styles.king}>King</Text>
      </Text>
    </View>
  );
}

/**
 * Opening screen, built in code (no picture pasted on): purple gradient with slowly turning
 * light rays, a gold crown dropping in, the lettered Housie / Tambola / King, and the 7 · 31 · 65
 * balls bouncing in — then it all fades into the app.
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const crown = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const balls = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.sequence([
      Animated.parallel([
        Animated.spring(crown, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
        Animated.timing(title, { toValue: 1, duration: 420, delay: 120, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]),
      Animated.stagger(
        110,
        balls.map((b) => Animated.spring(b, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })),
      ),
      Animated.delay(650),
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [crown, title, balls, spin, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100, elevation: 100 }]} pointerEvents="none">
      <LinearGradient colors={['#2E0A5A', '#5B21B6', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.intro}>
        <Animated.View
          style={[styles.rays, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
        >
          <Rays size={900} />
        </Animated.View>
        <Animated.View
          style={{
            opacity: crown,
            transform: [{ translateY: crown.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
            marginBottom: -6,
          }}
        >
          <Crown width={150} />
        </Animated.View>
        <Animated.View style={{ opacity: title, transform: [{ scale: title.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
          <TitleStack scale={1.35} />
        </Animated.View>
        <View style={styles.ballsRow}>
          {[7, 31, 65].map((n, i) => (
            <Animated.View key={n} style={{ transform: [{ scale: balls[i] }, { translateY: i === 1 ? -8 : 0 }] }}>
              <MiniBall n={n} size={54} />
            </Animated.View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  word: { includeFontPadding: false },
  layer: { position: 'absolute', left: 0, top: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: {
    flexShrink: 1,
    fontFamily: CHUNKY,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(30,0,60,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  king: { color: '#FFD43B' },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rays: { position: 'absolute', width: 900, height: 900 },
  ballsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
