import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/state/settingsStore';
import { speakNumber, speakSample } from '@/hooks/useCaller';
import type { SupportedLanguage } from '@/localization/languages';
import { radius, spacing, useThemeColors } from '@/theme';
import { Chip, T } from './ui';

interface VoiceOption {
  id: string;
  label: string;
  detail: string;
  icon: string;
}

/** Phone default + 4 others = 5 voices. */
const MAX_OTHER_VOICES = 4;

const regionOf = (v: Speech.Voice) => (v.language.split(/[-_]/)[1] ?? '').toUpperCase();

/** Flag emoji from a 2-letter region code (IN → 🇮🇳). */
function flagOf(region: string): string {
  if (!/^[A-Z]{2}$/.test(region)) return '🌐';
  return String.fromCodePoint(...[...region].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * Turns the engine's voice list into distinct, friendly rows. Android lists the same voice
 * twice ("…-local" and "…-network"), and some engines repeat names — those are merged.
 */
function describe(voices: Speech.Voice[], language: SupportedLanguage, t: TFunction): VoiceOption[] {
  const prefix = language === 'te' ? 'te' : 'en';
  const seen = new Set<string>();
  const distinct = voices
    .filter((v) => v.language.toLowerCase().startsWith(prefix))
    .sort((a, b) => {
      const ai = a.language.toLowerCase().includes('in') ? 0 : 1;
      const bi = b.language.toLowerCase().includes('in') ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (b.quality === 'Enhanced' ? 1 : 0) - (a.quality === 'Enhanced' ? 1 : 0);
    })
    .filter((v) => {
      const base = v.identifier.toLowerCase().replace(/[-_](local|network|embedded)$/, '');
      const key = `${base}|${v.name.toLowerCase().replace(/[-_](local|network)$/, '')}`;
      if (seen.has(base) || seen.has(key)) return false;
      seen.add(base);
      seen.add(key);
      return true;
    });
  // Voices of the same accent sound alike: keep just one per accent (India, US, UK…).
  const perAccent = new Map<string, Speech.Voice>();
  distinct.forEach((v) => {
    if (!perAccent.has(regionOf(v))) perAccent.set(regionOf(v), v);
  });
  return [...perAccent.values()].slice(0, MAX_OTHER_VOICES).map((v, i) => {
    const region = regionOf(v);
    const accent = t(`voice.accents.${region}`, { defaultValue: region || t('voice.other') });
    const gender = /female/.test(v.identifier.toLowerCase() + v.name.toLowerCase()) ? t('voice.female') : null;
    const parts = [accent, gender, v.quality === 'Enhanced' ? t('voice.hd') : null];
    return { id: v.identifier, label: t('voice.number', { n: i + 2 }), detail: parts.filter(Boolean).join(' · '), icon: flagOf(region) };
  });
}

/**
 * The phone's voice list, asked for once and shared. Android's TTS engine can take a moment
 * (or never answer) the first time: after 4 s we show what we have and ask again next time.
 */
let voicesCache: Promise<Speech.Voice[]> | null = null;
export function loadVoices(): Promise<Speech.Voice[]> {
  if (!voicesCache) {
    const request = Promise.race([
      Speech.getAvailableVoicesAsync(),
      new Promise<Speech.Voice[]>((resolve) => setTimeout(() => resolve([]), 4000)),
    ]).then((voices) => {
      if (!voices.length) voicesCache = null; // try again next time
      return voices;
    });
    voicesCache = request.catch(() => {
      voicesCache = null;
      return [];
    });
  }
  return voicesCache;
}

/**
 * Voice style (pitch/speed) + the distinct TTS voices installed for a language. Tapping
 * anything plays a sample number so the player can pick what they like.
 */
export function VoicePicker({ language }: { language: SupportedLanguage }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const selected = useSettingsStore((s) => s.voiceByLanguage[language] ?? null);
  const setVoiceFor = useSettingsStore((s) => s.setVoiceFor);
  const setSettings = useSettingsStore((s) => s.set);
  const [options, setOptions] = useState<VoiceOption[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadVoices()
      .then((voices) => alive && setOptions(describe(voices, language, t)))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [language, t]);

  const choose = (id: string | null) => {
    setVoiceFor(language, id);
    speakSample(language, id);
  };

  if (!options) return <ActivityIndicator color={colors.primary} />;

  const rows: VoiceOption[] = [{ id: '', label: t('voice.number', { n: 1 }), detail: t('voice.defaultDetail'), icon: '📱' }, ...options];
  return (
    <View style={{ gap: spacing.sm }}>
      {options.length === 0 ? (
        <T variant="small" color={colors.warning}>
          {language === 'te' ? t('voice.noTelugu') : t('voice.none')}
        </T>
      ) : null}
      {rows.map((o) => {
        const active = (selected ?? '') === o.id;
        return (
          <Pressable
            key={o.id || 'default'}
            onPress={() => choose(o.id || null)}
            style={[
              styles.row,
              { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceAlt : colors.surface },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: active ? colors.primary : colors.surfaceAlt }]}>
              <T style={{ fontSize: 20, lineHeight: 26 }}>{o.icon}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{o.label}</T>
              {o.detail ? (
                <T variant="tiny" muted>
                  {o.detail}
                </T>
              ) : null}
            </View>
            <Ionicons
              name={active ? 'checkmark-circle' : 'play-circle-outline'}
              size={24}
              color={active ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
});
