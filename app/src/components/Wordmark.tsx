import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

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
 * The app title as real text (crisp on every phone): "Housie Tambola" in Baloo 2 ExtraBold
 * followed by the gold crown — the crown is the "King". One line, shrinking to fit.
 *  - "large": Welcome screen, centred
 *  - "small": Home header
 */
/**
 * The app emblem: a glossy housie ball with "90" on its white face and a small gold crown on
 * top — housie + king in one mark.
 */
export function AppEmblem({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id="ball" x1="0.2" y1="0.1" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#F9A8D4" />
          <Stop offset="0.45" stopColor="#EC4899" />
          <Stop offset="1" stopColor="#6D28D9" />
        </SvgGradient>
        <SvgGradient id="emblemGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3B0" />
          <Stop offset="0.5" stopColor="#F5C542" />
          <Stop offset="1" stopColor="#B7791F" />
        </SvgGradient>
      </Defs>
      {/* Ball */}
      <Circle cx={50} cy={60} r={38} fill="url(#ball)" stroke="#FDE68A" strokeWidth={3} />
      <Circle cx={50} cy={60} r={22} fill="#FFFFFF" />
      <SvgText x={50} y={68.5} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#3B0764">
        90
      </SvgText>
      {/* Shine */}
      <Path d="M24 44 Q30 30 44 26" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" fill="none" />
      {/* Crown on top */}
      <Path
        d="M30 22 L27 4 L39 14 L50 0 L61 14 L73 4 L70 22 Z"
        fill="url(#emblemGold)"
        stroke="#8A5A00"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={16} r={2.4} fill="#E11D48" />
    </Svg>
  );
}

export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const font = size === 'large' ? 30 : 24;
  return (
    <View style={[styles.row, size === 'large' && { justifyContent: 'center' }]}>
      <Text
        style={[styles.title, { fontSize: font, lineHeight: font * 1.25 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        Housie Tambola
      </Text>
      {/* The crown is the "King": Housie Tambola 👑 */}
      <Crown width={size === 'large' ? 46 : 36} />
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
