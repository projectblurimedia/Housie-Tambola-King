import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, centeredInput, Row, Screen, Spacer, Stepper, T, TextField, Toggle } from '@/components/ui';
import { AppIcon } from '@/components/Wordmark';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import type { PrizeType } from '@/game/engine/ticket';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ClaimRule, HintMode, RoomKind, RoomVisibility } from '@/types/api';
import { RuleOptions, RulePicker } from './parts/RoomSettingsModal';
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

/** One numbered step: gradient number badge, title, a one-line "what this is", then its controls. */
function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card style={styles.step}>
      <Row gap={spacing.md} style={{ marginBottom: spacing.md }}>
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <T variant="h3" color="#fff">
            {n}
          </T>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="tiny" muted>
            {hint}
          </T>
        </View>
      </Row>
      {children}
    </Card>
  );
}

/** A choice tile: the selected one glows in the brand gradient with a tick. */
export function ChoiceTile({
  active,
  icon,
  title,
  desc,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  const body = (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={[styles.tileIcon, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surface }]}>
          <Ionicons name={icon} size={20} color={active ? '#fff' : colors.primary} />
        </View>
        <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? '#FDE68A' : colors.textMuted} />
      </Row>
      <T variant="h3" color={active ? '#fff' : colors.text} style={{ marginTop: 8 }}>
        {title}
      </T>
      <T variant="tiny" color={active ? 'rgba(255,255,255,0.85)' : colors.textMuted}>
        {desc}
      </T>
    </>
  );
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      {active ? (
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, { borderColor: '#FDE68A' }]}>
          {body}
        </LinearGradient>
      ) : (
        <View style={[styles.tile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>{body}</View>
      )}
    </Pressable>
  );
}

/** A setting line inside a step: icon, title + description, control on the right. */
function SettingLine({
  icon,
  title,
  desc,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const { colors } = useThemeColors();
  return (
    <Row gap={spacing.md} style={styles.line}>
      <View style={[styles.lineIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyMedium">{title}</T>
        {desc ? (
          <T variant="tiny" muted>
            {desc}
          </T>
        ) : null}
      </View>
      {children}
    </Row>
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
  const [hintMode, setHintMode] = useState<HintMode>('struck');
  // Owner's defaults: check until everyone is ready (0); late claim 2 numbers.
  const [checkSeconds, setCheckSeconds] = useState(0);
  /** Normal rule "Late claim": 0 = off. */
  const [lateClaimCalls, setLateClaimCalls] = useState(2);
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
        hintMode,
        chatEnabled,
        checkSeconds,
        lateClaimCalls,
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
      {/* Banner: what this screen is for. */}
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <AppIcon size={54} />
        <View style={{ flex: 1 }}>
          <T variant="h2" color="#fff">
            {t('create.heroTitle')}
          </T>
          <T variant="small" color="rgba(255,255,255,0.88)">
            {t('create.heroSub')}
          </T>
        </View>
      </LinearGradient>

      <Step n={1} title={t('create.roomName')} hint={t('create.nameHint')}>
        <TextField value={title} onChangeText={setTitle} placeholder={t('create.roomNamePlaceholder')} maxLength={40} />
      </Step>

      <Step n={2} title={t('create.type')} hint={t('create.typeHint')}>
        <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
          {(['normal', 'series'] as RoomKind[]).map((k) => (
            <ChoiceTile
              key={k}
              active={kind === k}
              icon={k === 'series' ? 'layers' : 'grid'}
              title={t(`kind.${k}`)}
              desc={k === 'series' ? t('create.seriesDesc') : t('create.normalDesc')}
              onPress={() => setKind(k)}
            />
          ))}
        </Row>
        {kind === 'series' ? (
          <View style={{ marginTop: spacing.sm }}>
            <SettingLine
              icon="infinite"
              title={t('create.limitGames')}
              desc={limitGames ? t('create.limitGamesOn', { count: seriesLength }) : t('create.limitGamesOff')}
            >
              <Toggle value={limitGames} onValueChange={setLimitGames} />
            </SettingLine>
            {limitGames ? (
              <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
                <T variant="bodyMedium">{t('create.seriesGames')}</T>
                <Stepper value={seriesLength} min={2} max={50} onChange={setSeriesLength} width={44} />
              </Row>
            ) : null}
          </View>
        ) : null}
      </Step>

      <Step n={3} title={t('create.visibility')} hint={t('create.joinHint')}>
        <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
          {(['private', 'public'] as RoomVisibility[]).map((v) => (
            <ChoiceTile
              key={v}
              active={visibility === v}
              icon={v === 'public' ? 'earth' : 'lock-closed'}
              title={t(`visibility.${v}`)}
              desc={v === 'public' ? t('create.publicDesc') : t('create.privateDesc')}
              onPress={() => setVisibility(v)}
            />
          ))}
        </Row>
        <View style={{ marginTop: spacing.sm }}>
          <SettingLine icon="people" title={t('create.maxPlayers')}>
            <Stepper value={maxPlayers} min={2} max={100} onChange={setMaxPlayers} width={44} />
          </SettingLine>
        </View>
      </Step>

      <Step n={4} title={t('create.ticketPrice')} hint={t('create.ticketPriceHelp')}>
        <Row gap={spacing.sm}>
          <View style={[styles.priceBox, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
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
            {PRICE_PRESETS.map((p) => {
              const on = Number(price) === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPrice(String(p))}
                  style={[styles.preset, { backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.gold : colors.border }]}
                >
                  <T variant="smallBold" color={on ? '#fff' : colors.text}>
                    ₹{p}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </Row>
      </Step>

      <Step n={5} title={t('create.claimRule')} hint={t('create.ruleHint')}>
        <RulePicker value={rule} onChange={setRule} checkSeconds={checkSeconds} />
        {/* The rule's options in one dropdown (Auto strikes everything itself — it has none). */}
        <RuleOptions
          rule={rule}
          checkSeconds={checkSeconds}
          onCheckSeconds={setCheckSeconds}
          lateClaim={lateClaimCalls}
          onLateClaim={setLateClaimCalls}
          autoHint={autoHint}
          onAutoHint={setAutoHint}
          hintMode={hintMode}
          onHintMode={setHintMode}
        />
      </Step>

      <Step n={6} title={t('create.extras')} hint={t('create.extrasHint')}>
        <SettingLine icon="chatbubbles" title={t('create.chat')} desc={t('create.chatDesc')}>
          <Toggle value={chatEnabled} onValueChange={setChatEnabled} />
        </SettingLine>
      </Step>

      <Spacer h={spacing.lg} />
      <Button title={t('create.create')} variant="gold" icon="sparkles" onPress={create} loading={loading} disabled={!valid} />
      {!valid ? (
        <T variant="tiny" muted center style={{ marginTop: 6 }}>
          {t('create.nameNeeded')}
        </T>
      ) : null}
      <Spacer h={spacing.lg} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(253,230,138,0.6)',
  },
  step: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1.5 },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, padding: spacing.md, borderWidth: 2, borderRadius: radius.lg, gap: 2 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  line: { paddingVertical: 6 },
  lineIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    width: 120,
    height: 52,
  },
  priceInput: { flex: 1, fontFamily: fonts.bold, fontSize: 22, height: 52, paddingHorizontal: 4 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5 },
});
