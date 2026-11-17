import '@/localization/i18n';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { IS_CONFIGURED } from '@/constants/config';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastHost } from '@/components/ToastHost';
import { WinnerOverlay } from '@/components/WinnerOverlay';
import { Screen, T } from '@/components/ui';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useMe } from '@/hooks/useMe';
import { registerForPush } from '@/services/pushService';
import { toAppError } from '@/services/errors';
import { useThemeColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => count < 2 && toAppError(err).code === 'NETWORK_ERROR',
    },
  },
});

// React Native has no window focus: treat "app came to foreground" as focus so live
// game state and the wallet refetch after the phone was locked (same fix as NearbyU).
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
}

/** Gates that need the signed-in profile: banned accounts see only a notice. */
function SessionGate() {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.session);
  const me = useMe();
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  useEffect(() => {
    if (me.data?.language) setLanguage(me.data.language);
  }, [me.data?.language, setLanguage]);

  useEffect(() => {
    if (session) registerForPush();
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && me.data?.isBanned) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <T variant="h1" center>
            {t('banned.title')}
          </T>
          <T muted center style={{ marginTop: 12 }}>
            {t('banned.message', { reason: me.data.bannedReason ?? '—' })}
          </T>
        </View>
      </Screen>
    );
  }
  return <RootNavigator />;
}

function NotConfigured() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T variant="h1" center>
          {t('setup.title')}
        </T>
        <T muted center style={{ marginTop: 12 }}>
          {t('setup.message')}
        </T>
      </View>
    </Screen>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Baloo2_800ExtraBold,
  });
  const { colors, isDark } = useThemeColors();
  const sessionReady = useSessionStore((s) => s.isReady);
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) queryClient.clear();
      else queryClient.invalidateQueries({ queryKey: ['me'] });
    });
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  // OTA updates: fetch in the background; applied on next launch (never mid-game).
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    Updates.checkForUpdateAsync()
      .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : undefined))
      .catch(() => undefined);
  }, []);

  const ready = (fontsLoaded || !!fontError) && settingsHydrated && (sessionReady || !IS_CONFIGURED);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.surface,
      primary: colors.primary,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {IS_CONFIGURED ? <SessionGate /> : <NotConfigured />}
        </NavigationContainer>
        <WinnerOverlay />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
