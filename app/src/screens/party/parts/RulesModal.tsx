import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { IconButton, Row, T } from '@/components/ui';
import type { PartyKind } from '@/services/partyService';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { GAME_ART } from './gameArt';
import { PARTY_LOOK } from './Premium';

/** How a party game is played — opened from the ⓘ in the header. */
export function RulesModal({ kind, visible, onClose }: { kind: PartyKind; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const look = PARTY_LOOK[kind];
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.top}>
            <SvgXml xml={GAME_ART[kind]} width={120} height={90} />
            <View style={{ flex: 1 }}>
              <T variant="tiny" color={look.accent} style={{ letterSpacing: 2 }}>
                {t('party.howItWorks').toUpperCase()}
              </T>
              <T style={styles.title}>{t(`party.${kind}.title`)}</T>
            </View>
            <IconButton icon="close" color="#fff" onPress={onClose} />
          </LinearGradient>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
            {[1, 2, 3, 4].map((n) => (
              <Row key={n} gap={spacing.md} style={{ alignItems: 'flex-start' }}>
                <LinearGradient colors={look.colors} style={styles.num}>
                  <T variant="smallBold" color="#fff" maxFontSizeMultiplier={1}>
                    {n}
                  </T>
                </LinearGradient>
                <T variant="body" style={{ flex: 1 }}>
                  {t(`party.${kind}.step${n}`)}
                </T>
              </Row>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.xl, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs, paddingLeft: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: '#fff' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
