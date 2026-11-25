import React, { useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, RadialGradient, Stop } from 'react-native-svg';
import { CrownArt } from '@/components/Wordmark';
import { T } from '@/components/ui';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import type { typography } from '@/theme/typography';

let seq = 0;

/**
 * A play coin: a polished gold disc with a ridged rim and the app's shiny crown in the middle
 * (the same crown as the header icon and the opening). Drawn in vector, so it is crisp at any size.
 */
export function CoinIcon({ size = 20, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const id = useRef(`coin${++seq}`).current;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF4BF" />
            <Stop offset="0.45" stopColor="#F5B700" />
            <Stop offset="1" stopColor="#9A6200" />
          </SvgGradient>
          <RadialGradient id={`${id}-face`} cx="38%" cy="32%" r="75%">
            <Stop offset="0" stopColor="#FFE88A" />
            <Stop offset="0.55" stopColor="#E9A400" />
            <Stop offset="1" stopColor="#B87400" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#${id}-rim)`} stroke="#7A4E00" strokeWidth={2} />
        {/* Ridges round the rim */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <Circle key={i} cx={50 + Math.cos(a) * 43} cy={50 + Math.sin(a) * 43} r={1.6} fill="#FFF4BF" opacity={0.75} />;
        })}
        <Circle cx={50} cy={50} r={37} fill={`url(#${id}-face)`} stroke="#8A5A00" strokeWidth={2} />
        <G transform="translate(22 28) scale(0.47)">
          <CrownArt id={`${id}-cr`} jewels={false} />
        </G>
        {/* Shine */}
        <Circle cx={34} cy={30} r={7} fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </View>
  );
}

/** A coin amount: crown coin + the number, e.g. a balance or a pot. */
export function CoinAmount({
  value,
  variant = 'smallBold',
  color,
  size,
  gap = 5,
}: {
  value: number | string;
  variant?: keyof typeof typography;
  color?: string;
  size?: number;
  gap?: number;
}) {
  const v = Number(value) || 0;
  const text = v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  const icon = size ?? (variant === 'h1' ? 26 : variant === 'h2' ? 22 : variant === 'h3' ? 19 : 16);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <CoinIcon size={icon} />
      <T variant={variant} color={color} maxFontSizeMultiplier={variant === 'h1' ? FIXED_SHAPE_SCALE : undefined} numberOfLines={1}>
        {text}
      </T>
    </View>
  );
}
