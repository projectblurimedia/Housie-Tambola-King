import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Clean, premium font for the title (loaded in App). */
const BOLD = 'Montserrat_800ExtraBold';
const BLACK = 'Montserrat_900Black';

const BALL_COLORS: Record<string, [string, string, string]> = {
  red: ['#FF8A8A', '#E11D2E', '#7F0A14'],
  blue: ['#8EC5FF', '#1D6BEB', '#0B2C7A'],
  green: ['#9BF59B', '#16A34A', '#0B4D22'],
  gold: ['#FFF1A8', '#F5B700', '#8A5A00'],
};

/**
 * A glossy bingo ball like the logo's: coloured sphere (lit from the top-left), a white
 * centre with a bold black number, and a soft white reflection.
 */
export function BingoBall({ n, size = 54, color = 'red' }: { n: number | string; size?: number; color?: keyof typeof BALL_COLORS }) {
  const [light, mid, dark] = BALL_COLORS[color];
  const id = `ball-${color}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.45" stopColor={mid} />
            <Stop offset="1" stopColor={dark} />
          </RadialGradient>
          <RadialGradient id={`${id}-face`} cx="45%" cy="40%" r="65%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#E5E7EB" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#${id})`} />
        <Circle cx={50} cy={52} r={29} fill={`url(#${id}-face)`} />
        <Ellipse cx={34} cy={24} rx={16} ry={8} fill="#FFFFFF" opacity={0.55} transform="rotate(-30 34 24)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { paddingTop: size * 0.04 }]}>
        <Text
          style={{ fontFamily: BLACK, fontSize: size * (String(n).length > 1 ? 0.28 : 0.34), color: '#111827', includeFontPadding: false }}
        >
          {n}
        </Text>
      </View>
    </View>
  );
}

/** A glossy gold crown: metal bands, highlights and sparkling jewels. */
function ShinyCrown({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.78} viewBox="0 0 120 94">
      <Defs>
        <SvgGradient id="metal" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF8D6" />
          <Stop offset="0.25" stopColor="#FFD84D" />
          <Stop offset="0.5" stopColor="#E9A400" />
          <Stop offset="0.72" stopColor="#FFE27A" />
          <Stop offset="1" stopColor="#B87400" />
        </SvgGradient>
        <SvgGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE992" />
          <Stop offset="0.5" stopColor="#D99100" />
          <Stop offset="1" stopColor="#FFD24A" />
        </SvgGradient>
        <RadialGradient id="ruby" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#FFB3C1" />
          <Stop offset="1" stopColor="#C1121F" />
        </RadialGradient>
        <RadialGradient id="sapphire" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#B3D4FF" />
          <Stop offset="1" stopColor="#1D4ED8" />
        </RadialGradient>
        <RadialGradient id="emerald" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#B9F5D8" />
          <Stop offset="1" stopColor="#0E9F6E" />
        </RadialGradient>
      </Defs>
      {/* Shadow */}
      <Path d="M14 74 L8 26 L38 50 L60 12 L82 50 L112 26 L106 74 Z" fill="#3B0764" opacity={0.35} transform="translate(0 4)" />
      {/* Body */}
      <Path
        d="M14 74 L8 26 L38 50 L60 12 L82 50 L112 26 L106 74 Z"
        fill="url(#metal)"
        stroke="#8A5A00"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* Highlights on the spikes */}
      <Path d="M16 66 L12 34 L30 50" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M52 44 L60 24" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={2.4} strokeLinecap="round" />
      {/* Band */}
      <Rect x={12} y={72} width={96} height={16} rx={5} fill="url(#band)" stroke="#8A5A00" strokeWidth={2.2} />
      <Rect x={18} y={75} width={84} height={3.5} rx={1.8} fill="#FFFFFF" opacity={0.55} />
      {/* Ball tips */}
      {[
        [8, 24],
        [60, 10],
        [112, 24],
      ].map(([x, y]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={6.5} fill="url(#metal)" stroke="#8A5A00" strokeWidth={1.6} />
          <Circle cx={x - 2} cy={y - 2.2} r={2} fill="#FFFFFF" opacity={0.85} />
        </G>
      ))}
      {/* Jewels */}
      <Path d="M60 48 L67 58 L60 68 L53 58 Z" fill="url(#ruby)" stroke="#7A0010" strokeWidth={1.2} />
      <Circle cx={36} cy={80} r={4.4} fill="url(#sapphire)" />
      <Circle cx={60} cy={80} r={4.8} fill="url(#ruby)" />
      <Circle cx={84} cy={80} r={4.4} fill="url(#emerald)" />
      {/* Sparkles */}
      <Path d="M92 36 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" fill="#FFFFFF" opacity={0.9} />
      <Path d="M24 58 l1.4 -4 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 Z" fill="#FFFFFF" opacity={0.85} />
    </Svg>
  );
}

