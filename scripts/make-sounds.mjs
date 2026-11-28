// Generates the prize sound effects (app/assets/sounds/*.wav): small synthesized jingles,
// no third-party audio. Run: node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

const freq = (note) => 440 * Math.pow(2, (note - 69) / 12); // MIDI note → Hz

/** One bell-ish tone: a few harmonics with an exponential decay. */
function tone(buf, startSec, durSec, midi, { vol = 0.5, decay = 4, harmonics = [1, 0.5, 0.25], attack = 0.005 } = {}) {
  const f = freq(midi);
  const s0 = Math.floor(startSec * RATE);
  const n = Math.floor(durSec * RATE);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin(2 * Math.PI * f * (k + 1) * t)));
    buf[s0 + i] += vol * env * v;
  }
}

function write(name, seconds, draw) {
  const buf = new Float32Array(Math.floor(seconds * RATE));
  draw(buf);
  let peak = 0;
  buf.forEach((v) => (peak = Math.max(peak, Math.abs(v))));
  const gain = peak > 0 ? 0.9 / peak : 1;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(out, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav ${((44 + data.length) / 1024).toFixed(0)} KB`);
}

// Fast 3/5/7: quick bright rising arpeggio ("ding-ding-ding-ding!").
write('fast', 1.1, (b) => {
  [76, 79, 83, 88].forEach((m, i) => tone(b, i * 0.08, 0.7, m, { vol: 0.5, decay: 6, harmonics: [1, 0.3] }));
});

// Lines: two-tone doorbell chime, warm.
write('line', 1.4, (b) => {
  tone(b, 0, 0.9, 79, { vol: 0.6, decay: 3.5, harmonics: [1, 0.4, 0.15] });
  tone(b, 0.32, 1.1, 74, { vol: 0.6, decay: 3, harmonics: [1, 0.4, 0.15] });
});

// Columns: three descending-then-up marimba hits.
write('column', 1.2, (b) => {
  [72, 67, 76].forEach((m, i) =>
    tone(b, i * 0.16, 0.6, m, { vol: 0.6, decay: 9, harmonics: [1, 0, 0.35, 0, 0.1] }),
  );
});

// Full Housie: fanfare — major arpeggio then a held chord.
write('fullhouse', 2.6, (b) => {
  const brass = { vol: 0.35, decay: 1.2, harmonics: [1, 0.7, 0.5, 0.3, 0.2], attack: 0.02 };
  [60, 64, 67].forEach((m, i) => tone(b, i * 0.14, 0.3, m + 12, { ...brass, decay: 4 }));
  [60, 64, 67, 72].forEach((m) => tone(b, 0.45, 2.1, m + 12, brass));
  [84, 88, 91, 96].forEach((m, i) => tone(b, 0.5 + i * 0.07, 1.2, m, { vol: 0.12, decay: 3, harmonics: [1] }));
});

// Strike: a soft, short "pop" for every number a player strikes.
write('strike', 0.18, (b) => {
  tone(b, 0, 0.18, 84, { vol: 0.5, decay: 28, harmonics: [1, 0.25], attack: 0.002 });
  tone(b, 0.01, 0.15, 91, { vol: 0.2, decay: 35, harmonics: [1], attack: 0.002 });
});

// ─── Board games (Snakes & Ladders, Ashta Chamma) ─────────────────────────────────────
/** White noise through a band-pass filter (biquad), with an exponential decay. */
function band(buf, startSec, durSec, centerHz, { vol = 0.5, decay = 40, q = 4 } = {}) {
  const s0 = Math.floor(startSec * RATE);
  const n = Math.floor(durSec * RATE);
  const w0 = (2 * Math.PI * centerHz) / RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const x = Math.random() * 2 - 1;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[s0 + i] += vol * Math.exp((-decay * i) / RATE) * y;
  }
}
/** A sine whose frequency glides (Hz), with optional vibrato. */
function sweep(buf, startSec, durSec, fromHz, toHz, { vol = 0.4, decay = 2, vibrato = 0, attack = 0.01 } = {}) {
  const s0 = Math.floor(startSec * RATE);
  const n = Math.floor(durSec * RATE);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const f = fromHz * Math.pow(toHz / fromHz, i / n) * (1 + vibrato * Math.sin(2 * Math.PI * 6 * t));
    ph += (2 * Math.PI * f) / RATE;
    buf[s0 + i] += vol * Math.min(1, t / attack) * Math.exp(-decay * t) * (Math.sin(ph) + 0.25 * Math.sin(2 * ph));
  }
}
/** A plucked-string note (harp-like): bright attack, warm fast decay. */
const pluck = (b, at, midi, vol = 0.4) => tone(b, at, 0.9, midi, { vol, decay: 5, harmonics: [1, 0.5, 0.3, 0.15, 0.08], attack: 0.003 });

// Dice: a real die rolling on a wooden board — clacks getting closer, a body thud, the settle.
write('dice', 0.9, (b) => {
  const hits = [0, 0.11, 0.2, 0.27, 0.33, 0.38, 0.42, 0.45];
  hits.forEach((t, i) => {
    const v = 0.9 - i * 0.08;
    band(b, t, 0.05, 2800 + Math.random() * 1200, { vol: v, decay: 90, q: 3 });
    band(b, t, 0.08, 180 + Math.random() * 60, { vol: v * 0.9, decay: 45, q: 2 });
  });
  band(b, 0.52, 0.12, 2200, { vol: 0.5, decay: 60, q: 3 });
  band(b, 0.52, 0.18, 150, { vol: 0.7, decay: 30, q: 2 });
});

// Step: a soft bubble pop for each square (pitch rises a little — friendly, not a click).
write('step', 0.16, (b) => {
  sweep(b, 0, 0.12, 520, 900, { vol: 0.55, decay: 26, attack: 0.004 });
  band(b, 0, 0.02, 3000, { vol: 0.08, decay: 200, q: 2 });
});

// Ladder: a harp run up the scale, then a bright chime.
write('ladder', 1.4, (b) => {
  [60, 62, 64, 67, 69, 72, 74, 76, 79].forEach((m, i) => pluck(b, i * 0.065, m + 7, 0.38));
  [91, 96].forEach((m, i) => tone(b, 0.62 + i * 0.08, 0.7, m, { vol: 0.12, decay: 4, harmonics: [1] }));
});

// Snake: a quick hiss, then a cartoon slide-whistle down.
write('snake', 1.3, (b) => {
  band(b, 0, 0.35, 6000, { vol: 0.25, decay: 6, q: 1.2 });
  sweep(b, 0.22, 1.0, 1100, 220, { vol: 0.42, decay: 1.4, vibrato: 0.03, attack: 0.02 });
});

// Seeds: four tamarind seeds tossed onto the floor — tiny clicks scattering, then landing taps.
write('seeds', 0.8, (b) => {
  for (let i = 0; i < 16; i++) band(b, Math.random() * 0.35, 0.03, 4500 + Math.random() * 2500, { vol: 0.35, decay: 140, q: 4 });
  [0.42, 0.5, 0.55, 0.61].forEach((t) => {
    band(b, t, 0.05, 3200, { vol: 0.6, decay: 80, q: 3 });
    band(b, t, 0.06, 400, { vol: 0.35, decay: 60, q: 2 });
  });
});

// Move (Ashta Chamma step): a soft wooden tap.
write('move', 0.14, (b) => {
  band(b, 0, 0.08, 900, { vol: 0.6, decay: 70, q: 5 });
  tone(b, 0, 0.12, 67, { vol: 0.25, decay: 40, harmonics: [1, 0.3], attack: 0.003 });
});

// Cut: a pawn knocked home — a thump, a whoosh, a falling tone.
write('cut', 0.9, (b) => {
  band(b, 0, 0.15, 120, { vol: 0.9, decay: 25, q: 1.5 });
  band(b, 0.02, 0.3, 2500, { vol: 0.35, decay: 12, q: 0.8 });
  sweep(b, 0.08, 0.7, 700, 180, { vol: 0.35, decay: 3 });
});

// Home: a pawn reaches the centre — two bright rising chimes.
write('home', 0.9, (b) => {
  pluck(b, 0, 84, 0.45);
  pluck(b, 0.12, 91, 0.45);
  tone(b, 0.24, 0.6, 96, { vol: 0.15, decay: 4, harmonics: [1] });
});

// ── Find Seeta ──
// deal: roles handed out — a quick card shuffle (soft riffle of paper flicks).
write('deal', 0.7, (b) => {
  for (let i = 0; i < 9; i++) band(b, i * 0.055, 0.06, 2600 + (i % 3) * 500, { vol: 0.35, decay: 70, q: 2.5 });
});
// reveal: the roles are shown — a mystic rising shimmer that lands on a soft chord.
write('reveal', 1.4, (b) => {
  sweep(b, 0, 0.6, 420, 1260, { vol: 0.18, decay: 1.2, vibrato: 6 });
  [72, 76, 79].forEach((m, i) => tone(b, 0.5 + i * 0.05, 0.9, m, { vol: 0.32, decay: 3, harmonics: [1, 0.35, 0.12] }));
});
// right: Ram found Seeta — a short bright fanfare.
write('right', 1.2, (b) => {
  [67, 72, 76].forEach((m, i) => tone(b, i * 0.1, 0.35, m, { vol: 0.45, decay: 7, harmonics: [1, 0.5, 0.2] }));
  tone(b, 0.32, 0.85, 79, { vol: 0.5, decay: 3, harmonics: [1, 0.5, 0.25, 0.1] });
  tone(b, 0.32, 0.85, 84, { vol: 0.25, decay: 3, harmonics: [1, 0.3] });
});
// wrong: Ram missed — a playful falling "wah-wah".
write('wrong', 1.0, (b) => {
  sweep(b, 0, 0.32, 392, 330, { vol: 0.42, decay: 2, vibrato: 7 });
  sweep(b, 0.34, 0.6, 311, 233, { vol: 0.42, decay: 2.2, vibrato: 7 });
});

// ── Show ──
// pass: a card slides to the next player — a quick paper swish.
write('pass', 0.35, (b) => {
  band(b, 0, 0.12, 1800, { vol: 0.3, decay: 22, q: 1.6 });
  band(b, 0.05, 0.16, 3200, { vol: 0.22, decay: 26, q: 1.4 });
});
// pick: choosing a card — a soft wooden click.
write('pick', 0.2, (b) => {
  band(b, 0, 0.06, 1400, { vol: 0.5, decay: 90, q: 5 });
  tone(b, 0, 0.12, 88, { vol: 0.12, decay: 30, harmonics: [1] });
});
// show: SHOW! — a big bright gong with a shimmering tail.
write('show', 1.8, (b) => {
  tone(b, 0, 1.7, 50, { vol: 0.6, decay: 1.6, harmonics: [1, 0.6, 0.45, 0.3, 0.2, 0.12] });
  tone(b, 0, 1.2, 62, { vol: 0.25, decay: 2.4, harmonics: [1, 0.4] });
  band(b, 0, 0.08, 4200, { vol: 0.25, decay: 30, q: 1.2 });
});
