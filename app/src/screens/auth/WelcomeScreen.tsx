import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, centeredInput, T } from '@/components/ui';
import { NumberBall } from '@/components/NumberBall';
import { authService, normalizeIndianMobile } from '@/services/authService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useSettingsStore } from '@/state/settingsStore';
import { APP_NAME } from '@/constants/config';
import { fonts, heroGradient, radius, spacing } from '@/theme';

const FLOATING = [3, 7, 11, 31, 65];

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

/**
 * Any pasted/typed form → the 10-digit mobile: "+91 70930 54784", "917093054784",
 * "07093054784" and "7093054784" all become 7093054784.
 */
function toMobile10(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** First screen: name + mobile number → straight in (no OTP during testing). */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const mobileRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const valid = name.trim().length >= 2 && normalizeIndianMobile(mobile) !== null;

  const play = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await authService.loginWithPhone(mobile, name, language);
      // RootNavigator switches to Home on the auth state change.
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={heroGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.balls}>
              {FLOATING.map((n, i) => (
                <FloatingBall key={n} n={n} index={i} />
              ))}
            </View>
            <T center color="#FDE68A" style={styles.crown}>
              👑
            </T>
            <T center color="#fff" style={styles.brand}>
              {APP_NAME}
            </T>
            <T center color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
              {t('app.tagline')}
            </T>

            <View style={styles.card}>
              <T variant="h2" color="#fff">
                {t('auth.welcomeTitle')}
              </T>
              <T variant="smallBold" color="rgba(255,255,255,0.85)" style={styles.label}>
                {t('auth.namePrompt')}
              </T>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('auth.namePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.55)"
                maxLength={30}
                autoCapitalize="words"
                importantForAutofill="no"
                autoComplete="off"
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                style={styles.input}
              />
              <T variant="smallBold" color="rgba(255,255,255,0.85)" style={styles.label}>
                {t('auth.phoneTitle')}
              </T>
              <View style={styles.phoneRow}>
                <View style={[styles.input, styles.prefix]}>
                  <T variant="h3" color="#fff">
                    +91
                  </T>
                </View>
                <TextInput
                  ref={mobileRef}
                  value={mobile}
                  onChangeText={(v) => setMobile(toMobile10(v))}
                  placeholder={t('auth.phonePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  keyboardType="phone-pad"
                  // No maxLength: it would cut a pasted "+91 70930 54784" before toMobile10 sees it.
                  importantForAutofill="no"
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={play}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
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
  // The wordmark: Lobster with a soft gold glow.
  brand: {
    fontFamily: fonts.brand,
    fontSize: 40,
    lineHeight: 52,
    textShadowColor: 'rgba(245,183,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  balls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6, marginBottom: spacing.lg },
  crown: { fontSize: 34, lineHeight: 44 },
  card: {
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: { marginTop: spacing.md },
  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  prefix: { justifyContent: 'center', paddingHorizontal: spacing.md },
  input: {
    marginTop: 6,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 18,
    paddingHorizontal: spacing.md,
    height: 52,
    ...centeredInput,
  },
});