/**
 * The header title: a glossy bingo ball icon (drawn, not a picture) and "Housie Tambola King"
 * on one line in Montserrat ExtraBold — King in gold. Shrinks to fit narrow phones.
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const large = size === 'large';
  const font = large ? 26 : 21;
  return (
    <View style={[styles.row, large && { justifyContent: 'center' }]}>
      <BingoBall n={90} size={large ? 46 : 36} color="gold" />
      <Text
        style={[styles.line, { fontSize: font, lineHeight: font * 1.25 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        Housie Tambola <Text style={styles.king}>King</Text>
      </Text>
    </View>
  );
}

/**
 * Opening screen, built in code: a radial gradient (bright glow in the middle, one solid dark
 * purple outside), a glossy gold crown, the title in a clean bold font, and glossy 7 · 31 · 65
 * balls bouncing in — then it fades into the app.
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const crown = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const balls = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(crown, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
        Animated.timing(title, { toValue: 1, duration: 450, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.stagger(
        110,
        balls.map((b) => Animated.spring(b, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })),
      ),
      Animated.delay(700),
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [crown, title, balls, fade, onDone]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100, elevation: 100, backgroundColor: '#24073F' }]}
      pointerEvents="none"
    >
      {/* Radial glow: bright in the middle, one solid colour outside. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="46%" r="60%">
            <Stop offset="0" stopColor="#C026D3" />
            <Stop offset="0.35" stopColor="#7E22CE" />
            <Stop offset="0.75" stopColor="#3B0A6B" />
            <Stop offset="1" stopColor="#24073F" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.View
          style={{ opacity: crown, transform: [{ translateY: crown.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] }}
        >
          <ShinyCrown width={150} />
        </Animated.View>
        <Animated.View
          style={{
            alignItems: 'center',
            marginTop: 10,
            opacity: title,
            transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <Text style={styles.introTop}>HOUSIE TAMBOLA</Text>
          <Text style={styles.introKing}>KING</Text>
        </Animated.View>
        <View style={styles.ballsRow}>
          {(
            [
              [7, 'red'],
              [31, 'blue'],
              [65, 'green'],
            ] as const
          ).map(([n, c], i) => (
            <Animated.View key={n} style={{ transform: [{ scale: balls[i] }, { translateY: i === 1 ? -10 : 0 }] }}>
              <BingoBall n={n} size={62} color={c} />
            </Animated.View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: {
    flexShrink: 1,
    fontFamily: BOLD,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(30,0,60,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  king: { color: '#FFD43B' },
  introTop: { fontFamily: BOLD, fontSize: 24, letterSpacing: 4, color: '#FFFFFF', includeFontPadding: false },
  introKing: {
    fontFamily: BLACK,
    fontSize: 54,
    letterSpacing: 8,
    color: '#FFD43B',
    includeFontPadding: false,
    textShadowColor: 'rgba(255,196,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  ballsRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
});
