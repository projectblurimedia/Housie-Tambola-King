import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { CoinAmount } from '@/components/CoinIcon';
import { PrizeList } from '@/components/PrizeList';
import { formatRupees } from '@/components/Money';
import { Button, Chip, IconButton, Row, T } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { useStakeStore } from '@/state/stakeStore';
import { showToast } from '@/state/toastStore';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { RoomState } from '@/types/api';

const ISSUES = ['wait', 'tickets', 'prizes', 'other'] as const;

/**
 * Lobby step 3 for each player: the prizes are set, so a card pops up with this game's details
 * (prizes and amounts, my tickets, the pot) and one big "I'm ready". A player with a problem
 * tells the host right here (quick reasons + their own words) instead of getting ready.
 */
export function ReadySheet({
  visible,
  state,
  gameLabel,
  busy,
  onReady,
  onClose,
}: {
  visible: boolean;
  state: RoomState;
  gameLabel: string;
  busy: boolean;
  onReady: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const mode = useStakeStore((s) => s.mode);
  const pop = useRef(new Animated.Value(0)).current;
  const [asking, setAsking] = useState(false);
  const [issue, setIssue] = useState<(typeof ISSUES)[number]>('wait');
  const [text, setText] = useState('');
  const game = state.game!;

  useEffect(() => {
    if (!visible) return;
    setAsking(false);
    setText('');
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();
  }, [visible, pop]);

  const tell = useMutation({
    mutationFn: () => {
      const reason = t(`ready.issue_${issue}`);
      return roomService.tellHost(state.room.id, text.trim() ? `${reason}: ${text.trim()}` : reason);
    },
    onSuccess: () => {
      showToast({ variant: 'success', title: t('ready.toldHost') });
      setAsking(false);
      setText('');
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const rows = state.prizes.map((p) => ({ prize: p.prize, amount: Number(p.amount), status: p.status, winners: [] }));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay, paddingBottom: spacing.lg + insets.bottom }]}>
        {/* Only the ✕ closes it — a tap outside does nothing. */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              opacity: pop,
              transform: [
                { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="flag" size={18} color="#3B1D00" />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="tiny" color="rgba(255,255,255,0.8)">
                {gameLabel}
              </T>
              <T variant="h3" color="#fff">
                {t('ready.title')}
              </T>
            </View>
            <IconButton icon="close" color="#fff" onPress={onClose} />
          </LinearGradient>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {/* Details: my tickets · pot (no money in free rooms) */}
            <Row gap={spacing.sm}>
              <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="ticket" size={16} color={colors.primary} />
                <T variant="tiny" muted>
                  {t('ready.yourTickets')}
                </T>
                <T variant="h2">{state.myTickets.length}</T>
              </View>
              {mode === 'free' ? (
                <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="gift" size={16} color={colors.primary} />
                  <T variant="tiny" muted>
                    {t('create.stake_free')}
                  </T>
                  <T variant="smallBold">{t('ready.justForFun')}</T>
                </View>
              ) : (
                <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="trophy" size={16} color={colors.goldDark} />
                  <T variant="tiny" muted>
                    {t('lobby.pot')}
                  </T>
                  {mode === 'coins' ? (
                    <CoinAmount value={game.pot} variant="h2" color={colors.goldDark} />
                  ) : (
                    <T variant="h2" color={colors.goldDark}>
                      {formatRupees(game.pot)}
                    </T>
                  )}
                </View>
              )}
            </Row>

            <T variant="smallBold" muted style={{ letterSpacing: 0.6 }}>
              {t('ready.prizes').toUpperCase()}
            </T>
            <PrizeList rows={rows} compact />

            {asking ? (
              <View style={[styles.ask, { backgroundColor: colors.surfaceAlt }]}>
                <T variant="smallBold">{t('ready.whatsWrong')}</T>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {ISSUES.map((k) => (
                    <Chip key={k} label={t(`ready.issue_${k}`)} active={issue === k} onPress={() => setIssue(k)} />
                  ))}
                </Row>
                <TextInput
                  value={text}
                  onChangeText={(v) => setText(v.slice(0, 160))}
                  placeholder={t('ready.tellPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                />
                <Row gap={spacing.sm}>
                  <Button title={t('common.cancel')} variant="ghost" small onPress={() => setAsking(false)} style={{ flex: 1 }} />
                  <Button title={t('ready.sendToHost')} variant="secondary" small icon="send" loading={tell.isPending} onPress={() => tell.mutate()} style={{ flex: 1 }} />
                </Row>
              </View>
            ) : (
              <Pressable onPress={() => setAsking(true)} style={styles.askLink} hitSlop={8}>
                <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
                <T variant="smallBold" color={colors.primary}>
                  {t('ready.tellHost')}
                </T>
              </Pressable>
            )}

            <Button title={t('lobby.readyButton')} variant="gold" icon="checkmark-done" loading={busy} onPress={onReady} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md },
  card: { borderRadius: radius.xl, overflow: 'hidden', maxHeight: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  headIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  ask: { borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  askLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontFamily: fonts.regular, fontSize: 14 },
});
