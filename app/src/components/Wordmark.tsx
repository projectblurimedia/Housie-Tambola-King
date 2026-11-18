import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

const FONT = 'Poppins_800ExtraBold';

/** Shared gold gradients (ids are per-Svg, so each drawing defines its own). */
function GoldDefs() {
  return (
    <Defs>
      {/* Polished gold: bright top, deep middle band, warm bottom — like stamped metal. */}
      <SvgGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFF6C8" />
        <Stop offset="0.42" stopColor="#FFD54A" />
        <Stop offset="0.55" stopColor="#E0A21B" />
        <Stop offset="1" stopColor="#FFE07A" />
      </SvgGradient>
      <SvgGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFE58A" />
        <Stop offset="0.5" stopColor="#F2B705" />
        <Stop offset="1" stopColor="#C98A04" />
      </SvgGradient>
      <SvgGradient id="ribbonTail" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#C98A04" />
        <Stop offset="1" stopColor="#8A5A00" />
      </SvgGradient>
      <SvgGradient id="crown" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFF3B0" />
        <Stop offset="0.5" stopColor="#F5C542" />
        <Stop offset="1" stopColor="#B7791F" />
      </SvgGradient>
    </Defs>
  );
}

/** Jewelled crown centred at (cx, top), `w` wide. */
function CrownShape({ cx, top, w }: { cx: number; top: number; w: number }) {
  const s = w / 100;
  const x = (v: number) => cx - w / 2 + v * s;
  const y = (v: number) => top + v * s;
  return (
    <G>
      <Path
        d={`M${x(8)} ${y(56)} L${x(4)} ${y(18)} L${x(28)} ${y(38)} L${x(50)} ${y(6)} L${x(72)} ${y(38)} L${x(96)} ${y(18)} L${x(92)} ${y(56)} Z`}
        fill="url(#crown)"
        stroke="#8A5A00"
        strokeWidth={1.6 * s}
        strokeLinejoin="round"
      />
      <Rect x={x(8)} y={y(56)} width={84 * s} height={12 * s} rx={3 * s} fill="url(#crown)" stroke="#8A5A00" strokeWidth={1.6 * s} />
      <Circle cx={x(4)} cy={y(16)} r={5 * s} fill="url(#crown)" stroke="#8A5A00" strokeWidth={1.2 * s} />
      <Circle cx={x(50)} cy={y(6)} r={5.5 * s} fill="url(#crown)" stroke="#8A5A00" strokeWidth={1.2 * s} />
      <Circle cx={x(96)} cy={y(16)} r={5 * s} fill="url(#crown)" stroke="#8A5A00" strokeWidth={1.2 * s} />
      <Circle cx={x(30)} cy={y(62)} r={3.2 * s} fill="#E11D48" />
      <Circle cx={x(50)} cy={y(62)} r={3.6 * s} fill="#2563EB" />
      <Circle cx={x(70)} cy={y(62)} r={3.2 * s} fill="#16A34A" />
    </G>
  );
}

/** Glossy 3-D gold text: a deep shadow copy, a dark outline, then the gold face. */
function GoldText({ x, y, size, spacing, children }: { x: number; y: number; size: number; spacing: number; children: string }) {
  const common = { x, textAnchor: 'middle' as const, fontFamily: FONT, fontSize: size, letterSpacing: spacing };
  return (
    <G>
      <SvgText {...common} y={y + size * 0.09} fill="#3B0764" opacity={0.85}>
        {children}
      </SvgText>
      <SvgText {...common} y={y} fill="url(#gold)" stroke="#7C4A03" strokeWidth={size * 0.045} strokeLinejoin="round">
        {children}
      </SvgText>
    </G>
  );
}

/** The folded gold ribbon with KING on it, centred at (cx, top). */
function KingRibbon({ cx, top, w, h }: { cx: number; top: number; w: number; h: number }) {
  const left = cx - w / 2;
  const right = cx + w / 2;
  const tail = h * 0.75;
  return (
    <G>
      {/* Tails, folded behind the band. */}
      <Path
        d={`M${left - tail} ${top + h * 0.3} L${left + h * 0.4} ${top + h * 0.3} L${left + h * 0.4} ${top + h * 1.15} L${left - tail} ${top + h * 1.15} L${left - tail + h * 0.35} ${top + h * 0.72} Z`}
        fill="url(#ribbonTail)"
      />
      <Path
        d={`M${right + tail} ${top + h * 0.3} L${right - h * 0.4} ${top + h * 0.3} L${right - h * 0.4} ${top + h * 1.15} L${right + tail} ${top + h * 1.15} L${right + tail - h * 0.35} ${top + h * 0.72} Z`}
        fill="url(#ribbonTail)"
      />
      <Rect x={left} y={top} width={w} height={h} rx={h * 0.18} fill="url(#ribbon)" stroke="#8A5A00" strokeWidth={1.2} />
      <Rect x={left + 3} y={top + 3} width={w - 6} height={h * 0.32} rx={h * 0.12} fill="#FFFFFF" opacity={0.22} />
      <SvgText x={cx} y={top + h * 0.74} textAnchor="middle" fontFamily={FONT} fontSize={h * 0.62} letterSpacing={h * 0.22} fill="#4A2600">
        KING
      </SvgText>
    </G>
  );
}

/** Gold text anchored at its right end (so the ribbon can sit right after it on one line). */
function GoldTextEnd({ x, y, size, spacing, children }: { x: number; y: number; size: number; spacing: number; children: string }) {
  const common = { x, textAnchor: 'end' as const, fontFamily: FONT, fontSize: size, letterSpacing: spacing };
  return (
    <G>
      <SvgText {...common} y={y + size * 0.09} fill="#3B0764" opacity={0.85}>
        {children}
      </SvgText>
      <SvgText {...common} y={y} fill="url(#gold)" stroke="#7C4A03" strokeWidth={size * 0.045} strokeLinejoin="round">
        {children}
      </SvgText>
    </G>
  );
}

/**
 * The "Housie Tambola King" logo, drawn in vector (sharp at any size), on ONE line:
 * HOUSIE TAMBOLA in glossy 3-D gold with KING on a folded gold ribbon right after it.
 *  - "large" (Welcome): jewelled crown above the line
 *  - "small" (Home header): crown at the start of the line
 * It scales to the width it's given.
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  if (size === 'small') {
    // viewBox 384 × 50: crown · HOUSIE TAMBOLA · [KING]
    return (
      <View style={{ width: '100%', maxWidth: 400, aspectRatio: 384 / 50 }}>
        <Svg width="100%" height="100%" viewBox="0 0 384 50">
          <GoldDefs />
          <CrownShape cx={22} top={8} w={40} />
          <GoldTextEnd x={272} y={34} size={22} spacing={1.2}>
            HOUSIE TAMBOLA
          </GoldTextEnd>
          <KingRibbon cx={330} top={13} w={64} h={24} />
        </Svg>
      </View>
    );
  }
  // viewBox 380 × 110: crown above · HOUSIE TAMBOLA · [KING]
  return (
    <View style={{ width: '100%', maxWidth: 380, aspectRatio: 380 / 110, alignSelf: 'center' }}>
      <Svg width="100%" height="100%" viewBox="0 0 380 110">
        <GoldDefs />
        <CrownShape cx={190} top={2} w={64} />
        <GoldTextEnd x={256} y={92} size={24} spacing={1.5}>
          HOUSIE TAMBOLA
        </GoldTextEnd>
        <KingRibbon cx={318} top={72} w={64} h={26} />
      </Svg>
    </View>
  );
}
