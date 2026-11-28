import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Row, T } from '@/components/ui';
import { showToast } from '@/state/toastStore';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/**
 * The game code card (Housie rooms and party games): a gold-edged card in the game's own colours,
 * the code big and spaced in a dark pill (key on the left, copy on the right — same size), then
 * Copy code and a gold Invite. Copying shows a tick and "Copied" in the card's own colours (no
 * green), for 2 s.
 */
export function GameCodeCard({ code, colors, emoji, label, shareMessage }: { code: string; colors: readonly [string, string, ...string[]]; emoji?: string; label: string; shareMessage: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = () =>
    Clipboard.setStringAsync(code).then(() => {
      setCopied(true);
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      showToast({ variant: 'success', title: t('common.copied') });
    });
  const share = () => Share.share({ message: shareMessage }).catch(() => undefined);
  return (
    <LinearGradient colors={['#FFF1A8', '#D4A017', '#8A6100', '#F5D06F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.edge}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Row gap={6} style={{ alignSelf: 'stretch' }}>
          {emoji ? (
            <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.12)']} style={styles.badge}>
              <T style={{ fontSize: 14, lineHeight: 18 }} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {emoji}
              </T>
            </LinearGradient>
          ) : null}
          <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 2, flex: 1, fontFamily: fonts.semibold }}>
            {label.toUpperCase()}
          </T>
        </Row>
        <Pressable onPress={copy} accessibilityLabel={t('party.copyCode')} style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.98 }] }]}>
          <View style={styles.key}>
            <Ionicons name="key" size={18} color="#fff" />
          </View>
          <T style={styles.code} maxFontSizeMultiplier={FIXED_SHAPE_SCALE} numberOfLines={1} adjustsFontSizeToFit>
            {code}
          </T>
          <Animated.View style={[styles.copyBtn, { transform: [{ scale: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] }) }] }]}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#3B1D00" />
          </Animated.View>
        </Pressable>
        <Row gap={spacing.sm} style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
          <Pressable onPress={copy} style={({ pressed }) => [styles.action, copied && styles.actionDone, pressed && { opacity: 0.8 }]}>
            <Ionicons name={copied ? 'checkmark-circle' : 'copy'} size={15} color={copied ? '#FDE68A' : '#fff'} />
            <T variant="smallBold" color={copied ? '#FDE68A' : '#fff'}>
              {copied ? t('common.copied') : t('party.copyCode')}
            </T>
          </Pressable>
          <Pressable onPress={share} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}>
            <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
              <Ionicons name="share-social" size={15} color="#3B1D00" />
              <T variant="smallBold" color="#3B1D00">
                {t('party.invite')}
              </T>
            </LinearGradient>
          </Pressable>
        </Row>
      </LinearGradient>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  edge: { borderRadius: 22, padding: 1.5 },
  card: { borderRadius: 21, padding: spacing.md, alignItems: 'center', overflow: 'hidden' },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, height: 62, marginTop: spacing.sm, borderRadius: 31, paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)' },
  key: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  code: { flex: 1, textAlign: 'center', color: '#FDE68A', fontFamily: fonts.display, fontSize: 30, lineHeight: 38, letterSpacing: 7, includeFontPadding: false, textAlignVertical: 'center' },
  copyBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F5B700', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF1A8' },
  action: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  actionDone: { borderColor: '#FDE68A', backgroundColor: 'rgba(0,0,0,0.35)' },
  invite: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#92400E' },
});

