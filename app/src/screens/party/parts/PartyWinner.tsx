import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { CoinIcon } from '@/components/CoinIcon';
import { Confetti } from '@/components/Confetti';
import { Row, T } from '@/components/ui';
import { Rays } from '@/components/Wordmark';
import type { PartyPlayer, PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { GOLD_EDGE, PARTY_LOOK } from './Premium';

const shownFor = new Set<string>();

/**
 * The end of a party game, celebrated like a Housie win: dim backdrop, slowly turning gold rays,
 * confetti, and a gold-framed card that springs in with the winner(s), "Congratulations!" when it
 * is you, and the coins won. Shows once per finished game; tap ✕ to close.
 */
export function PartyWinner({ state }: { state: PartyState }) {
  const { t } = useTranslation();
  const g = state.game;
  const winnerIds =
    g.state.winners ?? (g.state.winnerId ? [g.state.winnerId] : [...state.players].sort((a, b) => b.score - a.score).slice(0, 1).map((p) => p.userId));
  const key = `${g.id}:${g.roundNo}:${winnerIds.join(',')}`;
  const [visible, setVisible] = useState(false);
  const card = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const trophy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (g.status !== 'finished' || shownFor.has(key)) return;
    shownFor.add(key);
    setVisible(true);
    card.setValue(0);
    trophy.setValue(0);
    Animated.sequence([
      Animated.spring(card, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(trophy, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [g.status, key, card, spin, trophy]);

  if (!visible) return null;
  const winners = winnerIds.map((id) => state.players.find((p) => p.userId === id)).filter(Boolean) as PartyPlayer[];
  const iWon = winnerIds.includes(state.me.userId);
  const look = PARTY_LOOK[g.kind];
  const payout = g.state.payout;
  const turn = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setVisible(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.bigRays, { opacity: card, transform: [{ rotate: turn }] }]} pointerEvents="none">
          <Rays size={1100} color="#FDE68A" opacity={0.13} count={20} />
        </Animated.View>
        <Confetti burstKey={key} />
        <Animated.View style={{ width: '88%', opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
          <LinearGradient colors={GOLD_EDGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.edge}>
            <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={styles.innerRays} pointerEvents="none">
                <Animated.View style={{ transform: [{ rotate: turn }] }}>
                  <Rays size={700} opacity={0.12} />
                </Animated.View>
              </View>
              <Pressable onPress={() => setVisible(false)} style={styles.close} hitSlop={10}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
              <Animated.Text
                style={[
                  styles.trophy,
                  { transform: [{ scale: trophy.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: trophy.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] },
                ]}
              >
                🏆
              </Animated.Text>
              <T style={styles.headline} center>
                {iWon ? t('party.congrats') : t('party.gameOver')}
              </T>
              <Row gap={8} style={{ marginTop: spacing.md, justifyContent: 'center' }}>
                {winners.map((w) => (
                  <LinearGradient key={w.userId} colors={GOLD_EDGE} style={styles.ring}>
                    <Avatar avatarKey={w.avatarKey} size={68} />
                  </LinearGradient>
                ))}
              </Row>
              <View style={styles.namePlate}>
                <T style={styles.name} center numberOfLines={2}>
                  {winners.map((w) => (w.userId === state.me.userId ? t('party.you') : w.name)).join(' & ')}
                </T>
              </View>
              <T variant="small" color="rgba(255,255,255,0.9)" center style={{ marginTop: 4 }}>
                {winners.length > 1 ? t('party.winTeam') : t('party.wins')}
              </T>
              {payout?.pot ? (
                <View style={styles.payout}>
                  <CoinIcon size={20} />
                  <T style={styles.payoutText}>{winners.length > 1 ? t('party.wonEach', { count: payout.each }) : t('party.wonCoins', { count: payout.pot })}</T>
                </View>
              ) : null}
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,4,20,0.82)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bigRays: { position: 'absolute', width: 1100, height: 1100 },
  edge: { borderRadius: 30, padding: 2.5 },
  card: { borderRadius: 28, padding: spacing.lg, paddingTop: spacing.xl, alignItems: 'center', overflow: 'hidden' },
  innerRays: { position: 'absolute', top: -260, left: 0, right: 0, alignItems: 'center' },
  close: { position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  trophy: { fontSize: 64, lineHeight: 76 },
  headline: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: '#FDE68A', letterSpacing: 1 },
  ring: { padding: 3, borderRadius: 40 },
  namePlate: { marginTop: spacing.sm, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
  name: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: '#fff' },
  payout: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: '#FDE68A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  payoutText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: '#3B1D00' },
});
