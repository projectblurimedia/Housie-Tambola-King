import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useWinnerStore, PrizeWin } from '@/state/winnerStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useMe } from '@/hooks/useMe';
import { pickSound, playPrizeSound, PrizeSound } from '@/services/sounds';
import { fonts, goldGradient, radius, spacing } from '@/theme';
import { Avatar } from './Avatar';
import { Confetti } from './Confetti';
import { MiniBall } from './NumberBall';
import { formatRupees } from './Money';

const SHOW_MS = 6500;
const EXTRA_PRIZE_MS = 2500;
const SOUND_RANK: Record<PrizeSound, number> = { fast: 0, column: 1, line: 2, fullhouse: 3 };

function PopIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [delay, v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** One prize inside the card: name, winners, the numbers that made it, amount. */
function PrizeBlock({ item, meId, multi, baseDelay }: { item: PrizeWin; meId?: string; multi: boolean; baseDelay: number }) {
  const { t } = useTranslation();
  const count = item.winners.length;
  const each = count > 0 ? Math.floor((item.amount / count) * 100) / 100 : item.amount;
  const numbers = item.winners[0]?.numbers ?? [];
  return (
    <View style={[{ width: '100%', alignItems: 'center' }, multi && styles.block]}>
      <Text style={[styles.prize, multi && { fontSize: 22, marginTop: 0 }]}>{t(`prizes.${item.prize}`)}</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm, width: '100%' }}>
        {item.winners.map((w, i) => (
          <PopIn key={w.userId + i} delay={baseDelay + 200 + i * 150}>
            <View style={styles.winnerRow}>
              <Avatar avatarKey={w.avatarKey} size={multi ? 36 : 46} ring="#FDE68A" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, multi && { fontSize: 16 }]} numberOfLines={2}>
                  {w.name}
                </Text>
                <Text style={styles.sub}>{w.userId === meId ? t('winner.you') : t('winner.ticket', { serial: w.ticketSerial })}</Text>
              </View>
            </View>
          </PopIn>
        ))}
      </View>
      {numbers.length && !(multi && item.prize === 'full_house') ? (
        <>
          <Text style={styles.numbersLabel}>{t('winner.numbers')}</Text>
          <View style={styles.numbers}>
            {numbers.map((n, i) => (
              <PopIn key={n} delay={baseDelay + 450 + i * 90}>
                <MiniBall n={n} size={multi ? 28 : 34} />
              </PopIn>
            ))}
          </View>
        </>
      ) : null}
      <PopIn delay={baseDelay + 600 + numbers.length * 90}>
        <LinearGradient colors={goldGradient} style={[styles.amountPill, multi && { paddingVertical: 4, marginTop: spacing.md }]}>
          <Text style={[styles.amount, multi && { fontSize: 22 }]}>
            {count > 1 ? t('winner.each', { amount: formatRupees(each) }) : formatRupees(item.amount)}
          </Text>
        </LinearGradient>
      </PopIn>
      {count > 1 ? <Text style={styles.split}>{t('winner.split', { count })}</Text> : null}
    </View>
  );
}

/**
 * "WINNER!" announcement on every phone in the room. Everything won on the same called
 * number is one card (e.g. Line 3 + Full Housie together), with one sound: Full Housie's
 * if it is there, otherwise the highest of line / column / fast.
 */
export function WinnerOverlay() {
  const { t } = useTranslation();
  const current = useWinnerStore((s) => s.queue[0]);
  const dismiss = useWinnerStore((s) => s.dismiss);
  const soundsOn = useSettingsStore((s) => s.sounds);
  const haptics = useSettingsStore((s) => s.haptics);
  const me = useMe();
  const card = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  /** Sound already played for the card on screen (a later, bigger prize may upgrade it). */
  const played = useRef<{ id: string; rank: number } | null>(null);

  const itemsKey = current ? current.items.map((i) => `${i.prize}:${i.winners.length}`).join('|') : '';

  useEffect(() => {
    if (!current) return;
    const kind = pickSound(current.items.map((i) => i.prize));
    const rank = SOUND_RANK[kind];
    if (soundsOn && (played.current?.id !== current.id || rank > played.current.rank)) {
      playPrizeSound(kind, haptics);
      played.current = { id: current.id, rank };
    }
  }, [current?.id, itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current) return;
    card.setValue(0);
    Animated.spring(card, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    loop.start();
    const timer = setTimeout(dismiss, SHOW_MS + (current.items.length - 1) * EXTRA_PRIZE_MS);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
    // Re-run when the card changes (incl. a prize merging in or a shared prize updating).
  }, [current?.id, itemsKey, card, shine, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const multi = current.items.length > 1;
  const iWon = current.items.some((i) => i.winners.some((w) => w.userId === me.data?.id));
  const hasFullHouse = current.items.some((i) => i.prize === 'full_house');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Confetti burstKey={`${current.id}:${itemsKey}`} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: card,
              transform: [
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                { rotate: card.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <LinearGradient colors={hasFullHouse ? ['#7C2D12', '#C2410C', '#F59E0B'] : ['#4C1D95', '#7C3AED', '#C026D3']} style={styles.gradient}>
            <Animated.Text
              style={[styles.trophy, { transform: [{ scale: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }]}
            >
              {hasFullHouse ? '👑' : '🏆'}
            </Animated.Text>
            <LinearGradient colors={goldGradient} style={styles.titlePill}>
              <Text style={styles.title}>{t('winner.title')}</Text>
            </LinearGradient>
            <ScrollView style={{ width: '100%', maxHeight: 460 }} contentContainerStyle={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
              {current.items.map((item, i) => (
                <PrizeBlock key={item.prize} item={item} meId={me.data?.id} multi={multi} baseDelay={i * 300} />
              ))}
            </ScrollView>
            {iWon ? <Text style={styles.me}>{t('winner.you')}</Text> : null}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,4,24,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.xl, overflow: 'hidden', elevation: 20 },
  gradient: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.lg },
  trophy: { fontSize: 64 },
  titlePill: { borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 4, marginTop: 4 },
  title: { fontFamily: fonts.display, fontSize: 28, color: '#3B1D00', letterSpacing: 2 },
  prize: { fontFamily: fonts.display, fontSize: 26, color: '#fff', marginTop: spacing.sm },
  block: { backgroundColor: 'rgba(0,0,0,0.16)', borderRadius: radius.lg, padding: spacing.md },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
  },
  name: { fontFamily: fonts.bold, fontSize: 19, color: '#fff' },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  numbersLabel: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: spacing.md, letterSpacing: 1 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  amountPill: { borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 8, marginTop: spacing.lg },
  amount: { fontFamily: fonts.display, fontSize: 30, color: '#3B1D00' },
  split: { fontFamily: fonts.semibold, fontSize: 13, color: '#FDE68A', marginTop: 6 },
  me: { fontFamily: fonts.bold, fontSize: 16, color: '#BBF7D0', marginTop: spacing.sm },
});
