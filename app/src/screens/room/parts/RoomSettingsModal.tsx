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
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { claimRule, ClaimRule, RoomState, RoomVisibility } from '@/types/api';

/** 0 = no time limit: the game waits until everyone has checked (or the host continues). */
const CHECK_TIMES = [5, 10, 15, 20, 30, 0];

/** Normal rule: how long everyone gets to check their tickets after a claim. */
export function CheckTimePicker({ value, onChange }: { value: number; onChange: (s: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Card style={[styles.group, { marginTop: spacing.sm }]}>
      <Row gap={spacing.md}>
        <View style={[styles.optIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="hourglass" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{t('create.checkTime')}</T>
          <T variant="tiny" muted>
            {t('create.checkTimeDesc')}
          </T>
        </View>
      </Row>
      <Row gap={spacing.sm} style={{ marginTop: spacing.md, flexWrap: 'wrap' }}>
        {CHECK_TIMES.map((s) => (
          <Chip key={s} label={s === 0 ? t('create.untilReady') : t('common.seconds', { count: s })} active={value === s} onPress={() => onChange(s)} />
        ))}
      </Row>
    </Card>
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
        {canEdit ? <Button title={t('lobby.editSettings')} small variant="secondary" icon="create-outline" onPress={() => setEditing(true)} /> : null}
      </Row>
      <View style={styles.grid}>
        <SummaryItem icon={rule === 'normal' ? 'shield-checkmark' : 'flash'} label={t('create.claimRule')} value={t(`create.rule_${rule}`)} />
        {rule === 'normal' ? <SummaryItem icon="hourglass" label={t('create.checkTime')} value={room.checkSeconds === 0 ? t('create.untilReady') : t('common.seconds', { count: room.checkSeconds })} /> : null}
        <SummaryItem icon="pricetag" label={t('create.ticketPrice')} value={formatRupees(room.ticketPrice)} />
        <SummaryItem icon="people" label={t('create.maxPlayers')} value={String(room.maxPlayers)} />
        <SummaryItem icon={room.visibility === 'public' ? 'earth' : 'lock-closed'} label={t('create.visibility')} value={t(`visibility.${room.visibility}`)} />
        <SummaryItem icon="bulb" label={t('create.autoHint')} value={room.autoMark ? t('common.on') : t('common.off')} />
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
  const [chat, setChat] = useState(room.chatEnabled);

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
    setChat(room.chatEnabled);
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
        chatEnabled: chat,
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
            <Row gap={spacing.sm}>
              {(['normal', 'fastest'] as ClaimRule[]).map((m) => (
                <Chip key={m} label={t(`create.rule_${m}`)} active={rule === m} onPress={() => setRule(m)} />
              ))}
            </Row>
            {rule === 'normal' ? <CheckTimePicker value={checkSeconds} onChange={setCheckSeconds} /> : null}

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
              <T variant="bodyMedium">{t('create.autoHint')}</T>
              <Toggle value={autoHint} onValueChange={setAutoHint} />
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
              <T variant="bodyMedium">{t('create.chat')}</T>
              <Toggle value={chat} onValueChange={setChat} />
            </Row>
          </ScrollView>
          <Button title={t('common.save')} icon="checkmark" variant="gold" style={{ marginTop: spacing.md }} loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing.md, borderWidth: 2 },
  optIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '92%' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  priceBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 10, width: 140, height: 52 },
  priceInput: { flex: 1, fontFamily: fonts.bold, fontSize: 22, height: 52, paddingHorizontal: 4 },
});
