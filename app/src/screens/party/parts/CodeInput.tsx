import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '@/components/ui';
import { fonts, radius, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/**
 * A 6-character game code as six letter boxes (like an OTP): tap anywhere to type, the next
 * box glows, filled boxes turn gold. One hidden input does the typing (paste works too).
 */
export function CodeInput({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent: string }) {
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const box = Math.max(36, Math.min(48, Math.floor((width - 32 - 32 - 5 * 8) / 6)));
  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row} accessibilityLabel="Game code">
      {Array.from({ length: 6 }, (_, i) => {
        const ch = value[i];
        const active = focused && i === Math.min(value.length, 5);
        return ch ? (
          <LinearGradient key={i} colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.box, { width: box, height: box * 1.2 }]}>
            <T style={[styles.char, { color: '#3B1D00', fontSize: box * 0.55, lineHeight: box * 0.7 }]} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              {ch}
            </T>
          </LinearGradient>
        ) : (
          <View
            key={i}
            style={[
              styles.box,
              { width: box, height: box * 1.2, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: active ? accent : colors.border },
              active && { shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
            ]}
          >
            {active ? <View style={[styles.caret, { backgroundColor: accent }]} /> : <View style={[styles.dot, { backgroundColor: colors.border }]} />}
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(v) => onChange(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  char: { fontFamily: fonts.display },
  caret: { width: 2, height: '45%', borderRadius: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
