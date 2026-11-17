import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Header, Screen, Spacer, T } from '@/components/ui';
import { authService } from '@/services/authService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useSettingsStore } from '@/state/settingsStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const LENGTH = 6;
const RESEND_SECONDS = 30;

export function OtpScreen({ navigation, route }: ScreenProps<'Otp'>) {
  const { phone, mode } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const language = useSettingsStore((s) => s.language);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async (value = code) => {
    if (value.length !== LENGTH) return;
    setError(undefined);
    setLoading(true);
    try {
      if (mode === 'link') {
        await authService.verifyLinkPhone(phone, value);
        await qc.invalidateQueries({ queryKey: ['me'] });
        showToast({ variant: 'success', title: t('auth.linkDone') });
        navigation.navigate('Home');
      } else {
        await authService.verifyOtp(phone, value);
        // RootNavigator switches to the signed-in stack on the auth state change.
      }
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      if (mode === 'link') await authService.startLinkPhone(phone);
      else await authService.sendOtp(phone, language);
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{t('auth.otpTitle')}</T>
          <T muted style={{ marginTop: 6 }}>
            {t('auth.otpSubtitle', { phone: phone.replace('+91', '+91 ') })}
          </T>
          <Spacer h={spacing.xl} />
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
            {Array.from({ length: LENGTH }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    borderColor: error ? colors.error : i === code.length ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <T variant="h1">{code[i] ?? ''}</T>
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, LENGTH);
              setCode(digits);
              if (digits.length === LENGTH) verify(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={LENGTH}
            style={styles.hidden}
          />
          {error ? (
            <T variant="small" color={colors.error} style={{ marginTop: spacing.sm }}>
              {error}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
            <Pressable onPress={() => navigation.goBack()}>
              <T variant="smallBold" color={colors.primary}>
                {t('auth.changeNumber')}
              </T>
            </Pressable>
            <Pressable onPress={resend} disabled={resendIn > 0}>
              <T variant="smallBold" color={resendIn > 0 ? colors.textMuted : colors.primary}>
                {resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
              </T>
            </Pressable>
          </View>
        </View>
        <Button
          title={t('auth.verify')}
          onPress={() => verify()}
          loading={loading}
          disabled={code.length !== LENGTH}
          style={{ marginBottom: spacing.lg }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between' },
  box: {
    width: 48,
    height: 58,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1, fontFamily: fonts.regular },
});
