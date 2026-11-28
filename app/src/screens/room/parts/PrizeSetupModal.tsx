import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { formatRupees } from '@/components/Money';
import { Button, centeredInput, Row, T, Toggle } from '@/components/ui';
import { balanceFullHouse, splitPotWhole, sumAmounts } from '@/game/engine/split';
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
 * An amount box: the first tap selects the old amount (so typing replaces it); after that typing
 * goes on normally — Android kept the whole text selected after each change, so typing 1 then 0
 * replaced the 1 ("0" instead of "10").
 */
function AmountInput({ value, onChange, onFocus, style }: { value: string; onChange: (v: string) => void; onFocus: () => void; style: React.ComponentProps<typeof TextInput>['style'] }) {
  const [sel, setSel] = useState<{ start: number; end: number } | undefined>(undefined);
  return (
    <TextInput
      value={value}
      selection={sel}
      onFocus={() => {
        setSel({ start: 0, end: value.length });
        onFocus();
      }}
      onChangeText={(v) => {
        setSel(undefined);
        onChange(v);
      }}
      onBlur={() => setSel(undefined)}
      keyboardType="decimal-pad"
      style={style}
    />
  );
}

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
  /** One amount for every line / every column (host's choice). */
  const [same, setSame] = useState<{ lines: boolean; columns: boolean }>({ lines: false, columns: false });

  useEffect(() => {
    if (!visible) return;
    setEnabled(new Set(prizes.map((p) => p.prize)));
    setValues(Object.fromEntries(prizes.map((p) => [p.prize, String(Number(p.amount))])));
  }, [visible, prizes]);

  const weightOf = (p: PrizeType) => Number(template[p] ?? prizes.find((x) => x.prize === p)?.weight ?? DEFAULT_WEIGHT[p]);
  /** Auto split (button): whole rupees by the room's proportions, the rest to Full Housie. */
  const autoSplit = (set: Set<PrizeType> = enabled) => {
    const split = splitPotWhole(
      pot,
      [...set].map((p) => ({ prize: p, weight: weightOf(p) })),
    );
    setValues((v) => ({
      ...v,
      ...Object.fromEntries(Object.entries(split).map(([k, a]) => [k, String(a)])),
    }));
  };

  /**
   * Switching prizes on/off keeps every amount the host set: a prize switched off gives its
   * amount back to Full Housie; one switched on gets a whole-rupee share taken from Full Housie.
   */
  const applyEnabled = (next: Set<PrizeType>) => {
    const suggested = splitPotWhole(
      pot,
      [...next].map((p) => ({ prize: p, weight: weightOf(p) })),
    );
    const amounts: Partial<Record<PrizeType, number>> = {};
    next.forEach((p) => {
      amounts[p] = enabled.has(p) ? Number(values[p]) || 0 : (suggested[p] ?? 0);
    });
    const balanced = balanceFullHouse(pot, amounts);
    setEnabled(next);
    setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(balanced).map(([k, a]) => [k, String(a)])) }));
  };

  /** Section switch: off removes the whole section; on brings back its usual prizes. */
  const toggleGroup = (g: (typeof GROUPS)[number], on: boolean) => {
    const next = new Set(enabled);
    g.prizes.forEach((p) => next.delete(p));
    if (on) g.firstOn.forEach((p) => next.add(p));
    applyEnabled(next);
  };

  const toggle = (p: PrizeType, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(p);
    else next.delete(p);
    applyEnabled(next);
  };

  /** Typing a prize's amount: Full Housie takes the balance (typing Full Housie itself just sets it). */
  const setAmount = (p: PrizeType, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '').slice(0, 9);
    const group: PrizeType[] | null = same.lines && LINE_PRIZES.includes(p) ? LINE_PRIZES : same.columns && COLUMN_PRIZES.includes(p) ? COLUMN_PRIZES : null;
    setValues((cur) => {
      const nextValues = { ...cur, [p]: clean };
      if (group) group.forEach((x) => enabled.has(x) && (nextValues[x] = clean));
      if (p === 'full_house' || !enabled.has('full_house')) return nextValues;
      const amounts = Object.fromEntries([...enabled].map((x) => [x, Number(nextValues[x]) || 0])) as Partial<
        Record<PrizeType, number>
      >;
      return { ...nextValues, full_house: String(balanceFullHouse(pot, amounts).full_house ?? 0) };
    });
  };

  const toggleSame = (key: 'lines' | 'columns') => {
    const on = !same[key];
    setSame((x) => ({ ...x, [key]: on }));
    if (!on) return;
    const list = (key === 'lines' ? LINE_PRIZES : COLUMN_PRIZES).filter((x) => enabled.has(x));
    if (!list.length) return;
    const v = values[list[0]] ?? '0';
    setValues((cur) => {
      const nextValues = { ...cur };
      list.forEach((x) => (nextValues[x] = v));
      if (!enabled.has('full_house')) return nextValues;
      const amounts = Object.fromEntries([...enabled].map((x) => [x, Number(nextValues[x]) || 0])) as Partial<Record<PrizeType, number>>;
      return { ...nextValues, full_house: String(balanceFullHouse(pot, amounts).full_house ?? 0) };
    });
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
  const over = !matches && total > pot;
  const diff = Math.round(Math.abs(total - pot) * 100) / 100;
  const meterColor = matches ? colors.success : over ? colors.error : '#D97706';

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
          {/* Pot meter: prizes vs pot, with a bar and a plain-words status. */}
          <View style={[styles.meter, { borderColor: meterColor, backgroundColor: colors.surfaceAlt }]}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ flexShrink: 1 }}>
                <T variant="tiny" muted style={{ letterSpacing: 1 }}>
                  {t('lobby.prizesLabel').toUpperCase()}
                </T>
                <T variant="h2" color={meterColor}>
                  {formatRupees(total)}
                  <T variant="h3" muted>
                    {'  /  '}
                    {formatRupees(pot)}
                  </T>
                </T>
              </View>
              <Button title={t('lobby.autoSplit')} small variant="secondary" icon="git-compare" onPress={() => autoSplit()} />
            </Row>
            <View style={[styles.meterTrack, { backgroundColor: colors.border }]}>
              <View
                style={{
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: meterColor,
                  width: `${pot > 0 ? Math.min(100, (total / pot) * 100) : 0}%`,
                }}
              />
            </View>
            <Row gap={6}>
              <Ionicons name={matches ? 'checkmark-circle' : over ? 'alert-circle' : 'information-circle'} size={16} color={meterColor} />
              <T variant="smallBold" color={meterColor} style={{ flex: 1 }}>
                {matches
                  ? t('lobby.potMatched')
                  : over
                    ? t('lobby.potOver', { amount: formatRupees(diff) })
                    : t('lobby.potUnder', { amount: formatRupees(diff) })}
              </T>
            </Row>
            <T variant="tiny" muted>
              {t('lobby.fullHouseBalanceNote')}
            </T>
          </View>

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
                      <Toggle value={groupOn} onDark={groupOn} onValueChange={(v) => toggleGroup(g, v)} />
                    )}
                  </Row>
                  {groupOn ? (
                    <View style={{ padding: spacing.sm, paddingBottom: 2 }}>
                      {(g.key === 'lines' || g.key === 'columns') && g.prizes.filter((x) => enabled.has(x)).length > 1 ? (
                        <Pressable onPress={() => toggleSame(g.key as 'lines' | 'columns')} style={[styles.sameRow, { borderColor: colors.border }]} accessibilityRole="checkbox" accessibilityState={{ checked: same[g.key as 'lines' | 'columns'] }}>
                          <Ionicons name={same[g.key as 'lines' | 'columns'] ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                          <T variant="smallBold" style={{ flex: 1 }}>
                            {t(g.key === 'lines' ? 'prizeSetup.sameLines' : 'prizeSetup.sameColumns')}
                          </T>
                        </Pressable>
                      ) : null}
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
                                <AmountInput
                                  value={values[p] ?? '0'}
                                  onChange={(v) => setAmount(p, v)}
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
            <T variant="small" color={meterColor} style={{ marginTop: spacing.sm }}>
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
  sameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: radius.md, marginBottom: 6 },
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
  meter: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: 8,
  },
  meterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
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
