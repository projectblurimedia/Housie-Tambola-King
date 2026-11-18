import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/theme';

const GOLD_LIGHT = '#FFF1B8';
const GOLD = '#F5C542';
const GOLD_DEEP = '#B7791F';

/** A jewelled gold crown, drawn (no image file). */
export function Crown({ width = 48 }: { width?: number }) {
  const height = width * 0.72;
  return (
    <Svg width={width} height={height} viewBox="0 0 100 72">
      <Defs>
        <SvgGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GOLD_LIGHT} />
          <Stop offset="0.5" stopColor={GOLD} />
          <Stop offset="1" stopColor={GOLD_DEEP} />
        </SvgGradient>
      </Defs>
      {/* Five points with balls on top, and the band. */}
      <Path d="M8 56 L4 18 L28 38 L50 6 L72 38 L96 18 L92 56 Z" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={8} y={56} width={84} height={12} rx={3} fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth={2} />
      <Circle cx={4} cy={16} r={5} fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth={1.5} />
      <Circle cx={50} cy={6} r={5.5} fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth={1.5} />
      <Circle cx={96} cy={16} r={5} fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth={1.5} />
      {/* Jewels on the band. */}
      <Circle cx={30} cy={62} r={3.2} fill="#E11D48" />
      <Circle cx={50} cy={62} r={3.6} fill="#2563EB" />
      <Circle cx={70} cy={62} r={3.2} fill="#16A34A" />
    </Svg>
  );
}

/** A thin gold rule with a diamond in the middle. */
function Rule({ width }: { width: number }) {
  return (
    <Svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
      <Defs>
        <SvgGradient id="ruleGold" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GOLD} stopOpacity={0} />
          <Stop offset="0.5" stopColor={GOLD} stopOpacity={1} />
          <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Rect x={0} y={4.4} width={width} height={1.2} fill="url(#ruleGold)" />
      <Path d={`M${width / 2} 0 L${width / 2 + 5} 5 L${width / 2} 10 L${width / 2 - 5} 5 Z`} fill={GOLD} />
    </Svg>
  );
}

/**
 * The "Housie Tambola King" wordmark: gold crown, HOUSIE TAMBOLA in spaced Cinzel capitals,
 * a gold rule, and KING large in Cinzel Decorative with a warm glow.
 *  - size "large": stacked and centred (Welcome screen)
 *  - size "small": crown beside two lines (Home header)
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  if (size === 'small') {
    return (
      <View style={styles.smallRow}>
        <Crown width={38} />
        <View>
          <Text style={[styles.top, styles.topSmall]}>HOUSIE TAMBOLA</Text>
          <Text style={[styles.king, styles.kingSmall]}>KING</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.large}>
      <Crown width={64} />
      <Text style={[styles.top, styles.topLarge]}>HOUSIE TAMBOLA</Text>
      <Rule width={180} />
      <Text style={[styles.king, styles.kingLarge]}>KING</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  large: { alignItems: 'center', gap: 4 },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  top: { fontFamily: fonts.brandTop, color: GOLD_LIGHT, includeFontPadding: false },
  topLarge: { fontSize: 20, letterSpacing: 5, marginTop: 6 },
  topSmall: { fontSize: 12, letterSpacing: 3 },
  king: {
    fontFamily: fonts.brand,
    color: GOLD,
    includeFontPadding: false,
    textShadowColor: 'rgba(183,121,31,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  kingLarge: { fontSize: 50, letterSpacing: 10, lineHeight: 62 },
  kingSmall: { fontSize: 24, letterSpacing: 5, lineHeight: 30 },
});
