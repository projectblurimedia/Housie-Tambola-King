import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Header, Row, Screen, Segmented, Spacer, Stepper, T, TextField } from '@/components/ui';
import { formatRupees } from '@/components/Money';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { COLUMN_PRIZES, FAST_PRIZES, LINE_PRIZES, PrizeType } from '@/game/engine/ticket';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { RoomKind, RoomVisibility } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';

/** Defaults: Fast 5 + all three lines + all three columns + Full Housie (template ₹, total 100). */
const DEFAULT_AMOUNTS: Record<PrizeType, number> = {
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
const DEFAULT_ON: PrizeType[] = ['fast_5', ...LINE_PRIZES, ...COLUMN_PRIZES, 'full_house'];
const PRICE_PRESETS = [5, 10, 20, 50, 100];

function PrizeChip({
  prize,
  on,
  amount,
  locked,
  onToggle,
  onAmount,
}: {
  prize: PrizeType;
  on: boolean;
  amount: string;
  locked?: boolean;
  onToggle: () => void;
  onAmount: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <View
      style={[
        styles.prizeRow,
        { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.surfaceAlt : colors.surface },
      ]}
    >
      <Pressable onPress={locked ? undefined : onToggle} style={styles.prizeToggle} hitSlop={6}>
        <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.primary : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{t(`prizes.${prize}`)}</T>
          <T variant="tiny" muted numberOfLines={1}>
            {locked ? t('create.alwaysOn') : t(`prizes.desc.${prize}`)}
          </T>
        </View>
      </Pressable>
      {on ? (
        <View style={[styles.amountBox, { borderColor: colors.gold, backgroundColor: colors.surface }]}>
          <T variant="smallBold" color={colors.goldDark}>
            ₹
          </T>
          <TextInput
            value={amount}
            onChangeText={(v) => onAmount(v.replace(/[^0-9.]/g, '').slice(0, 8))}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: colors.text }]}
            selectTextOnFocus
          />
        </View>
      ) : null}
    </View>
  );
}

