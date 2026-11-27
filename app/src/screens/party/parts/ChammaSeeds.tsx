import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Row, T } from '@/components/ui';
import { fonts } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

let seedSeq = 0;

/**
 * A tamarind seed, drawn: a flat rounded seed — glossy dark-brown shell with a lighter rim, or
 * (when it lands that way up) its pale cream inside with a brown edge. Pale side up counts.
 */
export function TamarindSeed({ up, size, glow }: { up: boolean; size: number; glow?: boolean }) {
  const id = useRef(`ts${++seedSeq}`).current;
  return (
    <View style={glow && up ? styles.seedGlow : undefined}>
      <Svg width={size} height={size * 0.82} viewBox="0 0 50 41">
        <Defs>
          <RadialGradient id={`${id}s`} cx="35%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#C27A45" />
            <Stop offset="0.45" stopColor="#6B3311" />
            <Stop offset="1" stopColor="#2A1205" />
          </RadialGradient>
          <RadialGradient id={`${id}i`} cx="42%" cy="38%" r="75%">
            <Stop offset="0" stopColor="#FFFDF2" />
            <Stop offset="0.65" stopColor="#F1DEB2" />
            <Stop offset="1" stopColor="#C9A063" />
          </RadialGradient>
        </Defs>
        <Rect x={2} y={4} width={46} height={36} rx={15} fill="#000" opacity={0.3} />
        <Rect x={1} y={1} width={46} height={36} rx={15} fill={up ? '#7A4A1C' : '#3A1A07'} />
        <Rect x={3.5} y={3.5} width={41} height={31} rx={13} fill={up ? `url(#${id}i)` : `url(#${id}s)`} />
        {up ? (
          <Path d="M14 19 Q24 14 34 19" stroke="#A16207" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.65} />
        ) : (
          <>
            <Rect x={9} y={7} width={14} height={6} rx={3} fill="#fff" opacity={0.32} />
            <Rect x={6} y={6} width={36} height={26} rx={11} fill="none" stroke="#D69A63" strokeOpacity={0.35} strokeWidth={1} />
          </>
        )}
      </Svg>
    </View>
  );
}

/** Four seeds in a little heap — the art inside the Throw button. */
export function SeedsArt() {
  const at: [number, number, number, boolean][] = [
    [0, 4, -20, true],
    [20, 0, 15, false],
    [4, 20, 10, false],
    [22, 20, -30, true],
  ];
  return (
    <View style={{ width: 46, height: 40 }}>
      {at.map(([x, y, r, up], i) => (
        <View key={i} style={{ position: 'absolute', left: x, top: y, transform: [{ rotate: `${r}deg` }] }}>
          <TamarindSeed up={up} size={22} />
        </View>
      ))}
    </View>
  );
}

/**
 * A throw, shown on the board for everyone: "<name> threw", the four seeds tumble in and scatter
 * onto the middle, flipping as they land; the pale-side-up ones glow, then the number pops big
 * ("3", "4 · Chamma!", "8 · Ashta!") and it all fades away.
 */
