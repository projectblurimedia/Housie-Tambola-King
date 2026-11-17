import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, heroGradient } from '@/theme';

const RING = 104;

/**
 * Full-screen "Updating app…" overlay while an EAS OTA update downloads — same moment as
 * NearbyU's UpdateOverlay. expo-updates exposes no real byte progress, so App.tsx drives
 * `progress` with a simulated ramp and snaps it to 1 when the update is ready.
 */
export function UpdateOverlay({ progress }: { progress: number }) {
  const { t } = useTranslation();
  const done = progress >= 1;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2000, elevation: 2000 }]}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <View style={styles.ring}>
          {!done ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        left: RING / 2 + Math.cos(a) * (RING / 2 - 6) - 5,
                        top: RING / 2 + Math.sin(a) * (RING / 2 - 6) - 5,
                        opacity: 0.3 + (i / 8) * 0.7,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>
          ) : null}
          <View style={styles.mark}>
            <Ionicons name={done ? 'checkmark' : 'cloud-download'} size={28} color="#fff" />
          </View>
        </View>
        <Text style={styles.title}>{t(done ? 'update.completeTitle' : 'update.title')}</Text>
        <Text style={styles.message}>{t(done ? 'update.completeMessage' : 'update.message')}</Text>
        {!done ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FDE68A' },
  mark: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: '#fff', marginBottom: 8, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 20 },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#FDE68A' },
  percent: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
});
