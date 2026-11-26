import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CoinIcon } from '@/components/CoinIcon';
import { Button, Card, centeredInput, Chip, IconButton, Row, Stepper, T, TextField, Toggle } from '@/components/ui';
import { formatRupees } from '@/components/Money';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import { claimRule, ClaimRule, HintMode, RoomState, RoomVisibility } from '@/types/api';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/** A small − value + control. */
function MiniStepper({
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  display: string;
}) {
  const { colors } = useThemeColors();
  const btn = (icon: 'remove' | 'add', disabled: boolean, next: number) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.miniBtn, { backgroundColor: disabled ? 'transparent' : colors.primary + '1F', opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={15} color={disabled ? colors.border : colors.primary} />
    </Pressable>
  );
  return (
    <View style={[styles.mini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {btn('remove', value <= min, Math.max(min, value - step))}
      <T variant="smallBold" center style={{ minWidth: 40 }} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
        {display}
      </T>
      {btn('add', value >= max, Math.min(max, value + step))}
    </View>
  );
}

/** One compact setting line: small icon, name + what the value means, control on the right. */
function OptionRow({
  icon,
  color,
  title,
  meaning,
  last,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  meaning: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.optRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.optDot, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="smallBold">{title}</T>
        <T variant="tiny" muted numberOfLines={2}>
          {meaning}
        </T>
      </View>
      {children}
    </View>
  );
}

/**
 * The chosen rule's settings, compact and always open under its card: one line each for Time to
 * check and Late claim (Normal) and Auto hint (Normal / Fastest finger), each saying what its
 * value means. Auto has no settings.
 */
export function RuleOptions({
  rule,
  checkSeconds,
  onCheckSeconds,
  lateClaim,
  onLateClaim,
  autoHint,
  onAutoHint,
  hintMode,
  onHintMode,
}: {
  rule: ClaimRule;
  checkSeconds: number;
  onCheckSeconds: (s: number) => void;
  lateClaim: number;
  onLateClaim: (n: number) => void;
  autoHint: boolean;
  onAutoHint: (v: boolean) => void;
  hintMode: HintMode;
  onHintMode: (m: HintMode) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  if (rule === 'auto') return null;
  const normal = rule === 'normal';
  return (
    <View style={[styles.attached, { backgroundColor: colors.surfaceAlt }]}>
      {normal ? (
        <>
          <OptionRow
            icon="hourglass"
            color="#7C3AED"
            title={t('create.checkTime')}
            meaning={checkSeconds === 0 ? t('create.checkMeansReady') : t('create.checkMeansSeconds', { count: checkSeconds })}
          >
            <MiniStepper value={checkSeconds} min={0} max={60} step={5} onChange={onCheckSeconds} display={checkSeconds === 0 ? t('create.untilReadyShort') : `${checkSeconds}s`} />
          </OptionRow>
          <OptionRow
            icon="time"
            color="#D97706"
            title={t('create.lateClaim')}
            meaning={lateClaim === 0 ? t('create.lateClaimOffDesc') : t('create.lateClaimOnDesc', { count: lateClaim })}
          >
            <MiniStepper value={lateClaim} min={0} max={90} step={1} onChange={onLateClaim} display={lateClaim === 0 ? t('common.off') : String(lateClaim)} />
          </OptionRow>
        </>
      ) : null}
      <OptionRow
        icon="bulb"
        color="#DB2777"
        title={t('create.autoHint')}
        meaning={!autoHint ? t('create.autoHintDesc') : hintMode === 'next' ? t('create.hintNextShort') : t('create.hintStruckShort')}
        last={!autoHint}
      >
        <Toggle value={autoHint} onValueChange={onAutoHint} />
      </OptionRow>
      {autoHint ? (
        <View style={[styles.hintSeg, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['next', 'struck'] as const).map((m) => {
            const on = hintMode === m;
            return (
              <Pressable
                key={m}
                onPress={() => onHintMode(m)}
                style={[styles.hintSegItem, on && { backgroundColor: colors.primary }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={m === 'next' ? 'flash' : 'layers'} size={13} color={on ? '#fff' : colors.textMuted} />
                <T variant="tiny" color={on ? '#fff' : colors.text} numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                  {m === 'next' ? t('create.hintNext') : t('create.hintStruck')}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const RULE_ICONS: Record<ClaimRule, keyof typeof Ionicons.glyphMap> = {
  normal: 'shield-checkmark',
  fastest: 'flash',
  auto: 'hardware-chip',
};

/** Normal / Fastest finger / Auto as full-width cards; Normal's text shows the chosen check time. */
export function RulePicker({
  value,
  onChange,
  checkSeconds,
  options,
}: {
  value: ClaimRule;
  onChange: (r: ClaimRule) => void;
  checkSeconds: number;
  /** The chosen rule's settings, drawn joined under its card (Auto has none). */
  options?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const time = checkSeconds === 0 ? t('create.untilReadyLower') : t('common.seconds', { count: checkSeconds });
  // All three rules one under another (nothing hidden off-screen); the chosen one glows.
  return (
    <View style={{ gap: spacing.sm }}>
      {(['normal', 'fastest', 'auto'] as ClaimRule[]).map((m) => {
        const active = value === m;
        const hasSettings = m !== 'auto';
        const joined = active && hasSettings && !!options;
        const body = (
          <Row gap={spacing.md}>
            <View style={[styles.optIcon, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surface }]}>
              <Ionicons name={RULE_ICONS[m]} size={19} color={active ? '#fff' : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <T variant="h3" color={active ? '#fff' : colors.text}>
                  {t(`create.rule_${m}`)}
                </T>
                {m === 'normal' ? (
                  <View style={[styles.recommended, { backgroundColor: active ? 'rgba(253,230,138,0.25)' : colors.surface }]}>
                    <T variant="tiny" color={active ? '#FDE68A' : colors.primary}>
                      {t('create.recommended')}
                    </T>
                  </View>
                ) : null}
              </Row>
              <T variant="tiny" color={active ? 'rgba(255,255,255,0.88)' : colors.textMuted}>
                {m === 'normal' ? t('create.rule_normal_desc', { time }) : t(`create.rule_${m}_desc`)}
              </T>
              {hasSettings && !active ? (
                <Row gap={4} style={{ marginTop: 4 }}>
                  <Ionicons name="settings-outline" size={12} color={colors.primary} />
                  <T variant="tiny" color={colors.primary}>
                    {t('create.hasSettings')}
                  </T>
                </Row>
              ) : null}
            </View>
            <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={active ? '#FDE68A' : colors.textMuted} />
          </Row>
        );
        const card = (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => pressed && { opacity: 0.85 }}
          >
            {active ? (
              <LinearGradient
                colors={heroGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ruleCard, { borderColor: '#FDE68A' }, joined && styles.ruleCardJoined]}
              >
                {body}
              </LinearGradient>
            ) : (
              <View style={[styles.ruleCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>{body}</View>
            )}
          </Pressable>
        );
        // The selected rule and its settings form one joined block.
        return joined ? (
          <View key={m}>
            {card}
            {options}
          </View>
        ) : (
          card
        );
      })}
    </View>
  );
}

/**
 * Auto hint kind as two side-by-side cards with a tiny preview: the newest number only, until
 * the next call (default), or every called number until struck. The chosen card glows.
 */
export function HintModePicker({ value, onChange }: { value: HintMode; onChange: (m: HintMode) => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const opts: { m: HintMode; icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; glow: number[] }[] = [
    { m: 'next', icon: 'flash', title: t('create.hintNext'), desc: t('create.hintNextShort'), glow: [2] },
    { m: 'struck', icon: 'layers', title: t('create.hintStruck'), desc: t('create.hintStruckShort'), glow: [0, 1, 2] },
  ];
  return (
    <Row gap={spacing.sm} style={{ marginTop: spacing.sm, alignItems: 'stretch' }}>
      {opts.map((o) => {
        const on = value === o.m;
        return (
          <Pressable
            key={o.m}
            onPress={() => onChange(o.m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.hintCard,
              { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '14' : colors.surface },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={[styles.hintIcon, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}>
                <Ionicons name={o.icon} size={13} color={on ? '#fff' : colors.textMuted} />
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.primary : colors.textMuted} />
            </Row>
            {/* Mini preview: three called numbers, the glowing ones lit. */}
            <Row gap={4} style={{ marginTop: 6 }}>
              {[0, 1, 2].map((i) => {
                const lit = o.glow.includes(i);
                return (
                  <View
                    key={i}
                    style={[
                      styles.hintDot,
                      { backgroundColor: lit ? colors.primary : colors.surfaceAlt, borderColor: lit ? colors.primary : colors.border },
                    ]}
                  />
                );
              })}
            </Row>
            <T variant="smallBold" color={on ? colors.primary : colors.text} style={{ marginTop: 6 }} numberOfLines={2}>
              {o.title}
            </T>
            <T variant="tiny" muted numberOfLines={2}>
              {o.desc}
            </T>
          </Pressable>
        );
      })}
    </Row>
  );
}

function SummaryItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.item, { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <T variant="tiny" muted numberOfLines={1}>
          {label}
        </T>
        <T variant="smallBold" numberOfLines={1}>
          {value}
        </T>
      </View>
    </View>
  );
}

/** The room's current settings, shown to everyone in the lobby; the host can edit them. */
export function RoomSettingsCard({ state, isHost }: { state: RoomState; isHost: boolean }) {
  const { t } = useTranslation();
  const { room } = state;
  const [editing, setEditing] = useState(false);
  const rule = claimRule(room);
  const canEdit = isHost && state.game?.status === 'lobby' && room.status === 'open';
  return (
    <Card style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Ionicons name="options" size={20} color={undefined} />
          <T variant="h3">{t('lobby.roomSettings')}</T>
        </Row>
        {canEdit ? (
          <Button title={t('lobby.editSettings')} small variant="secondary" icon="create-outline" onPress={() => setEditing(true)} />
        ) : null}
      </Row>
      <View style={styles.grid}>
        <SummaryItem icon={RULE_ICONS[rule]} label={t('create.claimRule')} value={t(`create.rule_${rule}`)} />
        {rule === 'normal' ? (
          <SummaryItem
            icon="hourglass"
            label={t('create.checkTime')}
            value={room.checkSeconds === 0 ? t('create.untilReady') : t('common.seconds', { count: room.checkSeconds })}
          />
        ) : null}
        {rule === 'normal' ? (
          <SummaryItem
            icon="time"
            label={t('create.lateClaim')}
            value={room.lateClaimCalls > 0 ? t('create.lateClaimValue', { count: room.lateClaimCalls }) : t('common.off')}
          />
        ) : null}
        <SummaryItem
          icon={room.stakeMode === 'coins' ? 'logo-bitcoin' : room.stakeMode === 'free' ? 'gift' : 'pricetag'}
          label={t('create.stakeTitle')}
          value={room.stakeMode === 'free' ? t('create.stake_free') : `${t(`create.stake_${room.stakeMode}`)} · ${formatRupees(room.ticketPrice)}`}
        />
        <SummaryItem icon="layers" label={t('create.maxTickets')} value={String(room.maxTickets ?? 3)} />
        <SummaryItem icon="people" label={t('create.maxPlayers')} value={String(room.maxPlayers)} />
        <SummaryItem
          icon={room.visibility === 'public' ? 'earth' : 'lock-closed'}
          label={t('create.visibility')}
          value={t(`visibility.${room.visibility}`)}
        />
        {rule === 'auto' ? null : (
          <SummaryItem
            icon="bulb"
            label={t('create.autoHint')}
            value={!room.autoMark ? t('common.off') : room.hintMode === 'next' ? t('create.hintNext') : t('create.hintStruck')}
          />
        )}
        <SummaryItem icon="chatbubbles" label={t('create.chat')} value={room.chatEnabled ? t('common.on') : t('common.off')} />
        <SummaryItem icon="timer-outline" label={t('game.speedTitle')} value={t('common.seconds', { count: room.callIntervalSeconds })} />
        {room.kind === 'series' ? (
          <SummaryItem
            icon="layers"
            label={t('create.seriesGames')}
            value={room.seriesLength > 0 ? String(room.seriesLength) : t('create.noLimit')}
          />
        ) : null}
      </View>
      {canEdit ? <RoomSettingsModal visible={editing} state={state} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}

/** Host edits the room while the lobby is open; everyone gets the new settings live. */
export function RoomSettingsModal({ visible, state, onClose }: { visible: boolean; state: RoomState; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { room } = state;
  const priceLocked = (state.game?.ticketCount ?? 0) > 0;

  const [title, setTitle] = useState(room.title);
  const [visibility, setVisibility] = useState<RoomVisibility>(room.visibility);
  const [maxPlayers, setMaxPlayers] = useState(room.maxPlayers);
  const [price, setPrice] = useState(String(Number(room.ticketPrice)));
  const [rule, setRule] = useState<ClaimRule>(claimRule(room));
  const [checkSeconds, setCheckSeconds] = useState(room.checkSeconds);
  const [autoHint, setAutoHint] = useState(room.autoMark);
  const [hintMode, setHintMode] = useState<HintMode>(room.hintMode ?? 'next');
  const [chat, setChat] = useState(room.chatEnabled);
  const [lateClaim, setLateClaim] = useState(room.lateClaimCalls ?? 0);
  const [speed, setSpeed] = useState(room.callIntervalSeconds);
  const [stake, setStake] = useState<'free' | 'coins' | 'amount'>(room.stakeMode ?? 'amount');
  const [maxTickets, setMaxTickets] = useState(room.maxTickets ?? 3);
  const isSeries = room.kind === 'series';
  /** Series: 0 = no limit; the game in the lobby is number gamesPlayed + 1. */
  const [limitGames, setLimitGames] = useState(room.seriesLength > 0);
  const minGames = Math.max(2, room.gamesPlayed + 1);
  const [seriesGames, setSeriesGames] = useState(Math.max(minGames, room.seriesLength || 5));

  // Fresh values every time it opens.
  useEffect(() => {
    if (!visible) return;
    setTitle(room.title);
    setVisibility(room.visibility);
    setMaxPlayers(room.maxPlayers);
    setPrice(String(Number(room.ticketPrice)));
    setRule(claimRule(room));
    setCheckSeconds(room.checkSeconds);
    setAutoHint(room.autoMark);
    setHintMode(room.hintMode ?? 'next');
    setChat(room.chatEnabled);
    setLateClaim(room.lateClaimCalls ?? 0);
    setSpeed(room.callIntervalSeconds);
    setStake(room.stakeMode ?? 'amount');
    setMaxTickets(room.maxTickets ?? 3);
    setLimitGames(room.seriesLength > 0);
    setSeriesGames(Math.max(minGames, room.seriesLength || 5));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      roomService.updateSettings(room.id, {
        title: title.trim() || room.title,
        visibility,
        maxPlayers,
        ticketPrice: stake === 'free' ? 0 : stake === 'coins' ? Math.round(Number(price) || 0) : Number(price) || 0,
        rule,
        checkSeconds,
        autoMark: autoHint,
        hintMode,
        chatEnabled: chat,
        lateClaimCalls: rule === 'normal' ? lateClaim : 0,
        callIntervalSeconds: speed,
        stakeMode: stake,
        maxTickets,
        seriesLength: isSeries ? (limitGames ? seriesGames : 0) : undefined,
      }, {
        lateClaimCalls: room.lateClaimCalls ?? 0,
        callIntervalSeconds: room.callIntervalSeconds,
        seriesLength: room.seriesLength,
        stakeMode: room.stakeMode ?? 'amount',
        maxTickets: room.maxTickets ?? 3,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKey(room.id) });
      showToast({ variant: 'success', title: t('lobby.settingsSaved') });
      onClose();
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: spacing.lg + insets.bottom }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{t('lobby.editSettings')}</T>
            <IconButton icon="close" onPress={onClose} />
          </Row>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextField label={t('create.roomName')} value={title} onChangeText={setTitle} maxLength={40} />

            <T variant="smallBold" muted style={styles.label}>
              {t('create.claimRule')}
            </T>
            <RulePicker
              value={rule}
              onChange={setRule}
              checkSeconds={checkSeconds}
              options={
                <RuleOptions
                  rule={rule}
                  checkSeconds={checkSeconds}
                  onCheckSeconds={setCheckSeconds}
                  lateClaim={lateClaim}
                  onLateClaim={setLateClaim}
                  autoHint={autoHint}
                  onAutoHint={setAutoHint}
                  hintMode={hintMode}
                  onHintMode={setHintMode}
                />
              }
            />

            {/* Play for: Free / Coins / ₹ for fun (locked once anyone has tickets). */}
            <T variant="smallBold" muted style={styles.label}>
              {t('create.stakeTitle')}
            </T>
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap', opacity: priceLocked ? 0.5 : 1 }}>
              {(['free', 'coins', 'amount'] as const).map((m) => (
                <Chip key={m} label={t(`create.stake_${m}`)} active={stake === m} onPress={() => !priceLocked && setStake(m)} />
              ))}
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('create.maxTickets')}</T>
                <T variant="tiny" muted>
                  {t('create.maxTicketsDesc')}
                </T>
              </View>
              <Stepper value={maxTickets} min={1} max={10} onChange={setMaxTickets} width={44} />
            </Row>

            {stake === 'free' ? null : (
            <>
            <T variant="smallBold" muted style={styles.label}>
              {stake === 'coins' ? t('create.ticketPriceCoins') : t('create.ticketPrice')}
            </T>
            <View style={[styles.priceBox, { borderColor: colors.gold, opacity: priceLocked ? 0.5 : 1 }]}>
              {stake === 'coins' ? (
                <CoinIcon size={26} />
              ) : (
                <T variant="h2" color={colors.goldDark}>
                  ₹
                </T>
              )}
              <TextInput
                value={price}
                editable={!priceLocked}
                onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, '').slice(0, 8))}
                keyboardType="decimal-pad"
                style={[styles.priceInput, centeredInput, { color: colors.text }]}
              />
            </View>
            </>
            )}
            {priceLocked ? (
              <T variant="tiny" muted style={{ marginTop: 4 }}>
                {t('lobby.priceLocked')}
              </T>
            ) : null}

            <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
              <T variant="bodyMedium">{t('create.maxPlayers')}</T>
              <Stepper value={maxPlayers} min={Math.max(2, room.memberCount)} max={100} onChange={setMaxPlayers} width={44} />
            </Row>

            {/* Caller speed: seconds between numbers (the host can also change it during a game). */}
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('game.speedTitle')}</T>
                <T variant="tiny" muted>
                  {t('create.speedDesc', { count: speed })}
                </T>
              </View>
              <Stepper value={speed} min={1} max={10} onChange={setSpeed} width={44} />
            </Row>

            {isSeries ? (
              <>
                <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyMedium">{t('create.limitGames')}</T>
                    <T variant="tiny" muted>
                      {limitGames ? t('create.limitGamesOn', { count: seriesGames }) : t('create.limitGamesOff')}
                    </T>
                  </View>
                  <Toggle value={limitGames} onValueChange={setLimitGames} />
                </Row>
                {limitGames ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <T variant="bodyMedium">{t('create.seriesGames')}</T>
                    <Stepper value={seriesGames} min={minGames} max={50} onChange={setSeriesGames} width={44} />
                  </Row>
                ) : null}
              </>
            ) : null}

            <T variant="smallBold" muted style={styles.label}>
              {t('create.visibility')}
            </T>
            <Row gap={spacing.sm}>
              {(['private', 'public'] as RoomVisibility[]).map((v) => (
                <Chip key={v} label={t(`visibility.${v}`)} active={visibility === v} onPress={() => setVisibility(v)} />
              ))}
            </Row>

            <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
              <T variant="bodyMedium">{t('create.chat')}</T>
              <Toggle value={chat} onValueChange={setChat} />
            </Row>
          </ScrollView>
          <Button
            title={t('common.save')}
            icon="checkmark"
            variant="gold"
            style={{ marginTop: spacing.md }}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  optRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  optDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mini: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, padding: 2 },
  miniBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hintSeg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 3, marginBottom: 4 },
  hintSegItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 999 },
  setCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  setIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  presetRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  preset: { height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, padding: 3 },
  pillBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hintCard: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.sm },
  hintIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hintDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  group: { padding: spacing.md, borderWidth: 2 },
  // Every rule card the same size, side by side.
  ruleCard: { padding: spacing.md, borderWidth: 2, borderRadius: radius.lg },
  ruleCardJoined: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  attached: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#FDE68A',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  valueChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  recommended: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  optIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  optIconSm: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optLine: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(124,58,237,0.25)' },
  // Two 48% tiles per row spread evenly (no fixed column gap), so they never drop to one column.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, justifyContent: 'space-between' },
  item: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '92%' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    width: 140,
    height: 52,
  },
  priceInput: { flex: 1, fontFamily: fonts.bold, fontSize: 22, height: 52, paddingHorizontal: 4 },
});
