import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatRupees } from '@/components/Money';
import { Button, Row, T } from '@/components/ui';
import { splitPot, sumAmounts } from '@/game/engine/split';
import type { PrizeType } from '@/game/engine/ticket';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { GamePrize } from '@/types/api';

/** Host edits this game's prize amounts; they must add up exactly to the pot. */
export function PrizeAmountsModal({
  visible,
  pot,
  prizes,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  pot: number;
  prizes: GamePrize[];
  saving?: boolean;
  onSave: (amounts: Partial<Record<PrizeType, number>>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) setValues(Object.fromEntries(prizes.map((p) => [p.prize, String(Number(p.amount))])));
  }, [visible, prizes]);

  const total = sumAmounts(Object.values(values).map((v) => Number(v) || 0));
  const matches = Math.abs(total - pot) < 0.005;

  const autoSplit = () => {
    const split = splitPot(pot, prizes.map((p) => ({ prize: p.prize, weight: Number(p.weight) })));
    setValues(Object.fromEntries(Object.entries(split).map(([k, v]) => [k, String(v)])));
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <T variant="h1">{t('lobby.amountsTitle')}</T>
          <T variant="smallBold" color={matches ? colors.success : colors.error} style={{ marginTop: 4 }}>
            {t('lobby.amountsTotal', { total: formatRupees(total), pot: formatRupees(pot) })}
          </T>
          <ScrollView style={{ maxHeight: 380, marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
            {prizes.map((p) => (
              <Row key={p.prize} style={[styles.row, { borderColor: colors.border }]}>
                <T variant="bodyMedium" style={{ flex: 1 }}>
                  {t(`prizes.${p.prize}`)}
                </T>
                <View style={[styles.input, { borderColor: colors.gold }]}>
                  <T variant="smallBold" color={colors.goldDark}>
                    ₹
                  </T>
                  <TextInput
                    value={values[p.prize] ?? ''}
                    onChangeText={(v) => setValues((s) => ({ ...s, [p.prize]: v.replace(/[^0-9.]/g, '').slice(0, 9) }))}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={[styles.inputText, { color: colors.text }]}
                  />
                </View>
              </Row>
            ))}
          </ScrollView>
          {!matches ? (
            <T variant="small" color={colors.error} style={{ marginTop: spacing.sm }}>
              {t('lobby.amountsMustMatch', { pot: formatRupees(pot) })}
            </T>
          ) : null}
          <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
            <Button title={t('lobby.autoSplit')} variant="secondary" icon="git-compare" style={{ flex: 1 }} onPress={autoSplit} />
            <Button
              title={t('common.save')}
              icon="checkmark"
              style={{ flex: 1 }}
              loading={saving}
              disabled={!matches}
              onPress={() => onSave(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0])))}
            />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 8, width: 110 },
  inputText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, paddingVertical: 6, paddingHorizontal: 4 },
});
