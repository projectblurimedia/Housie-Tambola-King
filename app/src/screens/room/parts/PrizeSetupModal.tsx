import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatRupees } from '@/components/Money';
import { Button, centeredInput, Row, T, Toggle } from '@/components/ui';
import { splitPot, sumAmounts } from '@/game/engine/split';
import { COLUMN_PRIZES, FAST_PRIZES, LINE_PRIZES, PrizeType } from '@/game/engine/ticket';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { GamePrize } from '@/types/api';

const DEFAULT_WEIGHT: Record<PrizeType, number> = {
  fast_3: 5,
  fast_5: 10,
  fast_7: 10,
  line_1: 10,
  line_2: 10,
  line_3: 10,
  col_left: 10,
  col_center: 10,
  col_right: 10,
  full_house: 30,
};

const GROUPS: { key: string; prizes: PrizeType[] }[] = [
  { key: 'create.fastSection', prizes: FAST_PRIZES },
  { key: 'create.linesSection', prizes: LINE_PRIZES },
  { key: 'create.columnsSection', prizes: COLUMN_PRIZES },
  { key: 'create.fullHouseSection', prizes: ['full_house'] },
];

/**
 * Host's prize setup for THIS game, shown before every game: which prizes are on (players
 * may have joined, so the host can change their mind) and how much each pays. The amounts
 * must add up exactly to the pot (tickets × price).
 */
export function PrizeSetupModal({
  visible,
  pot,
  prizes,
  template,
  saving,
  saveLabel,
  hint,
  onSave,
  onClose,
}: {
  visible: boolean;
  pot: number;
  prizes: GamePrize[];
  /** Room's prize proportions (weights) — used for Auto split. */
  template: Partial<Record<PrizeType, number>>;
  saving?: boolean;
  saveLabel?: string;
  hint?: string;
  onSave: (amounts: Partial<Record<PrizeType, number>>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [enabled, setEnabled] = useState<Set<PrizeType>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setEnabled(new Set(prizes.map((p) => p.prize)));
    setValues(Object.fromEntries(prizes.map((p) => [p.prize, String(Number(p.amount))])));
  }, [visible, prizes]);

  const weightOf = (p: PrizeType) => Number(template[p] ?? prizes.find((x) => x.prize === p)?.weight ?? DEFAULT_WEIGHT[p]);
  const autoSplit = (set: Set<PrizeType> = enabled) => {
    const split = splitPot(pot, [...set].map((p) => ({ prize: p, weight: weightOf(p) })));
    setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(split).map(([k, a]) => [k, String(a)])) }));
  };

  const toggle = (p: PrizeType, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(p);
    else next.delete(p);
    setEnabled(next);
    autoSplit(next);
  };

  const total = useMemo(() => sumAmounts([...enabled].map((p) => Number(values[p]) || 0)), [enabled, values]);
  const matches = Math.abs(total - pot) < 0.005;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <T variant="h1">{t('lobby.prizeSetupTitle')}</T>
          {hint ? (
            <T variant="small" muted style={{ marginTop: 2 }}>
              {hint}
            </T>
          ) : null}
          <Row style={[styles.totalBar, { backgroundColor: matches ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)' }]}>
            <T variant="smallBold" color={matches ? colors.success : colors.error} style={{ flex: 1 }}>
              {t('lobby.amountsTotal', { total: formatRupees(total), pot: formatRupees(pot) })}
            </T>
            <Button title={t('lobby.autoSplit')} small variant="secondary" icon="git-compare" onPress={() => autoSplit()} />
          </Row>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {GROUPS.map((g) => (
              <View key={g.key} style={{ marginTop: spacing.md }}>
                <T variant="smallBold" muted style={styles.groupLabel}>
                  {t(g.key)}
                </T>
                {g.prizes.map((p) => {
                  const on = enabled.has(p);
                  const locked = p === 'full_house';
                  return (
                    <Row key={p} style={[styles.row, { borderColor: on ? colors.primary : colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <T variant="bodyMedium">{t(`prizes.${p}`)}</T>
                        <T variant="tiny" muted numberOfLines={1}>
                          {t(`prizes.desc.${p}`)}
                        </T>
                      </View>
                      {on ? (
                        <View style={[styles.input, { borderColor: colors.gold }]}>
                          <T variant="smallBold" color={colors.goldDark}>
                            ₹
                          </T>
                          <TextInput
                            value={values[p] ?? '0'}
                            onChangeText={(v) => setValues((s) => ({ ...s, [p]: v.replace(/[^0-9.]/g, '').slice(0, 9) }))}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            style={[styles.inputText, centeredInput, { color: colors.text }]}
                          />
                        </View>
                      ) : null}
                      {locked ? null : <Toggle value={on} onValueChange={(v) => toggle(p, v)} />}
                    </Row>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {!matches ? (
            <T variant="small" color={colors.error} style={{ marginTop: spacing.sm }}>
              {t('lobby.amountsMustMatch', { pot: formatRupees(pot) })}
            </T>
          ) : null}
          <Button
            title={saveLabel ?? t('common.save')}
            icon="checkmark"
            variant="gold"
            style={{ marginTop: spacing.md }}
            loading={saving}
            disabled={!matches}
            onPress={() => onSave(Object.fromEntries([...enabled].map((p) => [p, Number(values[p]) || 0])))}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.sm },
  totalBar: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, gap: spacing.sm },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  row: { gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1.5, borderRadius: radius.md, marginBottom: 6 },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 8, width: 100, height: 42 },
  inputText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, height: 42, paddingHorizontal: 4 },
});
