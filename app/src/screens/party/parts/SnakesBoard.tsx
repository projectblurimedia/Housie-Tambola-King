import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useAfterOpen } from '@/hooks/useAfterOpen';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { T } from '@/components/ui';
import { LADDERS, type Pt, shareLayout, SNAKES, snakeCurve, snlCell, snlCentre, snlLevelOf, snlSteps, type SnlBoard, type SnlLevel } from '@/game/engine/board';
import { playGameSound } from '@/services/sounds';
import type { PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { Pawn, TOKEN_COLORS } from './BoardBits';
import { GameDock, type DockPlayer } from './GameDock';
import { RollingDie } from './RollingDie';
import { BOARD_DESIGNS, designIcons, designTile, LADDER_LOOKS, SNAKE_PAINTS, type LadderLook, type SnakePaint, type SnakeStyle } from './snakesThemes';

const CLASSIC: SnlBoard = { ladders: LADDERS, snakes: SNAKES };
const f1 = (v: number) => v.toFixed(1);

// Shapes are merged into a few paths (one per colour) instead of hundreds of separate elements,
// so a whole board draws quickly even on slow phones.
const rectPath = (x: number, y: number, w: number, h: number, r = 0) =>
  r > 0
    ? `M${f1(x + r)} ${f1(y)}h${f1(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f1(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f1(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${f1(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}Z`
    : `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
const circlePath = (cx: number, cy: number, r: number) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
const ellipsePath = (cx: number, cy: number, rx: number, ry: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const sx = cx + rx * Math.cos(a);
  const sy = cy + rx * Math.sin(a);
  const ex = cx - rx * Math.cos(a);
  const ey = cy - rx * Math.sin(a);
  return `M${f1(sx)} ${f1(sy)}A${f1(rx)} ${f1(ry)} ${f1(deg)} 1 0 ${f1(ex)} ${f1(ey)}A${f1(rx)} ${f1(ry)} ${f1(deg)} 1 0 ${f1(sx)} ${f1(sy)}Z`;
};

/**
 * A snake in the board design's style — banded sea snake, spotted, python, cute (big eyes and a
 * smile) or glowing neon — on one smooth body along a natural wave (slim for short snakes, thicker
 * for long ones, fine pointed tail), with its head pinned on the neck inside its own square.
 */
function SnakeArt({ head, tail, cell, style, paint, lite, id, part }: { head: Pt; tail: Pt; cell: number; style: SnakeStyle; paint: SnakePaint; lite?: boolean; id: string; part: 'body' | 'head' }) {
  const p = paint;
  /** Line widths follow the board size, so a small preview looks just like the game board. */
  const k = Math.max(0.35, cell / 40);
  const { at } = snakeCurve(head, tail, cell);
  const rows = Math.abs(tail.y - head.y) / cell;
  const [wMin, wMax] = style === 'python' ? [0.22, 0.37] : style === 'cute' ? [0.26, 0.38] : [0.2, 0.34];
  const W = cell * Math.max(wMin, Math.min(wMax, wMin - 0.02 + rows * 0.03));
  const width = (t: number) => W * (t < 0.65 ? 1 : Math.max(0.08, 1 - (t - 0.65) / 0.35));
  const fr = (t: number) => {
    const q0 = at(t);
    const q = at(Math.min(1, t + 0.003));
    const r = at(Math.max(0, t - 0.003));
    const l = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    return { p: q0, tx: (q.x - r.x) / l, ty: (q.y - r.y) / l, ux: -(q.y - r.y) / l, uy: (q.x - r.x) / l };
  };
  const N = lite ? 28 : 56;
  const band = (k: number, t0 = 0, t1 = 1, shift = 0) => {
    const L: string[] = [];
    const R: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = t0 + (i / N) * (t1 - t0);
      const { p: q, ux, uy } = fr(t);
      const w = width(t) / 2;
      const cx = q.x - 0.55 * w * shift;
      const cy = q.y - 0.83 * w * shift;
      L.push(`${f1(cx + ux * w * k)} ${f1(cy + uy * w * k)}`);
      R.push(`${f1(cx - ux * w * k)} ${f1(cy - uy * w * k)}`);
    }
    return `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
  };
  /** Pattern points along the body, every `gapK` body-widths. */
  const along = (gapK: number) => {
    const out: { f: ReturnType<typeof fr>; w: number; k: number }[] = [];
    let acc = 0;
    let prev = at(0.06);
    for (let i = 1, k = 0; i <= 260; i++) {
      const t = 0.06 + (i / 260) * 0.86;
      const q = at(t);
      acc += Math.hypot(q.x - prev.x, q.y - prev.y);
      prev = q;
      if (acc < W * gapK) continue;
      acc = 0;
      k++;
      out.push({ f: fr(t), w: width(t) / 2, k });
    }
    return out;
  };

  // Pattern, merged per colour.
  let pattern: React.ReactNode = null;
  if (!lite && style === 'bands' && p.bands) {
    const per = p.bands.map(() => '');
    for (const { f, w, k } of along(0.75)) per[k % per.length] += `M${f1(f.p.x + f.ux * w)} ${f1(f.p.y + f.uy * w)}L${f1(f.p.x - f.ux * w)} ${f1(f.p.y - f.uy * w)}`;
    pattern = (
      <>
        {per.map((d, i) => (d ? <Path key={i} d={d} stroke={p.bands![i]} strokeWidth={W * 0.45} /> : null))}
        <Path d={band(1)} fill="none" stroke={p.line} strokeWidth={1.2 * k} />
      </>
    );
  } else if (!lite && style === 'python') {
    let d = '';
    for (const { f, w } of along(1.1)) d += ellipsePath(f.p.x, f.p.y, w * 0.55, w * 0.78, (Math.atan2(f.ty, f.tx) * 180) / Math.PI);
    pattern = <Path d={d} fill={p.mark} stroke={p.line} strokeWidth={0.6 * k} />;
  } else if (!lite && (style === 'dots' || style === 'cute')) {
    let d = '';
    for (const { f, w, k } of along(0.8)) d += circlePath(f.p.x + f.ux * w * 0.4 * (k % 2 ? 1 : -1), f.p.y + f.uy * w * 0.4 * (k % 2 ? 1 : -1), w * 0.24);
    pattern = <Path d={d} fill={p.mark} />;
  }

  // Head (pinned on the body's first point, pointing along the neck).
  const h0 = at(0);
  const h1 = at(0.025);
  const dl = Math.hypot(h0.x - h1.x, h0.y - h1.y) || 1;
  const ang = (Math.atan2((h0.y - h1.y) / dl, (h0.x - h1.x) / dl) * 180) / Math.PI;
  const tongue = (x0: number, L: number) => (
    <Path d={`M${f1(x0)} 0 L${f1(x0 + L)} 0 l${f1(L * 0.4)} ${f1(-L * 0.32)} M${f1(x0 + L)} 0 l${f1(L * 0.4)} ${f1(L * 0.32)}`} stroke="#D32F2F" strokeWidth={1.3 * k} strokeLinecap="round" fill="none" />
  );
  let headArt: React.ReactNode;
  if (style === 'cute') {
    const r = Math.min(W * 1.05, cell * 0.36);
    headArt = (
      <>
        {tongue(r * 0.9, r * 0.35)}
        <Ellipse rx={r} ry={r * 0.9} fill={p.head} stroke={p.line} strokeWidth={1.8 * k} />
        <Path d={circlePath(r * 0.1, -r * 0.42, r * 0.32) + circlePath(r * 0.1, r * 0.42, r * 0.32)} fill="#fff" stroke={p.line} strokeWidth={1} />
        <Path d={circlePath(r * 0.2, -r * 0.42, r * 0.17) + circlePath(r * 0.2, r * 0.42, r * 0.17)} fill="#111" />
        <Path d={circlePath(r * 0.14, -r * 0.5, r * 0.06) + circlePath(r * 0.14, r * 0.34, r * 0.06)} fill="#fff" />
        <Path d={`M${f1(r * 0.62)} ${f1(-r * 0.3)} Q${f1(r * 0.85)} 0 ${f1(r * 0.62)} ${f1(r * 0.3)}`} stroke={p.line} strokeWidth={1.1 * k} fill="none" strokeLinecap="round" />
      </>
    );
  } else {
    const round = style !== 'python';
    const hl = Math.min(W * (round ? 1.9 : 2.3), cell * 0.55);
    const hw = W * (round ? 1.5 : 1.42);
    const tip = hl * 0.55;
    const hp = round
      ? `M${f1(tip)} 0 C${f1(tip)} ${f1(-hw * 0.45)} ${f1(hl * 0.05)} ${f1(-hw * 0.55)} ${f1(-hl * 0.2)} ${f1(-hw * 0.5)} C${f1(-hl * 0.4)} ${f1(-hw * 0.45)} ${f1(-hl * 0.5)} ${f1(-W * 0.6)} ${f1(-hl * 0.5)} ${f1(-W * 0.5)} L${f1(-hl * 0.5)} ${f1(W * 0.5)} C${f1(-hl * 0.5)} ${f1(W * 0.6)} ${f1(-hl * 0.4)} ${f1(hw * 0.45)} ${f1(-hl * 0.2)} ${f1(hw * 0.5)} C${f1(hl * 0.05)} ${f1(hw * 0.55)} ${f1(tip)} ${f1(hw * 0.45)} ${f1(tip)} 0 Z`
      : `M${f1(tip)} 0 C${f1(tip)} ${f1(-hw * 0.25)} ${f1(hl * 0.2)} ${f1(-hw * 0.5)} ${f1(-hl * 0.15)} ${f1(-hw * 0.5)} C${f1(-hl * 0.35)} ${f1(-hw * 0.5)} ${f1(-hl * 0.45)} ${f1(-hw * 0.4)} ${f1(-hl * 0.5)} ${f1(-W * 0.5)} L${f1(-hl * 0.5)} ${f1(W * 0.5)} C${f1(-hl * 0.45)} ${f1(hw * 0.4)} ${f1(-hl * 0.35)} ${f1(hw * 0.5)} ${f1(-hl * 0.15)} ${f1(hw * 0.5)} C${f1(hl * 0.2)} ${f1(hw * 0.5)} ${f1(tip)} ${f1(hw * 0.25)} ${f1(tip)} 0 Z`;
    const neon = style === 'neon';
    const eyes = circlePath(hl * 0.08, -hw * 0.27, hw * 0.14) + circlePath(hl * 0.08, hw * 0.27, hw * 0.14);
    const pupils = circlePath(hl * 0.1, -hw * 0.27, hw * 0.07) + circlePath(hl * 0.1, hw * 0.27, hw * 0.07);
    headArt = (
      <>
        {tongue(tip - 1, hl * 0.25)}
        {neon ? (
          <>
            <Path d={hp} fill={p.body} opacity={0.3} transform="scale(1.3)" />
            <Path d={hp} fill="#0B0F1E" stroke={p.body} strokeWidth={2 * k} />
          </>
        ) : (
          <Path d={hp} fill={lite ? p.head : `url(#${id})`} stroke={p.line} strokeWidth={1.2 * k} strokeLinejoin="round" />
        )}
        <Path d={eyes} fill={neon ? p.belly ?? '#fff' : '#fff'} stroke={neon ? undefined : p.line} strokeWidth={0.8 * k} />
        <Path d={pupils} fill="#111" />
      </>
    );
  }

  let body: React.ReactNode;
  if (style === 'neon') {
    body = (
      <>
        <Path d={band(1.9)} fill={p.body} opacity={0.18} />
        <Path d={band(1.3)} fill={p.body} opacity={0.3} />
        <Path d={band(1)} fill="#0B0F1E" stroke={p.body} strokeWidth={2 * k} />
      </>
    );
  } else {
    body = (
      <>
        {lite ? null : <Path d={band(1)} fill="rgba(0,0,0,0.22)" transform={`translate(${f1(2 * k)} ${f1(2.5 * k)})`} />}
        <Path d={band(1)} fill={p.body} stroke={p.line} strokeWidth={(style === 'cute' ? 1.8 : 1.2) * k} strokeLinejoin="round" />
        {pattern}
        {style === 'cute' || lite ? null : (
          <>
            <Path d={band(0.4, 0, 0.9, -0.75)} fill="#000" opacity={0.15} />
            <Path d={band(0.16, 0.02, 0.8, 0.6)} fill="#fff" opacity={0.55} />
          </>
        )}
      </>
    );
  }
  if (part === 'body') return <G>{body}</G>;
  const neck =
    style === 'neon' ? (
      <Path d={band(1, 0, 0.1)} fill="#0B0F1E" stroke={p.body} strokeWidth={2 * k} />
    ) : (
      <>
        <Path d={band(1.05, 0, 0.11)} fill="rgba(0,0,0,0.28)" transform={`translate(${f1(2 * k)} ${f1(2.5 * k)})`} />
        <Path d={band(1, 0, 0.11)} fill={p.body} stroke={p.line} strokeWidth={(style === 'cute' ? 1.8 : 1.2) * k} strokeLinejoin="round" />
        {style === 'cute' || lite ? null : <Path d={band(0.16, 0.02, 0.11, 0.6)} fill="#fff" opacity={0.55} />}
      </>
    );
  return (
    <G>
      {lite || style === 'neon' || style === 'cute' ? null : (
        <Defs>
          <RadialGradient id={id} cx="40%" cy="35%" r="75%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="0.5" stopColor={p.head} />
            <Stop offset="1" stopColor={p.line} />
          </RadialGradient>
        </Defs>
      )}
      {neck}
      <G transform={`translate(${f1(h0.x)} ${f1(h0.y)}) rotate(${f1(ang)})`}>{headArt}</G>
    </G>
  );
}

