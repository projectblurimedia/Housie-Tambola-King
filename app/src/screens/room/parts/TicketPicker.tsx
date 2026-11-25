import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatCoins, formatRupees } from '@/components/Money';
import { Button, Row, T } from '@/components/ui';
import { useStakeStore } from '@/state/stakeStore';
import { fonts, goldGradient, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/**
 * "How many tickets this game?" — a small card with − count + (up to the room's limit), the
 * cost and, in a coins room, the player's balance. Confirmed once, then final for this game
 * (the server refuses changes), so nobody can keep re-picking until they like their numbers.
 */
export function TicketPicker({
  visible,
  price,
  maxTickets = 4,
  coins,
  gameLabel,
  busy,
  onPick,
  onClose,
}: {
  visible: boolean;
  price: number;
  /** The room's limit per player (1–10). */
  maxTickets?: number;
  /** The player's coin balance (coins rooms). */
  coins?: number;
  gameLabel: string;
  busy?: boolean;
  onPick: (count: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const mode = useStakeStore((s) => s.mode);
  const pop = useRef(new Animated.Value(0)).current;
  const [count, setCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const max = Math.max(1, maxTickets);
  const cost = count * price;
  const short = mode === 'coins' && coins !== undefined && cost > coins;

  useEffect(() => {
    if (!visible) return;
    setCount(1);
    setConfirming(false);
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [visible, pop]);

  const step = (d: number) => setCount((c) => Math.min(max, Math.max(1, c + d)));

  return (
    <>
      <Modal transparent visible={visible && !confirming} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay, paddingBottom: spacing.xl + insets.bottom }]} onPress={onClose}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                opacity: pop,
                transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              },
            ]}
          >
            <Pressable>
              <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
                <Ionicons name="ticket" size={18} color="#FDE68A" />
                <T variant="smallBold" color="#fff" style={{ flex: 1 }}>
                  {gameLabel}
                </T>
                <T variant="tiny" color="rgba(255,255,255,0.8)">
                  {t('lobby.upTo', { count: max })}
                </T>
              </LinearGradient>

              <View style={{ padding: spacing.md, gap: spacing.md }}>
                <T variant="h3" center>
                  {t('lobby.howManyTickets')}
                </T>
                {/* − count + */}
                <Row style={{ justifyContent: 'center' }} gap={spacing.lg}>
                  <Pressable onPress={() => step(-1)} disabled={count <= 1} hitSlop={8} style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt, opacity: count <= 1 ? 0.4 : 1 }]}>
                    <Ionicons name="remove" size={24} color={colors.primary} />
                  </Pressable>
                  <LinearGradient colors={goldGradient} style={styles.countBall}>
                    <T maxFontSizeMultiplier={FIXED_SHAPE_SCALE} style={styles.count} color="#3B1D00">
                      {count}
                    </T>
                  </LinearGradient>
                  <Pressable onPress={() => step(1)} disabled={count >= max} hitSlop={8} style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt, opacity: count >= max ? 0.4 : 1 }]}>
                    <Ionicons name="add" size={24} color={colors.primary} />
                  </Pressable>
                </Row>
                {mode === 'free' ? (
                  <T variant="small" muted center>
                    {t('lobby.freeTickets')}
                  </T>
                ) : (
                  <View style={[styles.costRow, { backgroundColor: colors.surfaceAlt }]}>
                    <T variant="small" muted>
                      {t('lobby.ticketsCost', { count })}
                    </T>
                    <T variant="h3" color={short ? colors.error : colors.goldDark}>
                      {formatRupees(cost)}
                    </T>
                  </View>
                )}
                {mode === 'coins' && coins !== undefined ? (
                  <T variant="tiny" center color={short ? colors.error : colors.textMuted}>
                    {short ? t('lobby.notEnoughCoins', { have: formatCoins(coins) }) : t('lobby.yourCoins', { have: formatCoins(coins) })}
                  </T>
                ) : null}
                <Button
                  title={t('lobby.confirmTickets')}
                  variant="gold"
                  icon="checkmark-circle"
                  disabled={short}
                  onPress={() => setConfirming(true)}
                />
                <Button title={t('lobby.later')} variant="ghost" small onPress={onClose} />
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      <ConfirmModal
        visible={visible && confirming}
        icon="ticket"
        gradient={BRAND_GRADIENT}
        title={t('lobby.confirmTicketsTitle', { count })}
        message={
          mode === 'free'
            ? t('lobby.confirmTicketsFree', { count })
            : t('lobby.confirmTicketsMessage', { count, amount: formatRupees(cost) })
        }
        confirmLabel={t('lobby.confirmTickets')}
        loading={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => onPick(count)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.lg },
  card: { borderRadius: radius.xl, overflow: 'hidden', alignSelf: 'center', width: '100%', maxWidth: 380 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  stepBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  countBall: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, includeFontPadding: false },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
