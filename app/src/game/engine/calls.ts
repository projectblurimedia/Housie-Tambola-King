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

const EN_UNITS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * 1–90 in English words, e.g. 30 → "thirty", 29 → "twenty nine". Digits ("30") let some phone
 * engines read "three oh"; words are always read as one number.
 */
export function englishNumber(n: number): string {
  if (n < 10) return EN_UNITS[n];
  if (n < 20) return EN_TEENS[n - 10];
  const tens = EN_TENS[Math.floor(n / 10)];
  const unit = EN_UNITS[n % 10];
  return unit ? `${tens} ${unit}` : tens;
}

export function spokenCall(n: number, language: SupportedLanguage = 'en'): string {
  return language === 'te' ? teluguNumber(n) : englishNumber(n);
}

export function speechLanguageCode(language: SupportedLanguage): string {
  return language === 'te' ? 'te-IN' : 'en-IN';
}
