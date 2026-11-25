import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/** Clean, premium font for the title (loaded in App). */
const BOLD = 'Montserrat_800ExtraBold';
const BLACK = 'Montserrat_900Black';
/** Bold, playful game-title font for the opening screen. */
const GAME = 'LuckiestGuy_400Regular';

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
/** Number size on a BingoBall: a bit smaller for two digits so they fit the white face. */
const ballFont = (n: number | string, size: number) => size * (String(n).length > 1 ? 0.3 : 0.36);

export function BingoBall({ n, size = 54, color = 'red' }: { n: number | string; size?: number; color?: keyof typeof BALL_COLORS }) {
  const [light, mid, dark] = BALL_COLORS[color];
  const id = `ball-${color}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="38%" cy="34%" r="72%">
            <Stop offset="0" stopColor={light} stopOpacity={0.75} />
            <Stop offset="0.45" stopColor={mid} />
            <Stop offset="1" stopColor={dark} />
          </RadialGradient>
          <RadialGradient id={`${id}-face`} cx="45%" cy="40%" r="65%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#E5E7EB" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#${id})`} />
        <Circle cx={50} cy={50} r={29} fill={`url(#${id}-face)`} />
        <Ellipse cx={33} cy={23} rx={11} ry={5} fill="#FFFFFF" opacity={0.28} transform="rotate(-30 33 23)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {/* The opening title's rounded game font, always on ONE line inside the white face
            (it shrinks to fit rather than wrapping — "65" must never show as "6"). */}
        <Text
          maxFontSizeMultiplier={FIXED_SHAPE_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            width: size * 0.56,
            fontFamily: GAME,
            fontSize: ballFont(n, size),
            // Luckiest Guy's line box (ascent 1440 + descent 608 of 2048) is exactly 1 em; its
            // digits are drawn from about 0 to 1470 above the baseline, so their middle sits
            // 0.153 em above the line's middle. Measured from the font file — shift them down
            // by that so the number is truly centred in the ball.
            lineHeight: ballFont(n, size),
            transform: [{ translateY: ballFont(n, size) * 0.153 }],
            textAlign: 'center',
            textAlignVertical: 'center',
            color: '#2E1065',
            includeFontPadding: false,
          }}
        >
          {n}
        </Text>
      </View>
    </View>
  );
}

/**
 * The app icon for headers, drawn in code: a purple tile with a gold edge, a glossy gold
 * crown on top and three little numbered bingo balls (7 red, 31 blue, 65 green) — a tiny
 * version of the logo.
 */
export function AppIcon({ size = 46 }: { size?: number }) {
  const ball = (cx: number, n: number, light: string, mid: string, dark: string, key: string) => (
    <G key={key}>
      <Defs>
        <RadialGradient id={`ic-${key}`} cx="38%" cy="34%" r="72%">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.5" stopColor={mid} />
          <Stop offset="1" stopColor={dark} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={74} r={11} fill={`url(#ic-${key})`} />
      <Circle cx={cx} cy={74} r={6.8} fill="#FFFFFF" />
      <SvgText x={cx} y={77.2} textAnchor="middle" fontSize={n > 9 ? 7.2 : 8.6} fontWeight="bold" fill="#111827">
        {n}
      </SvgText>
    </G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="ic-tile" cx="50%" cy="40%" r="70%">
          <Stop offset="0" stopColor="#B83AF0" />
          <Stop offset="0.6" stopColor="#6D28D9" />
          <Stop offset="1" stopColor="#3B0A6B" />
        </RadialGradient>
        <SvgGradient id="ic-edge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF1B8" />
          <Stop offset="0.5" stopColor="#F5B700" />
          <Stop offset="1" stopColor="#B87400" />
        </SvgGradient>
        <SvgGradient id="ic-gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF8D6" />
          <Stop offset="0.45" stopColor="#FFD84D" />
          <Stop offset="1" stopColor="#C98A04" />
        </SvgGradient>
      </Defs>
      <Rect x={3} y={3} width={94} height={94} rx={24} fill="url(#ic-tile)" stroke="url(#ic-edge)" strokeWidth={4} />
      {/* Crown — the same shiny crown as the opening screen. */}
      <G transform="translate(17 7) scale(0.55)">
        <CrownArt id="ic-cr" />
      </G>
      {/* Three balls */}
      {ball(28, 7, '#FF9A9A', '#E11D2E', '#7F0A14', 'r')}
      {ball(50, 31, '#9CCBFF', '#1D6BEB', '#0B2C7A', 'b')}
      {ball(72, 65, '#A8F5A8', '#16A34A', '#0B4D22', 'g')}
    </Svg>
  );
}

