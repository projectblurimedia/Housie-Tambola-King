/**
 * Each party game's illustration as SVG (drawn with SvgXml), 160 × 120. Kept as plain strings
 * so they can also be rendered off-device for previews.
 */
import type { PartyKind } from '@/services/partyService';

const seeta = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
<defs>
  <linearGradient id="bow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1A8"/><stop offset="0.5" stop-color="#F5B700"/><stop offset="1" stop-color="#9A6200"/></linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FDE68A" stop-opacity="0.55"/><stop offset="1" stop-color="#FDE68A" stop-opacity="0"/></radialGradient>
  <linearGradient id="petal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBCFE8"/><stop offset="1" stop-color="#DB2777"/></linearGradient>
</defs>
<circle cx="80" cy="58" r="56" fill="url(#glow)"/>
<path d="M44 16 Q104 58 44 100" fill="none" stroke="url(#bow)" stroke-width="7" stroke-linecap="round"/>
<path d="M44 16 L44 100" stroke="#FEF3C7" stroke-width="1.6"/>
<path d="M30 92 L118 26" stroke="#FDE68A" stroke-width="3.2" stroke-linecap="round"/>
<path d="M118 26 L106 28 L113 36 Z" fill="#FDE68A"/>
<path d="M30 92 l-8 -2 l4 6 Z M33 89 l-8 -2 l4 6 Z" fill="#FB7185"/>
<g transform="translate(118 92)">
  <ellipse cx="0" cy="6" rx="22" ry="5" fill="#065F46" opacity="0.5"/>
  <path d="M0 4 C-6 -6 -6 -16 0 -22 C6 -16 6 -6 0 4 Z" fill="url(#petal)"/>
  <path d="M0 4 C-12 -2 -18 -10 -18 -16 C-10 -14 -4 -8 0 4 Z" fill="url(#petal)"/>
  <path d="M0 4 C12 -2 18 -10 18 -16 C10 -14 4 -8 0 4 Z" fill="url(#petal)"/>
</g>
<path d="M132 18 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" fill="#FFF7D6"/>
<path d="M20 30 l1.4 -4 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 Z" fill="#FFF7D6" opacity="0.8"/>
</svg>`;

const card = (x: number, y: number, r: number, a: string, b: string, sym: string) => `
<g transform="translate(${x} ${y}) rotate(${r})">
  <rect x="-20" y="-30" width="40" height="60" rx="7" fill="#000" opacity="0.25" transform="translate(2 3)"/>
  <rect x="-20" y="-30" width="40" height="60" rx="7" fill="#FFFDF5"/>
  <rect x="-16.5" y="-26.5" width="33" height="53" rx="5" fill="url(#${a})"/>
  <rect x="-16.5" y="-26.5" width="33" height="26" rx="5" fill="#fff" opacity="0.18"/>
  ${sym}
  <circle cx="-11" cy="-21" r="2.4" fill="#fff" opacity="0.9"/><circle cx="11" cy="21" r="2.4" fill="#fff" opacity="0.9"/>
  <defs><linearGradient id="${a}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.split(',')[0]}"/><stop offset="1" stop-color="${b.split(',')[1]}"/></linearGradient></defs>
</g>`;
const show = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
<defs><radialGradient id="g2" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#67E8F9" stop-opacity="0.45"/><stop offset="1" stop-color="#67E8F9" stop-opacity="0"/></radialGradient></defs>
<circle cx="80" cy="64" r="54" fill="url(#g2)"/>
${card(52, 66, -22, 'c1', '#F87171,#B91C1C', '<path d="M0 8 C-12 0 -10 -12 0 -6 C10 -12 12 0 0 8 Z" fill="#fff"/>')}
${card(80, 58, 0, 'c2', '#60A5FA,#1D4ED8', '<path d="M0 -10 C6 -2 8 4 0 10 C-8 4 -6 -2 0 -10 Z" fill="#fff"/>')}
${card(108, 66, 22, 'c3', '#4ADE80,#15803D', '<path d="M-7 8 C-9 -4 0 -10 8 -8 C8 2 2 9 -7 8 Z" fill="#fff"/>')}
<path d="M80 6 l2.4 -7 l2.4 7 l7 2.4 l-7 2.4 l-2.4 7 l-2.4 -7 l-7 -2.4 Z" fill="#FFF7D6" transform="translate(52 6)"/>
</svg>`;

const snakes = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
<defs>
  <linearGradient id="sk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3E635"/><stop offset="1" stop-color="#15803D"/></linearGradient>
  <linearGradient id="wd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8B5A2B"/><stop offset="0.5" stop-color="#D9A066"/><stop offset="1" stop-color="#8B5A2B"/></linearGradient>
  <radialGradient id="g3" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#BEF264" stop-opacity="0.4"/><stop offset="1" stop-color="#BEF264" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="80" cy="60" r="56" fill="url(#g3)"/>
