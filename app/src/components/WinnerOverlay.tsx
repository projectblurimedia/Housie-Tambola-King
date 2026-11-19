import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
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
import { Rays } from './Wordmark';

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
  /** Trophy / glow / sparkles breathing. */
  const pulse = useRef(new Animated.Value(0)).current;
  /** Light rays turning. */
  const spin = useRef(new Animated.Value(0)).current;
  /** Glint sweeping across the gold frame. */
  const glint = useRef(new Animated.Value(0)).current;
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
    glint.setValue(0);
    Animated.spring(card, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(glint, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glint, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(900),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    const timer = setTimeout(dismiss, SHOW_MS + (current.items.length - 1) * EXTRA_PRIZE_MS);
    return () => {
      clearTimeout(timer);
      loops.forEach((l) => l.stop());
    };
    // Re-run when the card changes (incl. a prize merging in or a shared prize updating).
  }, [current?.id, itemsKey, card, pulse, spin, glint, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const multi = current.items.length > 1;
  const iWon = current.items.some((i) => i.winners.some((w) => w.userId === me.data?.id));
  const hasFullHouse = current.items.some((i) => i.prize === 'full_house');
  // Same radial glow as the opening screen; Full Housie burns orange-gold.
  const glow = hasFullHouse ? ['#FBBF24', '#EA580C', '#7C2D12', '#3B0A0A'] : ['#E879F9', '#9333EA', '#4C1D95', '#24073F'];
  const turn = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* Big golden rays turning slowly behind the card. */}
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Animated.View style={[styles.bigRays, { opacity: card, transform: [{ rotate: turn }] }]}>
            <Rays size={1100} color="#FDE68A" opacity={0.13} count={20} />
          </Animated.View>
        </View>
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
          {/* Shiny gold frame. */}
          <LinearGradient
            colors={['#FFF7CC', '#F5B700', '#FFE27A', '#B87400', '#FDE68A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.frame}
          >
            <View style={styles.inner}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id="winGlow" cx="50%" cy="30%" r="80%">
                    <Stop offset="0" stopColor={glow[0]} />
                    <Stop offset="0.3" stopColor={glow[1]} />
                    <Stop offset="0.7" stopColor={glow[2]} />
                    <Stop offset="1" stopColor={glow[3]} />
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill="url(#winGlow)" />
              </Svg>
              {/* Light rays from behind the trophy, like the opening screen. */}
              <View style={styles.innerRaysWrap} pointerEvents="none">
                <Animated.View style={[styles.innerRays, { transform: [{ rotate: turn }] }]}>
                  <Rays size={900} opacity={0.14} />
                </Animated.View>
              </View>

              <View style={styles.content}>
                <View style={styles.center}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.trophyGlow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) }]}
                  >
                    <Svg width={150} height={150}>
                      <Defs>
                        <RadialGradient id="trophyGlow" cx="50%" cy="50%" r="50%">
                          <Stop offset="0" stopColor="#FFE27A" stopOpacity={0.95} />
                          <Stop offset="0.55" stopColor="#FFB020" stopOpacity={0.3} />
                          <Stop offset="1" stopColor="#FFB020" stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Circle cx={75} cy={75} r={75} fill="url(#trophyGlow)" />
                    </Svg>
                  </Animated.View>
                  <Animated.Text
                    style={[styles.trophy, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }]}
                  >
                    {hasFullHouse ? '👑' : '🏆'}
                  </Animated.Text>
                </View>
                <Text style={[styles.title, iWon && styles.titleCongrats]} numberOfLines={1} adjustsFontSizeToFit>
                  {iWon ? t('winner.congrats') : t('winner.title')}
                </Text>
                <ScrollView
                  style={{ width: '100%', maxHeight: 440 }}
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
              </View>

              {/* Twinkling sparkles in the corners. */}
              {SPARKLES.map((s, i) => (
                <Animated.Text
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.sparkle,
                    s.pos,
                    {
                      fontSize: s.size,
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [1, 0.2] : [0.2, 1] }),
                    },
                  ]}
                >
                  ✦
                </Animated.Text>
              ))}
            </View>

            {/* A glint sweeping across the frame and card. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glint,
                { transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-160, 560] }) }, { rotate: '18deg' }] },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const SPARKLES = [
  { pos: { top: 14, left: 16 }, size: 18 },
  { pos: { top: 40, right: 22 }, size: 14 },
  { pos: { top: 96, left: 34 }, size: 11 },
  { pos: { top: 18, right: 64 }, size: 10 },
  { pos: { bottom: 18, left: 20 }, size: 13 },
  { pos: { bottom: 26, right: 18 }, size: 17 },
];

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,4,24,0.78)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  bigRays: { width: 1100, height: 1100 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl + 4,
    elevation: 24,
    shadowColor: '#FFC400',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  frame: { borderRadius: radius.xl + 4, padding: 4, overflow: 'hidden' },
  inner: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,248,204,0.7)' },
  innerRaysWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center' },
  innerRays: { width: 900, height: 900, marginTop: -390 },
  content: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.lg },
  trophyGlow: { position: 'absolute', width: 150, height: 150 },
  trophy: { fontSize: 64 },
  title: {
    fontFamily: 'LuckiestGuy_400Regular',
    fontSize: 38,
    color: '#FFD43B',
    letterSpacing: 2,
    marginTop: 2,
    includeFontPadding: false,
    textShadowColor: 'rgba(255,196,0,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  titleCongrats: { fontSize: 32 },
  sparkle: { position: 'absolute', color: '#FFF3B0', textShadowColor: '#FFC400', textShadowRadius: 8 },
  glint: { position: 'absolute', top: -80, bottom: -80, width: 90 },
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
