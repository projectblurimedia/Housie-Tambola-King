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

// ─── Snakes & Ladders ─────────────────────────────────────────────────────────────
/** Filtered noise burst (a "click" / rattle / hiss). */
function noise(buf, startSec, durSec, { vol = 0.4, decay = 30, smooth = 0.6 } = {}) {
  const s0 = Math.floor(startSec * RATE);
  const n = Math.floor(durSec * RATE);
  let last = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    last = smooth * last + (1 - smooth) * (Math.random() * 2 - 1);
    buf[s0 + i] += vol * Math.exp(-decay * t) * last;
  }
}
/** A tone whose pitch glides from one note to another. */
function glide(buf, startSec, durSec, fromMidi, toMidi, { vol = 0.4, decay = 2, harmonics = [1, 0.3] } = {}) {
  const s0 = Math.floor(startSec * RATE);
  const n = Math.floor(durSec * RATE);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const m = fromMidi + (toMidi - fromMidi) * (i / n);
    phase += (2 * Math.PI * freq(m)) / RATE;
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin(phase * (k + 1))));
    buf[s0 + i] += vol * Math.min(1, t / 0.01) * Math.exp(-decay * t) * v;
  }
}

// Dice: a quick wooden rattle — irregular clicks getting closer, then the settle.
write('dice', 0.75, (b) => {
  let t = 0;
  for (let i = 0; i < 9; i++) {
    noise(b, t, 0.05, { vol: 0.5 - i * 0.03, decay: 70, smooth: 0.35 });
    tone(b, t, 0.04, 70 + (i % 3) * 3, { vol: 0.12, decay: 90, harmonics: [1] });
    t += 0.09 - i * 0.006;
  }
  noise(b, t + 0.03, 0.08, { vol: 0.6, decay: 45, smooth: 0.3 });
});

// Step: a gentle marimba "plink" for each square a pawn hops — soft and musical, not a click.
write('step', 0.22, (b) => {
  tone(b, 0, 0.22, 84, { vol: 0.45, decay: 22, harmonics: [1, 0, 0.28, 0, 0.08], attack: 0.004 });
  tone(b, 0, 0.12, 96, { vol: 0.08, decay: 40, harmonics: [1], attack: 0.004 });
});

// Ladder: bright rising climb (quick notes up the scale) with a sparkle at the top.
write('ladder', 1.1, (b) => {
  [67, 69, 71, 72, 74, 76, 77, 79].forEach((m, i) => tone(b, i * 0.075, 0.25, m, { vol: 0.42, decay: 10, harmonics: [1, 0.35] }));
  [88, 91, 96].forEach((m, i) => tone(b, 0.62 + i * 0.05, 0.45, m, { vol: 0.15, decay: 6, harmonics: [1] }));
});

// Snake: a hiss, then a sliding "wooo" down.
write('snake', 1.3, (b) => {
  noise(b, 0, 0.45, { vol: 0.35, decay: 3, smooth: 0.05 });
  glide(b, 0.3, 0.95, 76, 52, { vol: 0.45, decay: 1.6, harmonics: [1, 0.5, 0.2] });
});
