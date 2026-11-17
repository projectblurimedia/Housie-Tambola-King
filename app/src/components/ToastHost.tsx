import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '@/state/toastStore';
import { fonts, radius } from '@/theme';

const VARIANTS = {
  success: { bg: '#16A34A', icon: 'checkmark-circle' },
  error: { bg: '#DC2626', icon: 'alert-circle' },
  info: { bg: '#4C1D95', icon: 'information-circle' },
  prize: { bg: '#B45309', icon: 'trophy' },
} as const;

/** Single app-wide toast, rendered once at the root. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (!toast) return;
    y.setValue(-150);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    const timer = setTimeout(() => {
      Animated.timing(y, { toValue: -150, duration: 220, useNativeDriver: true }).start(() => hide());
    }, toast.variant === 'error' ? 3800 : 2800);
    return () => clearTimeout(timer);
  }, [toast, y, hide]);

  if (!toast) return null;
  const v = VARIANTS[toast.variant];
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable onPress={hide} style={[styles.toast, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={22} color="#fff" />
        <Text style={styles.title} numberOfLines={3}>
          {toast.title}
          {toast.message ? `\n${toast.message}` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { flex: 1, color: '#fff', fontFamily: fonts.semibold, fontSize: 14 },
});
