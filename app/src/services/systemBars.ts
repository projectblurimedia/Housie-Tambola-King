import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type NavigationBarModule = { setVisibilityAsync: (v: 'hidden' | 'visible') => Promise<void> };

/**
 * Hides Android's bottom Back / Home / Recents bar for the whole game (a swipe up from the
 * bottom shows it for a moment). Needs expo-navigation-bar's native module, which only exists
 * in builds made after it was added — older builds skip this (checked first: requiring a
 * package with no native side is a fatal error in Metro).
 */
export function hideNavigationBar() {
  if (Platform.OS !== 'android' || !requireOptionalNativeModule('ExpoNavigationBar')) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nav = require('expo-navigation-bar') as NavigationBarModule;
    nav.setVisibilityAsync('hidden').catch(() => undefined);
  } catch {
    // Not available in this build.
  }
}
