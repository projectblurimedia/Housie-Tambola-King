import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius } from '@/theme';
import { T } from './ui';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

const LENGTH = 4;

/** One box: gold glow while it's the next to fill; the digit (or a dot) pops in. */
function PinBox({ digit, active, reveal, error }: { digit: string; active: boolean; reveal: boolean; error: boolean }) {
  const pop = useRef(new Animated.Value(digit ? 1 : 0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: digit ? 1 : 0, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [digit, pop]);

  useEffect(() => {
    if (!active) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.25, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, glow]);

  const border = error ? '#FCA5A5' : active ? '#FDE68A' : digit ? 'rgba(253,230,138,0.75)' : 'rgba(255,255,255,0.35)';
  return (
    <View style={[styles.box, { borderColor: border, backgroundColor: digit ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)' }]}>
      {active ? <Animated.View pointerEvents="none" style={[styles.boxGlow, { opacity: glow }]} /> : null}
      <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        {digit ? reveal ? <T style={styles.digit} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>{digit}</T> : <View style={styles.dot} /> : null}
      </Animated.View>
    </View>
  );
}

/**
 * 4-digit PIN in four boxes over one hidden number field (so the phone's keyboard, paste and
 * autofill all work). `shakeKey` changing shakes the row (wrong PIN / PINs don't match).
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  shakeKey,
  error,
  accessibilityLabel,
}: {
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
  shakeKey?: number;
  error?: boolean;
  accessibilityLabel?: string;
}) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!shakeKey) return;
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 0.7, -0.7, 0.35, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true })),
    ).start();
  }, [shakeKey, shake]);

  // Focus after the screen's own animation so the keyboard opens reliably on Android.
  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [autoFocus]);

  const change = (text: string) => {
    const pin = text.replace(/\D/g, '').slice(0, LENGTH);
    onChange(pin);
    if (pin.length === LENGTH) onComplete?.(pin);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => input.current?.focus()} accessibilityRole="none">
        <Animated.View style={[styles.row, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] }) }] }]}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <PinBox key={i} digit={value[i] ?? ''} active={focused && i === Math.min(value.length, LENGTH - 1) && value.length < LENGTH} reveal={reveal} error={!!error} />
          ))}
          <Pressable onPress={() => setReveal((r) => !r)} hitSlop={10} style={styles.eye} accessibilityRole="button" accessibilityLabel={reveal ? 'Hide PIN' : 'Show PIN'}>
            <Ionicons name={reveal ? 'eye-off' : 'eye'} size={22} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </Animated.View>
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={LENGTH}
        secureTextEntry={!reveal}
        textContentType="oneTimeCode"
        importantForAutofill="no"
        autoComplete="off"
        caretHidden
        accessibilityLabel={accessibilityLabel}
        style={styles.hidden}
      />
    </View>
  );
}

const BOX = 58;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: {
    width: BOX,
    height: BOX + 6,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(253,230,138,0.22)' },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FDE68A' },
  digit: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: '#fff' },
  eye: { marginLeft: 2, padding: 4 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
