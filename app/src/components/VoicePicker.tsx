import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/state/settingsStore';
import { speakNumber } from '@/hooks/useCaller';
import type { SupportedLanguage } from '@/localization/languages';
import { radius, spacing, useThemeColors } from '@/theme';
import { T } from './ui';

interface VoiceOption {
  id: string;
  label: string;
  detail: string;
}

/** Turns the engine's voice list into friendly rows ("Voice 2 · Female · India"). */
function describe(voices: Speech.Voice[], language: SupportedLanguage, t: TFunction): VoiceOption[] {
  const prefix = language === 'te' ? 'te' : 'en';
  return voices
    .filter((v) => v.language.toLowerCase().startsWith(prefix))
    // India voices first for English, then better quality first.
    .sort((a, b) => {
      const ai = a.language.toLowerCase().includes('in') ? 0 : 1;
      const bi = b.language.toLowerCase().includes('in') ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (b.quality === 'Enhanced' ? 1 : 0) - (a.quality === 'Enhanced' ? 1 : 0);
    })
    .map((v, i) => {
      const id = `${v.identifier} ${v.name}`.toLowerCase();
      const gender = id.includes('female') ? t('voice.female') : id.includes('male') ? t('voice.male') : null;
      const region = v.language.split(/[-_]/)[1]?.toUpperCase();
      const parts = [gender, region ? t('voice.region', { region }) : null, v.quality === 'Enhanced' ? t('voice.hd') : null];
      return { id: v.identifier, label: t('voice.number', { n: i + 1 }), detail: parts.filter(Boolean).join(' · ') };
    });
}

/**
 * Lists the TTS voices installed on this phone for a language. Tapping one selects it and
 * plays a sample number so the player can pick the voice they like.
 */
export function VoicePicker({ language }: { language: SupportedLanguage }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const selected = useSettingsStore((s) => s.voiceByLanguage[language] ?? null);
  const setVoiceFor = useSettingsStore((s) => s.setVoiceFor);
  const [options, setOptions] = useState<VoiceOption[] | null>(null);

  useEffect(() => {
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => alive && setOptions(describe(voices, language, t)))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [language, t]);

  const choose = (id: string | null) => {
    setVoiceFor(language, id);
    speakNumber(35, language, id);
  };

  if (!options) return <ActivityIndicator color={colors.primary} />;

  const rows: VoiceOption[] = [{ id: '', label: t('voice.default'), detail: t('voice.defaultDetail') }, ...options.slice(0, 12)];
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
            style={[styles.row, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceAlt : colors.surface }]}
          >
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{o.label}</T>
              {o.detail ? (
                <T variant="tiny" muted>
                  {o.detail}
                </T>
              ) : null}
            </View>
            <Ionicons name="volume-medium" size={18} color={colors.primary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
});
