import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { Card, Row, T } from '@/components/ui';
import { circleSeats, isShowHand, nextSeatPlayer, showColor } from '@/game/engine/party';
import type { PartyState } from '@/services/partyService';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';
import { RoundBar } from './PartyCommon';

const SEAT = 58;
/** Place in the SHOW race, e.g. "#1" (same in every language). */
const ord = (n: number) => `#${n}`;

/** One colour card: gradient face, its icon big in the middle and small in the corners. */
function ColorCard({
  color,
  selected,
  fresh,
  disabled,
  onPress,
}: {
  color: number;
  selected: boolean;
  /** Just arrived from the previous player: slides in. */
  fresh: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = showColor(color);
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [selected, lift]);
  useEffect(() => {
    if (!fresh) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [fresh, color, enter]);
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1 }}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) },
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
          ],
        }}
      >
        <LinearGradient
          colors={[c.hex, c.dark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: selected ? '#FDE68A' : 'rgba(255,255,255,0.5)', borderWidth: selected ? 3 : 1.5 }]}
        >
          <Ionicons name={c.icon} size={12} color="rgba(255,255,255,0.85)" style={styles.cornerTL} />
          <Ionicons name={c.icon} size={34} color="#fff" />
          <Ionicons name={c.icon} size={12} color="rgba(255,255,255,0.85)" style={styles.cornerBR} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Show, one round: everyone sits evenly round a table (me at the bottom). Each turn I pick a
 * card to pass to the next player (on my left); when all have picked, every card moves at once.
 * Four of one colour → SHOW; then everyone races to tap SHOW — the last one gets nothing.
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
  const active = state.players.filter((p) => p.active);
  const mePlayer = active.find((p) => p.userId === me.userId);
  const hand = me.hand ?? [];
  const shows = g.state.shows ?? [];
  const iShowed = shows.includes(me.userId);
  const canShow = (g.phase === 'pass' && isShowHand(hand)) || (g.phase === 'show' && !iShowed);
  const next = mePlayer ? nextSeatPlayer(active, mePlayer.seat) : undefined;
  const pickedCount = active.filter((p) => p.picked).length;

  // Which slots changed since the last turn (those cards slide in).
  const prevHand = useRef<number[]>(hand);
  const [freshSlots, setFreshSlots] = useState<number[]>([]);
  useEffect(() => {
    const prev = prevHand.current;
    const changed = hand.map((c, i) => (prev[i] !== c ? i : -1)).filter((i) => i >= 0);
    prevHand.current = hand;
    if (changed.length && changed.length < 4) setFreshSlots(changed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.turnNo, g.roundNo, hand.join(',')]);

  // SHOW button pulse when it's live.
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

  // The table
  const size = Math.min(width - spacing.lg * 2, 380);
  const radiusPx = size / 2 - SEAT / 2 - 4;
  const seats = mePlayer ? circleSeats(active, mePlayer.seat, radiusPx) : [];
  const nameOf = (id?: string) => state.players.find((p) => p.userId === id)?.name ?? '';

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
        {/* Felt table */}
        <LinearGradient colors={['#065F46', '#064E3B', '#022C22']} style={[styles.table, { width: size - SEAT, height: size - SEAT, borderRadius: size }]} />
        {/* Centre: turn / who showed + pass direction */}
        <View style={styles.centre} pointerEvents="none">
          {g.phase === 'show' && g.state.color !== undefined ? (
            <View style={[styles.showChip, { backgroundColor: showColor(g.state.color).hex }]}>
              <Ionicons name={showColor(g.state.color).icon} size={22} color="#fff" />
            </View>
          ) : (
            <Ionicons name="sync" size={26} color="rgba(253,230,138,0.85)" />
          )}
          <T variant="smallBold" color="#fff" center style={{ marginTop: 4, maxWidth: size * 0.5 }}>
            {centre}
          </T>
          {g.phase === 'pass' ? (
            <T variant="tiny" color="rgba(255,255,255,0.75)" center>
              {t('party.show.picked', { count: pickedCount, total: active.length })}
            </T>
          ) : null}
        </View>
        {seats.map(({ player: p, x, y }) => {
          const place = shows.indexOf(p.userId);
          const isMe = p.userId === me.userId;
          return (
            <View key={p.userId} style={[styles.seat, { left: size / 2 + x - SEAT / 2, top: size / 2 + y - SEAT / 2 }]}>
              <Avatar avatarKey={p.avatarKey} size={40} ring={isMe ? '#FDE68A' : p.userId === next?.userId ? '#22C55E' : undefined} />
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

      {/* Reveal: places and points */}
      {g.phase === 'reveal' ? (
        <Card style={{ marginTop: spacing.md, paddingVertical: spacing.sm }}>
          {[...(g.state.results ?? [])]
            .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
            .map((r) => {
              const p = state.players.find((x) => x.userId === r.userId);
              return (
                <Row key={r.userId} gap={spacing.sm} style={{ paddingVertical: 5 }}>
                  <T variant="smallBold" muted style={{ width: 34 }}>
                    {r.place ? ord(r.place) : '—'}
                  </T>
                  <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={28} />
                  <T variant="small" style={{ flex: 1 }} numberOfLines={1} color={r.userId === me.userId ? colors.primary : undefined}>
                    {p?.name ?? ''}
                  </T>
                  <T variant="smallBold" color={r.points > 0 ? colors.success : colors.error}>
                    +{r.points}
                  </T>
                </Row>
              );
            })}
        </Card>
      ) : (
        <>
          {/* Hint line */}
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

          {/* My hand */}
          <Row gap={spacing.sm} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.sm }}>
            {hand.map((c, i) => (
              <ColorCard
                key={i}
                color={c}
                selected={me.pick === i}
                fresh={freshSlots.includes(i)}
                disabled={g.phase !== 'pass'}
                onPress={() => onPick(i)}
              />
            ))}
          </Row>

          {/* SHOW */}
          <Animated.View
            style={{
              marginTop: spacing.lg,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            }}
          >
            <Pressable onPress={onShow} disabled={!canShow}>
              <LinearGradient
                colors={canShow ? ['#FFF1A8', '#F5B700', '#D97706'] : [colors.surfaceAlt, colors.surfaceAlt]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.showBtn, { borderColor: canShow ? '#B45309' : colors.border }]}
              >
                <Ionicons name="hand-left" size={24} color={canShow ? '#3B1D00' : colors.textMuted} />
                <T style={[styles.showText, { color: canShow ? '#3B1D00' : colors.textMuted }]}>{t('party.show.button')}</T>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    position: 'absolute',
    left: SEAT / 2,
    top: SEAT / 2,
    borderWidth: 6,
    borderColor: '#78350F',
  },
  centre: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  showChip: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  seat: { position: 'absolute', width: SEAT, alignItems: 'center' },
  seatName: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 13, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, borderRadius: 6, marginTop: 2, maxWidth: SEAT + 6 },
  badge: { position: 'absolute', right: 4, top: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  placeBadge: { backgroundColor: '#FDE68A', borderWidth: 1, borderColor: '#B45309' },
  placeText: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 12, color: '#3B1D00' },
  card: { height: 96, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cornerTL: { position: 'absolute', left: 6, top: 6 },
  cornerBR: { position: 'absolute', right: 6, bottom: 6, transform: [{ rotate: '180deg' }] },
  showBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 60, borderRadius: 30, borderWidth: 2 },
  showText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: 3 },
});
