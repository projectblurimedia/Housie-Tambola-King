import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, centeredInput, Row, Screen, Stepper, T } from '@/components/ui';
import { Rays } from '@/components/Wordmark';
import { partyService, type PartyKind } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

/** Look of each party game (also used by the Home cards). */
export const PARTY_LOOK: Record<PartyKind, { emoji: string; colors: [string, string, string] }> = {
  seeta: { emoji: '🏹', colors: ['#7C2D12', '#EA580C', '#FBBF24'] },
  show: { emoji: '🃏', colors: ['#1E1B4B', '#4F46E5', '#06B6D4'] },
};

/** A party game's details: what it is, how a round goes, create (rounds) or join with a code. */
export function PartyIntroScreen({ navigation, route }: ScreenProps<'PartyIntro'>) {
  const { kind } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const look = PARTY_LOOK[kind];
  const [rounds, setRounds] = useState(5);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const mine = useQuery({ queryKey: ['myParties'], queryFn: partyService.mine });
  const refetchMine = mine.refetch;
  useFocusEffect(
    React.useCallback(() => {
      refetchMine();
    }, [refetchMine]),
  );
  const myGames = (mine.data ?? []).filter((g) => g.kind === kind);

  const create = async () => {
    setBusy('create');
    try {
      const res = await partyService.create(kind, rounds);
      navigation.navigate('Party', { partyId: res.id });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setBusy('join');
    try {
      const id = await partyService.joinByCode(code);
      navigation.navigate('Party', { partyId: id });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const steps = [1, 2, 3, 4].map((n) => t(`party.${kind}.step${n}`));

  return (
    <Screen scroll title={t(`party.${kind}.title`)}>
      {/* Hero */}
      <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.rays} pointerEvents="none">
          <Rays size={520} opacity={0.12} count={20} />
        </View>
        <View style={styles.emojiDisc}>
          <T style={styles.emoji}>{look.emoji}</T>
        </View>
        <T variant="h1" color="#fff" center>
          {t(`party.${kind}.title`)}
        </T>
        <T variant="small" color="rgba(255,255,255,0.9)" center style={{ marginTop: 4 }}>
          {t(`party.${kind}.tagline`)}
        </T>
        <Row gap={6} style={{ marginTop: spacing.md }}>
          <View style={styles.heroPill}>
            <Ionicons name="people" size={13} color="#fff" />
            <T variant="tiny" color="#fff">
              {t('party.players', { min: 3, max: kind === 'seeta' ? 15 : 10 })}
            </T>
          </View>
          <View style={styles.heroPill}>
            <Ionicons name="star" size={13} color="#FDE68A" />
            <T variant="tiny" color="#fff">
              {t('party.pointsOnly')}
            </T>
          </View>
        </Row>
      </LinearGradient>

      {/* How a round goes */}
      <T variant="smallBold" muted style={styles.label}>
        {t('party.howItWorks').toUpperCase()}
      </T>
      <Card style={{ gap: spacing.sm }}>
        {steps.map((s, i) => (
          <Row key={i} gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
            <LinearGradient colors={[look.colors[1], look.colors[2]]} style={styles.stepNum}>
              <T variant="tiny" color="#fff">
                {i + 1}
              </T>
            </LinearGradient>
            <T variant="small" style={{ flex: 1 }}>
              {s}
            </T>
          </Row>
        ))}
      </Card>

      {/* Your open games of this kind */}
      {myGames.length ? (
        <>
          <T variant="smallBold" muted style={styles.label}>
            {t('party.yourGames').toUpperCase()}
          </T>
          <View style={{ gap: spacing.sm }}>
            {myGames.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => navigation.navigate('Party', { partyId: g.id })}
                style={({ pressed }) => [styles.mine, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
              >
                <T style={{ fontSize: 22 }}>{look.emoji}</T>
                <View style={{ flex: 1 }}>
                  <T variant="bodyMedium">{g.code}</T>
                  <T variant="tiny" muted>
                    {t(`party.status_${g.status}`)} · {t('party.playersCount', { count: g.players })}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* Create */}
      <T variant="smallBold" muted style={styles.label}>
        {t('party.newGame').toUpperCase()}
      </T>
      <Card>
        <Row gap={spacing.md}>
          <View style={{ flex: 1 }}>
            <T variant="bodyMedium">{t('party.rounds')}</T>
            <T variant="tiny" muted>
              {t('party.roundsDesc')}
            </T>
          </View>
          <Stepper value={rounds} min={3} max={20} onChange={setRounds} width={36} />
        </Row>
        <Button
          title={t('party.create')}
          variant="gold"
          icon="sparkles"
          loading={busy === 'create'}
          onPress={create}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {/* Join */}
      <T variant="smallBold" muted style={styles.label}>
        {t('party.joinTitle').toUpperCase()}
      </T>
      <Card>
        <Row gap={spacing.sm}>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.code, centeredInput, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          />
          <Button title={t('join.join')} onPress={join} loading={busy === 'join'} disabled={code.length !== 6} style={{ height: 52 }} />
        </Row>
      </Card>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', overflow: 'hidden' },
  rays: { position: 'absolute', top: -200, left: '50%', marginLeft: -260 },
  emojiDisc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(253,230,138,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emoji: { fontSize: 44, lineHeight: 54 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.22)' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.8 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  code: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, fontFamily: fonts.bold, fontSize: 20, letterSpacing: 4 },
});
