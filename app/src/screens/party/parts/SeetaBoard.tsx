import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Row, T } from '@/components/ui';
import { Rays } from '@/components/Wordmark';
import { rolePoints } from '@/game/engine/party';
import type { PartyPlayer, PartyState } from '@/services/partyService';
import { fonts, spacing } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { RoundBar } from './PartyCommon';
import { GOLD_EDGE, GoldFrame, Medallion } from './Premium';

const ROLE_LOOK: Record<string, { colors: [string, string, string]; emoji: string }> = {
  ram: { colors: ['#2A1403', '#92400E', '#D97706'], emoji: '🏹' },
  seeta: { colors: ['#2A0518', '#9D174D', '#DB2777'], emoji: '🌸' },
  lakshmana: { colors: ['#04210F', '#166534', '#16A34A'], emoji: '🛡️' },
  bharatha: { colors: ['#0A1630', '#1E3A8A', '#2563EB'], emoji: '👑' },
  anjaneya: { colors: ['#2A0C03', '#9A3412', '#EA580C'], emoji: '🐒' },
};
const roleLook = (role: string | null | undefined) => ROLE_LOOK[role ?? ''] ?? { colors: ['#140A24', '#4C1D95', '#7C3AED'] as [string, string, string], emoji: '🪔' };

/**
 * Find Seeta, one round: my secret role as an ornate card (flips in each round), then Ram picks
 * who Seeta is — Ram sees everyone else as tiles; the rest watch. The reveal shows every role.
 */