/** Soft light rays fanning out from the centre, drawn in vector. */
/** Light rays from the centre (opening screen, winner card). */
export function Rays({ size, color = '#FFFFFF', opacity = 0.1, count = 18 }: { size: number; color?: string; opacity?: number; count?: number }) {
  const c = size / 2;
  const rays = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const b = a + Math.PI / count;
    return `M${c} ${c} L${c + Math.cos(a) * size} ${c + Math.sin(a) * size} L${c + Math.cos(b) * size} ${c + Math.sin(b) * size} Z`;
  });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G opacity={opacity}>
        {rays.map((d, i) => (
          <Path key={i} d={d} fill={color} />
        ))}
      </G>
    </Svg>
  );
}

/** A glossy gold crown: metal bands, highlights and sparkling jewels. */
function ShinyCrown({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.78} viewBox="0 0 120 94">
      <CrownArt id="cr" />
    </Svg>
  );
}

/** The shiny crown's shapes in a 120 × 94 box (ids prefixed so two crowns never clash). */
export function CrownArt({ id }: { id: string }) {
  return (
    <G>
      <Defs>
        <SvgGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF8D6" />
          <Stop offset="0.25" stopColor="#FFD84D" />
          <Stop offset="0.5" stopColor="#E9A400" />
          <Stop offset="0.72" stopColor="#FFE27A" />
          <Stop offset="1" stopColor="#B87400" />
        </SvgGradient>
        <SvgGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE992" />
          <Stop offset="0.5" stopColor="#D99100" />
          <Stop offset="1" stopColor="#FFD24A" />
        </SvgGradient>
        <RadialGradient id={`${id}-ruby`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#FFB3C1" />
          <Stop offset="1" stopColor="#C1121F" />
        </RadialGradient>
        <RadialGradient id={`${id}-sapphire`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#B3D4FF" />
          <Stop offset="1" stopColor="#1D4ED8" />
        </RadialGradient>
        <RadialGradient id={`${id}-emerald`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#B9F5D8" />
          <Stop offset="1" stopColor="#0E9F6E" />
        </RadialGradient>
      </Defs>
      {/* Shadow */}
      <Path d="M14 74 L8 26 L38 50 L60 12 L82 50 L112 26 L106 74 Z" fill="#3B0764" opacity={0.35} transform="translate(0 4)" />
      {/* Body */}
      <Path
        d="M14 74 L8 26 L38 50 L60 12 L82 50 L112 26 L106 74 Z"
        fill={`url(#${id}-metal)`}
        stroke="#8A5A00"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* Highlights on the spikes */}
      <Path d="M16 66 L12 34 L30 50" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M52 44 L60 24" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={2.4} strokeLinecap="round" />
      {/* Band */}
      <Rect x={12} y={72} width={96} height={16} rx={5} fill={`url(#${id}-band)`} stroke="#8A5A00" strokeWidth={2.2} />
      <Rect x={18} y={75} width={84} height={3.5} rx={1.8} fill="#FFFFFF" opacity={0.55} />
      {/* Ball tips */}
      {[
        [8, 24],
        [60, 10],
        [112, 24],
      ].map(([x, y]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={6.5} fill={`url(#${id}-metal)`} stroke="#8A5A00" strokeWidth={1.6} />
          <Circle cx={x - 2} cy={y - 2.2} r={2} fill="#FFFFFF" opacity={0.85} />
        </G>
      ))}
      {/* Jewels */}
      <Path d="M60 48 L67 58 L60 68 L53 58 Z" fill={`url(#${id}-ruby)`} stroke="#7A0010" strokeWidth={1.2} />
      <Circle cx={36} cy={80} r={4.4} fill={`url(#${id}-sapphire)`} />
      <Circle cx={60} cy={80} r={4.8} fill={`url(#${id}-ruby)`} />
      <Circle cx={84} cy={80} r={4.4} fill={`url(#${id}-emerald)`} />
      {/* Sparkles */}
      <Path d="M92 36 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" fill="#FFFFFF" opacity={0.9} />
      <Path d="M24 58 l1.4 -4 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 Z" fill="#FFFFFF" opacity={0.85} />
    </G>
  );
}

/**
 * The header title: a glossy bingo ball icon (drawn, not a picture) and "Housie Tambola King"
 * on one line in Montserrat ExtraBold — King in gold. Shrinks to fit narrow phones.
 */
export function Wordmark({ size = 'large', subtitle }: { size?: 'large' | 'small'; subtitle?: string }) {
  const large = size === 'large';
  const font = large ? 26 : 21;
  return (
    <View style={[styles.row, large && { justifyContent: 'center' }]}>
      <AppIcon size={large ? 52 : 48} />
      <View style={{ flexShrink: 1 }}>
        <Text
          style={[styles.line, { fontSize: font, lineHeight: font * 1.25 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          Housie Tambola <Text style={styles.king}>King</Text>
        </Text>
        {/* e.g. "Hi, Manikanta 👋" — right under the title, beside the icon. */}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Opening screen, built in code: a radial gradient (bright glow in the middle, one solid dark
 * purple outside), a glossy gold crown, the title in a clean bold font, and glossy 7 · 31 · 65
 * balls bouncing in — then it fades into the app.
 */
export function LaunchIntro({ onDone, ready = true }: { onDone: () => void; ready?: boolean }) {
  const { width, height } = useWindowDimensions();
  const crown = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const balls = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Before the fonts / session are in, only the still background shows (it replaces the splash).
    if (!ready) return;
    const turning = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    turning.start();
    // The crown keeps glowing softly once it lands.
    const glowing = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    glowing.start();
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
    return () => {
      turning.stop();
      glowing.stop();
    };
  }, [ready, crown, title, balls, fade, spin, glow, onDone]);

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
          style={[styles.rays, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
        >
          <Rays size={1000} />
        </Animated.View>
      </View>

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.View
          style={{ opacity: crown, transform: [{ translateY: crown.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] }}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.crownGlow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }) }]}
          >
            <Svg width={230} height={230}>
              <Defs>
                <RadialGradient id="crownGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFD84D" stopOpacity={0.9} />
                  <Stop offset="0.5" stopColor="#FFB020" stopOpacity={0.35} />
                  <Stop offset="1" stopColor="#FFB020" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={115} cy={115} r={115} fill="url(#crownGlow)" />
            </Svg>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
            <ShinyCrown width={150} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={{
            alignItems: 'center',
            marginTop: 10,
            opacity: title,
            transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          {ready ? (
            <>
              <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={styles.introTop}>HOUSIE TAMBOLA</Text>
              <Text maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={styles.introKing}>KING</Text>
            </>
          ) : null}
        </Animated.View>
        <View style={[styles.ballsRow, !ready && { opacity: 0 }]}>
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
  subtitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.9)', includeFontPadding: false, marginTop: 2 },
  rays: { position: 'absolute', width: 1000, height: 1000 },
  introTop: {
    fontFamily: GAME,
    fontSize: 30,
    letterSpacing: 2,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(59,7,100,0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 2,
  },
  introKing: {
    fontFamily: GAME,
    fontSize: 64,
    letterSpacing: 4,
    color: '#FFD43B',
    includeFontPadding: false,
    textShadowColor: 'rgba(255,196,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  crownGlow: { position: 'absolute', left: -40, top: -60, width: 230, height: 230 },
  ballsRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
});
