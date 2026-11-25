import React, { useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { T } from '@/components/ui';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import type { typography } from '@/theme/typography';

let seq = 0;

/**
 * A play coin, minted style: a bevelled gold rim, a fine inner ring and a crown pressed into the
 * face (dark edge below, light edge above, so it reads as embossed metal). No colours but gold.
 */
export function CoinIcon({ size = 20, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const id = useRef(`coin${++seq}`).current;
  const crown = 'M27 61 L23 37 L37 47.5 L50 29 L63 47.5 L77 37 L73 61 Z';
  const band = 'M27 64 h46 a2.5 2.5 0 0 1 2.5 2.5 v3 a2.5 2.5 0 0 1 -2.5 2.5 h-46 a2.5 2.5 0 0 1 -2.5 -2.5 v-3 a2.5 2.5 0 0 1 2.5 -2.5 Z';
  const tips: [number, number][] = [
    [23, 35],
    [50, 26.5],
    [77, 35],
  ];
  const shape = (fill: string, dx: number, dy: number, opacity = 1) => (
    <G transform={`translate(${dx} ${dy})`} opacity={opacity}>
      <Path d={crown} fill={fill} strokeLinejoin="round" />
      <Path d={band} fill={fill} />
      {tips.map(([x, y]) => (
        <Circle key={x} cx={x} cy={y} r={3.6} fill={fill} />
      ))}
    </G>
  );
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF3B0" />
            <Stop offset="0.35" stopColor="#F7C531" />
            <Stop offset="0.7" stopColor="#D08C00" />
            <Stop offset="1" stopColor="#8F5A00" />
          </SvgGradient>
          <RadialGradient id={`${id}-face`} cx="40%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#FFE58A" />
            <Stop offset="0.6" stopColor="#F2B705" />
            <Stop offset="1" stopColor="#C98A04" />
          </RadialGradient>
          <SvgGradient id={`${id}-crown`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E8A800" />
            <Stop offset="1" stopColor="#B87900" />
          </SvgGradient>
        </Defs>
        {/* Rim with a bevel */}
        <Circle cx={50} cy={50} r={48} fill={`url(#${id}-rim)`} />
        <Circle cx={50} cy={50} r={47} fill="none" stroke="#7A4C00" strokeOpacity={0.55} strokeWidth={2} />
        {/* Face + fine ring */}
        <Circle cx={50} cy={50} r={39.5} fill={`url(#${id}-face)`} stroke="#A86F00" strokeWidth={1.6} />
        <Circle cx={50} cy={50} r={35} fill="none" stroke="#FFF1B0" strokeOpacity={0.6} strokeWidth={1.2} />
        {/* Embossed crown: highlight, shadow, then the metal */}
        <G transform="translate(7.5 8.5) scale(0.85)">
          {shape('#FFF6CC', -1.1, -1.1, 0.9)}
          {shape('#7A4C00', 1.3, 1.5, 0.55)}
          {shape(`url(#${id}-crown)`, 0, 0)}
        </G>
        {/* Soft shine across the top-left */}
        <Path d="M20 40 A32 32 0 0 1 46 16" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3.5} strokeLinecap="round" fill="none" />
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