export function SeetaBoard({ state, seconds, onGuess }: { state: PartyState; seconds: number; onGuess: (userId: string) => void }) {
  const { t } = useTranslation();
  const g = state.game;
  const me = state.me;
  const ramId = g.state.ramId;
  const ram = state.players.find((p) => p.userId === ramId);
  const iAmRam = ramId === me.userId;
  const [asking, setAsking] = useState<PartyPlayer | null>(null);
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    flip.setValue(0);
    Animated.spring(flip, { toValue: 1, friction: 7, tension: 45, useNativeDriver: true }).start();
  }, [g.roundNo, flip]);

  const roleName = (role: string | null | undefined) => (role ? t(`party.role.${role}`) : '—');
  const nameOf = (id?: string) => state.players.find((p) => p.userId === id)?.name ?? '';

  if (g.phase === 'reveal') {
    const roles = g.state.roles ?? [];
    const ok = g.state.correct;
    return (
      <View>
        <RoundBar state={state} seconds={seconds} label={t('party.nextRoundIn', { count: seconds })} />
        <GoldFrame radius={24} colors={ok ? ['#022C1A', '#065F46', '#059669'] : ['#2B0606', '#7F1D1D', '#DC2626']} innerStyle={styles.banner}>
          <View style={styles.bannerRays} pointerEvents="none">
            <Rays size={500} opacity={0.1} count={20} />
          </View>
          <Medallion emoji={ok ? '🎯' : '🙈'} size={70} />
          <T style={styles.bannerTitle} center>
            {ok ? t('party.seeta.found', { ram: nameOf(g.state.ramId) }) : t('party.seeta.missed', { ram: nameOf(g.state.ramId) })}
          </T>
          <T variant="small" color="rgba(255,255,255,0.9)" center>
            {ok ? t('party.seeta.foundDesc', { seeta: nameOf(g.state.seetaId) }) : t('party.seeta.missedDesc', { guess: nameOf(g.state.guessId), seeta: nameOf(g.state.seetaId) })}
          </T>
        </GoldFrame>
        <GoldFrame radius={20} style={{ marginTop: spacing.md }} innerStyle={{ padding: spacing.md, gap: 2 }}>
          {roles.map((r) => {
            const p = state.players.find((x) => x.userId === r.userId);
            const look = roleLook(r.role);
            return (
              <Row key={r.userId} gap={spacing.sm} style={{ paddingVertical: 5 }}>
                <LinearGradient colors={GOLD_EDGE} style={styles.ring}>
                  <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={30} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <T variant="smallBold" color={r.userId === me.userId ? '#FDE68A' : '#fff'} numberOfLines={1}>
                    {p?.name ?? ''}
                  </T>
                  <T variant="tiny" color="rgba(255,255,255,0.7)">
                    {look.emoji} {roleName(r.role)}
                  </T>
                </View>
                <T variant="smallBold" color={r.points > 0 ? '#86EFAC' : 'rgba(255,255,255,0.5)'}>
                  +{r.points}
                </T>
              </Row>
            );
          })}
        </GoldFrame>
      </View>
    );
  }

  const look = roleLook(me.role);
  const initial = roleName(me.role).slice(0, 1);
  const others = state.players.filter((p) => p.active && p.userId !== me.userId);
  return (
    <View>
      <RoundBar state={state} seconds={seconds} />
      <Animated.View
        style={{
          opacity: flip,
          transform: [
            { perspective: 900 },
            { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['100deg', '0deg'] }) },
            { scale: flip.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          ],
        }}
      >
        {/* The role card: gold frame, ornate corners, a medallion, the role's name in gold. */}
        <GoldFrame radius={28} width={2.5} colors={look.colors} innerStyle={styles.roleCard}>
          <View style={styles.cardRays} pointerEvents="none">
            <Rays size={560} opacity={0.12} count={24} />
          </View>
          <View style={styles.innerBorder} pointerEvents="none" />
          <View style={[styles.corner, { left: 14, top: 12 }]}>
            <T style={styles.cornerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              {initial}
            </T>
            <T style={styles.cornerSuit} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              ◆
            </T>
          </View>
          <View style={[styles.corner, { right: 14, bottom: 12, transform: [{ rotate: '180deg' }] }]}>
            <T style={styles.cornerText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              {initial}
            </T>
            <T style={styles.cornerSuit} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              ◆
            </T>
          </View>
          <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 3 }}>
            {t('party.seeta.youAre').toUpperCase()}
          </T>
          <View style={{ marginVertical: spacing.sm }}>
            <Medallion emoji={look.emoji} size={104} />
          </View>
          <T style={styles.roleName} center numberOfLines={1} adjustsFontSizeToFit>
            {roleName(me.role)}
          </T>
          <LinearGradient colors={['#FFF1A8', '#F5B700', '#B87400']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ribbon}>
            <Ionicons name="star" size={12} color="#3B1D00" />
            <T variant="smallBold" color="#3B1D00">
              {me.role === 'ram' || me.role === 'seeta' ? t('party.seeta.ramSeetaPoints') : t('party.pointsN', { count: rolePoints(me.role) })}
            </T>
          </LinearGradient>
          <T variant="small" color="rgba(255,255,255,0.9)" center style={{ marginTop: spacing.md }}>
            {me.role === 'ram' ? t('party.seeta.ramHint') : me.role === 'seeta' ? t('party.seeta.seetaHint') : t('party.seeta.otherHint')}
          </T>
        </GoldFrame>
      </Animated.View>

      {iAmRam ? (
        <>
          <T style={styles.ask} center>
            {t('party.seeta.whoIsSeeta')}
          </T>
          <View style={styles.grid}>
            {others.map((p) => (
              <Pressable key={p.userId} onPress={() => setAsking(p)} style={({ pressed }) => [{ width: '31%' }, pressed && { transform: [{ scale: 0.95 }] }]}>
                <GoldFrame radius={18} innerStyle={styles.tile}>
                  <LinearGradient colors={GOLD_EDGE} style={[styles.ring, { padding: 2.5, borderRadius: 30 }]}>
                    <Avatar avatarKey={p.avatarKey} size={48} />
                  </LinearGradient>
                  <T variant="smallBold" color="#fff" numberOfLines={1} style={{ marginTop: 6 }}>
                    {p.name}
                  </T>
                  <T variant="tiny" color="#FDBA74">
                    {t('party.seeta.isItHer')}
                  </T>
                </GoldFrame>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <GoldFrame radius={20} style={{ marginTop: spacing.lg }} colors={['#1F0A04', '#5B2108', '#92400E']} innerStyle={{ padding: spacing.md }}>
          <Row gap={spacing.md}>
            <LinearGradient colors={GOLD_EDGE} style={[styles.ring, { padding: 2.5, borderRadius: 26 }]}>
              <Avatar avatarKey={ram?.avatarKey ?? 'a1'} size={44} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium" color="#fff">
                {t('party.seeta.ramIs', { name: ram?.name ?? '' })}
              </T>
              <T variant="tiny" color="#FDBA74">
                {t('party.seeta.ramFinding')}
              </T>
            </View>
            <T style={{ fontSize: 30, lineHeight: 38 }}>🏹</T>
          </Row>
        </GoldFrame>
      )}

      <ConfirmModal
        visible={asking !== null}
        icon="search"
        gradient={['#F59E0B', '#B45309']}
        title={t('party.seeta.confirmTitle')}
        message={t('party.seeta.confirmMessage', { name: asking?.name ?? '' })}
        confirmLabel={t('party.seeta.confirmYes')}
        onConfirm={() => {
          if (asking) onGuess(asking.userId);
          setAsking(null);
        }}
        onCancel={() => setAsking(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  roleCard: { padding: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center' },
  cardRays: { position: 'absolute', top: -140, left: '50%', marginLeft: -280 },
  innerBorder: { position: 'absolute', left: 8, right: 8, top: 8, bottom: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(253,230,138,0.45)' },
  corner: { position: 'absolute', alignItems: 'center' },
  cornerText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: '#FDE68A' },
  cornerSuit: { fontSize: 10, lineHeight: 12, color: '#FDE68A' },
  roleName: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: '#FDE68A', letterSpacing: 1 },
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 },
  ask: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, marginTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.md },
  tile: { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 4 },
  ring: { padding: 2, borderRadius: 20 },
  banner: { padding: spacing.lg, alignItems: 'center', gap: 4 },
  bannerRays: { position: 'absolute', top: -180, left: '50%', marginLeft: -250 },
  bannerTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: '#fff', marginTop: 6 },
});
