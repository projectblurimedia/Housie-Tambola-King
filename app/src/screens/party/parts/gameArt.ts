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

// Snakes & Ladders (owner, 2026-11-28): a tilted folk-colour board, a wooden ladder, a friendly banded
// snake curling over it and a die.
const snakes = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
  <defs>
    <linearGradient id="sb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22C55E"/><stop offset="1" stop-color="#15803D"/></linearGradient>
    <radialGradient id="sh" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#86EFAC"/><stop offset="1" stop-color="#15803D"/></radialGradient>
    <linearGradient id="dice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E5DCCB"/></linearGradient>
  </defs>
  <ellipse cx="80" cy="112" rx="62" ry="7" fill="rgba(0,0,0,0.25)"/>
  <g transform="translate(36 14) rotate(-8 44 44)">
    <rect x="-4" y="-4" width="96" height="96" rx="8" fill="#5D2E0B" stroke="#FDE047" stroke-width="2"/>
    <g><rect x="0" y="0" width="22" height="22" fill="#FFD54F"/><rect x="22" y="0" width="22" height="22" fill="#FFB74D"/><rect x="44" y="0" width="22" height="22" fill="#CE93D8"/><rect x="66" y="0" width="22" height="22" fill="#81D4FA"/><rect x="0" y="22" width="22" height="22" fill="#81D4FA"/><rect x="22" y="22" width="22" height="22" fill="#AED581"/><rect x="44" y="22" width="22" height="22" fill="#F48FB1"/><rect x="66" y="22" width="22" height="22" fill="#FFD54F"/><rect x="0" y="44" width="22" height="22" fill="#FFD54F"/><rect x="22" y="44" width="22" height="22" fill="#FFB74D"/><rect x="44" y="44" width="22" height="22" fill="#CE93D8"/><rect x="66" y="44" width="22" height="22" fill="#81D4FA"/><rect x="0" y="66" width="22" height="22" fill="#81D4FA"/><rect x="22" y="66" width="22" height="22" fill="#AED581"/><rect x="44" y="66" width="22" height="22" fill="#F48FB1"/><rect x="66" y="66" width="22" height="22" fill="#FFD54F"/></g>
    <g stroke="#3E2723" stroke-width="4.5" stroke-linecap="round"><line x1="18" y1="84" x2="30" y2="10"/><line x1="34" y1="86" x2="46" y2="12"/></g>
    <g stroke="#B9732F" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="84" x2="30" y2="10"/><line x1="34" y1="86" x2="46" y2="12"/></g>
    <g stroke="#E0A060" stroke-width="2.4" stroke-linecap="round"><line x1="19.0" y1="77.8" x2="35.0" y2="79.8"/><line x1="21.0" y1="65.5" x2="37.0" y2="67.5"/><line x1="23.0" y1="53.2" x2="39.0" y2="55.2"/><line x1="25.0" y1="40.8" x2="41.0" y2="42.8"/><line x1="27.0" y1="28.5" x2="43.0" y2="30.5"/><line x1="29.0" y1="16.2" x2="45.0" y2="18.2"/></g>
  </g>
  <path d="M118 30 C 96 26, 84 44, 98 56 S 116 80, 92 92 S 52 96, 46 108" stroke="rgba(0,0,0,0.25)" stroke-width="13" fill="none" stroke-linecap="round" transform="translate(2 3)"/>
  <path d="M118 30 C 96 26, 84 44, 98 56 S 116 80, 92 92 S 52 96, 46 108" stroke="#14532D" stroke-width="13" fill="none" stroke-linecap="round"/>
  <path d="M118 30 C 96 26, 84 44, 98 56 S 116 80, 92 92 S 52 96, 46 108" stroke="url(#sb)" stroke-width="10.5" fill="none" stroke-linecap="round"/>
  <path d="M118 30 C 96 26, 84 44, 98 56 S 116 80, 92 92 S 52 96, 46 108" stroke="#FDE047" stroke-width="10.5" fill="none" stroke-dasharray="4 7"/>
  <path d="M118 30 C 96 26, 84 44, 98 56 S 116 80, 92 92 S 52 96, 46 108" stroke="#fff" stroke-opacity="0.45" stroke-width="2.5" fill="none" transform="translate(-2 -2)"/>
  <ellipse cx="122" cy="28" rx="13" ry="11" fill="url(#sh)" stroke="#14532D" stroke-width="1.6"/>
  <circle cx="118" cy="24" r="3.6" fill="#fff" stroke="#14532D" stroke-width="0.8"/><circle cx="119" cy="24" r="1.9" fill="#111"/>
  <circle cx="127" cy="23" r="3.6" fill="#fff" stroke="#14532D" stroke-width="0.8"/><circle cx="128" cy="23" r="1.9" fill="#111"/>
  <path d="M120 32 Q124 35 129 31" stroke="#14532D" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <path d="M134 28 L142 27 l3 -3 M142 27 l3 3" stroke="#DC2626" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <g transform="translate(16 74) rotate(-14 13 13)">
    <rect width="26" height="26" rx="6" fill="url(#dice)" stroke="#B9AB92" stroke-width="1.2"/>
    <circle cx="7" cy="7" r="2.4" fill="#1F2937"/><circle cx="19" cy="7" r="2.4" fill="#1F2937"/><circle cx="13" cy="13" r="2.4" fill="#1F2937"/><circle cx="7" cy="19" r="2.4" fill="#1F2937"/><circle cx="19" cy="19" r="2.4" fill="#1F2937"/>
  </g>
