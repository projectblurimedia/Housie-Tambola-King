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
import { PatternTicket } from './PatternTicket';
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
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Everyone who won on this number, one row per person with ALL their prizes together
 * ("Mani — Centre Column & Fast 5"), and what they get in total.
 */
function WinnersList({ items, meId }: { items: PrizeWin[]; meId?: string }) {
  const { t } = useTranslation();
  const people = new Map<string, { winner: PrizeWin['winners'][number]; prizes: string[]; total: number; shared: boolean }>();
  items.forEach((item) => {
    const count = item.winners.length || 1;
    const each = Math.floor((item.amount / count) * 100) / 100;
    item.winners.forEach((w) => {
      const p = people.get(w.userId) ?? { winner: w, prizes: [], total: 0, shared: false };
      p.prizes.push(t(`prizes.${item.prize}`));
      p.total += each;
      p.shared = p.shared || count > 1;
      people.set(w.userId, p);
    });
  });
  return (
    <View style={{ gap: spacing.sm, width: '100%' }}>
      {[...people.values()].map(({ winner, prizes, total, shared }, i) => (
        <PopIn key={winner.userId} delay={150 + i * 120}>
          <View style={styles.winnerRow}>
            <Avatar avatarKey={winner.avatarKey} size={46} ring="#FDE68A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {winner.userId === meId ? t('winner.you') : winner.name}
              </Text>
              <View style={styles.prizeChips}>
                {prizes.map((p) => (
                  <View key={p} style={styles.chip}>
                    <Text style={styles.chipText}>{p}</Text>
                  </View>
                ))}
              </View>
              {shared ? <Text style={styles.sub}>{t('winner.sharedNote')}</Text> : null}
            </View>
            <LinearGradient colors={goldGradient} style={styles.totalPill}>
              <Text style={styles.total}>{formatRupees(Math.round(total * 100) / 100)}</Text>
            </LinearGradient>
          </View>
        </PopIn>
      ))}
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
          <LinearGradient
            colors={hasFullHouse ? ['#7C2D12', '#C2410C', '#F59E0B'] : ['#4C1D95', '#7C3AED', '#C026D3']}
            style={styles.gradient}
          >
            <Animated.Text
              style={[styles.trophy, { transform: [{ scale: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }]}
            >
              {hasFullHouse ? '👑' : '🏆'}
            </Animated.Text>
            <LinearGradient colors={goldGradient} style={styles.titlePill}>
              <Text style={styles.title}>{t('winner.title')}</Text>
            </LinearGradient>
            <ScrollView
              style={{ width: '100%', maxHeight: 480 }}
              contentContainerStyle={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.md }}
            >
              <WinnersList items={current.items} meId={me.data?.id} />
              <View style={styles.patterns}>
                {current.items.map((item) => (
                  <View key={item.prize} style={{ alignItems: 'center', gap: 4 }}>
                    <PatternTicket prize={item.prize} width={multi ? 120 : 170} />
                    <Text style={styles.patternLabel}>{t(`prizes.${item.prize}`)}</Text>
                  </View>
                ))}
              </View>
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
  patterns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  patternLabel: { fontFamily: fonts.semibold, fontSize: 12, color: '#FDE68A' },
  prizeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: { backgroundColor: 'rgba(253,230,138,0.22)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: '#FDE68A' },
  total: { fontFamily: fonts.display, fontSize: 18, color: '#3B1D00' },
  totalPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  numbersLabel: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: spacing.md, letterSpacing: 1 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  amountPill: { borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 8, marginTop: spacing.lg },
  amount: { fontFamily: fonts.display, fontSize: 30, color: '#3B1D00' },
  split: { fontFamily: fonts.semibold, fontSize: 13, color: '#FDE68A', marginTop: 6 },
  me: { fontFamily: fonts.bold, fontSize: 16, color: '#BBF7D0', marginTop: spacing.sm },
});
