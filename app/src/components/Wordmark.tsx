import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

/** App title font: Aquire Bold (assets/fonts, loaded in App). Non-commercial licence — see App.tsx. */
const TITLE_FONT = 'Aquire-Bold';

/** A jewelled gold crown (vector) — kept for other screens that may want it. */
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
    </Svg>
  );
}

/**
 * The app icon: a white housie ticket (two numbers marked) on a purple-to-magenta tile with
 * a gold edge.
 */
export function AppIcon({ size = 40 }: { size?: number }) {
  // 3 rows × 5 marks on the ticket; which ones are "struck".
  const struck = new Set(['0-1', '1-3', '2-0']);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id="tile" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B5CF6" />
          <Stop offset="1" stopColor="#C026D3" />
        </SvgGradient>
        <SvgGradient id="edge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF1B8" />
          <Stop offset="1" stopColor="#D99400" />
        </SvgGradient>
      </Defs>
      <Rect x={3} y={3} width={94} height={94} rx={24} fill="url(#tile)" stroke="url(#edge)" strokeWidth={5} />
      {/* Ticket with notched sides. */}
      <Path
        d="M20 30 H80 A4 4 0 0 1 84 34 V44 A6 6 0 0 0 84 56 V66 A4 4 0 0 1 80 70 H20 A4 4 0 0 1 16 66 V56 A6 6 0 0 0 16 44 V34 A4 4 0 0 1 20 30 Z"
        fill="#FFFFFF"
      />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const on = struck.has(`${r}-${c}`);
          return <Circle key={`${r}-${c}`} cx={28 + c * 11} cy={39 + r * 11} r={on ? 4.2 : 3} fill={on ? '#EC4899' : '#DDD6FE'} />;
        }),
      )}
    </Svg>
  );
}

/**
 * The app title: icon · HOUSIE TAMBOLA KING in Aquire Bold (KING in gold) — one line,
 * shrinking to fit narrow phones.
 *  - "large": Welcome screen, centred   ·   "small": Home header
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const font = size === 'large' ? 22 : 17;
  return (
    <View style={[styles.row, size === 'large' && { justifyContent: 'center' }]}>
      <AppIcon size={size === 'large' ? 44 : 34} />
      <Text style={[styles.title, { fontSize: font, lineHeight: font * 1.3 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
        HOUSIE TAMBOLA <Text style={styles.king}>KING</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    flexShrink: 1,
    fontFamily: TITLE_FONT,
    color: '#FFFFFF',
    letterSpacing: 1,
    includeFontPadding: false,
    textShadowColor: 'rgba(30,0,60,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  king: { color: '#FCD34D' },
});
