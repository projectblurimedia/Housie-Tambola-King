import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Card, Row, T } from '@/components/ui';
import { rolePoints } from '@/game/engine/party';
import type { PartyPlayer, PartyState } from '@/services/partyService';
import { radius, spacing, useThemeColors } from '@/theme';
import { RoundBar } from './PartyCommon';

const ROLE_LOOK: Record<string, { colors: [string, string]; emoji: string }> = {
  ram: { colors: ['#F59E0B', '#B45309'], emoji: '🏹' },
  seeta: { colors: ['#EC4899', '#9D174D'], emoji: '🌸' },
  lakshmana: { colors: ['#22C55E', '#15803D'], emoji: '🛡️' },
  anjaneya: { colors: ['#F97316', '#C2410C'], emoji: '🐒' },
};
const roleLook = (role: string | null | undefined) => ROLE_LOOK[role ?? ''] ?? { colors: ['#8B5CF6', '#5B21B6'] as [string, string], emoji: '👑' };

/**
 * Find Seeta, one round: my secret role (flips in each round), then Ram picks who Seeta is —
 * Ram sees everyone else as tiles; the rest watch. The reveal shows every role and the points.
 */
export function SeetaBoard({
  state,
  seconds,
  onGuess,
}: {
  state: PartyState;
  seconds: number;
  onGuess: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const g = state.game;
  const me = state.me;
  const ramId = g.state.ramId;
  const ram = state.players.find((p) => p.userId === ramId);
  const iAmRam = ramId === me.userId;
  const [asking, setAsking] = useState<PartyPlayer | null>(null);
  const flip = useRef(new Animated.Value(0)).current;

  // A new round deals a new role: flip the card in.
  useEffect(() => {
    flip.setValue(0);
    Animated.spring(flip, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }).start();
  }, [g.roundNo, flip]);

  const roleName = (role: string | null | undefined) => (role ? t(`party.role.${role}`) : '—');
  const nameOf = (id?: string) => state.players.find((p) => p.userId === id)?.name ?? '';

  if (g.phase === 'reveal') {
    const roles = g.state.roles ?? [];
    return (
      <View>
        <RoundBar state={state} seconds={seconds} label={t('party.nextRoundIn', { count: seconds })} />
        <LinearGradient
          colors={g.state.correct ? ['#16A34A', '#065F46'] : ['#DC2626', '#7F1D1D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resultBanner}
        >
          <T style={{ fontSize: 40, lineHeight: 48 }}>{g.state.correct ? '🎯' : '🙈'}</T>
          <T variant="h2" color="#fff" center>
            {g.state.correct ? t('party.seeta.found', { ram: nameOf(g.state.ramId) }) : t('party.seeta.missed', { ram: nameOf(g.state.ramId) })}
          </T>
          <T variant="small" color="rgba(255,255,255,0.9)" center>
            {g.state.correct
              ? t('party.seeta.foundDesc', { seeta: nameOf(g.state.seetaId) })
              : t('party.seeta.missedDesc', { guess: nameOf(g.state.guessId), seeta: nameOf(g.state.seetaId) })}
          </T>
        </LinearGradient>
        <Card style={{ marginTop: spacing.md, paddingVertical: spacing.sm }}>
          {roles.map((r) => {
            const p = state.players.find((x) => x.userId === r.userId);
            const look = roleLook(r.role);
            return (
              <Row key={r.userId} gap={spacing.sm} style={{ paddingVertical: 5 }}>
                <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={30} />
                <View style={{ flex: 1 }}>
                  <T variant="smallBold" numberOfLines={1} color={r.userId === me.userId ? colors.primary : undefined}>
                    {p?.name ?? ''}
                  </T>
                  <T variant="tiny" muted>
                    {look.emoji} {roleName(r.role)}
                  </T>
                </View>
                <T variant="smallBold" color={r.points > 0 ? colors.success : colors.textMuted}>
                  +{r.points}
                </T>
              </Row>
            );
          })}
        </Card>
      </View>
    );
  }

  // Guess phase
  const look = roleLook(me.role);
  const others = state.players.filter((p) => p.active && p.userId !== me.userId);
  return (
    <View>
      <RoundBar state={state} seconds={seconds} />
      <Animated.View
        style={{
          opacity: flip,
          transform: [
            { perspective: 800 },
            { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
            { scale: flip.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        }}
      >
        <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.roleCard}>
          <T variant="tiny" color="rgba(255,255,255,0.85)" style={{ letterSpacing: 2 }}>
            {t('party.seeta.youAre').toUpperCase()}
          </T>
          <T style={{ fontSize: 54, lineHeight: 64 }}>{look.emoji}</T>
          <T variant="hero" color="#fff" center>
            {roleName(me.role)}
          </T>
          <View style={styles.pointsPill}>
            <Ionicons name="star" size={12} color="#FDE68A" />
            <T variant="smallBold" color="#fff">
              {me.role === 'ram' || me.role === 'seeta' ? t('party.seeta.ramSeetaPoints') : t('party.pointsN', { count: rolePoints(me.role) })}
            </T>
          </View>
          <T variant="small" color="rgba(255,255,255,0.92)" center style={{ marginTop: spacing.sm }}>
            {me.role === 'ram' ? t('party.seeta.ramHint') : me.role === 'seeta' ? t('party.seeta.seetaHint') : t('party.seeta.otherHint')}
          </T>
        </LinearGradient>
      </Animated.View>

      {iAmRam ? (
        <>
          <T variant="h3" center style={{ marginTop: spacing.lg }}>
            {t('party.seeta.whoIsSeeta')}
          </T>
          <View style={styles.grid}>
            {others.map((p) => (
              <Pressable
                key={p.userId}
                onPress={() => setAsking(p)}
                style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <Avatar avatarKey={p.avatarKey} size={48} />
                <T variant="smallBold" numberOfLines={1} style={{ marginTop: 6 }}>
                  {p.name}
                </T>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Card style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Row gap={spacing.sm}>
            <Avatar avatarKey={ram?.avatarKey ?? 'a1'} size={40} ring="#F59E0B" />
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{t('party.seeta.ramIs', { name: ram?.name ?? '' })}</T>
              <T variant="tiny" muted>
                {t('party.seeta.ramFinding')}
              </T>
            </View>
            <T style={{ fontSize: 26 }}>🏹</T>
          </Row>
        </Card>
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
  roleCard: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(253,230,138,0.6)' },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.22)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.md },
  tile: { width: '31%', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: radius.lg, borderWidth: 1 },
  resultBanner: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: 4 },
});
