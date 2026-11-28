import React from 'react';
// The real module object (an `import * as` can be a copy), so every screen's import sees the swap.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactNative = require('react-native');

/**
 * Phones set to a large font size scale every text up (Android goes to about 2×), which broke
 * layouts made for normal size: numbers wrapping in inputs, the 2×2 Home tiles falling into one
 * column. Owner (2026-11-27): text stays at normal size on every phone — it never grows with the
 * phone setting (smaller settings still shrink it).
 *
 * React 19 ignores `defaultProps` on function components, so `Text` and `TextInput` are swapped
 * for wrappers that pass a default `maxFontSizeMultiplier` (a screen can still set its own).
 * Imported first in index.ts, before any screen reads them. Same as NearbyU (fix of 2026-11-21).
 * Numbers inside fixed-size shapes (ticket cells, number balls, the 1–90 board, PIN boxes) use
 * FIXED_SHAPE_SCALE = 1: the shape cannot grow, so their text must not either.
 */
export const MAX_FONT_SCALE = 1;

/** Layouts are made for a phone about 392 dp wide. */
const DESIGN_WIDTH = 392;
/**
 * "Display size" (screen zoom) makes the phone narrower in dp, so text made for normal phones
 * wraps or gets cut ("Calle…"). Text shrinks with the width — never below 84 % — so it fits.
 */
export function fitScale(): number {
  const w = ReactNative.Dimensions.get('window').width as number;
  return Math.max(0.84, Math.min(1, w / DESIGN_WIDTH));
}
function fitStyle(style: unknown) {
  const k = fitScale();
  if (k >= 0.999 || !style) return style;
  const flat = ReactNative.StyleSheet.flatten(style) as { fontSize?: number; lineHeight?: number } | undefined;
  if (!flat || (flat.fontSize == null && flat.lineHeight == null)) return style;
  return [style, { fontSize: flat.fontSize != null ? flat.fontSize * k : undefined, lineHeight: flat.lineHeight != null ? flat.lineHeight * k : undefined }];
}

function capped<T extends React.ComponentType<any>>(Original: T): T {
  const Wrapped = React.forwardRef((props: any, ref) =>
    // A screen passing maxFontSizeMultiplier={undefined} (our T always passes the prop) must still
    // get the cap — spreading props after the default let undefined switch it off.
    React.createElement(Original, {
      ...props,
      // Never grows with the phone's font setting; shrinks a little on zoomed (narrow) screens.
      allowFontScaling: props.allowFontScaling ?? false,
      maxFontSizeMultiplier: props.maxFontSizeMultiplier ?? MAX_FONT_SCALE,
      style: fitStyle(props.style),
      ref,
    }),
  );
  // Keep statics such as TextInput.State.
  for (const key of Object.keys(Original)) {
    if (!(key in Wrapped)) (Wrapped as any)[key] = (Original as any)[key];
  }
  Wrapped.displayName = (Original as any).displayName ?? (Original as any).name;
  return Wrapped as unknown as T;
}

function swap(name: 'Text' | 'TextInput') {
  try {
    const wrapped = capped(ReactNative[name] as React.ComponentType<any>);
    Object.defineProperty(ReactNative, name, { configurable: true, enumerable: true, get: () => wrapped });
  } catch {
    // Can't swap here: the app simply keeps the phone's full font scaling.
  }
}

swap('Text');
swap('TextInput');

// Animated.Text was built from the original Text when React Native loaded: rebuild it on the capped one.
try {
  const Animated = ReactNative.Animated;
  const animatedText = Animated.createAnimatedComponent(ReactNative.Text);
  Object.defineProperty(Animated, 'Text', { configurable: true, enumerable: true, get: () => animatedText });
} catch {
  // Keep the original Animated.Text.
}

/** For text inside a fixed-size shape (ticket cell, ball, board cell, PIN box): never scaled up. */
export const FIXED_SHAPE_SCALE = 1;