/** A ladder in the design's style: rope, rainbow steps, gold, candy stripes or white (merged paths). */
function LadderArt({ from, to, cell, look, lite, foot }: { from: Pt; to: Pt; cell: number; look: LadderLook; lite?: boolean; foot?: boolean }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const A = { x: from.x - ux * cell * 0.2, y: from.y - uy * cell * 0.2 };
  const B = { x: to.x + ux * cell * 0.15, y: to.y + uy * cell * 0.15 };
  const full = Math.hypot(B.x - A.x, B.y - A.y);
  // Foot only: the ladder's first square (its entry point), drawn again over any snake passing it —
  // the very same rails and rungs (same spacing), just cut short, so it reads as one ladder.
  const reach = foot ? Math.min(full, cell * 0.85) : full;
  const E = { x: A.x + ux * reach, y: A.y + uy * reach };
  const half = cell * (look.half ?? 0.19);
  const px = -uy * half;
  const py = ux * half;
  const n = Math.max(4, Math.round(full / (cell * (look.gap ?? 0.3))));
  const sw = Math.max(0.5, cell / 36);
  const railD = (sx = 0, sy = 0) =>
    [1, -1].map((k) => `M${f1(A.x + k * px + sx)} ${f1(A.y + k * py + sy)}L${f1(E.x + k * px + sx)} ${f1(E.y + k * py + sy)}`).join('');
  const colours = Array.isArray(look.rung) ? look.rung : [look.rung];
  const rungs = colours.map(() => '');
  let all = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    if (t * full > reach) break;
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t;
    const seg = `M${f1(x + px)} ${f1(y + py)}L${f1(x - px)} ${f1(y - py)}`;
    rungs[i % colours.length] += seg;
    all += seg;
  }
  return (
    <G>
      {lite || foot ? null : <Path d={railD(2, 3)} stroke="rgba(0,0,0,0.22)" strokeWidth={(look.rail + 1) * sw} strokeLinecap="round" />}
      {look.edge && all ? <Path d={all} stroke={look.edge} strokeWidth={(look.rungW + 1.4) * sw} strokeLinecap="round" /> : null}
      {rungs.map((d, i) => (d ? <Path key={i} d={d} stroke={colours[i]} strokeWidth={look.rungW * sw} strokeLinecap="round" /> : null))}
      {look.edge ? <Path d={railD()} stroke={look.edge} strokeWidth={(look.rail + 1.6) * sw} strokeLinecap={foot ? 'butt' : 'round'} /> : null}
      <Path d={railD()} stroke={look.railC} strokeWidth={look.rail * sw} strokeLinecap={foot ? 'butt' : 'round'} />
      {look.kind === 'candy' ? <Path d={railD()} stroke="#fff" strokeWidth={look.rail * sw} strokeDasharray="4 4" /> : null}
      {look.kind === 'rope' ? <Path d={railD()} stroke="#8D6E63" strokeWidth={look.rail * 0.6 * sw} strokeDasharray="1.5 2.5" /> : null}
      {look.shine && !foot ? <Path d={railD(-0.8)} stroke="#fff" strokeOpacity={0.7} strokeWidth={1} /> : null}
    </G>
  );
}

