import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import { circleSeats, isShowHand, nextSeatPlayer, showColor } from '@/game/engine/party';
import type { PartyOptions, PartyState } from '@/services/partyService';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { showItem } from './CategoryPicker';
import { RoundBar } from './PartyCommon';
import { GoldFrame, ShineSweep } from './Premium';
import { playGameSound } from '@/services/sounds';

const SEAT = 60;
/** Place in the SHOW race, e.g. "#1" (same in every language). */
const ord = (n: number) => `#${n}`;

/** The face of card n: the category's emoji + name (or the colour's icon), on its colour. */
function CardFace({ n, options, small }: { n: number; options: PartyOptions; small?: boolean }) {
  const { t } = useTranslation();
  const c = showColor(n);
  const colorsCat = (options.category ?? 'colors') === 'colors';
  const item = showItem(options, n, t);
  return (
    <LinearGradient colors={[c.hex, c.dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.face}>
      {/* Gloss */}
      <LinearGradient colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.2, y: 0.7 }} style={StyleSheet.absoluteFill} />
      {colorsCat ? (
        <>
          <Ionicons name={c.icon} size={11} color="rgba(255,255,255,0.9)" style={styles.cornerTL} />
          <Ionicons name={c.icon} size={small ? 22 : 36} color="#fff" />
          <Ionicons name={c.icon} size={11} color="rgba(255,255,255,0.9)" style={styles.cornerBR} />
        </>
      ) : (
        <>
          <T style={{ fontSize: small ? 22 : 34, lineHeight: small ? 28 : 42 }} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {item.e || '★'}
          </T>
          {small ? null : (
            <T style={styles.faceName} numberOfLines={1} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              {item.n}
            </T>
          )}
        </>
      )}
    </LinearGradient>
  );
}

/** A card in my hand: lifts when picked, slides in when it just arrived. */
function HandCard({
  n,
  options,
  selected,
  fresh,
  disabled,
  onPress,
}: {
  n: number;
  options: PartyOptions;
  selected: boolean;
  fresh: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [selected, lift]);
  useEffect(() => {
    if (!fresh) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 460, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [fresh, n, enter]);
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1 }}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) },
          ],
        }}
      >
        <View style={[styles.cardFrame, selected && styles.cardSelected]}>
          <CardFace n={n} options={options} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Show, one round: everyone sits evenly round a wooden table (me at the bottom). Each turn I pick
 * a card to pass to the next player (on my left); when all have picked, every card moves at once.
 * Four of a kind → SHOW; then everyone races to tap SHOW — the last one gets nothing.
 */