<g transform="rotate(-8 80 60)">
  <rect x="34" y="16" width="92" height="92" rx="10" fill="#FFF8EC" opacity="0.95"/>
  <path d="M34 39 h92 M34 62 h92 M34 85 h92 M57 16 v92 M80 16 v92 M103 16 v92" stroke="#E2C9A6" stroke-width="1"/>
  <rect x="34" y="16" width="23" height="23" fill="#F6E3C6"/><rect x="80" y="16" width="23" height="23" fill="#F6E3C6"/><rect x="57" y="39" width="23" height="23" fill="#F6E3C6"/><rect x="103" y="39" width="23" height="23" fill="#F6E3C6"/><rect x="34" y="62" width="23" height="23" fill="#F6E3C6"/><rect x="80" y="62" width="23" height="23" fill="#F6E3C6"/><rect x="57" y="85" width="23" height="23" fill="#F6E3C6"/><rect x="103" y="85" width="23" height="23" fill="#F6E3C6"/>
  <g stroke-linecap="round"><path d="M50 98 L92 28 M62 104 L104 34" stroke="#6B3E17" stroke-width="5"/><path d="M50 98 L92 28 M62 104 L104 34" stroke="url(#wd)" stroke-width="3"/>
  <path d="M55 89 l12 6 M61 79 l12 6 M67 69 l12 6 M73 59 l12 6 M79 49 l12 6 M85 39 l12 6" stroke="#7C4A1E" stroke-width="3"/></g>
  <path d="M112 30 C88 40 120 58 96 70 C72 82 98 96 70 102" fill="none" stroke="#14532D" stroke-width="12" stroke-linecap="round"/>
  <path d="M112 30 C88 40 120 58 96 70 C72 82 98 96 70 102" fill="none" stroke="url(#sk)" stroke-width="9" stroke-linecap="round"/>
  <path d="M112 30 C88 40 120 58 96 70 C72 82 98 96 70 102" fill="none" stroke="#FDE047" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
  <ellipse cx="114" cy="28" rx="9" ry="7" fill="#15803D"/><ellipse cx="114" cy="28" rx="7.5" ry="5.6" fill="#84CC16"/>
  <circle cx="117" cy="25" r="2" fill="#fff"/><circle cx="117.5" cy="25" r="1" fill="#111"/><circle cx="117" cy="31" r="2" fill="#fff"/><circle cx="117.5" cy="31" r="1" fill="#111"/>
  <path d="M122 28 l6 -2 M122 28 l6 2" stroke="#E11D48" stroke-width="1.6" stroke-linecap="round"/>
</g>
<g transform="translate(26 84) rotate(-14)">
  <rect x="-13" y="-13" width="26" height="26" rx="6" fill="#000" opacity="0.25" transform="translate(2 3)"/>
  <rect x="-13" y="-13" width="26" height="26" rx="6" fill="#FFFFFF"/><rect x="-13" y="-13" width="26" height="13" rx="6" fill="#F1F5F9"/>
  <circle cx="-6" cy="-6" r="2.6" fill="#1F2937"/><circle cx="0" cy="0" r="2.6" fill="#DC2626"/><circle cx="6" cy="6" r="2.6" fill="#1F2937"/>
</g>
</svg>`;

const seed = (x: number, y: number, r: number, up: boolean) => `
<g transform="translate(${x} ${y}) rotate(${r})">
  <ellipse cx="1.5" cy="2.5" rx="11" ry="8" fill="#000" opacity="0.3"/>
  <ellipse cx="0" cy="0" rx="11" ry="8" fill="${up ? 'url(#in)' : 'url(#sh)'}" stroke="#2B1405" stroke-width="1"/>
  ${up ? '<path d="M-6 0 Q0 -3 6 0" stroke="#92400E" stroke-width="1.4" fill="none" opacity="0.7"/>' : '<ellipse cx="-3.5" cy="-3" rx="4" ry="2" fill="#fff" opacity="0.35"/>'}
</g>`;
const chamma = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
<defs>
  <radialGradient id="sh" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#B4683A"/><stop offset="0.6" stop-color="#5A2A0E"/><stop offset="1" stop-color="#2B1405"/></radialGradient>
  <radialGradient id="in" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#FFFBEB"/><stop offset="0.7" stop-color="#EBD3A0"/><stop offset="1" stop-color="#B88A4E"/></radialGradient>
  <radialGradient id="g4" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FCD34D" stop-opacity="0.4"/><stop offset="1" stop-color="#FCD34D" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="80" cy="60" r="56" fill="url(#g4)"/>
<g transform="translate(80 58) rotate(-10)">
  <rect x="-44" y="-44" width="88" height="88" rx="8" fill="#33241B" stroke="#FDE68A" stroke-width="1.2"/>
  <path d="M-44 -26.4 h88 M-44 -8.8 h88 M-44 8.8 h88 M-44 26.4 h88 M-26.4 -44 v88 M-8.8 -44 v88 M8.8 -44 v88 M26.4 -44 v88" stroke="rgba(255,248,230,0.75)" stroke-width="1.3"/>
  <rect x="-8.8" y="-8.8" width="17.6" height="17.6" fill="#FDE68A" opacity="0.35"/>
  <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#FDE68A" stroke-width="1.6"/>
  <path d="M-5 30 L5 40 M5 30 L-5 40" stroke="#EF4444" stroke-width="2"/>
  <path d="M30 -5 L40 5 M40 -5 L30 5" stroke="#22C55E" stroke-width="2"/>
  <path d="M-5 -40 L5 -30 M5 -40 L-5 -30" stroke="#FACC15" stroke-width="2"/>
  <path d="M-40 -5 L-30 5 M-30 -5 L-40 5" stroke="#3B82F6" stroke-width="2"/>
  <circle cx="-17.6" cy="35" r="5.5" fill="#EF4444" stroke="#fff" stroke-width="1.5"/>
  <circle cx="35" cy="17.6" r="5.5" fill="#22C55E" stroke="#fff" stroke-width="1.5"/>
</g>
${seed(26, 96, -20, true)}${seed(48, 104, 15, false)}${seed(120, 98, 30, true)}${seed(138, 82, -10, false)}
</svg>`;

export const GAME_ART: Record<PartyKind, string> = { seeta, show, snakes, chamma };