/**
 * The board in the chosen design: its squares (mixed folk colours or sea rows), raised edges,
 * waves or bubbles, a picture in every square (no picture repeats near itself) unless pictures
 * are turned off — then the numbers sit big in the middle — the number badge, the design's
 * ladders and snakes (every snake its own colour). `numbers={false}` = a light mini version.
 */
export const BoardArt = React.memo(
  function BoardArt({ size, board, design, icons = true, numbers = true, idPrefix = 'b', svgRef }: { size: number; board: SnlBoard; design: number; icons?: boolean; numbers?: boolean; idPrefix?: string; svgRef?: React.Ref<Svg> }) {
    const cell = size / 10;
    const k = Math.max(0.35, cell / 40);
    // Small previews: the number in each badge would be unreadable — the badge shape is enough.
    const small = size < 240;
    const d = BOARD_DESIGNS[design] ?? BOARD_DESIGNS[0];
    const c = (sq: number) => snlCentre(sq, size);
    const pics = icons && numbers ? designIcons(d) : null;
    const gap = d.gap ?? 0.6;
    const rx = d.rx ? Math.max(1, (d.rx * cell) / 36) : 0;
    const paints = SNAKE_PAINTS[d.snake];
    const fills = new Map<string, string>();
    let light = '';
    let dark = '';
    let waves = '';
    let bubbles = '';
    let badges = '';
    for (let sq = 1; sq <= 100; sq++) {
      const { row, col } = snlCell(sq);
      const x0 = col * cell;
      const y0 = row * cell;
      const fill = designTile(d, sq);
      fills.set(fill, (fills.get(fill) ?? '') + rectPath(x0 + gap, y0 + gap, cell - gap * 2, cell - gap * 2, rx));
      if (!numbers) continue;
      if (d.bevel) {
        light += `M${f1(x0 + 2)} ${f1(y0 + cell - 2)}L${f1(x0 + 2)} ${f1(y0 + 2)}L${f1(x0 + cell - 2)} ${f1(y0 + 2)}`;
        dark += `M${f1(x0 + cell - 2)} ${f1(y0 + 2)}L${f1(x0 + cell - 2)} ${f1(y0 + cell - 2)}L${f1(x0 + 2)} ${f1(y0 + cell - 2)}`;
      }
      if (d.waves && sq % 3 === 0) waves += `M${f1(x0 + 3)} ${f1(y0 + cell * 0.72)}q${f1(cell * 0.12)} ${f1(-cell * 0.1)} ${f1(cell * 0.24)} 0t${f1(cell * 0.24)} 0t${f1(cell * 0.24)} 0`;
      if (d.bubbles && sq % 2) bubbles += circlePath(x0 + cell * 0.82, y0 + cell * 0.3, cell * 0.06) + circlePath(x0 + cell * 0.72, y0 + cell * 0.16, cell * 0.035);
      if (pics) badges += rectPath(x0 + 1.8, y0 + 1.8, cell * (sq > 99 ? 0.5 : sq > 9 ? 0.4 : 0.3), cell * 0.3, cell * 0.15);
    }
    return (
      <Svg ref={svgRef} width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={d.grout} />
        {[...fills.entries()].map(([fill, path]) => (
          <Path key={fill} d={path} fill={fill} />
        ))}
        {light ? <Path d={light} stroke="#fff" strokeOpacity={0.5} strokeWidth={1.2 * k} fill="none" /> : null}
        {dark ? <Path d={dark} stroke="#000" strokeOpacity={0.18} strokeWidth={1.2 * k} fill="none" /> : null}
        {waves ? <Path d={waves} stroke={d.waves} strokeWidth={k} fill="none" opacity={0.55} /> : null}
        {bubbles ? <Path d={bubbles} fill="none" stroke={d.bubbles} strokeWidth={0.8 * k} opacity={0.7} /> : null}
        {badges ? <Path d={badges} fill={d.badge} stroke={d.badgeLine ?? 'rgba(0,0,0,0.35)'} strokeWidth={0.6 * k} /> : null}
        {numbers
          ? Array.from({ length: 100 }, (_, i) => {
              const sq = i + 1;
              const { row, col } = snlCell(sq);
              const x0 = col * cell;
              const y0 = row * cell;
              const wide = sq > 99 ? 0.5 : sq > 9 ? 0.4 : 0.3;
              return (
                <G key={sq}>
                  {pics ? (
                    <SvgText x={x0 + cell * 0.56} y={y0 + cell * 0.84} fontSize={cell * 0.42} textAnchor="middle" opacity={0.92}>
                      {pics[i]}
                    </SvgText>
                  ) : null}
                  {pics && small ? null : pics ? (
                    <SvgText x={x0 + 1.8 + (cell * wide) / 2} y={y0 + cell * 0.26} fontSize={cell * 0.22} fontWeight="800" fill={d.numC} textAnchor="middle">
                      {sq}
                    </SvgText>
                  ) : sq === 100 ? (
                    <SvgText x={x0 + cell / 2} y={y0 + cell * 0.7} fontSize={cell * 0.44} textAnchor="middle">
                      {d.topIcon}
                    </SvgText>
                  ) : (
                    <SvgText x={x0 + cell / 2} y={y0 + cell * 0.64} fontSize={cell * 0.36} fontWeight="800" fill={d.numC} textAnchor="middle" opacity={0.85}>
                      {sq}
                    </SvgText>
                  )}
                </G>
              );
            })
          : null}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`l${f}`} from={c(Number(f))} to={c(to)} cell={cell} look={LADDER_LOOKS[d.ladder]} lite={!numbers} />
        ))}
        {/* Layers: ladders, snake bodies, then every ladder's foot (its entry square) over any snake
            passing it, then every snake's head over any ladder passing it. */}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`s${h}`} part="body" id={`${idPrefix}h${h}`} style={d.snake} paint={paints[i % paints.length]} head={c(Number(h))} tail={c(tl)} cell={cell} lite={!numbers} />
        ))}
        {Object.entries(board.ladders).map(([f, to]) => (
          <LadderArt key={`lf${f}`} foot from={c(Number(f))} to={c(to)} cell={cell} look={LADDER_LOOKS[d.ladder]} lite />
        ))}
        {Object.entries(board.snakes).map(([h, tl], i) => (
          <SnakeArt key={`sh${h}`} part="head" id={`${idPrefix}h${h}`} style={d.snake} paint={paints[i % paints.length]} head={c(Number(h))} tail={c(tl)} cell={cell} lite={!numbers} />
        ))}
      </Svg>
    );
  },
  (a, b) => a.size === b.size && a.numbers === b.numbers && a.design === b.design && a.icons === b.icons && JSON.stringify(a.board) === JSON.stringify(b.board),
);

