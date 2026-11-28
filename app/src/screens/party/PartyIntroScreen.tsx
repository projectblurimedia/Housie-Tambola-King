import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { CoinIcon } from '@/components/CoinIcon';
import { Button, centeredInput, IconButton, Row, Screen, Stepper, T, Toggle } from '@/components/ui';
import { SvgXml } from 'react-native-svg';
import { useMe } from '@/hooks/useMe';
import { isBoardGame, PARTY_LIMITS, partyService, type PartyOptions } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, radius, spacing, ThemeOverride, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';
import { PARTY_LOOK, PARTY_THEME } from './parts/Premium';
import { GAME_ART } from './parts/gameArt';
import { RulesModal } from './parts/RulesModal';
import { DesignPreview, MiniBoard } from './parts/SnakesBoard';
import { useAfterOpen } from '@/hooks/useAfterOpen';
import { BOARD_DESIGNS } from './parts/snakesThemes';
import { CodeInput } from './parts/CodeInput';
import { SNL_BOARDS, SNL_LEVELS, SNL_PER_LEVEL, snlLevelOf } from '@/game/engine/board';

const ENTRY_PRESETS = [0, 10, 25, 50, 100];
const SAFE_CELLS = {
  corners: new Set([22, 14, 2, 10, 12, 6, 8, 16, 18]),
  straight: new Set([22, 14, 2, 10, 12, 7, 11, 13, 17]),
};

/** A tiny 5×5 board showing which squares are safe in a layout. */
function SafeDiagram({ mode, on }: { mode: 'corners' | 'straight'; on: boolean }) {
  return (
    <View style={styles.diagram}>
      {Array.from({ length: 25 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.diagramCell,
            { backgroundColor: SAFE_CELLS[mode].has(i) ? (on ? '#FDE68A' : '#F59E0B') : on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)' },
          ]}
        />
      ))}
    </View>
  );
}

/** One of a few choices: the chosen one turns gold with a tick (the page itself is in the game's colours, so gold stands out). */
function Choice({
  active,
  title,
  desc,
  colors,
  onPress,
  children,
}: {
  active: boolean;
  title: string;
  desc: string;
  colors: [string, string];
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { colors: c } = useThemeColors();
  const body = (
    <>
      {children}
      <T variant="smallBold" color={active ? '#3B1D00' : c.text} center style={{ marginTop: children ? 6 : 0 }}>
        {title}
      </T>
      <T variant="tiny" color={active ? 'rgba(59,29,0,0.8)' : c.textMuted} center>
        {desc}
      </T>
    </>
  );
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      {active ? (
        <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.choice, styles.choiceOn]}>
          {body}
          <View style={styles.choiceTick}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.choice, { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }]}>{body}</View>
      )}
    </Pressable>
  );
}

/** A party game's details: what it is, how it goes, then create (with its options) or join. */
/** Easy / Medium / Hard: each in its own colours (green, amber, red) with its badge; the chosen one
 * lifts a little with a gold rim and a tick, the others dim. */
const LEVEL_LOOK = {
  easy: { colors: ['#34D399', '#059669'], ink: '#047857', soft: '#ECFDF5', icon: '🌱' },
  medium: { colors: ['#FBBF24', '#D97706'], ink: '#B45309', soft: '#FFFBEB', icon: '⚡' },
  hard: { colors: ['#F87171', '#DC2626'], ink: '#B91C1C', soft: '#FEF2F2', icon: '🔥' },
} as const;
/**
 * Easy / Medium / Hard: light cards, easy to read — the level's colour on the badge, title and
 * border. The chosen one fills with its colour (white text), gets a gold rim and a tick.
 */
