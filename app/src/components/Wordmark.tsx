import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient as SvgGradient, Stop, Text as SvgText, TSpan } from 'react-native-svg';

/** App title font: Aquire Bold (assets/fonts, loaded in App). Non-commercial licence — see App.tsx. */
const TITLE_FONT = 'Aquire-Bold';
const APP_ICON = require('../../assets/icon.png');

/** The app's own launcher icon (gold 90 ball with a crown), framed for headers. */
export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.iconFrame, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Image source={APP_ICON} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

/**
 * HOUSIE TAMBOLA KING in Aquire Bold as glossy 3-D gold lettering (deep shadow, dark outline,
 * polished gold face) with KING in a pink-to-gold gradient. textLength stretches the line to
 * exactly fill the width it's given, so it's never squeezed small on narrow phones.
 */
function GoldTitle({ width, height }: { width: number; height: number }) {
  const size = height * 0.62;
  const y = height * 0.72;
  const common = {
    x: 2,
    fontFamily: TITLE_FONT,
    fontSize: size,
    textLength: width - 6,
    lengthAdjust: 'spacingAndGlyphs' as const,
  };
  const words = (kingFill: string) => (
    <>
      HOUSIE TAMBOLA <TSpan fill={kingFill}>KING</TSpan>
    </>
  );
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF6C8" />
          <Stop offset="0.45" stopColor="#FFD54A" />
          <Stop offset="0.58" stopColor="#E0A21B" />
          <Stop offset="1" stopColor="#FFE07A" />
        </SvgGradient>
        <SvgGradient id="king" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD1E8" />
          <Stop offset="0.5" stopColor="#FF4FA3" />
          <Stop offset="1" stopColor="#FFB020" />
        </SvgGradient>
      </Defs>
      <G>
        {/* Depth shadow */}
        <SvgText {...common} y={y + size * 0.1} fill="#2E0A5A" opacity={0.75}>
          {words('#2E0A5A')}
        </SvgText>
        {/* Gold face with a dark outline */}
        <SvgText {...common} y={y} fill="url(#gold)" stroke="#6B3E00" strokeWidth={size * 0.05} strokeLinejoin="round">
          {words('url(#king)')}
        </SvgText>
      </G>
    </Svg>
  );
}

/**
 * The app title: launcher icon · HOUSIE TAMBOLA KING (gold, Aquire) on one line.
 *  - "large": Welcome screen  ·  "small": Home header
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const large = size === 'large';
  // The title's drawing box: a fixed shape that scales to the space left after the icon.
  const W = 420;
  const H = large ? 52 : 44;
  return (
    <View style={styles.row}>
      <AppIcon size={large ? 48 : 40} />
      <View style={{ flex: 1, aspectRatio: W / H, maxHeight: large ? 56 : 46 }}>
        <GoldTitle width={W} height={H} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  iconFrame: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
