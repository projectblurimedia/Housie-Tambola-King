/**
 * What the caller voice says for each number: just the number, nothing else
 * (owner's rule — no rhymes like "three dozen", no digit-by-digit "3, 5").
 * The TTS engine reads "35" as "thirty-five" in en-IN and "ముప్పై ఐదు" in te-IN.
 */
import type { SupportedLanguage } from '@/localization/languages';

export function spokenCall(n: number): string {
  return String(n);
}

export function speechLanguageCode(language: SupportedLanguage): string {
  return language === 'te' ? 'te-IN' : 'en-IN';
}