export function ThrowOverlay({ seeds, throwKey, name, color }: { seeds: boolean[]; throwKey?: number; name: string; color: string }) {
  const { t } = useTranslation();
  const p = useRef(new Animated.Value(1)).current;
  const result = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(true);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!throwKey) return;
    p.setValue(0);
    result.setValue(0);
    fade.setValue(1);
    setLanded(false);
    const land = setTimeout(() => setLanded(true), 720);
    Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(result, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    return () => clearTimeout(land);
  }, [throwKey, p, result, fade]);
  const up = seeds.filter(Boolean).length;
  const value = up === 0 ? 8 : up;
  const label = value === 8 ? t('party.chamma.ashta') : value === 4 ? t('party.chamma.chamma') : null;
  const spots: [number, number, number][] = [
    [-48, -8, -25],
    [-16, 14, 18],
    [18, -12, -8],
    [50, 10, 30],
  ];
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]}>
      <View style={[styles.throwName, { borderColor: color }]}>
        <View style={[styles.throwDot, { backgroundColor: color }]} />
        <T variant="tiny" color="#fff" maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={{ fontFamily: fonts.semibold }}>
          {t('party.chamma.threw', { name })}
        </T>
      </View>
      <View style={styles.field}>
        {seeds.map((sd, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, spots[i][0]] }) },
                { translateY: p.interpolate({ inputRange: [0, 0.5, 0.8, 1], outputRange: [-90, spots[i][1] - 10, spots[i][1] + 4, spots[i][1]] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: [`${(i % 2 ? 1 : -1) * 540}deg`, `${spots[i][2]}deg`] }) },
                { scaleY: p.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [1, 0.15, 1, 0.15, 1, 1] }) },
              ],
            }}
          >
            <TamarindSeed up={landed ? sd : i % 2 === 0} size={34} glow={landed} />
          </Animated.View>
        ))}
      </View>
      <Animated.View style={{ alignItems: 'center', opacity: result, transform: [{ scale: result.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} style={styles.resultBadge}>
          <T style={styles.resultNum} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {value}
          </T>
        </LinearGradient>
        {label ? (
          <T style={styles.resultLabel} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {label}
          </T>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

/** The last throw, small: four seeds and the number. */
export function LastThrow({ seeds, value }: { seeds: boolean[]; value: number | null }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Row gap={2}>
        {seeds.map((sd, i) => (
          <TamarindSeed key={i} up={sd} size={18} />
        ))}
      </Row>
      {value ? (
        <T style={styles.lastValue} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {value}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seedGlow: { shadowColor: '#FDE68A', shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  overlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,5,2,0.4)', borderRadius: 8 },
  throwName: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1.5 },
  throwDot: { width: 8, height: 8, borderRadius: 4 },
  field: { height: 74, width: 170, alignItems: 'center', justifyContent: 'center' },
  resultBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF7D6' },
  resultNum: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: '#3B1D00' },
  resultLabel: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: '#FDE68A', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  lastValue: { fontFamily: fonts.display, fontSize: 14, lineHeight: 18, color: '#FCD34D' },
});

/**
 * The seed tray under the board (fixed height): who threw, the four seeds tumbling down and
 * flipping as they land (pale-side-up ones glow), and the number in a gold badge — "4 Chamma!",
 * "8 Ashta!". Shown in this one place only (never on the board).
 */
export function SeedTray({ seeds, throwKey, name, value, avatar }: { seeds: boolean[]; throwKey?: number; name: string; value: number | null; avatar?: React.ReactNode }) {
  const { t } = useTranslation();
  const p = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [landed, setLanded] = useState(true);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!throwKey) return;
    p.setValue(0);
    pop.setValue(0);
    setLanded(false);
    const land = setTimeout(() => setLanded(true), 650);
    Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
    return () => clearTimeout(land);
  }, [throwKey, p, pop]);
  const label = value === 8 ? t('party.chamma.ashta') : value === 4 ? t('party.chamma.chamma') : null;
  const spots: [number, number, number][] = [
    [-36, 2, -25],
    [-12, -6, 18],
    [12, 4, -8],
    [36, -4, 30],
  ];
  return (
    <View style={trayStyles.tray}>
      <View style={{ flex: 1, gap: 4 }}>
        <Row gap={6}>
          {avatar}
          <T variant="smallBold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </T>
        </Row>
        <T variant="tiny" color="rgba(255,255,255,0.85)" numberOfLines={1}>
          {value ? (label ? `${t('party.chamma.threwN', { count: value })} · ${label}` : t('party.chamma.threwN', { count: value })) : t('party.chamma.firstThrow')}
        </T>
      </View>
      <View style={trayStyles.field}>
        {seeds.map((sd, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, spots[i][0]] }) },
                { translateY: p.interpolate({ inputRange: [0, 0.55, 0.8, 1], outputRange: [-50, spots[i][1] - 8, spots[i][1] + 3, spots[i][1]] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: [`${(i % 2 ? 1 : -1) * 540}deg`, `${spots[i][2]}deg`] }) },
                { scaleY: p.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [1, 0.15, 1, 0.15, 1, 1] }) },
              ],
            }}
          >
            <TamarindSeed up={landed ? sd : i % 2 === 0} size={26} glow={landed} />
          </Animated.View>
        ))}
      </View>
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} style={trayStyles.badge}>
          <T style={trayStyles.badgeText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {value ?? '–'}
          </T>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const trayStyles = StyleSheet.create({
  tray: { height: 92, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 14, paddingRight: 10, borderRadius: 18, backgroundColor: '#2A1B12', borderWidth: 2, borderColor: 'rgba(245,208,111,0.5)' },
  field: { width: 104, height: 60, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF7D6' },
  badgeText: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: '#3B1D00' },
});

/**
 * The seeds in the middle of the play area. Tapped Throw (`throwing`): they shake in the hand at
 * once. A new throw (`throwKey`): they toss up, spin and flip, scatter onto the pad and land —
 * pale-side-up ones glow — then the number pops in a gold badge.
 */
export function SeedPad({ seeds, throwKey, throwing, value }: { seeds: boolean[]; throwKey?: number; throwing: boolean; value: number | null }) {
  const p = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(value ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(true);
  const first = useRef(true);
  useEffect(() => {
    if (!throwing) return;
    pop.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 180, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      shake.setValue(0);
    };
  }, [throwing, shake, pop]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!throwKey) return;
    p.setValue(0);
    pop.setValue(0);
    setLanded(false);
    const land = setTimeout(() => setLanded(true), 560);
    Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 680, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();
    return () => clearTimeout(land);
  }, [throwKey, p, pop]);
  const spots: [number, number, number][] = [
    [-24, -10, -25],
    [8, -16, 18],
    [-10, 12, -8],
    [22, 8, 30],
  ];
  return (
    <View style={{ width: 96, height: 76, alignItems: 'center', justifyContent: 'center' }}>
      {seeds.map((sd, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            transform: [
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, spots[i][0]] }) },
              { translateY: p.interpolate({ inputRange: [0, 0.5, 0.78, 1], outputRange: [0, -34, spots[i][1] + 3, spots[i][1]] }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: [`${(i % 2 ? 1 : -1) * 540}deg`, `${spots[i][2]}deg`] }) },
              { scaleY: p.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [1, 0.15, 1, 0.15, 1, 1] }) },
              { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-3 - i, 3 + i] }) },
              { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) },
            ],
          }}
        >
          <TamarindSeed up={landed ? sd : i % 2 === 0} size={24} glow={landed && !throwing} />
        </Animated.View>
      ))}
      <Animated.View style={[padStyles.badgeWrap, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} style={padStyles.badge}>
          <T style={padStyles.badgeText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {value ?? '–'}
          </T>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const padStyles = StyleSheet.create({
  badgeWrap: { position: 'absolute', right: -6, top: -8 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF7D6' },
  badgeText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, color: '#3B1D00' },
});