</svg>`;

const seed = (x: number, y: number, r: number, up: boolean) => `
<g transform="translate(${x} ${y}) rotate(${r})">
  <ellipse cx="1.5" cy="2.5" rx="11" ry="8" fill="#000" opacity="0.3"/>
  <ellipse cx="0" cy="0" rx="11" ry="8" fill="${up ? 'url(#in)' : 'url(#sh)'}" stroke="#2B1405" stroke-width="1"/>
  ${up ? '<path d="M-6 0 Q0 -3 6 0" stroke="#92400E" stroke-width="1.4" fill="none" opacity="0.7"/>' : '<ellipse cx="-3.5" cy="-3" rx="4" ry="2" fill="#fff" opacity="0.35"/>'}
</g>`;
// Ashta Chamma (owner, 2026-11-28): a tilted walnut 5×5 board with chalk crosses on the safe squares,
// four pawns in the players' colours and four tamarind seeds thrown in front.
const chamma = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
  <ellipse cx="80" cy="110" rx="60" ry="7" fill="rgba(0,0,0,0.25)"/>
  <g transform="translate(36 10) rotate(7 45 45)">
    <rect x="-5" y="-5" width="100" height="100" rx="9" fill="#2A1A10" stroke="#F5D06F" stroke-width="2.2"/>
    <rect x="1" y="1" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="19" y="1" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="37" y="1" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M38 2 L52 16 M52 2 L38 16" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="55" y="1" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="73" y="1" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="1" y="19" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="19" y="19" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M20 20 L34 34 M34 20 L20 34" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="37" y="19" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="55" y="19" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M56 20 L70 34 M70 20 L56 34" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="73" y="19" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="1" y="37" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M2 38 L16 52 M16 38 L2 52" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="19" y="37" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="37" y="37" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M38 38 L52 52 M52 38 L38 52" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="55" y="37" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="73" y="37" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M74 38 L88 52 M88 38 L74 52" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="1" y="55" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="19" y="55" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M20 56 L34 70 M34 56 L20 70" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="37" y="55" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="55" y="55" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M56 56 L70 70 M70 56 L56 70" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="73" y="55" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="1" y="73" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="19" y="73" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="37" y="73" width="16" height="16" rx="2.5" fill="#6B4A33"/><path d="M38 74 L52 88 M52 74 L38 88" stroke="#F3E3C3" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/><rect x="55" y="73" width="16" height="16" rx="2.5" fill="#4A3224"/><rect x="73" y="73" width="16" height="16" rx="2.5" fill="#4A3224"/>
    <circle cx="45" cy="45" r="5" fill="#FDE68A" opacity="0.85"/>
    <g transform="translate(45 81)"><ellipse cx="0" cy="7" rx="7" ry="2.5" fill="rgba(0,0,0,0.35)"/><circle r="6.5" fill="#991B1B"/><circle r="5.2" fill="#EF4444"/><ellipse cx="-1.8" cy="-2.2" rx="2.2" ry="1.4" fill="#fff" opacity="0.7"/></g><g transform="translate(81 45)"><ellipse cx="0" cy="7" rx="7" ry="2.5" fill="rgba(0,0,0,0.35)"/><circle r="6.5" fill="#166534"/><circle r="5.2" fill="#22C55E"/><ellipse cx="-1.8" cy="-2.2" rx="2.2" ry="1.4" fill="#fff" opacity="0.7"/></g><g transform="translate(45 9)"><ellipse cx="0" cy="7" rx="7" ry="2.5" fill="rgba(0,0,0,0.35)"/><circle r="6.5" fill="#A16207"/><circle r="5.2" fill="#FACC15"/><ellipse cx="-1.8" cy="-2.2" rx="2.2" ry="1.4" fill="#fff" opacity="0.7"/></g><g transform="translate(27 63)"><ellipse cx="0" cy="7" rx="7" ry="2.5" fill="rgba(0,0,0,0.35)"/><circle r="6.5" fill="#1E3A8A"/><circle r="5.2" fill="#3B82F6"/><ellipse cx="-1.8" cy="-2.2" rx="2.2" ry="1.4" fill="#fff" opacity="0.7"/></g>
  </g>
  <g transform="translate(24 92) rotate(-20)"><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="rgba(0,0,0,0.3)" transform="translate(1 2)"/><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="#7A4A1C"/><rect x="-7" y="-4.6" width="14" height="9.2" rx="4.4" fill="#F3E2B8"/></g><g transform="translate(42 104) rotate(15)"><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="rgba(0,0,0,0.3)" transform="translate(1 2)"/><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="#3A1A07"/><rect x="-7" y="-4.6" width="14" height="9.2" rx="4.4" fill="#7B3A12"/><rect x="-5" y="-3.6" width="5" height="2" rx="1" fill="#fff" opacity="0.35"/></g><g transform="translate(122 98) rotate(-10)"><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="rgba(0,0,0,0.3)" transform="translate(1 2)"/><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="#7A4A1C"/><rect x="-7" y="-4.6" width="14" height="9.2" rx="4.4" fill="#F3E2B8"/></g><g transform="translate(138 86) rotate(30)"><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="rgba(0,0,0,0.3)" transform="translate(1 2)"/><rect x="-8.5" y="-6" width="17" height="12" rx="5.5" fill="#3A1A07"/><rect x="-7" y="-4.6" width="14" height="9.2" rx="4.4" fill="#7B3A12"/><rect x="-5" y="-3.6" width="5" height="2" rx="1" fill="#fff" opacity="0.35"/></g>
</svg>`;

export const GAME_ART: Record<PartyKind, string> = { seeta, show, snakes, chamma };
