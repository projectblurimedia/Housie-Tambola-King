import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, centeredInput, T } from '@/components/ui';
import { NumberBall } from '@/components/NumberBall';
import { PinInput } from '@/components/PinInput';
import { Wordmark } from '@/components/Wordmark';
import { authService, normalizeIndianMobile, PinError } from '@/services/authService';
import { errorMessage } from '@/localization/errorMessages';
import { toAppError } from '@/services/errors';
import { showToast } from '@/state/toastStore';
import { useSettingsStore } from '@/state/settingsStore';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/config';
import { fonts, goldGradient, heroGradient, radius, spacing } from '@/theme';

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

type Mode = 'login' | 'register';
/** Register: details (name + mobile) → create PIN → confirm PIN. */
type RegStep = 'details' | 'pin' | 'confirm';

/** Slides + fades its content in whenever `stepKey` changes. */
function StepIn({ stepKey, children }: { stepKey: string; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [stepKey, v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function MobileField({
  value,
  onChange,
  inputRef,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
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
          ref={inputRef}
          value={value}
          onChangeText={(v) => onChange(toMobile10(v))}
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.55)"
          keyboardType="phone-pad"
          // No maxLength: it would cut a pasted "+91 70930 54784" before toMobile10 sees it.
          importantForAutofill="no"
          autoComplete="off"
          autoFocus={autoFocus}
          returnKeyType="next"
          onSubmitEditing={onSubmit}
          style={[styles.input, { flex: 1 }]}
        />
      </View>
    </>
  );
}

/** First screen: Login (mobile + PIN) or New player (name + mobile → create PIN → confirm PIN). */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<RegStep>('details');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  /** A message under the PIN boxes (wrong PIN, locked, PINs don't match…). */
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const mobileRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const tab = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  const phoneOk = normalizeIndianMobile(mobile) !== null;
  const nameOk = name.trim().length >= 2;

  useEffect(() => {
    Animated.spring(tab, { toValue: mode === 'login' ? 0 : 1, friction: 8, tension: 90, useNativeDriver: true }).start();
  }, [mode, tab]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('details');
    setPin('');
    setFirstPin('');
    setPinMsg(null);
  };

  const fail = (msg: string) => {
    setPin('');
    setPinMsg(msg);
    setShakeKey((k) => k + 1);
  };

  const login = async (code = pin) => {
    if (!phoneOk || code.length !== 4 || loading) return;
    setLoading(true);
    setPinMsg(null);
    try {
      await authService.login(mobile, code, language);
      // RootNavigator switches to Home on the auth state change.
    } catch (err) {
      const e = toAppError(err);
      if (err instanceof PinError && e.code === 'WRONG_PIN') fail(t('auth.wrongPin', { count: err.attemptsLeft ?? 0 }));
      else if (err instanceof PinError && e.code === 'PIN_LOCKED') {
        const minutes = err.lockedUntil ? Math.max(1, Math.ceil((new Date(err.lockedUntil).getTime() - Date.now()) / 60000)) : 15;
        fail(t('auth.pinLocked', { minutes }));
      } else if (e.code === 'ACCOUNT_NOT_FOUND') {
        fail(t('auth.noAccount'));
      } else if (e.code === 'PIN_NOT_SET') {
        // Made before PINs existed: set one through the register steps (same number).
        switchMode('register');
        showToast({ variant: 'info', title: t('auth.pinNotSet') });
      } else {
        setPin('');
        showToast({ variant: 'error', title: errorMessage(err) });
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (code: string) => {
    if (code !== firstPin) {
      setStep('pin');
      setFirstPin('');
      fail(t('auth.pinMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authService.register(mobile, name, code, language);
    } catch (err) {
      const { code: c } = toAppError(err);
      if (c === 'PHONE_TAKEN') {
        switchMode('login');
        showToast({ variant: 'info', title: t('errors.PHONE_TAKEN') });
      } else {
        setPin('');
        showToast({ variant: 'error', title: errorMessage(err) });
      }
    } finally {
      setLoading(false);
    }
  };

  const forgot = () => showToast({ variant: 'info', title: t('auth.forgotPinSoon', { email: SUPPORT_EMAIL }) });

  const tabs: { key: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'login', label: t('auth.loginTab'), icon: 'log-in' },
    { key: 'register', label: t('auth.registerTab'), icon: 'person-add' },
  ];

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
            {/* Icon with the title and a short line beside it — one compact row. */}
            <Wordmark size="large" subtitle={t('app.taglineShort')} />

            <View style={styles.card}>
              {/* Login | New player, with a sliding gold pill. */}
              <View style={styles.tabs} onLayout={(e) => setTabWidth((e.nativeEvent.layout.width - 8) / 2)}>
                {tabWidth > 0 ? (
                  <Animated.View
                    style={[
                      styles.tabPill,
                      { width: tabWidth, transform: [{ translateX: tab.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth] }) }] },
                    ]}
                  >
                    <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 999 }} />
                  </Animated.View>
                ) : null}
                {tabs.map((x) => (
                  <Pressable key={x.key} style={styles.tab} onPress={() => switchMode(x.key)} accessibilityRole="tab" accessibilityState={{ selected: mode === x.key }}>
                    <Ionicons name={x.icon} size={16} color={mode === x.key ? '#3B1D00' : 'rgba(255,255,255,0.85)'} />
                    <T variant="smallBold" color={mode === x.key ? '#3B1D00' : 'rgba(255,255,255,0.85)'}>
                      {x.label}
                    </T>
                  </Pressable>
                ))}
              </View>

              {mode === 'login' ? (
                <StepIn stepKey="login">
                  <T variant="h2" color="#fff" style={{ marginTop: spacing.md }}>
                    {t('auth.welcomeBack')}
                  </T>
                  <MobileField value={mobile} onChange={setMobile} inputRef={mobileRef} />
                  <T variant="smallBold" color="rgba(255,255,255,0.85)" style={styles.label}>
                    {t('auth.pinTitle')}
                  </T>
                  <PinInput
                    value={pin}
                    onChange={(p) => {
                      setPin(p);
                      if (p) setPinMsg(null);
                    }}
                    onComplete={(p) => login(p)}
                    shakeKey={shakeKey}
                    error={!!pinMsg}
                    accessibilityLabel={t('auth.pinTitle')}
                  />
                  {pinMsg ? <T variant="smallBold" center color="#FECACA">{pinMsg}</T> : null}
                  <Button
                    title={t('auth.login')}
                    variant="gold"
                    icon="log-in"
                    loading={loading}
                    disabled={!phoneOk || pin.length !== 4}
                    onPress={() => login()}
                    style={{ marginTop: spacing.md }}
                  />
                  <Pressable onPress={forgot} style={styles.linkBtn} hitSlop={8}>
                    <T variant="smallBold" color="#FDE68A">
                      {t('auth.forgotPin')}
                    </T>
                  </Pressable>
                </StepIn>
              ) : step === 'details' ? (
                <StepIn stepKey="details">
                  <T variant="h2" color="#fff" style={{ marginTop: spacing.md }}>
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
                  <MobileField value={mobile} onChange={setMobile} inputRef={mobileRef} onSubmit={() => nameOk && phoneOk && setStep('pin')} />
                  <T variant="small" color="rgba(255,255,255,0.75)">
                    {t('auth.nameHelp')}
                  </T>
                  <Button
                    title={t('auth.next')}
                    variant="gold"
                    icon="arrow-forward"
                    disabled={!nameOk || !phoneOk}
                    onPress={() => {
                      setPin('');
                      setPinMsg(null);
                      setStep('pin');
                    }}
                    style={{ marginTop: spacing.lg }}
                  />
                </StepIn>
              ) : (
                <StepIn stepKey={step}>
                  <Pressable
                    onPress={() => {
                      setPin('');
                      setFirstPin('');
                      setPinMsg(null);
                      setStep(step === 'confirm' ? 'pin' : 'details');
                    }}
                    style={styles.back}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-back" size={18} color="#fff" />
                    <T variant="smallBold" color="#fff">
                      {t('common.back')}
                    </T>
                  </Pressable>
                  <View style={styles.pinHead}>
                    <View style={styles.lockIcon}>
                      <Ionicons name={step === 'pin' ? 'lock-closed' : 'shield-checkmark'} size={26} color="#3B1D00" />
                    </View>
                    <T variant="h2" color="#fff" center>
                      {step === 'pin' ? t('auth.createPin') : t('auth.confirmPin')}
                    </T>
                    <T variant="small" color="rgba(255,255,255,0.8)" center>
                      {step === 'pin' ? t('auth.createPinSub', { phone: `+91 ${mobile}` }) : t('auth.confirmPinSub')}
                    </T>
                  </View>
                  <PinInput
                    key={step}
                    value={pin}
                    onChange={(p) => {
                      setPin(p);
                      if (p) setPinMsg(null);
                    }}
                    onComplete={(p) => {
                      if (step === 'pin') {
                        setFirstPin(p);
                        setPin('');
                        setStep('confirm');
                      } else register(p);
                    }}
                    autoFocus
                    shakeKey={shakeKey}
                    error={!!pinMsg}
                    accessibilityLabel={step === 'pin' ? t('auth.createPin') : t('auth.confirmPin')}
                  />
                  {pinMsg ? <T variant="smallBold" center color="#FECACA">{pinMsg}</T> : null}
                  {/* Step dots: 1 details · 2 create · 3 confirm */}
                  <View style={styles.dots}>
                    {['details', 'pin', 'confirm'].map((s) => (
                      <View key={s} style={[styles.stepDot, s === step && styles.stepDotOn]} />
                    ))}
                  </View>
                  {step === 'confirm' && loading ? (
                    <Button title={t('auth.createAccount')} variant="gold" loading onPress={() => undefined} style={{ marginTop: spacing.md }} />
                  ) : null}
                </StepIn>
              )}
            </View>

            <T variant="tiny" center color="rgba(255,255,255,0.7)" style={{ marginTop: spacing.md }}>
              {t('auth.agreePrefix')}{' '}
              <T variant="tiny" color="#FDE68A" onPress={() => Linking.openURL(TERMS_URL)}>
                {t('auth.termsLink')}
              </T>{' '}
              {t('auth.and')}{' '}
              <T variant="tiny" color="#FDE68A" onPress={() => Linking.openURL(PRIVACY_URL)}>
                {t('auth.privacyLink')}
              </T>
            </T>
            <T variant="tiny" center color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }}>
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
  card: {
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999, padding: 4, height: 46 },
  tabPill: { position: 'absolute', top: 4, left: 4, bottom: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
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
  linkBtn: { alignSelf: 'center', marginTop: spacing.md, padding: 4 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: spacing.md },
  pinHead: { alignItems: 'center', gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  lockIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotOn: { width: 22, backgroundColor: '#FDE68A' },
});
