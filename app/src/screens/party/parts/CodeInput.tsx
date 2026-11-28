import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';

/**
 * The join-code box: one sleek dark pill — a key icon, the code in big spaced letters (placeholder
 * dots), and a round gold arrow inside it that lights up once all 6 letters are in. Paste works.
 */
export function CodeInput({
  value,
  onChange,
  onSubmit,
  busy,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  accent: string;
}) {
  const [focused, setFocused] = useState(false);
  const ready = value.length === 6;
  return (
    <View style={[styles.pill, { borderColor: focused ? accent : 'rgba(255,255,255,0.18)' }]}>
      <View style={[styles.key, { backgroundColor: accent }]}>
        <Ionicons name="key" size={16} color="#fff" />
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => ready && onSubmit()}
        placeholder="••••••"
        placeholderTextColor="rgba(255,255,255,0.35)"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="go"
        style={styles.input}
        maxFontSizeMultiplier={1}
      />
      <Pressable onPress={onSubmit} disabled={!ready || busy} hitSlop={6} accessibilityLabel="Join">
        <LinearGradient
          colors={ready ? ['#FFF1A8', '#F5B700', '#D97706'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.go}
        >
          {busy ? <ActivityIndicator color="#3B1D00" /> : <Ionicons name="arrow-forward" size={22} color={ready ? '#3B1D00' : 'rgba(255,255,255,0.5)'} />}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 30, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.35)', paddingLeft: 8, paddingRight: 6, gap: 8 },
  key: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Android pads text for accents and Poppins sits off-centre: no font padding, centred line.
  input: { flex: 1, height: 56, color: '#fff', fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: 8, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, paddingVertical: 0 },
  go: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
