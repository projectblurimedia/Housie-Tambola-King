import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Button, Screen, Spacer, T } from '@/components/ui';
import { useSettingsStore } from '@/state/settingsStore';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/localization/i18n';
import { radius, spacing, useThemeColors } from '@/theme';

export function LanguageSelectScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const confirm = useSettingsStore((s) => s.confirmLanguage);

  const label = (l: SupportedLanguage) => (l === 'te' ? t('language.telugu') : t('language.english'));

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T variant="hero" center color={colors.primary}>
          🎱
        </T>
        <T variant="h1" center>
          {t('language.title')}
        </T>
        <T muted center style={{ marginTop: 6 }}>
          {t('language.subtitle')}
        </T>
        <Spacer h={spacing.xl} />
        {SUPPORTED_LANGUAGES.map((l) => {
          const active = l === language;
          return (
            <Pressable
              key={l}
              onPress={() => setLanguage(l)}
              style={[
                styles.option,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceAlt : colors.surface },
              ]}
            >
              <T variant="h2" style={{ flex: 1 }}>
                {label(l)}
              </T>
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={24} color={active ? colors.primary : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
      <Button title={t('common.continue')} onPress={confirm} style={{ marginBottom: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    marginBottom: spacing.md,
  },
});
