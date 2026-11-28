import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
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
import { MiniBoard } from './parts/SnakesBoard';
import { useAfterOpen } from '@/hooks/useAfterOpen';
import { BOARD_DESIGNS, designTile } from './parts/snakesThemes';
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
  easy: { bars: 1, color: '#4ADE80' },
  medium: { bars: 2, color: '#FBBF24' },
  hard: { bars: 3, color: '#F87171' },
} as const;

/**
 * Easy / Medium / Hard as dark glass cards with a signal-style difficulty meter (1, 2 or 3 bars
 * lit in the level's colour), the name, and the board's snakes and ladders. The chosen one gets a
 * gold edge, a soft gold glow and a tick; the others stay fully readable.
 */
function LevelCard({ level, active, title, snakes, ladders, onPress }: { level: keyof typeof LEVEL_LOOK; active: boolean; title: string; snakes: number; ladders: number; onPress: () => void }) {
  const lk = LEVEL_LOOK[level];
  const glow = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(glow, { toValue: active ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [active, glow]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <View style={[styles.lvCard, active ? styles.lvCardOn : null]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lvGlow, { opacity: glow }]} />
        <View style={styles.lvMeter}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.lvBar, { height: 8 + i * 6, backgroundColor: i < lk.bars ? lk.color : 'rgba(255,255,255,0.22)' }]} />
          ))}
        </View>
        <T style={[styles.lvName, { color: active ? '#FDE68A' : '#FFFFFF' }]} numberOfLines={1} maxFontSizeMultiplier={1}>
          {title}
        </T>
        <View style={styles.lvRow}>
          <T style={styles.lvStat} maxFontSizeMultiplier={1}>
            🐍 {snakes}
          </T>
          <View style={styles.lvDot} />
          <T style={styles.lvStat} maxFontSizeMultiplier={1}>
            🪜 {ladders}
          </T>
        </View>
        {active ? (
          <View style={styles.lvTick}>
            <Ionicons name="checkmark" size={12} color="#3B1D00" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * A board design as a light card (no heavy drawing): the design's frame, a 5 × 5 mosaic of its
 * square colours, its picture in the middle and its name. The chosen one gets a gold ring + tick.
 */
const DesignCard = React.memo(function DesignCard({ index, active, name, pictures, onPress }: { index: number; active: boolean; name: string; pictures: boolean; onPress: () => void }) {
  const d = BOARD_DESIGNS[index];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ alignItems: 'center', gap: 4, width: 104 }, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <LinearGradient colors={active ? ['#FFF1A8', '#F5B700', '#B87400'] : ['transparent', 'transparent']} style={styles.designRing}>
        <View style={[styles.designFrame, { backgroundColor: d.frame, borderColor: d.edge }]}>
          <View style={styles.mosaic}>
            {Array.from({ length: 25 }, (_, i) => (
              <View key={i} style={[styles.mosaicTile, { backgroundColor: designTile(d, 76 + i) }]} />
            ))}
          </View>
          <View style={styles.designBadge}>
            <T style={{ fontSize: 18, lineHeight: 24 }} maxFontSizeMultiplier={1}>
              {pictures ? d.icons[0] : d.topIcon}
            </T>
          </View>
        </View>
      </LinearGradient>
      <T variant="tiny" style={{ fontFamily: active ? fonts.bold : fonts.medium }} numberOfLines={1}>
        {name}
      </T>
      {active ? (
        <View style={styles.designTick}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
});

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
  const opened = useAfterOpen();
  const { width: screenW } = useWindowDimensions();
  /** The one big preview: as wide as the page allows. */
  const previewSize = Math.min(screenW - spacing.lg * 2 - 8, 380);
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

      {/* New game: a featured card — gold edge, a header strip in the game's colours, then the options. */}
      <LinearGradient colors={['#FFF1A8', '#D4A017', '#8A6100', '#F5D06F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newEdge}>
        <View style={[styles.newCard, { backgroundColor: colors.surface }]}>
          <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newHead}>
            <View style={styles.newHeadIcon}>
              <Ionicons name="sparkles" size={18} color="#FDE68A" />
            </View>
            <View style={{ flex: 1 }}>
              <T style={styles.newTitle}>{t('party.newGame')}</T>
              <T variant="tiny" color="rgba(255,255,255,0.88)">
                {t('party.newGameSub')}
              </T>
            </View>
            <T style={{ fontSize: 26, lineHeight: 32 }} maxFontSizeMultiplier={1}>
              {look.emoji}
            </T>
          </LinearGradient>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
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

        {/* Snakes & Ladders: level → pictures → design (light cards) → placement (5 buttons) → one
            big preview of exactly what's chosen. Only that one board is drawn, so nothing lags. */}
        {kind === 'snakes' ? (
          <View>
            <T variant="bodyMedium" style={{ marginBottom: 8 }}>
              {t('party.snakes.level')}
            </T>
            <Row gap={spacing.sm} style={{ marginBottom: spacing.md, alignItems: 'stretch' }}>
              {SNL_LEVELS.map((lv, li) => {
                const b = SNL_BOARDS[li * SNL_PER_LEVEL + (boardNo % SNL_PER_LEVEL)];
                return (
                  <LevelCard
                    key={lv}
                    level={lv}
                    active={level === lv}
                    title={t('party.snakes.' + lv)}
                    snakes={Object.keys(b.snakes).length}
                    ladders={Object.keys(b.ladders).length}
                    onPress={() => setBoardNo(li * SNL_PER_LEVEL + (boardNo % SNL_PER_LEVEL))}
                  />
                );
              })}
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

            <T variant="bodyMedium" style={{ marginTop: spacing.sm }}>
              {t('party.snakes.design')}
            </T>
            <T variant="tiny" muted>
              {t('party.snakes.designDesc')}
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.sm }}>
              {BOARD_DESIGNS.map((d, i) => (
                <DesignCard key={d.key} index={i} active={design === i} name={t('party.snakes.designs.' + d.key)} pictures={pictures} onPress={() => setDesign(i)} />
              ))}
            </ScrollView>

            <T variant="bodyMedium" style={{ marginTop: spacing.sm }}>
              {t('party.snakes.chooseBoard')}
            </T>
            <T variant="tiny" muted>
              {t('party.snakes.chooseBoardDesc')}
            </T>
            <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
              {Array.from({ length: SNL_PER_LEVEL }, (_, k) => {
                const idx = SNL_BOARDS.findIndex((_b, i) => snlLevelOf(i) === level) + k;
                const on = boardNo === idx;
                return (
                  <Pressable key={k} onPress={() => setBoardNo(idx)} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    {on ? (
                      <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} style={styles.placeBtn}>
                        <T style={[styles.placeNum, { color: '#3B1D00' }]} maxFontSizeMultiplier={1}>
                          {k + 1}
                        </T>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.placeBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}>
                        <T style={[styles.placeNum, { color: colors.text }]} maxFontSizeMultiplier={1}>
                          {k + 1}
                        </T>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </Row>

            {/* The one big preview: exactly the board everyone will play on. */}
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              {opened ? (
                <MiniBoard design={design} board={SNL_BOARDS[boardNo]} size={previewSize} icons={pictures} still={false} />
              ) : (
                <View style={[styles.placeholder, { width: previewSize, height: previewSize + 10, backgroundColor: colors.surfaceAlt }]}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </View>
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
        </View>
      </LinearGradient>

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

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  newEdge: { marginTop: spacing.lg, borderRadius: 22, padding: 2 },
  newCard: { borderRadius: 20, overflow: 'hidden' },
  newHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 12 },
  newHeadIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(253,230,138,0.6)' },
  newTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  lvCard: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', minHeight: 112, justifyContent: 'center' },
  lvCardOn: { borderWidth: 2.5, borderColor: '#F5B700', backgroundColor: 'rgba(15,23,42,0.75)' },
  lvGlow: { backgroundColor: 'rgba(245,183,0,0.16)' },
  lvMeter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20, marginBottom: 6 },
  lvBar: { width: 7, borderRadius: 2 },
  lvName: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  lvRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  lvStat: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15, color: 'rgba(255,255,255,0.9)' },
  lvDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  lvTick: { position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5B700', alignItems: 'center', justifyContent: 'center' },
  designRing: { borderRadius: 14, padding: 3 },
  designFrame: { width: 94, height: 94, borderRadius: 11, borderWidth: 2, padding: 4, alignItems: 'center', justifyContent: 'center' },
  mosaic: { width: 80, height: 80, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 4, overflow: 'hidden' },
  mosaicTile: { width: 16, height: 16, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.12)' },
  designBadge: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  designTick: { position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  placeBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
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
