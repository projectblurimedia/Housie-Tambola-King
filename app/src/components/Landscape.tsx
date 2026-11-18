import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OrientationModule = {
  lockAsync: (lock: number) => Promise<void>;
  OrientationLock: { LANDSCAPE: number; PORTRAIT_UP: number };
};

/**
 * expo-screen-orientation is loaded lazily and guarded: app builds made before it was added
 * have no native module, and those get the rotated-view fallback below instead.
 */
let orientation: OrientationModule | null | undefined;
function loadOrientation(): OrientationModule | null {
  if (orientation !== undefined) return orientation;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    orientation = require('expo-screen-orientation') as OrientationModule;
  } catch {
    orientation = null;
  }
  return orientation;
}

export interface LandscapeFrame {
  width: number;
  height: number;
  /** Safe padding in landscape terms. */
  padLeft: number;
  padRight: number;
}

/**
 * Shows its content in landscape. With the native orientation module the phone really turns
 * to landscape (and back to portrait on leave); without it the content is drawn rotated 90°.
 * Content must not use <Modal> (a modal would not rotate with it) — use in-tree overlays.
 */
export function Landscape({ children }: { children: (frame: LandscapeFrame) => React.ReactNode }) {
  const mod = loadOrientation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!mod) return;
    mod.lockAsync(mod.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      mod.lockAsync(mod.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, [mod]);

  if (mod) {
    // Until the rotation lands, lay out as if already wide.
    const w = Math.max(width, height);
    const h = Math.min(width, height);
    return (
      <View style={{ flex: 1 }}>
        {children({ width: w, height: h, padLeft: Math.max(insets.left, 12), padRight: Math.max(insets.right, 12) })}
      </View>
    );
  }

  // Fallback: rotate a landscape-sized box 90° clockwise inside the portrait screen.
  // The status bar (portrait top) ends up on the left, the nav bar (portrait bottom) on the right.
  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          width: height,
          height: width,
          left: (width - height) / 2,
          top: (height - width) / 2,
          transform: [{ rotate: '90deg' }],
        }}
      >
        {children({ width: height, height: width, padLeft: Math.max(insets.top, 12), padRight: Math.max(insets.bottom, 12) })}
      </View>
    </View>
  );
}
