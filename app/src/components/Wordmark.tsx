import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

/** Chunky, rounded game-title font (Baloo 2 ExtraBold), loaded in App. */
const TITLE_FONT = 'Baloo2_800ExtraBold';

/** A jewelled gold crown (vector). */
export function Crown({ width = 40 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.72} viewBox="0 0 100 72">
      <Defs>
        <SvgGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3B0" />
          <Stop offset="0.5" stopColor="#F5C542" />
          <Stop offset="1" stopColor="#B7791F" />
        </SvgGradient>
      </Defs>
      <Path d="M8 56 L4 18 L28 38 L50 6 L72 38 L96 18 L92 56 Z" fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={2} strokeLinejoin="round" />
      <Rect x={8} y={56} width={84} height={12} rx={3} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={2} />
      <Circle cx={4} cy={16} r={5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={50} cy={6} r={5.5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={96} cy={16} r={5} fill="url(#crownGold)" stroke="#8A5A00" strokeWidth={1.5} />
      <Circle cx={30} cy={62} r={3.2} fill="#E11D48" />
      <Circle cx={50} cy={62} r={3.6} fill="#2563EB" />
      <Circle cx={70} cy={62} r={3.2} fill="#16A34A" />
    </Svg>
  );
}

/** The gold "KING" badge. */
function KingBadge({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={['#FFE58A', '#F5B700', '#D99400']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.badge, { paddingHorizontal: size * 0.42, borderRadius: size * 0.4, height: size * 1.3 }]}
    >
      <Text style={[styles.badgeText, { fontSize: size * 0.82, lineHeight: size * 1.1, letterSpacing: size * 0.08 }]}>KING</Text>
    </LinearGradient>
  );
}

/**
 * The app title as real text (crisp on every phone): crown · "Housie Tambola" in Baloo 2
 * ExtraBold · a gold KING badge — all on one line, shrinking to fit narrow phones.
 *  - "large": Welcome screen, centred
 *  - "small": Home header
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const font = size === 'large' ? 30 : 24;
  return (
    <View style={[styles.row, size === 'large' && { justifyContent: 'center' }]}>
      <Crown width={size === 'large' ? 40 : 32} />
      <Text style={[styles.title, { fontSize: font, lineHeight: font * 1.25 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        Housie Tambola
      </Text>
      <KingBadge size={size === 'large' ? 24 : 20} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flexShrink: 1,
    fontFamily: TITLE_FONT,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(30,0,60,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFF3C4' },
  badgeText: { fontFamily: TITLE_FONT, color: '#4A2600', includeFontPadding: false },
});
