import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/state/settingsStore';
import {
  HINT_COLORS,
  TICKET_SHAPES,
  PALETTE,
  PaletteKey,
  STRIKE_COLORS,
  TICKET_THEMES,
  toPalette,
} from '@/theme/ticketThemes';
import { radius, spacing, useThemeColors } from '@/theme';
import { TicketView } from './TicketView';
import { T } from './ui';

/** A valid 5-per-row / 5-per-column-group sample for the preview. */
const SAMPLE = [4, 0, 21, 0, 45, 0, 63, 0, 85, 0, 12, 0, 33, 0, 57, 0, 71, 88, 7, 18, 0, 39, 48, 0, 66, 0, 0];
const SAMPLE_STRUCK = new Set([4, 33, 57, 18, 66]);
const SAMPLE_HINTED = new Set([21, 71]);

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
  const { t } = useTranslation();
  const colorName = (k: K) => t('ticketStyle.colors.' + String(k));
  return (
    <View style={{ gap: 8 }}>
      <T variant="smallBold" muted style={styles.label}>
        {label}
      </T>
      <View style={styles.swatches}>
        {keys.map((k) => (
          <Pressable key={k} onPress={() => onPick(k)} accessibilityLabel={k} hitSlop={4} style={{ alignItems: 'center', gap: 3 }}>
            {render(k, k === value)}
            <T variant="tiny" muted>
              {colorName(k)}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A live preview, the ticket shape, and custom ticket / strike / hint colours. */
export function TicketStylePicker() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const ticketTheme = toPalette(
    useSettingsStore((s) => s.ticketTheme),
    'purple',
  );
  const strikeColor = toPalette(
    useSettingsStore((s) => s.strikeColor),
    'purple',
  );
  const hintColor = toPalette(
    useSettingsStore((s) => s.hintColor),
    'pink',
  );
  const set = useSettingsStore((s) => s.set);
  const shape = useSettingsStore((s) => s.ticketShape);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={[styles.previewBox, { backgroundColor: colors.surfaceAlt }]}>
        <TicketView cells={SAMPLE} marked={SAMPLE_STRUCK} hinted={SAMPLE_HINTED} lastCalled={45} label="#1" compact />
        <T variant="tiny" muted center style={{ marginTop: spacing.sm }}>
          {t('ticketStyle.previewHint')}
        </T>
      </View>

      <View style={{ gap: 8 }}>
        <T variant="smallBold" muted style={styles.label}>
          {t('ticketStyle.shape')}
        </T>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {TICKET_SHAPES.map((k) => {
            const selected = (shape ?? 'round') === k;
            // Same proportions as on the ticket (cells ~36px: semi box 11, box 4) at this 18px size.
            const corner = k === 'box' ? 2 : k === 'soft' ? 5 : 999;
            return (
              <Pressable
                key={k}
                onPress={() => set({ ticketShape: k })}
                style={[
                  styles.shapeOption,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.shapeCell,
                        {
                          borderRadius: corner,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: i === 1 ? colors.primary : 'transparent',
                        },
                      ]}
                    />
                  ))}
                </View>
                <T variant="tiny" color={selected ? colors.primary : colors.textMuted}>
                  {t(`ticketStyle.shapes.${k}`)}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Swatches<PaletteKey>
        label={t('ticketStyle.background')}
        keys={[...PALETTE]}
        value={ticketTheme}
        onPick={(k) => set({ ticketTheme: k })}
        render={(k, selected) => (
          <View style={{ alignItems: 'center' }}>
            <LinearGradient
              colors={TICKET_THEMES[k].frame}
              style={[styles.themeSwatch, { borderColor: selected ? colors.gold : 'transparent' }]}
            >
              <View style={[styles.themeInner, { backgroundColor: TICKET_THEMES[k].paper }]}>
                {selected ? <Ionicons name="checkmark" size={16} color={TICKET_THEMES[k].ink} /> : null}
              </View>
            </LinearGradient>
          </View>
        )}
      />
      <Swatches<PaletteKey>
        label={t('ticketStyle.strike')}
        keys={[...PALETTE]}
        value={strikeColor}
        onPick={(k) => set({ strikeColor: k })}
        render={(k, selected) => (
          <LinearGradient colors={STRIKE_COLORS[k].disc} style={[styles.dot, selected && { borderColor: colors.text }]}>
            {selected ? (
              <Ionicons name="checkmark" size={18} color={STRIKE_COLORS[k].line} />
            ) : (
              <View style={[styles.dotLine, { backgroundColor: STRIKE_COLORS[k].line }]} />
            )}
          </LinearGradient>
        )}
      />
      <Swatches<PaletteKey>
        label={t('ticketStyle.hint')}
        keys={[...PALETTE]}
        value={hintColor}
        onPick={(k) => set({ hintColor: k })}
        render={(k, selected) => (
          <View
            style={[
              styles.dot,
              { borderColor: HINT_COLORS[k], borderWidth: 4, backgroundColor: selected ? HINT_COLORS[k] : colors.surface },
            ]}
          >
            {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shapeOption: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: radius.md, paddingVertical: 10 },
  shapeCell: { width: 18, height: 18, borderWidth: 1.5 },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  previewBox: { borderRadius: radius.lg, padding: spacing.md },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  themeSwatch: { width: 40, height: 40, borderRadius: 12, padding: 4, borderWidth: 2.5 },
  themeInner: { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLine: { width: 18, height: 2.5, borderRadius: 2, transform: [{ rotate: '-40deg' }] },
});
