import '@/localization/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { IS_CONFIGURED } from '@/constants/config';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastHost } from '@/components/ToastHost';
import { WinnerOverlay } from '@/components/WinnerOverlay';
import { UpdateOverlay } from '@/components/UpdateOverlay';
import { Screen, T } from '@/components/ui';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useMe } from '@/hooks/useMe';
import { registerForPush } from '@/services/pushService';
import { hideNavigationBar } from '@/services/systemBars';
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

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const APPLIED_UPDATE_KEY = 'ota-applied-update-id';

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
    Poppins_800ExtraBold,
    // App title font (Aquire Bold — freeware, NON-COMMERCIAL licence: buy a commercial
    // licence or swap in an OFL look-alike before a commercial release).
    'Aquire-Bold': require('./assets/fonts/Aquire-Bold.otf'),
  });
  const { colors, isDark } = useThemeColors();
  const sessionReady = useSessionStore((s) => s.isReady);
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // Full-screen game: no Back / Home / Recents bar over the buttons at the bottom.
  useEffect(() => {
    hideNavigationBar();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && hideNavigationBar());
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

  // OTA updates (EAS Update), same as NearbyU: checked on launch, when the app returns to
  // the foreground and every 5 minutes. A found update downloads behind a full-screen
  // progress overlay, then the app restarts into it. expo-updates gives no byte progress,
  // so the bar is a simulated ramp (5% → 88%) snapped to 100% when the update is ready.
  // Game state lives on the server and strikes are persisted, so a restart mid-game is safe.
  const { isUpdateAvailable, isUpdatePending, isDownloading, availableUpdate } = Updates.useUpdates();
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  // Each update is fetched once. After the restart the same update can still be reported as
  // "available" by the next check — it's already running, so it must not show the overlay again.
  const handledUpdateId = useRef<string | null>(null);
  const overlayRef = useRef(false);
  overlayRef.current = showUpdateOverlay;
  useEffect(() => {
    const id = availableUpdate?.updateId?.toLowerCase() ?? null;
    if (!isUpdateAvailable || !id || overlayRef.current) return;
    if (id === Updates.updateId?.toLowerCase() || handledUpdateId.current === id) return;
    handledUpdateId.current = id;
    let cancelled = false;
    // The id applied last time is kept on the phone: never offer the same update twice.
    AsyncStorage.getItem(APPLIED_UPDATE_KEY)
      .catch(() => null)
      .then((applied) => {
        if (cancelled || applied === id) return;
        setShowUpdateOverlay(true);
        setDownloadProgress(0.05);
        Updates.fetchUpdateAsync().catch(() => setShowUpdateOverlay(false));
      });
    return () => {
      cancelled = true;
    };
  }, [isUpdateAvailable, availableUpdate?.updateId]);

  // Simulated ramp; it only ever moves forward (a second download event can't reset it to 5%).
  useEffect(() => {
    if (!isDownloading || !showUpdateOverlay) return;
    const id = setInterval(() => {
      setDownloadProgress((p) => Math.max(p, Math.min(Math.max(p, 0.05) + Math.random() * 0.1 + 0.04, 0.88)));
    }, 400);
    return () => clearInterval(id);
  }, [isDownloading, showUpdateOverlay]);

  useEffect(() => {
    if (!isUpdatePending || !showUpdateOverlay) return;
    setDownloadProgress(1);
    const applied = handledUpdateId.current;
    const timeout = setTimeout(async () => {
      if (applied) await AsyncStorage.setItem(APPLIED_UPDATE_KEY, applied).catch(() => undefined);
      Updates.reloadAsync().catch(() => setShowUpdateOverlay(false));
    }, 1800);
    return () => clearTimeout(timeout);
  }, [isUpdatePending, showUpdateOverlay]);

  const checkForUpdate = useCallback(async () => {
    // Never while an update is already downloading / about to restart.
    if (__DEV__ || !Updates.isEnabled || overlayRef.current) return;
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // Offline / update server unreachable — the installed version keeps working.
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
    const sub = AppState.addEventListener('change', (status) => {
      if (appStateRef.current !== 'active' && status === 'active') checkForUpdate();
      appStateRef.current = status;
    });
    const interval = setInterval(() => {
      if (appStateRef.current === 'active') checkForUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [checkForUpdate]);

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
          {/* Always white: every screen has the purple gradient behind the status bar. */}
          <StatusBar style="light" />
          {IS_CONFIGURED ? <SessionGate /> : <NotConfigured />}
        </NavigationContainer>
        <WinnerOverlay />
        <ToastHost />
        {showUpdateOverlay ? <UpdateOverlay progress={downloadProgress} /> : null}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
