import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/state/settingsStore';
import { STRIKE_COLORS, StrikeColorKey, TICKET_THEMES, TicketThemeKey } from '@/theme/ticketThemes';
import { spacing, useThemeColors } from '@/theme';
import { TicketView } from './TicketView';
import { T } from './ui';

/** A valid 5-per-row / 5-per-column-group sample for the preview. */
const SAMPLE = [4, 0, 21, 0, 45, 0, 63, 0, 85, 0, 12, 0, 33, 0, 57, 0, 71, 88, 7, 18, 0, 39, 48, 0, 66, 0, 0];
const SAMPLE_STRUCK = new Set([4, 33, 57, 18, 66]);

/** Ticket background + strike colour swatches with a live preview. */
export function TicketStylePicker({ preview = true }: { preview?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const ticketTheme = useSettingsStore((s) => s.ticketTheme);
  const strikeColor = useSettingsStore((s) => s.strikeColor);
  const set = useSettingsStore((s) => s.set);

  return (
    <View style={{ gap: spacing.md }}>
      {preview ? <TicketView cells={SAMPLE} marked={SAMPLE_STRUCK} lastCalled={45} label="#1" compact /> : null}
      <View style={{ gap: 6 }}>
        <T variant="smallBold" muted>
          {t('ticketStyle.background')}
        </T>
        <View style={styles.swatches}>
          {(Object.keys(TICKET_THEMES) as TicketThemeKey[]).map((key) => {
            const selected = key === ticketTheme;
            return (
              <Pressable key={key} onPress={() => set({ ticketTheme: key })} accessibilityLabel={t(`ticketStyle.themes.${key}`)}>
                <LinearGradient
                  colors={TICKET_THEMES[key].frame}
                  style={[styles.swatch, { borderColor: selected ? colors.gold : 'transparent' }]}
                >
                  <View style={[styles.inner, { backgroundColor: TICKET_THEMES[key].paper }]}>
                    {selected ? <Ionicons name="checkmark" size={16} color={TICKET_THEMES[key].ink} /> : null}
                  </View>
                </LinearGradient>
                <T variant="tiny" muted center style={{ marginTop: 2 }}>
                  {t(`ticketStyle.themes.${key}`)}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <T variant="smallBold" muted>
          {t('ticketStyle.strike')}
        </T>
        <View style={styles.swatches}>
          {(Object.keys(STRIKE_COLORS) as StrikeColorKey[]).map((key) => {
            const selected = key === strikeColor;
            return (
              <Pressable key={key} onPress={() => set({ strikeColor: key })} accessibilityLabel={key}>
                <LinearGradient colors={STRIKE_COLORS[key].disc} style={[styles.dot, { borderColor: selected ? colors.text : 'transparent' }]}>
                  {selected ? <Ionicons name="checkmark" size={18} color={STRIKE_COLORS[key].line} /> : null}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 48, height: 36, borderRadius: 10, padding: 4, borderWidth: 2 },
  inner: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