export function CreateRoomScreen({ navigation }: ScreenProps<'CreateRoom'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RoomKind>('normal');
  const [seriesLength, setSeriesLength] = useState(5);
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [price, setPrice] = useState('10');
  const [speed, setSpeed] = useState(6);
  const [enabled, setEnabled] = useState<Set<PrizeType>>(new Set(DEFAULT_ON));
  const [amounts, setAmounts] = useState<Record<PrizeType, string>>(
    Object.fromEntries(Object.entries(DEFAULT_AMOUNTS).map(([k, v]) => [k, String(v)])) as Record<PrizeType, string>,
  );
  const [loading, setLoading] = useState(false);

  const toggle = (p: PrizeType) =>
    setEnabled((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const total = [...enabled].reduce((sum, p) => sum + (Number(amounts[p]) || 0), 0);
  const priceNum = Number(price);
  const valid = title.trim().length > 0 && Number.isFinite(priceNum) && priceNum >= 0 && enabled.has('full_house');

  const create = async () => {
    setLoading(true);
    try {
      const prizes = Object.fromEntries([...enabled].map((p) => [p, Number(amounts[p]) || 0]));
      const { roomId } = await roomService.create({
        title: title.trim(),
        kind,
        visibility,
        maxPlayers,
        ticketPrice: priceNum,
        callIntervalSeconds: speed,
        seriesLength: kind === 'series' ? seriesLength : 1,
        prizes,
      });
      qc.invalidateQueries({ queryKey: ['myRooms'] });
      navigation.replace('Room', { roomId });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const section = (label: string, prizes: PrizeType[]) => (
    <>
      <T variant="smallBold" muted style={styles.sectionLabel}>
        {label}
      </T>
      <View style={{ gap: spacing.sm }}>
        {prizes.map((p) => (
          <PrizeChip
            key={p}
            prize={p}
            on={enabled.has(p)}
            amount={amounts[p]}
            locked={p === 'full_house'}
            onToggle={() => toggle(p)}
            onAmount={(v) => setAmounts((a) => ({ ...a, [p]: v }))}
          />
        ))}
      </View>
    </>
  );

  return (
    <Screen scroll>
      <Header title={t('create.title')} />
      <TextField
        label={t('create.roomName')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('create.roomNamePlaceholder')}
        maxLength={40}
      />

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.type')}
      </T>
      <Row gap={spacing.sm}>
        {(['normal', 'series'] as RoomKind[]).map((k) => (
          <Card
            key={k}
            onPress={() => setKind(k)}
            style={[styles.option, kind === k && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name={k === 'series' ? 'layers' : 'grid'} size={24} color={kind === k ? colors.primary : colors.textMuted} />
            <T variant="h3">{t(`kind.${k}`)}</T>
            <T variant="tiny" muted>
              {k === 'series' ? t('create.seriesDesc') : t('create.normalDesc')}
            </T>
          </Card>
        ))}
      </Row>
      {kind === 'series' ? (
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          <T variant="bodyMedium">{t('create.seriesGames')}</T>
          <Stepper value={seriesLength} min={2} max={50} onChange={setSeriesLength} width={44} />
        </Row>
      ) : null}

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.visibility')}
      </T>
      <Row gap={spacing.sm}>
        {(['private', 'public'] as RoomVisibility[]).map((v) => (
          <Card
            key={v}
            onPress={() => setVisibility(v)}
            style={[styles.option, visibility === v && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name={v === 'public' ? 'earth' : 'lock-closed'} size={24} color={visibility === v ? colors.primary : colors.textMuted} />
            <T variant="h3">{t(`visibility.${v}`)}</T>
            <T variant="tiny" muted>
              {v === 'public' ? t('create.publicDesc') : t('create.privateDesc')}
            </T>
          </Card>
        ))}
      </Row>

      <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
        <T variant="bodyMedium">{t('create.maxPlayers')}</T>
        <Stepper value={maxPlayers} min={2} max={100} onChange={setMaxPlayers} width={44} />
      </Row>

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.ticketPrice')}
      </T>
      <Row gap={spacing.sm}>
        <View style={[styles.amountBox, styles.priceBox, { borderColor: colors.gold, backgroundColor: colors.surface }]}>
          <T variant="h2" color={colors.goldDark}>
            ₹
          </T>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, '').slice(0, 8))}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: colors.text, fontSize: 22 }]}
          />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PRICE_PRESETS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPrice(String(p))}
              style={[styles.preset, { backgroundColor: Number(price) === p ? colors.primary : colors.surfaceAlt }]}
            >
              <T variant="smallBold" color={Number(price) === p ? '#fff' : colors.text}>
                {p}
              </T>
            </Pressable>
          ))}
        </View>
      </Row>
      <T variant="tiny" muted style={{ marginTop: 6 }}>
        {t('create.ticketPriceHelp')}
      </T>

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.callSpeed')}
      </T>
      <Segmented
        value={speed}
        onChange={setSpeed}
        options={[
          { value: 4, label: t('create.speedFast') },
          { value: 6, label: t('create.speedNormal') },
          { value: 9, label: t('create.speedSlow') },
        ]}
      />

      <Spacer h={spacing.xl} />
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="h1">{t('create.prizesTitle')}</T>
        <T variant="smallBold" color={colors.goldDark}>
          {t('create.templateTotal', { total: formatRupees(total) })}
        </T>
      </Row>
      <T variant="small" muted>
        {t('create.prizesHelp')}
      </T>
      {section(t('create.fastSection'), FAST_PRIZES)}
      {section(t('create.linesSection'), LINE_PRIZES)}
      {section(t('create.columnsSection'), COLUMN_PRIZES)}
      {section(t('create.fullHouseSection'), ['full_house'])}

      <Spacer h={spacing.xl} />
      <Button title={t('create.create')} variant="gold" icon="sparkles" onPress={create} loading={loading} disabled={!valid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  option: { flex: 1, gap: 2, padding: spacing.md, borderWidth: 2 },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  prizeToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    width: 92,
  },
  priceBox: { width: 120, paddingVertical: 4 },
  amountInput: { flex: 1, fontFamily: fonts.bold, fontSize: 16, paddingVertical: 6, paddingHorizontal: 4 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