const STEP_MS = 210;
/** Time the die needs to land before the pawn starts walking. */
const LAND_MS = 820;

/**
 * Snakes & Ladders. Everyone starts off the board (a 1 brings you onto square 1). On your turn
 * tap the die under the board: it spins down and lands, then your pawn glides square by square
 * (lifting a little on each, with a pop), climbs a ladder or slides down along the snake's body.
 * Up to 10 pawns share a square, smaller the more there are. Names sit either side of the die.
 */
export function SnakesBoard({ state, seconds, busy, onRoll }: { state: PartyState; seconds: number; busy: boolean; onRoll: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const g = state.game;
  const s = g.state;
  // As big as the screen allows: the frame is thin so the squares get the room (board + 12 px of frame).
  const size = Math.min(width - 14, 560);
  const cell = size / 10;
  const pawnSize = cell * 0.62;
  const order = s.order ?? state.players.map((p) => p.userId);
  const pos = s.pos ?? {};
  const board = (s as { board?: SnlBoard }).board ?? CLASSIC;
  // The host's design (0–8) and whether squares show pictures — the same for everyone.
  const opts = (g.options ?? {}) as { theme?: number; icons?: boolean };
  const design = Math.max(0, Math.min(BOARD_DESIGNS.length - 1, opts.theme ?? 0));
  const showIcons = opts.icons !== false;
  const theme = BOARD_DESIGNS[design];
  const opened = useAfterOpen();
  const colorOf = (uid?: string) => TOKEN_COLORS[Math.max(0, order.indexOf(uid ?? '')) % TOKEN_COLORS.length];
  const isMyTurn = s.turn === state.me.userId;
  const outOf = (uid: string) => !state.players.find((p) => p.userId === uid)?.active;
  const last = s.last;

  const [rolling, setRolling] = useState(false);
  useEffect(() => setRolling(false), [last?.at]);
  useEffect(() => {
    if (!rolling) return;
    const t1 = setTimeout(() => setRolling(false), 6000);
    return () => clearTimeout(t1);
  }, [rolling]);

  const onBoard = order.filter((u) => !outOf(u) && (pos[u] ?? 0) > 0);
  const groups: Record<number, string[]> = {};
  for (const u of onBoard) (groups[pos[u]] ??= []).push(u);
  const restOf = (uid: string): { x: number; y: number; scale: number } => {
    const sq = pos[uid] ?? 0;
    const sharers = groups[sq] ?? [uid];
    const { offsets, scale } = shareLayout(sharers.length);
    const o = offsets[Math.max(0, sharers.indexOf(uid))];
    const c = snlCentre(Math.max(1, sq), size);
    return { x: c.x + o.x * cell - pawnSize / 2, y: c.y + o.y * cell - pawnSize * 0.75, scale };
  };
  const at = (p: Pt) => ({ x: p.x - pawnSize / 2, y: p.y - pawnSize * 0.75 });

  const anims = useRef<Record<string, Animated.ValueXY>>({});
  const scales = useRef<Record<string, Animated.Value>>({});
  const lifts = useRef<Record<string, Animated.Value>>({});
  const seenAt = useRef<number | undefined>(last?.at);
  const [moving, setMoving] = useState<string | null>(null);
  const movingRef = useRef<string | null>(null);
  for (const uid of order) {
    if (!anims.current[uid]) {
      const r = restOf(uid);
      anims.current[uid] = new Animated.ValueXY({ x: r.x, y: r.y });
      scales.current[uid] = new Animated.Value(r.scale);
      lifts.current[uid] = new Animated.Value(0);
    }
  }

  useEffect(() => {
    const isNew = last && last.at !== seenAt.current;
    for (const uid of order) {
      // Never pull back a pawn that is still walking.
      if ((isNew && uid === last!.userId) || movingRef.current === uid) continue;
      const r = restOf(uid);
      Animated.parallel([
        Animated.spring(anims.current[uid], { toValue: { x: r.x, y: r.y }, friction: 9, useNativeDriver: false }),
        Animated.spring(scales.current[uid], { toValue: r.scale, friction: 9, useNativeDriver: false }),
      ]).start();
    }
    if (!isNew || !last) return;
    seenAt.current = last.at;
    const uid = last.userId;
    const a = anims.current[uid];
    const lift = lifts.current[uid];
    const sc = scales.current[uid];
    if (!a || !lift || !sc) return;
    if (uid !== state.me.userId) playGameSound('dice');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sound = (kind: Parameters<typeof playGameSound>[0], ms: number) => timers.push(setTimeout(() => playGameSound(kind), ms));

    const mid = last.mid ?? last.to;
    const steps = last.from === 0 ? (mid === 1 ? [1] : []) : snlSteps(last.from, mid);
    // Still waiting for a 1, or no move at all: the pawn stays where it is (off the board, under
    // the board in the dock) — never shown on square 1 and taken back.
    if (steps.length === 0 && last.to === last.from) return () => timers.forEach(clearTimeout);
    const seq: Animated.CompositeAnimation[] = [Animated.delay(LAND_MS)];
    let t0 = LAND_MS;
    // Coming onto the board: from just left of square 1.
    if (last.from === 0 && steps.length) a.setValue(at({ x: snlCentre(1, size).x - cell * 0.9, y: snlCentre(1, size).y }));
    seq.push(Animated.timing(sc, { toValue: 1, duration: 120, useNativeDriver: false }));
    t0 += 120;
    for (const sq of steps) {
      // Glide to the next square, lifting slightly towards you (never a jump up the board).
      seq.push(
        Animated.parallel([
          Animated.timing(a, { toValue: at(snlCentre(sq, size)), duration: STEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 1, duration: STEP_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(lift, { toValue: 0, duration: STEP_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          ]),
        ]),
      );
      sound('step', t0 + STEP_MS - 30);
      t0 += STEP_MS;
    }
    if (last.to > mid) {
      seq.push(Animated.delay(180));
      sound('ladder', t0 + 180);
      seq.push(Animated.timing(a, { toValue: at(snlCentre(last.to, size)), duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    } else if (last.to < mid) {
      seq.push(Animated.delay(180));
      sound('snake', t0 + 180);
      const curve = snakeCurve(snlCentre(mid, size), snlCentre(last.to, size), cell);
      const N = 24;
      for (let i = 1; i <= N; i++) {
        seq.push(Animated.timing(a, { toValue: at(curve.at(i / N)), duration: 1300 / N, easing: Easing.linear, useNativeDriver: false }));
      }
    }
    const r = restOf(uid);
    seq.push(
      Animated.parallel([
        Animated.spring(a, { toValue: { x: r.x, y: r.y }, friction: 8, useNativeDriver: false }),
        Animated.spring(sc, { toValue: r.scale, friction: 8, useNativeDriver: false }),
      ]),
    );
    movingRef.current = uid;
    setMoving(uid);
    Animated.sequence(seq).start(() => {
      movingRef.current = null;
      setMoving(null);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.at, JSON.stringify(pos), size]);

  const nameOf = (uid?: string) => (uid === state.me.userId ? t('party.you') : state.players.find((p) => p.userId === uid)?.name ?? '');
  const message = useMemo(() => {
    if (!last) return t('party.snakes.start');
    const name = nameOf(last.userId);
    const mid = last.mid ?? last.to;
    if (last.from === 0 && mid === 0) return t('party.snakes.needOne', { name, roll: last.roll });
    if (last.from === 0) return t('party.snakes.entered', { name });
    if (last.to > mid) return t('party.snakes.climbed', { name, to: last.to });
    if (last.to < mid) return t('party.snakes.bitten', { name, to: last.to });
    if (mid === last.from) return t('party.snakes.tooHigh', { name });
    return t('party.snakes.moved', { name, roll: last.roll, to: last.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, state.players, state.me.userId, t]);

  const canRoll = isMyTurn && g.phase === 'turn' && !moving && !rolling;
  const roll = () => {
    if (!canRoll) return;
    setRolling(true);
    playGameSound('dice');
    onRoll();
  };

  const dockPlayers: DockPlayer[] = order.flatMap((uid) => {
    const p = state.players.find((x) => x.userId === uid);
    if (!p) return [];
    const sq = pos[uid] ?? 0;
    return [
      {
        userId: uid,
        name: nameOf(uid),
        avatarKey: p.avatarKey,
        color: colorOf(uid),
        value: outOf(uid) ? t('party.board.out') : sq === 0 ? '' : `#${sq}`,
        misses: s.misses?.[uid] ?? 0,
        out: outOf(uid),
        // Not on the board yet (needs a 1): the pawn waits here, under the board.
        piece: !outOf(uid) && sq === 0 && moving !== uid ? <Pawn color={colorOf(uid).hex} dark={colorOf(uid).dark} size={18} /> : undefined,
      },
    ];
  });

  return (
    <View>
      <View style={[styles.boardWrap, { width: size + 12, marginHorizontal: -(spacing.lg - 1), backgroundColor: theme.frame, borderColor: theme.edge }]}>
        {/* Title banner, like the painted Paramapadam boards */}
        <View style={styles.banner}>
          <T style={styles.bannerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
            🪔  {t('party.snakes.title').toUpperCase()}  🪔
          </T>
        </View>
        <View style={{ width: size + 2, padding: 1, borderRadius: 6, backgroundColor: '#1E1006' }}>
        <View style={{ width: size, height: size, borderRadius: 5, overflow: 'hidden' }}>
          {opened ? (
            <BoardArt size={size} board={board} design={design} icons={showIcons} />
          ) : (
            <View style={[styles.boardWait, { width: size, height: size, backgroundColor: theme.grout }]}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          {order.map((uid) => {
            const c = colorOf(uid);
            const on = !outOf(uid) && ((pos[uid] ?? 0) > 0 || moving === uid);
            return (
              <Animated.View
                key={uid}
                pointerEvents="none"
                style={[
                  styles.token,
                  {
                    opacity: on ? 1 : 0,
                    transform: [
                      ...anims.current[uid].getTranslateTransform(),
                      { scale: Animated.multiply(scales.current[uid], lifts.current[uid].interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] })) },
                    ],
                  },
                ]}
              >
                <Pawn color={c.hex} dark={c.dark} size={pawnSize} glow={uid === s.turn} />
              </Animated.View>
            );
          })}
          </View>
        </View>
      </View>

      <GameDock
        players={dockPlayers}
        meId={state.me.userId}
        turnId={s.turn}
        canAct={canRoll}
        busy={busy}
        onAct={roll}
        actLabel={t('party.board.tapRoll')}
        seconds={seconds}
        status={rolling ? t('party.board.rolling') : !moving && canRoll ? t('party.board.yourTurnRoll') : message}
        center={<RollingDie value={last?.roll ?? 1} rollKey={last?.at} rolling={rolling} size={50} />}
      />
    </View>
  );
}

/** A small preview of one board (for choosing at create). */
export function BoardThumb({ index, board, size, design = 0, label }: { index: number; board: SnlBoard; size: number; design?: number; label?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
      <BoardArt size={size} board={board} design={design} numbers={false} idPrefix={`t${index}_${design}`} />
      <View style={styles.thumbNum}>
        <T style={styles.thumbNumText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
          {label ?? (index % 5) + 1}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: { alignSelf: 'center', padding: 3, borderRadius: 12, borderWidth: 2 },
  banner: { height: 28, marginBottom: 5, borderRadius: 7, backgroundColor: '#FFF176', borderWidth: 1, borderColor: '#5D4037', alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: '#B71C1C', letterSpacing: 1 },
  token: { position: 'absolute', left: 0, top: 0 },
  mini: { borderRadius: 8, borderWidth: 2, padding: 3, alignItems: 'center' },
  miniBanner: { alignSelf: 'stretch', height: 7, borderRadius: 3, marginBottom: 3, backgroundColor: '#FFF176' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewCard: { alignItems: 'center', borderRadius: 20, padding: 12, backgroundColor: '#1A1030' },
  previewHead: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  boardWait: { alignItems: 'center', justifyContent: 'center' },
  thumbNum: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbNumText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});

/** Saved pictures of preview boards (design + pictures + size + layout). */
const SNAPSHOTS = new Map<string, string>();

/** The game board in small, exactly as in the game: its frame, the yellow title strip, the full board (pictures as chosen). */
export function MiniBoard({ design, board, size, label, icons = true, still = true }: { design: number; board: SnlBoard; size: number; label?: string; icons?: boolean; /** Save as a picture (for scrolling lists); false = keep drawing live (one big board). */ still?: boolean }) {
  const d = BOARD_DESIGNS[design] ?? BOARD_DESIGNS[0];
  const inner = size - 10;
  // Drawn once, saved as a picture (kept for next time), then shown as an image — images scroll
  // smoothly, hundreds of vector shapes don't.
  const key = `${design}|${icons ? 1 : 0}|${inner}|${JSON.stringify(board)}`;
  const [uri, setUri] = useState<string | undefined>(SNAPSHOTS.get(key));
  const svg = useRef<Svg>(null);
  useEffect(() => {
    if (!still) return;
    const cached = SNAPSHOTS.get(key);
    if (cached) {
      setUri(cached);
      return;
    }
    setUri(undefined);
    const id = setTimeout(() => {
      svg.current?.toDataURL((b64: string) => {
        const u = `data:image/png;base64,${b64}`;
        SNAPSHOTS.set(key, u);
        setUri(u);
      });
    }, 60);
    return () => clearTimeout(id);
  }, [key, still]);
  return (
    // Kept as a ready-made picture while scrolling (no redraw of hundreds of shapes every frame).
    <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.mini, { width: size, backgroundColor: d.frame, borderColor: d.edge }]}>
      <View style={styles.miniBanner} />
      <View style={{ width: inner, height: inner, borderRadius: 3, overflow: 'hidden' }}>
        {still && uri ? (
          <Image source={{ uri }} style={{ width: inner, height: inner }} fadeDuration={0} />
        ) : (
          <BoardArt size={inner} board={board} design={design} icons={icons} idPrefix={`m${design}_${size}`} svgRef={svg} />
        )}
      </View>
      {label ? (
        <View style={styles.thumbNum}>
          <T style={styles.thumbNumText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {label}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Full-size look at a design (as in the game), with "Use this design". */
export function DesignPreview({
  design,
  board,
  icons,
  title,
  useLabel,
  onUse,
  onClose,
}: {
  design: number | null;
  board: SnlBoard;
  icons: boolean;
  title: string;
  useLabel: string;
  onUse: () => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const size = Math.min(width - 56, 460);
  const d = design === null ? null : BOARD_DESIGNS[design];
  return (
    <Modal visible={design !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.previewBackdrop} onPress={onClose}>
        {d ? (
          <Pressable style={styles.previewCard} onPress={() => undefined}>
            <View style={styles.previewHead}>
              <T variant="h3" color="#fff" style={{ flex: 1 }} numberOfLines={1}>
                {title}
              </T>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <View style={[styles.boardWrap, { width: size + 12, backgroundColor: d.frame, borderColor: d.edge }]}>
              <View style={styles.banner}>
                <T style={styles.bannerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1}>
                  🪔  {t('party.snakes.title').toUpperCase()}  🪔
                </T>
              </View>
              <View style={{ width: size + 2, padding: 1, borderRadius: 6, backgroundColor: '#1E1006' }}>
                <View style={{ width: size, height: size, borderRadius: 5, overflow: 'hidden' }}>
                  <BoardArt size={size} board={board} design={design!} icons={icons} idPrefix={`p${design}`} />
                </View>
              </View>
            </View>
            <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
              <Button title={useLabel} variant="gold" icon="checkmark-circle" onPress={onUse} />
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}
