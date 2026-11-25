import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, centeredInput, Row, Screen, Stepper, T } from '@/components/ui';
import { Rays } from '@/components/Wordmark';
import { isBoardGame, PARTY_LIMITS, partyService } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';
import { GoldFrame, Medallion, PARTY_LOOK, ShineSweep } from './parts/Premium';

/** A party game's details: what it is, how it goes, create (rounds for card games) or join with a code. */
export function PartyIntroScreen({ navigation, route }: ScreenProps<'PartyIntro'>) {
  const { kind } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const look = PARTY_LOOK[kind];
  const [min, max] = PARTY_LIMITS[kind];
  const board = isBoardGame(kind);
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
      const res = await partyService.create(kind, board ? 1 : rounds);
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
      <GoldFrame radius={26} colors={look.colors} innerStyle={styles.hero}>
        <View style={styles.rays} pointerEvents="none">
          <Rays size={560} opacity={0.1} count={22} />
        </View>
        <Medallion emoji={look.emoji} size={92} />
        <T style={styles.heroTitle} center>
          {t(`party.${kind}.title`)}
        </T>
        <T variant="small" color="rgba(255,255,255,0.88)" center style={{ marginTop: 4, paddingHorizontal: spacing.sm }}>
          {t(`party.${kind}.tagline`)}
        </T>
        <Row gap={6} style={{ marginTop: spacing.md }}>
          <View style={styles.heroPill}>
            <Ionicons name="people" size={13} color="#FDE68A" />
            <T variant="tiny" color="#fff">
              {t('party.players', { min, max })}
            </T>
          </View>
          <View style={styles.heroPill}>
            <Ionicons name="star" size={13} color="#FDE68A" />
            <T variant="tiny" color="#fff">
              {t('party.pointsOnly')}
            </T>
          </View>
        </Row>
      </GoldFrame>

      {/* How it goes */}
      <T variant="smallBold" muted style={styles.label}>
        {t('party.howItWorks').toUpperCase()}
      </T>
      <View style={[styles.stepsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {steps.map((s, i) => (
          <Row key={i} gap={spacing.md} style={{ alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center' }}>
              <LinearGradient colors={[look.colors[1], look.colors[2]]} style={styles.stepNum}>
                <T variant="tiny" color="#fff" maxFontSizeMultiplier={1}>
                  {i + 1}
                </T>
              </LinearGradient>
              {i < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <T variant="small" style={{ flex: 1, paddingBottom: spacing.md }}>
              {s}
            </T>
          </Row>
        ))}
      </View>

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
                <Medallion emoji={look.emoji} size={40} float={false} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyMedium" style={{ letterSpacing: 2 }}>
                    {g.code}
                  </T>
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
        {board ? null : (
          <Row gap={spacing.md} style={{ marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{t('party.rounds')}</T>
              <T variant="tiny" muted>
                {t('party.roundsDesc')}
              </T>
            </View>
            <Stepper value={rounds} min={3} max={20} onChange={setRounds} width={36} />
          </Row>
        )}
        <Pressable onPress={create} disabled={busy !== null} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
          <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createBtn}>
            <ShineSweep />
            <Ionicons name="sparkles" size={18} color="#3B1D00" />
            <T style={styles.createText}>{busy === 'create' ? t('common.loading') : t('party.create')}</T>
          </LinearGradient>
        </Pressable>
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
  hero: { padding: spacing.lg, alignItems: 'center' },
  rays: { position: 'absolute', top: -220, left: '50%', marginLeft: -280 },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: '#fff', marginTop: spacing.sm, letterSpacing: 0.5 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.35)',
  },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.8 },
  stepsCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, paddingBottom: 0 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  createBtn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  createText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: '#3B1D00' },
  code: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, fontFamily: fonts.bold, fontSize: 20, letterSpacing: 4 },
});
