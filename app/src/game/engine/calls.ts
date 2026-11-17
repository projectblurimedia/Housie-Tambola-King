/**
 * What the caller says for each number. "classic" adds the traditional Indian housie
 * call (English only — the rhymes don't translate); Telugu speaks the number in Telugu.
 */
import type { SupportedLanguage } from '@/localization/languages';

export type CallStyle = 'simple' | 'classic';

const CLASSIC: Record<number, string> = {
  1: "Kelly's eye",
  2: 'One little duck',
  3: 'Cup of tea',
  4: 'Knock at the door',
  5: 'Man alive',
  6: 'Half a dozen',
  7: 'Lucky seven',
  8: 'Garden gate',
  9: 'Doctor’s orders',
  10: 'Big fat hen',
  11: 'Legs eleven',
  12: 'One dozen',
  13: 'Unlucky for some',
  16: 'Sweet sixteen',
  18: 'Voting age',
  20: 'One score',
  21: 'Key of the door',
  22: 'Two little ducks',
  25: 'Quarter century',
  26: 'Republic Day',
  28: 'In a state',
  30: 'Dirty thirty',
  32: 'Buckle my shoe',
  33: 'All the threes',
  36: 'Three dozen',
  39: 'Watch your waistline',
  44: 'All the fours',
  45: 'Halfway there',
  48: 'Four dozen',
  50: 'Half a century',
  55: 'All the fives',
  57: 'Heinz varieties',
  60: 'Five dozen',
  62: 'Tickety-boo',
  66: 'Clickety click',
  69: 'Ups and downs',
  72: 'Six dozen',
  73: 'Queen bee',
  77: 'Two hockey sticks',
  80: 'Gandhi’s breakfast',
  84: 'Seven dozen',
  88: 'Two fat ladies',
  89: 'Nearly there',
  90: 'Top of the house',
};

const TE_ONES = ['', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'];

/** Text for the on-screen subtitle under the big number. */
export function classicPhrase(n: number): string | null {
  return CLASSIC[n] ?? null;
}

/** What the text-to-speech voice says. */
export function spokenCall(n: number, language: SupportedLanguage, style: CallStyle): string {
  if (language === 'te') {
    // TTS reads digits in Telugu for te-IN; single-digit numbers are spelled out for clarity.
    return n < 10 ? `ఒంటి అంకె, ${TE_ONES[n]}` : `${Math.floor(n / 10)}, ${n % 10}, ${n}`;
  }
  const digits = n < 10 ? `Single number ${n}` : `${Math.floor(n / 10)} and ${n % 10}, ${n}`;
  const phrase = style === 'classic' ? classicPhrase(n) : null;
  return phrase ? `${phrase}. ${digits}` : digits;
}

export function speechLanguageCode(language: SupportedLanguage): string {
  return language === 'te' ? 'te-IN' : 'en-IN';
}
