import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Header, Screen, Spacer, T, TextField } from '@/components/ui';
import { authService } from '@/services/authService';
import { errorMessage } from '@/localization/errorMessages';
import { useSettingsStore } from '@/state/settingsStore';
import { spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

export function PhoneScreen({ navigation, route }: ScreenProps<'Phone'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const mode = route.params?.mode ?? 'login';
  const language = useSettingsStore((s) => s.language);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const phone = authService.assertPhone(value);
      if (mode === 'link') await authService.startLinkPhone(phone);
      else await authService.sendOtp(phone, language);
      navigation.navigate('Otp', { phone, mode });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{mode === 'link' ? t('auth.linkTitle') : t('auth.phoneTitle')}</T>
          <T muted style={{ marginTop: 6 }}>
            {mode === 'link' ? t('auth.linkSubtitle') : t('auth.phoneSubtitle')}
          </T>
          <Spacer h={spacing.xl} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextField value="+91" editable={false} style={{ width: 64, textAlign: 'center' }} />
            <View style={{ flex: 1 }}>
              <TextField
                value={value}
                onChangeText={(v) => setValue(v.replace(/\D/g, '').slice(0, 10))}
                placeholder={t('auth.phonePlaceholder')}
                keyboardType="phone-pad"
                autoFocus
                maxLength={10}
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={error}
                onSubmitEditing={submit}
              />
            </View>
          </View>
          <T variant="small" muted>
            {t('auth.terms')}
          </T>
        </View>
        <Button
          title={t('auth.sendOtp')}
          onPress={submit}
          loading={loading}
          disabled={value.length !== 10}
          style={{ marginBottom: spacing.lg, backgroundColor: colors.primary }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
