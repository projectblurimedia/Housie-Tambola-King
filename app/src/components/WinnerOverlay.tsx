import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useWinnerStore } from '@/state/winnerStore';
import { useMe } from '@/hooks/useMe';
import { fonts, goldGradient, radius, spacing } from '@/theme';
import { Avatar } from './Avatar';
import { Confetti } from './Confetti';
import { MiniBall } from './NumberBall';
import { formatRupees } from './Money';

const SHOW_MS = 6500;

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

/**
 * "WINNER!" announcement shown on every phone in the room: who, which prize, the numbers
 * that made it (popping in one by one), and the amount — split equally when shared.
 */
export function WinnerOverlay() {
  const { t } = useTranslation();
  const current = useWinnerStore((s) => s.queue[0]);
  const dismiss = useWinnerStore((s) => s.dismiss);
  const me = useMe();
  const card = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    card.setValue(0);
    Animated.spring(card, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    loop.start();
    const timer = setTimeout(dismiss, SHOW_MS);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
    // Re-run when the shown announcement changes (incl. a shared prize updating in place).
  }, [current?.id, current?.winners.length, card, shine, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const count = current.winners.length;
  const each = count > 0 ? Math.floor((current.amount / count) * 100) / 100 : current.amount;
  const iWon = current.winners.some((w) => w.userId === me.data?.id);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Confetti burstKey={`${current.id}:${count}`} />
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
          <LinearGradient colors={['#4C1D95', '#7C3AED', '#C026D3']} style={styles.gradient}>
            <Animated.Text
              style={[
                styles.trophy,
                { transform: [{ scale: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] },
              ]}
            >
              🏆
            </Animated.Text>
            <LinearGradient colors={goldGradient} style={styles.titlePill}>
              <Text style={styles.title}>{t('winner.title')}</Text>
            </LinearGradient>
            <Text style={styles.prize}>{t(`prizes.${current.prize}`)}</Text>

            <View style={{ gap: spacing.sm, marginTop: spacing.md, width: '100%' }}>
              {current.winners.map((w, i) => (
                <PopIn key={w.userId} delay={200 + i * 150}>
                  <View style={styles.winnerRow}>
                    <Avatar avatarKey={w.avatarKey} size={46} ring="#FDE68A" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={2}>
                        {w.name}
                      </Text>
                      <Text style={styles.sub}>
                        {w.userId === me.data?.id ? t('winner.you') : t('winner.ticket', { serial: w.ticketSerial })}
                      </Text>
                    </View>
                  </View>
                </PopIn>
              ))}
            </View>

            {current.winners[0]?.numbers?.length ? (
              <>
                <Text style={styles.numbersLabel}>{t('winner.numbers')}</Text>
                <View style={styles.numbers}>
                  {current.winners[0].numbers.map((n, i) => (
                    <PopIn key={n} delay={450 + i * 110}>
                      <MiniBall n={n} size={34} />
                    </PopIn>
                  ))}
                </View>
              </>
            ) : null}

            <PopIn delay={700 + (current.winners[0]?.numbers.length ?? 0) * 110}>
              <LinearGradient colors={goldGradient} style={styles.amountPill}>
                <Text style={styles.amount}>{count > 1 ? t('winner.each', { amount: formatRupees(each) }) : formatRupees(current.amount)}</Text>
              </LinearGradient>
            </PopIn>
            {count > 1 ? <Text style={styles.split}>{t('winner.split', { count })}</Text> : null}
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
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  name: { fontFamily: fonts.bold, fontSize: 19, color: '#fff' },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  numbersLabel: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: spacing.lg, letterSpacing: 1 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  amountPill: { borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 8, marginTop: spacing.lg },
  amount: { fontFamily: fonts.display, fontSize: 30, color: '#3B1D00' },
  split: { fontFamily: fonts.semibold, fontSize: 13, color: '#FDE68A', marginTop: 6 },
  me: { fontFamily: fonts.bold, fontSize: 16, color: '#BBF7D0', marginTop: spacing.sm },
});
