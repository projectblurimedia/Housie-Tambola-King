import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/state/settingsStore';
import {
  HINT_COLORS,
  HintColorKey,
  STRIKE_COLORS,
  StrikeColorKey,
  TICKET_COMBOS,
  TICKET_THEMES,
  TicketCombo,
  TicketThemeKey,
} from '@/theme/ticketThemes';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { TicketView } from './TicketView';
import { T } from './ui';

/** A valid 5-per-row / 5-per-column-group sample for the preview. */
const SAMPLE = [4, 0, 21, 0, 45, 0, 63, 0, 85, 0, 12, 0, 33, 0, 57, 0, 71, 88, 7, 18, 0, 39, 48, 0, 66, 0, 0];
const SAMPLE_STRUCK = new Set([4, 33, 57, 18, 66]);
const SAMPLE_HINTED = new Set([21, 71]);

/** A small ticket-looking card for one ready-made combo. */
function ComboCard({ combo, selected, onPress }: { combo: TicketCombo; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const theme = TICKET_THEMES[combo.theme];
  const strike = STRIKE_COLORS[combo.strike];
  const hint = HINT_COLORS[combo.hint];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.comboWrap, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <View style={[styles.comboRing, { borderColor: selected ? colors.gold : 'transparent' }]}>
        <LinearGradient colors={theme.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.comboFrame}>
          <View style={[styles.comboPaper, { backgroundColor: theme.paper }]}>
            <View style={styles.comboRow}>
              <LinearGradient colors={strike.disc} style={styles.comboDot}>
                <View style={[styles.comboStrike, { backgroundColor: strike.line }]} />
              </LinearGradient>
              <View style={[styles.comboDot, { backgroundColor: theme.cell, borderColor: hint, borderWidth: 2.5 }]} />
              <View style={[styles.comboDot, { backgroundColor: theme.blankCell }]} />
            </View>
            <View style={styles.comboRow}>
              <View style={[styles.comboDot, { backgroundColor: theme.blankCell }]} />
              <View style={[styles.comboDot, { backgroundColor: theme.cell, borderColor: theme.cellBorder, borderWidth: 1.5 }]} />
              <LinearGradient colors={strike.disc} style={styles.comboDot}>
                <View style={[styles.comboStrike, { backgroundColor: strike.line }]} />
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
        {selected ? (
          <View style={[styles.comboCheck, { backgroundColor: colors.gold }]}>
            <Ionicons name="checkmark" size={14} color="#3B1D00" />
          </View>
        ) : null}
      </View>
      <T variant="tiny" center style={{ fontFamily: selected ? fonts.bold : fonts.medium, marginTop: 4 }} color={selected ? colors.text : colors.textMuted}>
        {t(`ticketStyle.combos.${combo.key}`)}
      </T>
    </Pressable>
  );
}

function Swatches<K extends string>({
  label,
  keys,
  value,
  onPick,
  render,
}: {
  label: string;
  keys: K[];
  value: K;
  onPick: (k: K) => void;
  render: (k: K, selected: boolean) => React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="smallBold" muted style={styles.label}>
        {label}
      </T>
      <View style={styles.swatches}>
        {keys.map((k) => (
          <Pressable key={k} onPress={() => onPick(k)} accessibilityLabel={k} hitSlop={4}>
            {render(k, k === value)}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Ready-made looks + a live preview + custom ticket / strike / hint colours. */
export function TicketStylePicker() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const ticketTheme = useSettingsStore((s) => s.ticketTheme);
  const strikeColor = useSettingsStore((s) => s.strikeColor);
  const hintColor = useSettingsStore((s) => s.hintColor);
  const set = useSettingsStore((s) => s.set);
  const activeCombo = TICKET_COMBOS.find((c) => c.theme === ticketTheme && c.strike === strikeColor && c.hint === hintColor)?.key;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: 8 }}>
        <T variant="smallBold" muted style={styles.label}>
          {t('ticketStyle.looks')}
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: 4, paddingRight: spacing.md }}>
          {TICKET_COMBOS.map((c) => (
            <ComboCard
              key={c.key}
              combo={c}
              selected={activeCombo === c.key}
              onPress={() => set({ ticketTheme: c.theme, strikeColor: c.strike, hintColor: c.hint })}
            />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.previewBox, { backgroundColor: colors.surfaceAlt }]}>
        <TicketView cells={SAMPLE} marked={SAMPLE_STRUCK} hinted={SAMPLE_HINTED} lastCalled={45} label="#1" compact />
        <T variant="tiny" muted center style={{ marginTop: spacing.sm }}>
          {t('ticketStyle.previewHint')}
        </T>
      </View>

      <Swatches<TicketThemeKey>
        label={t('ticketStyle.background')}
        keys={Object.keys(TICKET_THEMES) as TicketThemeKey[]}
        value={ticketTheme}
        onPick={(k) => set({ ticketTheme: k })}
        render={(k, selected) => (
          <View style={{ alignItems: 'center' }}>
            <LinearGradient colors={TICKET_THEMES[k].frame} style={[styles.themeSwatch, { borderColor: selected ? colors.gold : 'transparent' }]}>
              <View style={[styles.themeInner, { backgroundColor: TICKET_THEMES[k].paper }]}>
                {selected ? <Ionicons name="checkmark" size={16} color={TICKET_THEMES[k].ink} /> : null}
              </View>
            </LinearGradient>
            <T variant="tiny" muted style={{ marginTop: 2 }}>
              {t(`ticketStyle.themes.${k}`)}
            </T>
          </View>
        )}
      />
      <Swatches<StrikeColorKey>
        label={t('ticketStyle.strike')}
        keys={Object.keys(STRIKE_COLORS) as StrikeColorKey[]}
        value={strikeColor}
        onPick={(k) => set({ strikeColor: k })}
        render={(k, selected) => (
          <LinearGradient colors={STRIKE_COLORS[k].disc} style={[styles.dot, selected && { borderColor: colors.text }]}>
            {selected ? <Ionicons name="checkmark" size={18} color={STRIKE_COLORS[k].line} /> : <View style={[styles.dotLine, { backgroundColor: STRIKE_COLORS[k].line }]} />}
          </LinearGradient>
        )}
      />
      <Swatches<HintColorKey>
        label={t('ticketStyle.hint')}
        keys={Object.keys(HINT_COLORS) as HintColorKey[]}
        value={hintColor}
        onPick={(k) => set({ hintColor: k })}
        render={(k, selected) => (
          <View style={[styles.dot, { borderColor: HINT_COLORS[k], borderWidth: 4, backgroundColor: selected ? HINT_COLORS[k] : colors.surface }]}>
            {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  comboWrap: { alignItems: 'center', width: 88 },
  comboRing: { borderRadius: radius.md + 3, borderWidth: 2.5, padding: 2 },
  comboFrame: { borderRadius: radius.md, padding: 3, width: 78 },
  comboPaper: { borderRadius: radius.md - 3, padding: 6, gap: 5 },
  comboRow: { flexDirection: 'row', justifyContent: 'space-between' },
  comboDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  comboStrike: { width: 12, height: 2, borderRadius: 1, transform: [{ rotate: '-40deg' }] },
  comboCheck: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  previewBox: { borderRadius: radius.lg, padding: spacing.md },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeSwatch: { width: 50, height: 38, borderRadius: 11, padding: 4, borderWidth: 2.5 },
  themeInner: { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dotLine: { width: 18, height: 2.5, borderRadius: 2, transform: [{ rotate: '-40deg' }] },
});
