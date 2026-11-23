import '@/localization/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Montserrat_800ExtraBold, Montserrat_900Black } from '@expo-google-fonts/montserrat';
import { LuckiestGuy_400Regular } from '@expo-google-fonts/luckiest-guy';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { installCrashReporting, setCurrentScreen } from '@/services/crashReporter';
import type { RootStackParamList } from '@/navigation/types';
import { codeFromLink } from '@/constants/config';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { IS_CONFIGURED } from '@/constants/config';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastHost } from '@/components/ToastHost';
import { WinnerOverlay } from '@/components/WinnerOverlay';
import { UpdateOverlay } from '@/components/UpdateOverlay';
import { LaunchIntro } from '@/components/Wordmark';
import { Screen, T } from '@/components/ui';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useMe } from '@/hooks/useMe';
import { registerForPush } from '@/services/pushService';
import { hideNavigationBar } from '@/services/systemBars';
import { toAppError } from '@/services/errors';
import { useThemeColors } from '@/theme';

// No native splash logo: the coded opening scene is drawn on the very first frame (while fonts
// and the session load), and the native splash is hidden as soon as it is up.
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

// Crash reports (admin web → Crashes): installed before anything else can throw.
installCrashReporting();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
const trackScreen = () => setCurrentScreen(navigationRef.getCurrentRoute()?.name);

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
    // Title font (header + opening screen).
    Montserrat_800ExtraBold,
    Montserrat_900Black,
    LuckiestGuy_400Regular,
  });
  const { colors, isDark } = useThemeColors();
  const sessionReady = useSessionStore((s) => s.isReady);
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const setSession = useSessionStore((s) => s.setSession);
  const session = useSessionStore((s) => s.session);

  // Shared room links (housietambolaking://join/CODE): kept until the player is logged in and
  // the screens are ready, then Join Room opens and sends the request by itself.
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    Linking.getInitialURL().then((url) => setLinkCode((c) => c ?? codeFromLink(url ?? null))).catch(() => undefined);
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = codeFromLink(url);
      if (code) setLinkCode(code);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!linkCode || !session || !navReady) return;
    // Let the logged-in screens mount first (the navigator switches stacks on login).
    const id = setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('JoinRoom', { code: linkCode, auto: true });
        setLinkCode(null);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [linkCode, session, navReady]);

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
      if (!session) {
        queryClient.clear();
        // The saved profile belongs to whoever just logged out.
        useSettingsStore.getState().setLastMe(null);
      }
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
  // Logo intro when the app opens (once per launch).
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
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

  // The opening scene's background is on screen from the first render — drop the splash now.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Still loading: only the opening scene (it starts animating once the fonts are in).
  if (!ready) return <LaunchIntro onDone={finishIntro} ready={false} />;

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
        <NavigationContainer theme={navTheme} ref={navigationRef} onReady={() => {
            trackScreen();
            setNavReady(true);
          }} onStateChange={trackScreen}>
          {/* Always white: every screen has the purple gradient behind the status bar. */}
          <StatusBar style="light" />
          {IS_CONFIGURED ? <SessionGate /> : <NotConfigured />}
        </NavigationContainer>
        <WinnerOverlay />
        <ToastHost />
        {showUpdateOverlay ? <UpdateOverlay progress={downloadProgress} /> : null}
        {introDone ? null : <LaunchIntro onDone={finishIntro} ready />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