function LevelTile({ level, active, title, desc, onPress }: { level: keyof typeof LEVEL_LOOK; active: boolean; title: string; desc: string; onPress: () => void }) {
  const lk = LEVEL_LOOK[level];
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: active ? 1 : 0, friction: 6, tension: 160, useNativeDriver: true }).start();
  }, [active, pop]);
  const inner = (
    <>
      <View style={[styles.levelBadge, { backgroundColor: active ? 'rgba(255,255,255,0.95)' : lk.colors[0] }]}>
        <T style={{ fontSize: 20, lineHeight: 26 }} maxFontSizeMultiplier={1}>
          {lk.icon}
        </T>
      </View>
      <T style={[styles.levelTitle, { color: active ? '#FFFFFF' : lk.ink }]} numberOfLines={1}>
        {title}
      </T>
      <T style={[styles.levelDesc, { color: active ? 'rgba(255,255,255,0.95)' : '#4B5563' }]} numberOfLines={2}>
        {desc}
      </T>
      {active ? (
        <View style={styles.choiceTick}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </>
  );
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.9 }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>
        {active ? (
          <LinearGradient colors={['#FFF1A8', '#F5B700', '#B87400']} style={styles.levelRim}>
            <LinearGradient colors={[...lk.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelTile}>
              {inner}
            </LinearGradient>
          </LinearGradient>
        ) : (
          <View style={[styles.levelRim, { backgroundColor: lk.colors[0] }]}>
            <View style={[styles.levelTile, { backgroundColor: lk.soft }]}>{inner}</View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** The design cards all show this one layout (medium, 1), so changing level or layout never redraws them. */
const SAMPLE_BOARD = SNL_BOARDS[SNL_PER_LEVEL];
/** Preview card size (width) and height (frame + strip + board). */
const CARD = 150;
const CARD_H = 160;

/** Grey boxes with a spinner while the board pictures are being drawn. */
function Placeholders({ size, count }: { size: number; count: number }) {
  const { colors } = useThemeColors();
  return (
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.placeholder, { width: size + 6, height: CARD_H + 6, backgroundColor: colors.surfaceAlt }]}>
          {i === 0 ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function PartyIntroScreen(props: ScreenProps<'PartyIntro'>) {
  // The whole page in the game's own colours (cards, text, pop-ups) — not just the header.
  return (
    <ThemeOverride colors={PARTY_THEME[props.route.params.kind].palette}>
      <PartyIntroContent {...props} />
    </ThemeOverride>
  );
}

function PartyIntroContent({ navigation, route }: ScreenProps<'PartyIntro'>) {
  const { kind } = route.params;
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const me = useMe();
  const look = PARTY_LOOK[kind];
  const [min, max] = PARTY_LIMITS[kind];
  const board = isBoardGame(kind);
  const [rounds, setRounds] = useState(5);
  const [entry, setEntry] = useState(0);
  const [boardNo, setBoardNo] = useState(SNL_PER_LEVEL); // medium, board 1
  const level = snlLevelOf(boardNo);
  const [design, setDesign] = useState(0);
  const [pictures, setPictures] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const opened = useAfterOpen();
  // Full previews are heavy: show them one after another (one every 70 ms) so the page stays smooth.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!opened || shown >= BOARD_DESIGNS.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 70);
    return () => clearTimeout(id);
  }, [opened, shown]);
  const [opts, setOpts] = useState<Required<Pick<PartyOptions, 'start' | 'safe' | 'teams' | 'needCut'>>>({
    start: 'enter',
    safe: 'corners',
    teams: false,
    needCut: true,
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const mine = useQuery({ queryKey: ['myParties'], queryFn: partyService.mine });
  const refetchMine = mine.refetch;
  useFocusEffect(
    React.useCallback(() => {
      refetchMine();
    }, [refetchMine]),
  );
  const myGames = (mine.data ?? []).filter((g) => g.kind === kind);
  const coins = Number(me.data?.coins ?? 0);

  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const create = async () => {
    setBusy('create');
    try {
      const res = await partyService.create(kind, board ? 1 : rounds, entry, kind === 'chamma' ? opts : kind === 'snakes' ? { board: boardNo, theme: design, icons: pictures } : null);
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

  return (
    <Screen
      scroll
      title={t(`party.${kind}.title`)}
      headerColors={look.colors}
      backgroundColors={PARTY_THEME[kind].page}
      right={<IconButton icon="information-circle-outline" color="#fff" onPress={() => setRulesOpen(true)} accessibilityLabel={t('party.howItWorks')} />}
    >
      {/* Hero: the game's illustration on its own colours, name, line, and quick facts */}
      <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ alignSelf: 'center', transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }] }}>
          <SvgXml xml={GAME_ART[kind]} width={232} height={174} />
        </Animated.View>
        <T style={styles.heroTitle} center>
          {t(`party.${kind}.title`)}
        </T>
        <T variant="small" color="rgba(255,255,255,0.88)" center style={{ marginTop: 2, paddingHorizontal: spacing.md }}>
          {t(`party.${kind}.tagline`)}
        </T>
        <Row gap={8} style={{ marginTop: spacing.md, justifyContent: 'center' }}>
          <View style={styles.heroChip}>
            <Ionicons name="people" size={12} color={look.accent} />
            <T variant="tiny" color="#fff">
              {t('party.players', { min, max })}
            </T>
          </View>
          <View style={styles.heroChip}>
            <CoinIcon size={13} />
            <T variant="tiny" color="#fff">
              {t('party.coinsOrFree')}
            </T>
          </View>
          <Pressable onPress={() => setRulesOpen(true)} style={styles.heroChip}>
            <Ionicons name="book" size={12} color={look.accent} />
            <T variant="tiny" color="#fff">
              {t('party.rules')}
            </T>
          </Pressable>
        </Row>
      </LinearGradient>
      <RulesModal kind={kind} visible={rulesOpen} onClose={() => setRulesOpen(false)} />
      {kind === 'snakes' ? (
        <DesignPreview
          design={preview}
          board={SNL_BOARDS[boardNo]}
          icons={pictures}
          title={preview === null ? '' : t('party.snakes.designs.' + BOARD_DESIGNS[preview].key)}
          useLabel={t('party.snakes.useDesign')}
          onUse={() => {
            if (preview !== null) setDesign(preview);
            setPreview(null);
          }}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {/* Your open games */}
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
                <LinearGradient colors={look.colors} style={styles.mineBadge}>
                  <T style={{ fontSize: 18, lineHeight: 24 }}>{look.emoji}</T>
                </LinearGradient>
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
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.md }]}>
        {board ? null : (
          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{t('party.rounds')}</T>
              <T variant="tiny" muted>
                {t('party.roundsDesc')}
              </T>
            </View>
            <Stepper value={rounds} min={3} max={20} onChange={setRounds} width={36} />
          </Row>
        )}

        {/* Entry coins */}
        <View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="bodyMedium">{t('party.entry')}</T>
            <Row gap={4}>
              <CoinIcon size={14} />
              <T variant="tiny" muted>
                {t('party.youHave', { count: coins })}
              </T>
            </Row>
          </Row>
          <T variant="tiny" muted>
            {t('party.entryDesc')}
          </T>
          <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
            {ENTRY_PRESETS.map((v) => {
              const on = entry === v;
              const short = v > coins;
              return (
                <Pressable key={v} onPress={() => setEntry(v)} disabled={short} style={({ pressed }) => [{ width: '18.5%', opacity: short ? 0.4 : 1 }, pressed && { transform: [{ scale: 0.95 }] }]}>
                  {on ? (
                    <LinearGradient colors={look.colors} style={styles.entryChip}>
                      {v ? <CoinIcon size={13} /> : null}
                      <T variant="smallBold" color="#fff" maxFontSizeMultiplier={1}>
                        {v ? v : t('party.free')}
                      </T>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.entryChip, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}>
                      {v ? <CoinIcon size={13} /> : null}
                      <T variant="smallBold" maxFontSizeMultiplier={1}>
                        {v ? v : t('party.free')}
                      </T>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Row>
        </View>

        {/* Snakes & Ladders: level → board design (mini boards like the game, with a preview) →
            pictures on/off → snakes & ladders placement. The heavy drawings wait until the screen
            has opened (placeholders first), so tapping the game card opens it at once. */}
        {kind === 'snakes' ? (
          <View>
            <T variant="bodyMedium" style={{ marginBottom: 6 }}>
              {t('party.snakes.level')}
            </T>
            <Row gap={spacing.sm} style={{ marginBottom: spacing.md }}>
              {SNL_LEVELS.map((lv, li) => (
                <LevelTile
                  key={lv}
                  level={lv}
                  active={level === lv}
                  title={t('party.snakes.' + lv)}
                  desc={t('party.snakes.' + lv + 'Desc')}
                  onPress={() => setBoardNo(li * SNL_PER_LEVEL + (boardNo % SNL_PER_LEVEL))}
                />
              ))}
            </Row>

            <Row gap={spacing.md} style={styles.picRow}>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('party.snakes.pictures')}</T>
                <T variant="tiny" muted>
                  {t('party.snakes.picturesDesc')}
                </T>
              </View>
              <Toggle value={pictures} onValueChange={setPictures} tint="#F5B700" />
            </Row>
            <T variant="bodyMedium">{t('party.snakes.design')}</T>
            <T variant="tiny" muted>
              {t('party.snakes.designDesc')}
            </T>
            {opened ? (
              <ScrollView horizontal removeClippedSubviews showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {BOARD_DESIGNS.map((d, i) => {
                  const on = design === i;
                  return (
                    <Pressable key={d.key} onPress={() => setDesign(i)} style={({ pressed }) => [{ alignItems: 'center', gap: 4 }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <LinearGradient colors={on ? ['#FFF1A8', '#F5B700', '#B87400'] : ['transparent', 'transparent']} style={styles.boardEdge}>
                        {i < shown ? <MiniBoard design={i} board={SAMPLE_BOARD} size={CARD} label={String(i + 1)} icons={pictures} /> : <View style={[styles.placeholder, { width: CARD, height: CARD_H, backgroundColor: d.frame }]} />}
                      </LinearGradient>
                      <T variant="tiny" style={{ fontFamily: on ? fonts.bold : fonts.medium }} numberOfLines={1}>
                        {t('party.snakes.designs.' + d.key)}
                      </T>
                      <Pressable onPress={() => setPreview(i)} hitSlop={8} style={styles.eye} accessibilityLabel={t('party.snakes.preview')}>
                        <Ionicons name="eye" size={15} color="#fff" />
                      </Pressable>
                      {on ? (
                        <View style={[styles.boardTick, { left: 8, right: undefined }]}>
                          <Ionicons name="checkmark" size={14} color="#3B1D00" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Placeholders size={CARD} count={3} />
            )}


            <T variant="bodyMedium" style={{ marginTop: spacing.sm }}>
              {t('party.snakes.chooseBoard')}
            </T>
            <T variant="tiny" muted>
              {t('party.snakes.chooseBoardDesc')}
            </T>
            {opened && shown >= BOARD_DESIGNS.length ? (
              <ScrollView horizontal removeClippedSubviews showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {SNL_BOARDS.map((b, i) => {
                  if (snlLevelOf(i) !== level) return null;
                  const on = boardNo === i;
                  return (
                    <Pressable key={i} onPress={() => setBoardNo(i)} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <LinearGradient colors={on ? ['#FFF1A8', '#F5B700', '#B87400'] : [colors.border, colors.border]} style={styles.boardEdge}>
                        <MiniBoard design={design} board={b} size={CARD} label={String((i % SNL_PER_LEVEL) + 1)} icons={pictures} />
                      </LinearGradient>
                      {on ? (
                        <View style={styles.boardTick}>
                          <Ionicons name="checkmark" size={14} color="#3B1D00" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Placeholders size={CARD} count={3} />
            )}
          </View>
        ) : null}

        {/* Ashta Chamma rules */}
        {kind === 'chamma' ? (
          <>
            <View>
              <T variant="bodyMedium" style={{ marginBottom: 6 }}>
                {t('party.chamma.optStart')}
              </T>
              <Row gap={spacing.sm}>
                <Choice active={opts.start === 'enter'} colors={look.colors} title={t('party.chamma.startEnter')} desc={t('party.chamma.startEnterDesc')} onPress={() => setOpts({ ...opts, start: 'enter' })} />
                <Choice active={opts.start === 'board'} colors={look.colors} title={t('party.chamma.startBoard')} desc={t('party.chamma.startBoardDesc')} onPress={() => setOpts({ ...opts, start: 'board' })} />
              </Row>
            </View>
            <View>
              <T variant="bodyMedium" style={{ marginBottom: 6 }}>
                {t('party.chamma.optSafe')}
              </T>
              <Row gap={spacing.sm}>
                {(['corners', 'straight'] as const).map((m) => (
                  <Choice
                    key={m}
                    active={opts.safe === m}
                    colors={look.colors}
                    title={t(`party.chamma.safe_${m}`)}
                    desc={t(`party.chamma.safe_${m}_desc`)}
                    onPress={() => setOpts({ ...opts, safe: m })}
                  >
                    <SafeDiagram mode={m} on={opts.safe === m} />
                  </Choice>
                ))}
              </Row>
            </View>
            <Row gap={spacing.md}>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">{t('party.chamma.optTeams')}</T>
                <T variant="tiny" muted>
                  {t('party.chamma.optTeamsDesc')}
                </T>
              </View>
              <Toggle value={opts.teams} onValueChange={(teams) => setOpts({ ...opts, teams })} />
            </Row>
            <View>
              <T variant="bodyMedium" style={{ marginBottom: 6 }}>
                {t('party.chamma.optInside')}
              </T>
              <Row gap={spacing.sm}>
                <Choice active={opts.needCut} colors={look.colors} title={t('party.chamma.cutNeeded')} desc={t('party.chamma.cutNeededDesc')} onPress={() => setOpts({ ...opts, needCut: true })} />
                <Choice active={!opts.needCut} colors={look.colors} title={t('party.chamma.cutNotNeeded')} desc={t('party.chamma.cutNotNeededDesc')} onPress={() => setOpts({ ...opts, needCut: false })} />
              </Row>
            </View>
          </>
        ) : null}

        {/* Same plain gold button as Housie's Start game. */}
        <Button title={t('party.create')} variant="gold" icon="add-circle" loading={busy === 'create'} disabled={busy !== null && busy !== 'create'} onPress={create} />
      </View>

      {/* Join */}
      <T variant="smallBold" muted style={styles.label}>
        {t('party.joinTitle').toUpperCase()}
      </T>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <T variant="tiny" muted style={{ marginBottom: spacing.sm }}>
          {t('party.joinHint')}
        </T>
        <CodeInput value={code} onChange={setCode} onSubmit={join} busy={busy === 'join'} accent={look.colors[1]} />
      </View>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, padding: spacing.lg, paddingTop: spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroWatermark: { position: 'absolute', right: -14, bottom: -24, fontSize: 130, lineHeight: 150, opacity: 0.2 },
  heroBadge: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: '#fff' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.8 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  mineBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  entryChip: { height: 38, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  choice: { borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minHeight: 70, justifyContent: 'center' },
  choiceOn: { borderWidth: 2, borderColor: '#FFFFFF' },
  levelRim: { borderRadius: 18, padding: 2.5 },
  levelTile: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', minHeight: 112 },
  levelBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  levelTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21 },
  levelDesc: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: 2 },
  choiceTick: { position: 'absolute', right: 5, top: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  diagram: { width: 46, height: 46, flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  diagramCell: { width: 8, height: 8, borderRadius: 2 },
  boardEdge: { borderRadius: 11, padding: 3 },
  eye: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  placeholder: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  picRow: { alignItems: 'center', marginTop: spacing.xs, paddingVertical: spacing.sm },
  boardTick: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  joinBtn: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  joinText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: '#fff' },
  code: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, fontFamily: fonts.bold, fontSize: 20, letterSpacing: 4 },
});
