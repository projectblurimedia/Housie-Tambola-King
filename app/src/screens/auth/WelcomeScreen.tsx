import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, T } from '@/components/ui';
import { NumberBall } from '@/components/NumberBall';
import { authService } from '@/services/authService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useSettingsStore } from '@/state/settingsStore';
import { APP_NAME } from '@/constants/config';
import { fonts, heroGradient, radius, spacing } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const FLOATING = [7, 21, 45, 66, 88];

function FloatingBall({ n, index }: { n: number; index: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1800 + index * 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1800 + index * 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [v, index]);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }] }}>
      <NumberBall number={n} size={index === 2 ? 92 : 58} />
    </Animated.View>
  );
}

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const valid = name.trim().length >= 2;

  const play = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await authService.playAsGuest(name, language);
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={heroGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.balls}>
              {FLOATING.map((n, i) => (
                <FloatingBall key={n} n={n} index={i} />
              ))}
            </View>
            <T variant="tiny" center color="#FDE68A" style={styles.crown}>
              👑
            </T>
            <T variant="hero" center color="#fff">
              {APP_NAME}
            </T>
            <T center color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
              {t('app.tagline')}
            </T>

            <View style={styles.card}>
              <T variant="h2" color="#fff">
                {t('auth.namePrompt')}
              </T>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('auth.namePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.55)"
                maxLength={30}
                autoCapitalize="words"
                returnKeyType="go"
                onSubmitEditing={play}
                style={styles.input}
              />
              <T variant="small" color="rgba(255,255,255,0.75)">
                {t('auth.nameHelp')}
              </T>
              <Button
                title={t('auth.letsPlay')}
                variant="gold"
                icon="play"
                loading={loading}
                disabled={!valid}
                onPress={play}
                style={{ marginTop: spacing.lg }}
              />
            </View>

            <Pressable onPress={() => navigation.navigate('Phone', { mode: 'login' })} style={{ marginTop: spacing.lg }}>
              <T variant="smallBold" center color="#fff" style={{ textDecorationLine: 'underline' }}>
                {t('auth.loginWithPhone')}
              </T>
            </Pressable>
            <T variant="tiny" center color="rgba(255,255,255,0.6)" style={{ marginTop: spacing.md }}>
              {t('auth.terms')}
            </T>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  balls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6, marginBottom: spacing.lg },
  crown: { fontSize: 34, lineHeight: 40 },
  card: {
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  input: {
    marginVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
