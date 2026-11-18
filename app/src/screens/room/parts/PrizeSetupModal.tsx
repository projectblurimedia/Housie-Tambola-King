import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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

type GroupKey = 'fast' | 'lines' | 'columns' | 'fullHouse';
const GROUPS: {
  key: GroupKey;
  icon: keyof typeof Ionicons.glyphMap;
  prizes: PrizeType[];
  firstOn: PrizeType[];
}[] = [
  { key: 'fast', icon: 'flash', prizes: FAST_PRIZES, firstOn: ['fast_5'] },
  {
    key: 'lines',
    icon: 'reorder-three',
    prizes: LINE_PRIZES,
    firstOn: LINE_PRIZES,
  },
  {
    key: 'columns',
    icon: 'grid',
    prizes: COLUMN_PRIZES,
    firstOn: COLUMN_PRIZES,
  },
  {
    key: 'fullHouse',
    icon: 'trophy',
    prizes: ['full_house'],
    firstOn: ['full_house'],
  },
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
    const split = splitPot(
      pot,
      [...set].map((p) => ({ prize: p, weight: weightOf(p) })),
    );
    setValues((v) => ({
      ...v,
      ...Object.fromEntries(Object.entries(split).map(([k, a]) => [k, String(a)])),
    }));
  };

  /** Section switch: off removes the whole section; on brings back its usual prizes. */
  const toggleGroup = (g: (typeof GROUPS)[number], on: boolean) => {
    const next = new Set(enabled);
    g.prizes.forEach((p) => next.delete(p));
    if (on) g.firstOn.forEach((p) => next.add(p));
    setEnabled(next);
    autoSplit(next);
  };

  const toggle = (p: PrizeType, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(p);
    else next.delete(p);
    setEnabled(next);
    autoSplit(next);
  };

  // Keep the focused amount above the keyboard: scroll its row into view once the keyboard is up.
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const groupY = useRef<Record<string, number>>({});
  const rowY = useRef<Partial<Record<PrizeType, { group: string; y: number }>>>({});
  const revealRow = (p: PrizeType) => {
    const row = rowY.current[p];
    if (!row) return;
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(0, (groupY.current[row.group] ?? 0) + row.y - 60),
          animated: true,
        }),
      300,
    );
  };

  const total = useMemo(() => sumAmounts([...enabled].map((p) => Number(values[p]) || 0)), [enabled, values]);
  const matches = Math.abs(total - pot) < 0.005;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The modal window doesn't resize for the keyboard on Android (edge-to-edge), so pad on both. */}
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: spacing.xl + insets.bottom,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <T variant="h1">{t('lobby.prizeSetupTitle')}</T>
          {hint ? (
            <T variant="small" muted style={{ marginTop: 2 }}>
              {hint}
            </T>
          ) : null}
          <Row
            style={[
              styles.totalBar,
              {
                backgroundColor: matches ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
              },
            ]}
          >
            <T variant="smallBold" color={matches ? colors.success : colors.error} style={{ flex: 1 }}>
              {t('lobby.amountsTotal', {
                total: formatRupees(total),
                pot: formatRupees(pot),
              })}
            </T>
            <Button title={t('lobby.autoSplit')} small variant="secondary" icon="git-compare" onPress={() => autoSplit()} />
          </Row>

          <ScrollView
            ref={scrollRef}
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {GROUPS.map((g) => {
              const groupOn = g.prizes.some((p) => enabled.has(p));
              const always = g.key === 'fullHouse';
              return (
                <View
                  key={g.key}
                  style={[styles.group, { borderColor: groupOn ? colors.primary : colors.border }]}
                  onLayout={(e) => (groupY.current[g.key] = e.nativeEvent.layout.y)}
                >
                  <Row
                    style={[
                      styles.groupHead,
                      {
                        backgroundColor: groupOn ? colors.primary : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.groupIcon,
                        {
                          backgroundColor: groupOn ? 'rgba(255,255,255,0.2)' : colors.surface,
                        },
                      ]}
                    >
                      <Ionicons name={g.icon} size={18} color={groupOn ? '#fff' : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="h3" color={groupOn ? '#fff' : colors.text}>
                        {t(`prizeSetup.${g.key}`)}
                      </T>
                      <T variant="tiny" color={groupOn ? 'rgba(255,255,255,0.85)' : colors.textMuted}>
                        {t(`prizeSetup.${g.key}Desc`)}
                      </T>
                    </View>
                    {always ? (
                      <T variant="tiny" color="#FDE68A">
                        {t('prizeSetup.alwaysOn')}
                      </T>
                    ) : (
                      <Toggle value={groupOn} onValueChange={(v) => toggleGroup(g, v)} />
                    )}
                  </Row>
                  {groupOn ? (
                    <View style={{ padding: spacing.sm, paddingBottom: 2 }}>
                      {g.prizes.map((p) => {
                        const on = enabled.has(p);
                        const locked = p === 'full_house';
                        return (
                          <Row
                            key={p}
                            style={[
                              styles.row,
                              {
                                borderColor: on ? colors.primary : colors.border,
                              },
                            ]}
                            onLayout={(e) =>
                              (rowY.current[p] = {
                                group: g.key,
                                y: e.nativeEvent.layout.y,
                              })
                            }
                          >
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
                                  onChangeText={(v) =>
                                    setValues((s) => ({
                                      ...s,
                                      [p]: v.replace(/[^0-9.]/g, '').slice(0, 9),
                                    }))
                                  }
                                  keyboardType="decimal-pad"
                                  selectTextOnFocus
                                  onFocus={() => revealRow(p)}
                                  style={[styles.inputText, centeredInput, { color: colors.text }]}
                                />
                              </View>
                            ) : null}
                            {locked || g.prizes.length === 1 ? null : <Toggle value={on} onValueChange={(v) => toggle(p, v)} />}
                          </Row>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
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
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '92%',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  totalBar: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  group: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  groupHead: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    width: 100,
    height: 42,
  },
  inputText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    height: 42,
    paddingHorizontal: 4,
  },
});
