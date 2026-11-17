/**
 * What the caller voice says for each number: just the number, nothing else
 * (owner's rule — no rhymes like "three dozen", no digit-by-digit "3, 5").
 *
 * Telugu is spelled out in Telugu words ("ముప్పై ఐదు") instead of digits: many phone TTS
 * engines read the digit string "35" in English even with a te-IN voice, so passing the
 * words is what makes the call actually sound Telugu.
 */
import type { SupportedLanguage } from '@/localization/languages';

const TE_UNITS = ['', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'];
const TE_TEENS = ['పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పందొమ్మిది'];
const TE_TENS = ['', '', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంభై'];

/** 1–90 in Telugu words, e.g. 35 → "ముప్పై ఐదు". */
export function teluguNumber(n: number): string {
  if (n < 10) return TE_UNITS[n];
  if (n < 20) return TE_TEENS[n - 10];
  const tens = TE_TENS[Math.floor(n / 10)];
  const unit = TE_UNITS[n % 10];
  return unit ? `${tens} ${unit}` : tens;
}

export function spokenCall(n: number, language: SupportedLanguage = 'en'): string {
  return language === 'te' ? teluguNumber(n) : String(n);
}

export function speechLanguageCode(language: SupportedLanguage): string {
  return language === 'te' ? 'te-IN' : 'en-IN';
}
