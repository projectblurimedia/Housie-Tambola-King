import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, centeredInput, Chip, Row, Screen, Spacer, Stepper, T, TextField, Toggle } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { COLUMN_PRIZES, FAST_PRIZES, LINE_PRIZES, PrizeType } from '@/game/engine/ticket';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ClaimMode, RoomKind, RoomVisibility } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';

/**
 * Prize amounts are NOT asked here — nobody knows yet how many tickets people will take.
 * The host sets them in the lobby right before each game, against the real pot. These
 * hidden weights only shape the suggested split there (Full Housie gets the biggest share).
 */
const DEFAULT_WEIGHTS: Record<PrizeType, number> = {
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
const PRICE_PRESETS = [5, 10, 20, 50, 100];
const ROOM_SPEEDS = [3, 4, 5, 6, 7, 8, 9, 10];

type Group = 'fast' | 'lines' | 'columns';
const GROUP_PRIZES: Record<Group, PrizeType[]> = { fast: FAST_PRIZES, lines: LINE_PRIZES, columns: COLUMN_PRIZES };

function PrizeGroup({
  title,
  desc,
  on,
  onToggle,
  prizes,
  selected,
  onPick,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  prizes: PrizeType[];
  selected: Set<PrizeType>;
  onPick: (p: PrizeType) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Card style={[styles.group, on && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
      <Row>
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="tiny" muted>
            {desc}
          </T>
        </View>
        <Toggle value={on} onValueChange={onToggle} />
      </Row>
      {on ? (
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.md }}>
          {prizes.map((p) => (
            <Chip key={p} label={t(`prizes.${p}`)} active={selected.has(p)} onPress={() => onPick(p)} />
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

export function CreateRoomScreen({ navigation }: ScreenProps<'CreateRoom'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RoomKind>('normal');
  const [seriesLength, setSeriesLength] = useState(5);
  /** Off = no limit: the series runs until the host taps End series. */
  const [limitGames, setLimitGames] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [price, setPrice] = useState('10');
  const [speed, setSpeed] = useState(3);
  const [claimMode, setClaimMode] = useState<ClaimMode>('fastest');
  const [autoMark, setAutoMark] = useState(false);
  const [groupsOn, setGroupsOn] = useState<Record<Group, boolean>>({ fast: true, lines: true, columns: true });
  const [selected, setSelected] = useState<Set<PrizeType>>(new Set<PrizeType>(['fast_5', ...LINE_PRIZES, ...COLUMN_PRIZES]));
  const [loading, setLoading] = useState(false);

  const pick = (group: Group) => (p: PrizeType) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) {
        // Keep at least one choice in a group that is switched on.
        if (GROUP_PRIZES[group].filter((x) => next.has(x)).length > 1) next.delete(p);
      } else next.add(p);
      return next;
    });

  const toggleGroup = (group: Group) => (v: boolean) => {
    setGroupsOn((g) => ({ ...g, [group]: v }));
    if (v && !GROUP_PRIZES[group].some((p) => selected.has(p))) {
      setSelected((s) => new Set([...s, group === 'fast' ? 'fast_5' : GROUP_PRIZES[group][0]]));
    }
  };

  const chosen: PrizeType[] = [
    ...(Object.keys(GROUP_PRIZES) as Group[]).flatMap((g) => (groupsOn[g] ? GROUP_PRIZES[g].filter((p) => selected.has(p)) : [])),
    'full_house',
  ];
  const priceNum = Number(price);
  const valid = title.trim().length > 0 && Number.isFinite(priceNum) && priceNum >= 0;

  const create = async () => {
    setLoading(true);
    try {
      const { roomId } = await roomService.create({
        title: title.trim(),
        kind,
        visibility,
        maxPlayers,
        ticketPrice: priceNum,
        callIntervalSeconds: speed,
        seriesLength: kind === 'series' ? (limitGames ? seriesLength : 0) : 1,
        prizes: Object.fromEntries(chosen.map((p) => [p, DEFAULT_WEIGHTS[p]])),
        claimMode,
        autoMark,
      });
      qc.invalidateQueries({ queryKey: ['myRooms'] });
      navigation.replace('Room', { roomId });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll title={t('create.title')}>
      <TextField label={t('create.roomName')} value={title} onChangeText={setTitle} placeholder={t('create.roomNamePlaceholder')} maxLength={40} />

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.type')}
      </T>
      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        {(['normal', 'series'] as RoomKind[]).map((k) => (
          <Card key={k} onPress={() => setKind(k)} style={[styles.option, kind === k && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={k === 'series' ? 'layers' : 'grid'} size={24} color={kind === k ? colors.primary : colors.textMuted} />
            <T variant="h3">{t(`kind.${k}`)}</T>
            <T variant="tiny" muted>
              {k === 'series' ? t('create.seriesDesc') : t('create.normalDesc')}
            </T>
          </Card>
        ))}
      </Row>
      {kind === 'series' ? (
        <Card style={[styles.group, { marginTop: spacing.sm }]}>
          <Row>
            <View style={{ flex: 1 }}>
              <T variant="h3">{t('create.limitGames')}</T>
              <T variant="tiny" muted>
                {limitGames ? t('create.limitGamesOn', { count: seriesLength }) : t('create.limitGamesOff')}
              </T>
            </View>
            <Toggle value={limitGames} onValueChange={setLimitGames} />
          </Row>
          {limitGames ? (
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
              <T variant="bodyMedium">{t('create.seriesGames')}</T>
              <Stepper value={seriesLength} min={2} max={50} onChange={setSeriesLength} width={44} />
            </Row>
          ) : null}
        </Card>
      ) : null}

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.visibility')}
      </T>
      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        {(['private', 'public'] as RoomVisibility[]).map((v) => (
          <Card key={v} onPress={() => setVisibility(v)} style={[styles.option, visibility === v && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
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
        <View style={[styles.priceBox, { borderColor: colors.gold, backgroundColor: colors.surface }]}>
          <T variant="h2" color={colors.goldDark}>
            ₹
          </T>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, '').slice(0, 8))}
            keyboardType="decimal-pad"
            style={[styles.priceInput, centeredInput, { color: colors.text }]}
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {ROOM_SPEEDS.map((s) => (
          <Chip key={s} label={t('common.seconds', { count: s })} active={speed === s} onPress={() => setSpeed(s)} />
        ))}
      </ScrollView>

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('create.claimRule')}
      </T>
      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        {(['fastest', 'fair'] as ClaimMode[]).map((m) => (
          <Card key={m} onPress={() => setClaimMode(m)} style={[styles.option, claimMode === m && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={m === 'fastest' ? 'flash' : 'shield-checkmark'} size={24} color={claimMode === m ? colors.primary : colors.textMuted} />
            <T variant="h3">{t(`create.claim_${m}`)}</T>
            <T variant="tiny" muted>
              {t(`create.claim_${m}_desc`)}
            </T>
          </Card>
        ))}
      </Row>
      <Card style={[styles.group, { marginTop: spacing.sm }]}>
        <Row>
          <View style={{ flex: 1 }}>
            <T variant="h3">{t('create.autoMark')}</T>
            <T variant="tiny" muted>
              {t('create.autoMarkDesc')}
            </T>
          </View>
          <Toggle value={autoMark} onValueChange={setAutoMark} />
        </Row>
      </Card>

      <Spacer h={spacing.xl} />
      <T variant="h1">{t('create.prizesTitle')}</T>
      <T variant="small" muted style={{ marginBottom: spacing.md }}>
        {t('create.prizesHelp')}
      </T>
      <View style={{ gap: spacing.sm }}>
        <PrizeGroup
          title={t('create.fastSection')}
          desc={t('create.fastDesc')}
          on={groupsOn.fast}
          onToggle={toggleGroup('fast')}
          prizes={FAST_PRIZES}
          selected={selected}
          onPick={pick('fast')}
        />
        <PrizeGroup
          title={t('create.linesSection')}
          desc={t('create.linesDesc')}
          on={groupsOn.lines}
          onToggle={toggleGroup('lines')}
          prizes={LINE_PRIZES}
          selected={selected}
          onPick={pick('lines')}
        />
        <PrizeGroup
          title={t('create.columnsSection')}
          desc={t('create.columnsDesc')}
          on={groupsOn.columns}
          onToggle={toggleGroup('columns')}
          prizes={COLUMN_PRIZES}
          selected={selected}
          onPick={pick('columns')}
        />
        <Card style={[styles.group, { borderColor: colors.gold }]}>
          <Row>
            <View style={{ flex: 1 }}>
              <T variant="h3">{t('create.fullHouseSection')}</T>
              <T variant="tiny" muted>
                {t('prizes.desc.full_house')}
              </T>
            </View>
            <T variant="tiny" color={colors.goldDark}>
              {t('create.alwaysOn')}
            </T>
          </Row>
        </Card>
      </View>

      <Spacer h={spacing.xl} />
      <Button title={t('create.create')} variant="gold" icon="sparkles" onPress={create} loading={loading} disabled={!valid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  option: { flex: 1, gap: 2, padding: spacing.md, borderWidth: 2 },
  group: { padding: spacing.md, borderWidth: 2 },
  priceBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 10, width: 120, height: 52 },
  priceInput: { flex: 1, fontFamily: fonts.bold, fontSize: 22, height: 52, paddingHorizontal: 4 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
