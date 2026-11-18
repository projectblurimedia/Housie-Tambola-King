import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, centeredInput, Row, Screen, Spacer, Stepper, T, TextField, Toggle } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import type { PrizeType } from '@/game/engine/ticket';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ClaimRule, RoomKind, RoomVisibility } from '@/types/api';
import { CheckTimePicker } from './parts/RoomSettingsModal';
import type { ScreenProps } from '@/navigation/types';

/**
 * Prizes are NOT chosen here: the host switches each prize on/off and sets its amount in the
 * lobby right before every game, against the real pot. This is only the starting set and the
 * weights for the suggested split (Fast 3 / Fast 7 start switched off).
 */
const DEFAULT_PRIZES: Partial<Record<PrizeType, number>> = {
  fast_5: 10,
  line_1: 10,
  line_2: 10,
  line_3: 10,
  col_left: 10,
  col_center: 10,
  col_right: 10,
  full_house: 30,
};
const PRICE_PRESETS = [5, 10, 20, 50, 100];

function OptionToggle({
  icon,
  title,
  desc,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Card style={[styles.group, { marginTop: spacing.sm }, value && { borderColor: colors.primary }]}>
      <Row gap={spacing.md}>
        <View style={[styles.optIcon, { backgroundColor: value ? colors.primary : colors.surfaceAlt }]}>
          <Ionicons name={icon} size={20} color={value ? '#fff' : colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="tiny" muted>
            {desc}
          </T>
        </View>
        <Toggle value={value} onValueChange={onChange} />
      </Row>
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
  const [rule, setRule] = useState<ClaimRule>('normal');
  const [autoHint, setAutoHint] = useState(false);
  /** Normal rule: seconds everyone gets to check after a claim. */
  const [checkSeconds, setCheckSeconds] = useState(10);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

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
        // Default 3 s; the host changes it any time from the game settings.
        callIntervalSeconds: 3,
        seriesLength: kind === 'series' ? (limitGames ? seriesLength : 0) : 1,
        prizes: DEFAULT_PRIZES,
        rule,
        autoMark: autoHint,
        chatEnabled,
        checkSeconds,
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
        {t('create.claimRule')}
      </T>
      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        {(['normal', 'fastest'] as ClaimRule[]).map((m) => (
          <Card key={m} onPress={() => setRule(m)} style={[styles.option, rule === m && { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={m === 'fastest' ? 'flash' : 'shield-checkmark'} size={24} color={rule === m ? colors.primary : colors.textMuted} />
            <T variant="h3">{t(`create.rule_${m}`)}</T>
            <T variant="tiny" muted>
              {t(`create.rule_${m}_desc`)}
            </T>
          </Card>
        ))}
      </Row>
      {rule === 'normal' ? <CheckTimePicker value={checkSeconds} onChange={setCheckSeconds} /> : null}
      <OptionToggle icon="bulb" title={t('create.autoHint')} desc={t('create.autoHintDesc')} value={autoHint} onChange={setAutoHint} />
      <OptionToggle icon="chatbubbles" title={t('create.chat')} desc={t('create.chatDesc')} value={chatEnabled} onChange={setChatEnabled} />

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
  optIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
