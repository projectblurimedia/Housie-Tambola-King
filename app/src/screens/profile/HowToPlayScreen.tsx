import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Row, Screen, Spacer, T } from '@/components/ui';
import { TicketView } from '@/components/TicketView';
import { radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

const DEMO = [4, 0, 21, 0, 45, 0, 63, 0, 85, 0, 12, 0, 33, 0, 57, 0, 71, 88, 7, 18, 0, 39, 48, 0, 66, 0, 0];
const TOP_LINE = new Set([4, 21, 45, 63, 85]);

/** The steps, in the order a game happens (texts in howToPlay.s<n>t / s<n>). */
const STEPS: { icon: keyof typeof Ionicons.glyphMap; colors: [string, string] }[] = [
  { icon: 'enter', colors: ['#A78BFA', '#6D28D9'] },
  { icon: 'pricetags', colors: ['#FDE68A', '#D97706'] },
  { icon: 'list', colors: ['#93C5FD', '#2563EB'] },
  { icon: 'ticket', colors: ['#F9A8D4', '#DB2777'] },
  { icon: 'megaphone', colors: ['#FDBA74', '#EA580C'] },
  { icon: 'trophy', colors: ['#FDE68A', '#CA8A04'] },
  { icon: 'shield-checkmark', colors: ['#6EE7B7', '#059669'] },
  { icon: 'chatbubbles', colors: ['#67E8F9', '#0891B2'] },
];

/** How to play: a sample ticket, then the game step by step as a numbered timeline. */
export function HowToPlayScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Screen scroll title={t('howToPlay.title')}>
      <T variant="small" muted center style={{ marginBottom: spacing.sm }}>
        {t('howToPlay.intro')}
      </T>
      <TicketView cells={DEMO} marked={TOP_LINE} label={t('prizes.line_1')} badge="✓" />
      <Spacer />
      {STEPS.map((step, i) => {
        const n = i + 1;
        const last = i === STEPS.length - 1;
        return (
          <Row key={n} gap={spacing.md} style={{ alignItems: 'stretch' }}>
            {/* Timeline: numbered gradient dot + line to the next step */}
            <View style={{ alignItems: 'center', width: 40 }}>
              <LinearGradient colors={step.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dot}>
                <Ionicons name={step.icon} size={18} color="#fff" />
              </LinearGradient>
              {last ? null : <View style={[styles.line, { backgroundColor: colors.border }]} />}
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row gap={6}>
                <View style={[styles.num, { backgroundColor: step.colors[1] }]}>
                  <T variant="tiny" color="#fff" maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                    {n}
                  </T>
                </View>
                <T variant="h3" style={{ flex: 1 }}>
                  {t(`howToPlay.s${n}t`)}
                </T>
              </Row>
              <T variant="small" muted style={{ marginTop: 4 }}>
                {t(`howToPlay.s${n}`)}
              </T>
            </View>
          </Row>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  num: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
