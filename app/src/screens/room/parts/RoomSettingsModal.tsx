import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, centeredInput, Chip, IconButton, Row, Stepper, T, TextField, Toggle } from '@/components/ui';
import { formatRupees } from '@/components/Money';
import { roomKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import { claimRule, ClaimRule, HintMode, RoomState, RoomVisibility } from '@/types/api';

/** One − value + line inside the rule dropdown. */
function StepLine({
  icon,
  title,
  desc,
  caption,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  caption: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.optLine}>
      <Row gap={spacing.md}>
        <View style={[styles.optIconSm, { backgroundColor: colors.primary }]}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyMedium">{title}</T>
          <T variant="tiny" muted>
            {desc}
          </T>
        </View>
      </Row>
      <Row style={{ justifyContent: 'center', marginTop: 6 }}>
        <Stepper value={value} min={min} max={max} step={step} onChange={onChange} width={56} />
      </Row>
      <T variant="smallBold" center color={colors.primary}>
        {caption}
      </T>
    </View>
  );
}

/**
 * The chosen rule's options in one neat dropdown: closed it shows a one-line summary; open it
 * shows Time to check (− +, 0 = until all ready) and Late claim (− +) for Normal, and Auto hint
 * for Normal / Fastest finger. Auto has no options.
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
  const [open, setOpen] = useState(false);
  if (rule === 'auto') return null;
  const normal = rule === 'normal';
  const checkLabel = checkSeconds === 0 ? t('create.untilReady') : t('common.seconds', { count: checkSeconds });
  const lateLabel = lateClaim > 0 ? t('create.lateClaimValue', { count: lateClaim }) : t('common.off');
  const hintLabel = !autoHint ? t('common.off') : hintMode === 'next' ? t('create.hintNext') : t('create.hintStruck');
  // Current values as small chips while closed.
  const chips: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    ...(normal
      ? [
          { icon: 'hourglass' as const, label: checkLabel },
          { icon: 'time' as const, label: `${t('create.lateClaim')}: ${lateClaim > 0 ? lateClaim : lateLabel}` },
        ]
      : []),
    { icon: 'bulb' as const, label: `${t('create.autoHint')}: ${hintLabel}` },
  ];
  // Drawn joined to the selected rule card (RulePicker's `options`).
  return (
    <View style={[styles.attached, { backgroundColor: colors.surfaceAlt }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Row gap={spacing.sm}>
          <Ionicons name="settings" size={18} color={colors.primary} />
          <T variant="h3" style={{ flex: 1 }}>
            {t('create.ruleOptions', { rule: t(`create.rule_${rule}`) })}
          </T>
          <View style={[styles.openBtn, { backgroundColor: colors.primary }]}>
            <T variant="smallBold" color="#fff">
              {open ? t('create.closeSettings') : t('create.openSettings')}
            </T>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
          </View>
        </Row>
        {open ? null : (
          <View style={styles.chips}>
            {chips.map((c) => (
              <View key={c.icon} style={[styles.valueChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name={c.icon} size={12} color={colors.primary} />
                <T variant="tiny" numberOfLines={1}>
                  {c.label}
                </T>
              </View>
            ))}
          </View>
        )}
      </Pressable>
      {open ? (
        <View style={{ marginTop: spacing.sm }}>
          {normal ? (
            <>
              <StepLine
                icon="hourglass"
                title={t('create.checkTime')}
                desc={t('create.checkTimeDesc')}
                caption={checkLabel}
                value={checkSeconds}
                min={0}
                max={60}
                step={5}
                onChange={onCheckSeconds}
              />
              <StepLine
                icon="time"
                title={t('create.lateClaim')}
                desc={t('create.lateClaimDesc')}
                caption={lateClaim === 0 ? t('create.lateClaimOffDesc') : t('create.lateClaimOnDesc', { count: lateClaim })}
                value={lateClaim}
                min={0}
                max={90}
                step={1}
                onChange={onLateClaim}
              />
            </>
          ) : null}
          <View style={[styles.optLine, { borderBottomWidth: 0 }]}>
            <Row gap={spacing.md}>
              <View style={[styles.optIconSm, { backgroundColor: autoHint ? colors.primary : colors.surfaceAlt }]}>
                <Ionicons name="bulb" size={16} color={autoHint ? '#fff' : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('create.autoHint')}</T>
                <T variant="tiny" muted>
                  {t('create.autoHintDesc')}
                </T>
              </View>
              <Toggle value={autoHint} onValueChange={onAutoHint} />
            </Row>
            {autoHint ? <HintModePicker value={hintMode} onChange={onHintMode} /> : null}
          </View>
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

/** Auto hint kind: the newest number until the next call, or every called number until struck. */
export function HintModePicker({ value, onChange }: { value: HintMode; onChange: (m: HintMode) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 6, marginTop: spacing.sm }}>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={t('create.hintNext')} active={value === 'next'} onPress={() => onChange('next')} />
        <Chip label={t('create.hintStruck')} active={value === 'struck'} onPress={() => onChange('struck')} />
      </Row>
      <T variant="tiny" muted>
        {value === 'next' ? t('create.hintNextDesc') : t('create.hintStruckDesc')}
      </T>
    </View>
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
        <SummaryItem icon="pricetag" label={t('create.ticketPrice')} value={formatRupees(room.ticketPrice)} />
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
  const [hintMode, setHintMode] = useState<HintMode>(room.hintMode ?? 'struck');
  const [chat, setChat] = useState(room.chatEnabled);
  const [lateClaim, setLateClaim] = useState(room.lateClaimCalls ?? 0);

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
    setHintMode(room.hintMode ?? 'struck');
    setChat(room.chatEnabled);
    setLateClaim(room.lateClaimCalls ?? 0);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      roomService.updateSettings(room.id, {
        title: title.trim() || room.title,
        visibility,
        maxPlayers,
        ticketPrice: Number(price) || 0,
        rule,
        checkSeconds,
        autoMark: autoHint,
        hintMode,
        chatEnabled: chat,
        lateClaimCalls: rule === 'normal' ? lateClaim : 0,
      }, room.lateClaimCalls ?? 0),
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

            <T variant="smallBold" muted style={styles.label}>
              {t('create.ticketPrice')}
            </T>
            <View style={[styles.priceBox, { borderColor: colors.gold, opacity: priceLocked ? 0.5 : 1 }]}>
              <T variant="h2" color={colors.goldDark}>
                ₹
              </T>
              <TextInput
                value={price}
                editable={!priceLocked}
                onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, '').slice(0, 8))}
                keyboardType="decimal-pad"
                style={[styles.priceInput, centeredInput, { color: colors.text }]}
              />
            </View>
            {priceLocked ? (
              <T variant="tiny" muted style={{ marginTop: 4 }}>
                {t('lobby.priceLocked')}
              </T>
            ) : null}

            <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg }}>
              <T variant="bodyMedium">{t('create.maxPlayers')}</T>
              <Stepper value={maxPlayers} min={Math.max(2, room.memberCount)} max={100} onChange={setMaxPlayers} width={44} />
            </Row>

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
    padding: spacing.md,
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