export function ShowBoard({
  state,
  seconds,
  onPick,
  onShow,
}: {
  state: PartyState;
  seconds: number;
  onPick: (index: number) => void;
  onShow: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const g = state.game;
  const me = state.me;
  const options = g.options ?? {};
  const active = state.players.filter((p) => p.active);
  const mePlayer = active.find((p) => p.userId === me.userId);
  const hand = me.hand ?? [];
  const shows = g.state.shows ?? [];
  const iShowed = shows.includes(me.userId);
  const canShow = (g.phase === 'pass' && isShowHand(hand)) || (g.phase === 'show' && !iShowed);
  const next = mePlayer ? nextSeatPlayer(active, mePlayer.seat) : undefined;
  const pickedCount = active.filter((p) => p.picked).length;

  // Slots that changed since the last turn slide in.
  const prevHand = useRef<number[]>(hand);
  const [freshSlots, setFreshSlots] = useState<number[]>([]);
  useEffect(() => {
    const prev = prevHand.current;
    const changed = hand.map((c, i) => (prev[i] !== c ? i : -1)).filter((i) => i >= 0);
    prevHand.current = hand;
    if (changed.length && changed.length < 4) setFreshSlots(changed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.turnNo, g.roundNo, hand.join(',')]);

  // Sounds: a swish when the cards pass round, a gong when SHOW is called.
  const heard = useRef({ turn: g.turnNo, phase: g.phase, round: g.roundNo });
  useEffect(() => {
    const h = heard.current;
    if (g.phase === 'show' && h.phase !== 'show') playGameSound('show');
    else if (g.phase === 'pass' && g.roundNo === h.round && g.turnNo > h.turn) playGameSound('pass');
    heard.current = { turn: g.turnNo, phase: g.phase, round: g.roundNo };
  }, [g.turnNo, g.phase, g.roundNo]);
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canShow) return;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => {
      loop.stop();
      ring.setValue(0);
    };
  }, [canShow, ring]);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!canShow) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canShow, pulse]);

  const size = Math.min(width - spacing.lg * 2, 380);
  const radiusPx = size / 2 - SEAT / 2 - 2;
  const seats = mePlayer ? circleSeats(active, mePlayer.seat, radiusPx) : [];
  const nameOf = (id?: string) => state.players.find((p) => p.userId === id)?.name ?? '';
  const tableSize = size - SEAT - 6;

  const centre =
    g.phase === 'reveal'
      ? t('party.show.roundOver')
      : g.phase === 'show'
        ? t('party.show.someoneShowed', { name: nameOf(g.state.firstId) })
        : t('party.show.turn', { n: g.turnNo });

  return (
    <View>
      <RoundBar state={state} seconds={seconds} label={g.phase === 'reveal' ? t('party.nextRoundIn', { count: seconds }) : undefined} />

      <View style={{ width: size, height: size, alignSelf: 'center' }}>
        {/* Wooden rim → gold hairline → green felt */}
        <LinearGradient
          colors={['#8B5A2B', '#5C3A1A', '#3B2410']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.rim, { width: tableSize, height: tableSize, borderRadius: tableSize / 2, left: (size - tableSize) / 2, top: (size - tableSize) / 2 }]}
        >
          <LinearGradient colors={['#F5D06F', '#8A6100']} style={{ flex: 1, borderRadius: tableSize / 2, padding: 1.5 }}>
            <LinearGradient colors={['#0F7A55', '#065F46', '#033D2D']} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, borderRadius: tableSize / 2 }} />
          </LinearGradient>
        </LinearGradient>
        {/* Centre */}
        <View style={styles.centre} pointerEvents="none">
          {g.phase === 'show' && g.state.color !== undefined ? (
            <View style={[styles.miniCard]}>
              <CardFace n={g.state.color} options={options} small />
            </View>
          ) : (
            <Ionicons name="sync" size={26} color="rgba(253,230,138,0.9)" />
          )}
          <T style={styles.centreText} numberOfLines={2} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
            {centre}
          </T>
          {g.phase === 'pass' ? (
            <T variant="tiny" color="rgba(255,255,255,0.75)" center maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
              {t('party.show.picked', { count: pickedCount, total: active.length })}
            </T>
          ) : null}
        </View>
        {seats.map(({ player: p, x, y }) => {
          const place = shows.indexOf(p.userId);
          const isMe = p.userId === me.userId;
          const isNext = p.userId === next?.userId;
          return (
            <View key={p.userId} style={[styles.seat, { left: size / 2 + x - SEAT / 2, top: size / 2 + y - SEAT / 2 }]}>
              <LinearGradient colors={isMe ? ['#FFF1A8', '#D4A017'] : isNext ? ['#86EFAC', '#16A34A'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.25)']} style={styles.seatRing}>
                <Avatar avatarKey={p.avatarKey} size={40} />
              </LinearGradient>
              {g.phase === 'pass' && p.picked ? (
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              ) : null}
              {place >= 0 ? (
                <View style={[styles.badge, styles.placeBadge]}>
                  <T style={styles.placeText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                    {ord(place + 1)}
                  </T>
                </View>
              ) : null}
              <T style={styles.seatName} numberOfLines={1} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {isMe ? t('party.you') : p.name}
              </T>
            </View>
          );
        })}
      </View>

      {g.phase === 'reveal' ? (
        <GoldFrame radius={18} style={{ marginTop: spacing.md }} innerStyle={{ padding: spacing.md }}>
          {[...(g.state.results ?? [])]
            .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
            .map((r) => {
              const p = state.players.find((x) => x.userId === r.userId);
              return (
                <Row key={r.userId} gap={spacing.sm} style={{ paddingVertical: 5 }}>
                  <T variant="smallBold" color="#FDE68A" style={{ width: 34 }}>
                    {r.place ? ord(r.place) : '—'}
                  </T>
                  <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={28} />
                  <T variant="small" color="#fff" style={{ flex: 1 }} numberOfLines={1}>
                    {p?.name ?? ''}
                  </T>
                  <T variant="smallBold" color={r.points > 0 ? '#86EFAC' : '#FCA5A5'}>
                    +{r.points}
                  </T>
                </Row>
              );
            })}
        </GoldFrame>
      ) : (
        <>
          <T variant="small" muted center style={{ marginTop: spacing.sm }}>
            {g.phase === 'show'
              ? iShowed
                ? t('party.show.youShowed')
                : t('party.show.tapFast')
              : isShowHand(hand)
                ? t('party.show.youHaveShow')
                : me.pick !== null
                  ? t('party.show.waitingOthers')
                  : t('party.show.pickOne', { name: next?.name ?? '' })}
          </T>

          {/* My hand on a dark velvet tray */}
          <GoldFrame radius={20} style={{ marginTop: spacing.md }} innerStyle={{ paddingHorizontal: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Row gap={spacing.sm}>
              {hand.map((c, i) => (
                <HandCard
                  key={i}
                  n={c}
                  options={options}
                  selected={me.pick === i}
                  fresh={freshSlots.includes(i)}
                  disabled={g.phase !== 'pass'}
                  onPress={() => {
                    playGameSound('pick');
                    onPick(i);
                  }}
                />
              ))}
            </Row>
          </GoldFrame>

          {/* SHOW */}
          <Animated.View style={{ marginTop: spacing.lg, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
            {/* A glowing ring spreads out from the button while SHOW can be pressed. */}
            {canShow ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.showRing,
                  { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scaleX: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { scaleY: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] },
                ]}
              />
            ) : null}
            <Pressable
              onPress={() => {
                if (!canShow) return;
                playGameSound('show');
                onShow();
              }}
              disabled={!canShow}
            >
              <LinearGradient
                colors={canShow ? ['#FF5F6D', '#F97316', '#FACC15'] : [colors.surfaceAlt, colors.surfaceAlt]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.showBtn, { borderColor: canShow ? '#FFF1A8' : colors.border }]}
              >
                {canShow ? <ShineSweep every={900} /> : null}
                <View style={[styles.showIcon, { backgroundColor: canShow ? 'rgba(255,255,255,0.25)' : 'transparent' }]}>
                  <Ionicons name="megaphone" size={22} color={canShow ? '#FFFFFF' : colors.textMuted} />
                </View>
                <T style={[styles.showText, { color: canShow ? '#FFFFFF' : colors.textMuted }, canShow && styles.showTextOn]}>{t('party.show.button')}</T>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rim: { position: 'absolute', padding: 7 },
  centre: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SEAT + 10 },
  centreText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: '#fff', textAlign: 'center', marginTop: 4 },
  miniCard: { width: 46, height: 60, borderRadius: 8, padding: 2, backgroundColor: '#fff' },
  seat: { position: 'absolute', width: SEAT, alignItems: 'center' },
  seatRing: { padding: 2.5, borderRadius: 24 },
  seatName: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 13,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 2,
    maxWidth: SEAT + 8,
    overflow: 'hidden',
  },
  badge: { position: 'absolute', right: 2, top: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  placeBadge: { backgroundColor: '#FDE68A', borderWidth: 1, borderColor: '#B45309' },
  placeText: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 12, color: '#3B1D00' },
  cardFrame: { borderRadius: radius.md + 3, padding: 3, backgroundColor: '#FFFDF5', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  cardSelected: { backgroundColor: '#FDE68A', padding: 3.5 },
  face: { height: 100, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 1 },
  faceName: { position: 'absolute', bottom: 5, left: 4, right: 4, textAlign: 'center', fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: '#fff' },
  cornerTL: { position: 'absolute', left: 6, top: 6 },
  cornerBR: { position: 'absolute', right: 6, bottom: 6, transform: [{ rotate: '180deg' }] },
  showBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 68, borderRadius: 34, borderWidth: 2.5, overflow: 'hidden' },
  showRing: { position: 'absolute', left: 0, right: 0, top: 0, height: 68, borderRadius: 34, borderWidth: 3, borderColor: '#FACC15' },
  showIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  showTextOn: { textShadowColor: 'rgba(124,45,18,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 }, letterSpacing: 3 },
  showText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: 3 },
});
